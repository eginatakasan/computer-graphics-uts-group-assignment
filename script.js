import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";
import { enableCoordinatePicking } from "./cordinate-picker.js";
import {
  generateRoomFloorMesses,
  generateRoomWallMesses,
  generateRoomObjectMesses,
} from "./generate-mess.js";

let gameStarted = false;

let scene, camera, renderer, controls, mixer;
const animationActions = {};
let activeAction;
let currentHandsModel; // Renamed from boxModel
let handsGuiFolder; // To manage the GUI folder for hands
let gui;
let collidableObjects = [];
let antiCollidableObjects = [];
let interactableObjects = []; // To store objects that can be interacted with
let raycaster; // For detecting what the camera is looking at
let highlightedObject = null; // To keep track of the currently highlighted object
const INTERACTION_DISTANCE = 7; // Max distance to interact/highlight
const INTERACTION_DURATION = 5000; // 5 seconds in milliseconds
const ANIMATION_FADE_DURATION = 0.2; // Duration for animation crossfading

// Interaction state variables
let isInteracting = false;
let interactionStartTime = 0;
let interactionTarget = null;
let progressBarContainer, progressBarFill;

// Player constants
const PLAYER_HALF_HEIGHT = 2; // Player is 1.8 units tall

// Reusable Box3 instances for AABB collision
let playerWorldAABB = new THREE.Box3();
let wallWorldAABB = new THREE.Box3();

const placeableObjects = [];
const roomObjects = [];
const doorObjects = [];

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let clock = new THREE.Clock();

const settings = {
  moveSpeed: 5.0, // Units per second
  cameraBodyRadius: 0.7, // Half-width/depth of player's AABB. Name "Min Gap to Wall" in GUI is a bit misleading now.
  armProtrusion: 0.35, // How far arms stick out. NOTE: Not used in current AABB collision logic.
};

init();
animate();

function setupInteractableObjects() { }

function highlightObject(object) {
  if (!object || !object.material) return;

  const mat = object.material;

  // Case 1: emissive-supported material (e.g., MeshLambertMaterial)
  if ('emissive' in mat) {
    mat.userData = mat.userData || {};
    mat.userData.originalEmissive = mat.emissive.getHex();
    mat.emissive.setHex(0xffcc00); // yellow glow
  }
  // Case 2: fallback for basic materials
  else if ('color' in mat) {
    mat.userData = mat.userData || {};
    mat.userData.originalColor = mat.color.getHex();
    mat.color.setHex(0xff4444); // red tint
  }
}

function unhighlightObject(object) {
  if (!object || !object.material) return;

  const mat = object.material;
  const ud = mat.userData || {};

  if ('emissive' in mat && ud.originalEmissive !== undefined) {
    mat.emissive.setHex(ud.originalEmissive);
  } else if ('color' in mat && ud.originalColor !== undefined) {
    mat.color.setHex(ud.originalColor);
  }
}

function highlightWithColor(object) {
  if (object && object.material && object.material.color) {
    object.material.userData = object.material.userData || {};
    object.material.userData.originalColor = object.material.color.getHex();
    object.material.color.setHex(0xff4444); // red tint highlight
  }
}

function unhighlightWithColor(object) {
  if (object && object.material && object.material.color) {
    const originalColor = object.material.userData?.originalColor;
    if (originalColor !== undefined) {
      object.material.color.setHex(originalColor);
    }
  }
}

function handleObjectInteraction(objectType) {
  // This function is called when an interactable object is being looked at.
  // Add specific actions based on objectType here.
  console.log("Player is looking at:", objectType);
}

// function handleMessInteraction(target) {
//   const type = target.userData.object_type;

//   if (type === "swappable") {
//     const gltfLoader = new GLTFLoader();
//     const swapPath = target.userData.modelSwap;
//     const pos = target.userData.position || target.position;
//     const scale = target.userData.cleanScale || 0.5;
//     const groupToRemove = target.userData.parentGroup || target;

//     scene.remove(groupToRemove);

//     if (swapPath && swapPath.trim() !== "") {
//       gltfLoader.load(swapPath, (gltf) => {
//         const clean = gltf.scene;
//         clean.position.copy(pos);
//         clean.scale.setScalar(scale);
//         clean.rotation.y = Math.random() * Math.PI * 2;
//         scene.add(clean);
//       });
//     } else {
//       console.log(
//         `🧹 Removed mess '${target.userData.subtype}' with no clean model.`
//       );
//     }

//     console.log(`✅ Swapped ${target.userData.subtype} to clean model.`);
//   } else {
//     const groupToRemove = target.userData.ownerGroup || target;
//     scene.remove(groupToRemove);
//     console.log(`🧼 Removed ${type} mess from scene.`);
//   }
// }

function handleMessInteraction(target) {
  const type = target.userData.object_type;

  // Define the actual object that was added to interactableObjects
  const referenceToRemove = target.userData.ownerGroup || target.userData.parentGroup || target;

  // Remove from scene
  scene.remove(referenceToRemove);

  // Remove from interactables
  const index = interactableObjects.indexOf(target);
  if (index !== -1) {
    interactableObjects.splice(index, 1);
  }

  // Also check for proxy references like dust bunnies or others
  if (target.userData.ownerGroup) {
    const proxyIndex = interactableObjects.indexOf(target.userData.ownerGroup);
    if (proxyIndex !== -1) {
      interactableObjects.splice(proxyIndex, 1);
    }
  }

  if (type === "swappable") {
    const gltfLoader = new GLTFLoader();
    const swapPath = target.userData.modelSwap;
    const pos = target.userData.position || target.position;
    const scale = target.userData.cleanScale || 0.5;

    if (swapPath && swapPath.trim() !== "") {
      gltfLoader.load(swapPath, (gltf) => {
        const clean = gltf.scene;
        clean.position.copy(pos);
        clean.scale.setScalar(scale);
        clean.rotation.y = Math.random() * Math.PI * 2;
        scene.add(clean);
      });
    } else {
      console.log(`🧹 Removed mess '${target.userData.subtype}' with no clean model.`);
    }

    console.log(`✅ Swapped ${target.userData.subtype} to clean model.`);
  } else {
    console.log(`🧼 Removed ${type} mess from scene.`);
  }
}


function loadPositions(path) {
  fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to load scene: ${response.status} ${response.statusText}`
        );
      }
      return response.json();
    })
    .then((json) => {
      new THREE.ObjectLoader().parse(json, (object) => {
        object.traverse((child) => {
          if (child.name === "ground") {
            return;
          }
          child.traverse((c) => {
            if (c.name.includes("[placeableObject]")) {
              placeableObjects.push(c);
            } else if (c.name.includes("[Room]")) {
              roomObjects.push(c);
            } else if (c.name.includes("[Door]")) {
              doorObjects.push(c);
            }
          });
        });

        for (const room of roomObjects) {
          scene.add(room);
          room.traverse((child) => {
            if (child instanceof THREE.Mesh && child.name.includes("Wall")) {
              collidableObjects.push(child);
            }
          });
        }

        for (const door of doorObjects) {
          scene.add(door);
          antiCollidableObjects.push(door);

          door.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.transparent = true; // You'll likely want to set this to true for opacity to work as expected
              child.material.opacity = 0; // Adjust opacity as needed (0.0 to 1.0)
            }
          });
        }

        for (const placeableObject of placeableObjects) {
          scene.add(placeableObject);
          collidableObjects.push(placeableObject);
        }
      });

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      scene.add(new THREE.DirectionalLight(0xffffff, 0.7));
    })
    .catch((error) => {
      console.error("Error loading scene:", error);
    });
}

function loadHouse() {
  loadPositions("/positions/houseWithLights.json");
  console.log("House loaded", scene.children);

  //calling generate mess function here

  //object messes
  generateRoomObjectMesses(
    scene,
    "house",
    5,
    "mess-positions.json",
    interactableObjects
  );

  //single-bedroom
  generateRoomFloorMesses(
    scene,
    "single-bedroom",
    4,
    "mess-positions.json",
    interactableObjects
  );
  generateRoomWallMesses(
    scene,
    "single-bedroom",
    1,
    "mess-positions.json",
    interactableObjects
  );

  //living-room
  generateRoomFloorMesses(
    scene,
    "living-room",
    4,
    "mess-positions.json",
    interactableObjects
  );
  generateRoomWallMesses(
    scene,
    "living-room",
    2,
    "mess-positions.json",
    interactableObjects
  );

  //study
  generateRoomFloorMesses(
    scene,
    "study",
    2,
    "mess-positions.json",
    interactableObjects
  );
  generateRoomWallMesses(
    scene,
    "study",
    1,
    "mess-positions.json",
    interactableObjects
  );

  //toilet
  generateRoomFloorMesses(
    scene,
    "toilet",
    2,
    "mess-positions.json",
    interactableObjects
  );
  generateRoomWallMesses(
    scene,
    "toilet",
    3,
    "mess-positions.json",
    interactableObjects
  );

  //master
  generateRoomFloorMesses(
    scene,
    "master",
    3,
    "mess-positions.json",
    interactableObjects
  );
  generateRoomWallMesses(
    scene,
    "master",
    1,
    "mess-positions.json",
    interactableObjects
  );

  //kitchen
  generateRoomObjectMesses(
    scene,
    "kitchen",
    1,
    "mess-positions.json",
    interactableObjects
  );

  //corridor
  generateRoomFloorMesses(
    scene,
    "corridor",
    3,
    "mess-positions.json",
    interactableObjects
  );
}

function loadHandsModel(modelPath) {
  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    function (gltf) {
      currentHandsModel = gltf.scene;
      camera.add(currentHandsModel);

      // Default position and rotation, adjust as needed
      currentHandsModel.position.set(0, -1.72, -0.83);
      currentHandsModel.rotation.set(0.5, -Math.PI, 0); // Example rotation
      currentHandsModel.scale.set(1.1, 1.1, 1.1);

      currentHandsModel.traverse(function (child) {
        if (child.isMesh) {
          child.frustumCulled = false;
          child.castShadow = false;
        }
      });

      // Initialize AnimationMixer
      mixer = new THREE.AnimationMixer(currentHandsModel);

      // Store all animations
      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        animationActions[clip.name] = action;
      });

      // Play the first animation by default, or an 'idle' animation
      if (gltf.animations.length > 0) {
        activeAction = animationActions["Walk"]; // Or choose a specific "idle" animation
        activeAction.play();
      }

      console.log(`GLTF model '${modelPath}' loaded and added to camera.`);

      // Create GUI for the new model
      const modelNameForGui = modelPath.split("/").pop(); // e.g., "fp_arms.glb"
      handsGuiFolder = gui.addFolder(`Hands (${modelNameForGui})`);

      const posFolder = handsGuiFolder.addFolder("Position");
      posFolder.add(currentHandsModel.position, "x", -2, 2, 0.01).name("X");
      posFolder.add(currentHandsModel.position, "y", -2, 2, 0.01).name("Y");
      posFolder
        .add(currentHandsModel.position, "z", -2, 2, 0.01)
        .name("Z (front)");

      const rotFolder = handsGuiFolder.addFolder("Rotation");
      rotFolder
        .add(currentHandsModel.rotation, "x", -Math.PI, Math.PI, 0.01)
        .name("X (rad)");
      rotFolder
        .add(currentHandsModel.rotation, "y", -Math.PI, Math.PI, 0.01)
        .name("Y (rad)");
      rotFolder
        .add(currentHandsModel.rotation, "z", -Math.PI, Math.PI, 0.01)
        .name("Z (rad)");

      const scaleFolder = handsGuiFolder.addFolder("Scale");
      scaleFolder.add(currentHandsModel.scale, "x", 0.01, 2, 0.01).name("X");
      scaleFolder.add(currentHandsModel.scale, "y", 0.01, 2, 0.01).name("Y");
      scaleFolder.add(currentHandsModel.scale, "z", 0.01, 2, 0.01).name("Z");

      handsGuiFolder.open();
    },
    undefined,
    function (error) {
      console.error(
        `An error happened while loading GLTF model '${modelPath}':`,
        error
      );
    }
  );
}

function playTargetAnimation(
  animationName,
  loopOnce = false,
  crossfadeDuration = ANIMATION_FADE_DURATION
) {
  if (!mixer || !animationActions[animationName]) {
    console.warn(`Animation "${animationName}" not found or mixer not ready.`);
    return;
  }

  const targetAction = animationActions[animationName];

  if (activeAction && activeAction !== targetAction) {
    activeAction.fadeOut(crossfadeDuration);
  }

  targetAction.reset();
  if (loopOnce) {
    targetAction.setLoop(THREE.LoopOnce, 1);
    targetAction.clampWhenFinished = true;
  } else {
    targetAction.setLoop(THREE.LoopRepeat);
  }
  targetAction.fadeIn(crossfadeDuration).play();
  activeAction = targetAction;
}

function switchToDefaultAnimation(crossfadeDuration = ANIMATION_FADE_DURATION) {
  // Assuming "Walk" is the default animation
  if (!mixer || !animationActions["Walk"]) {
    console.warn("Default animation 'Walk' not found or mixer not ready.");
    // Fallback or ensure activeAction is at least stopped if it's a one-shot
    if (activeAction && activeAction.loop === THREE.LoopOnce) {
      activeAction.fadeOut(crossfadeDuration);
      // Optionally, try to find *any* looping animation if "Walk" is missing
    }
    return;
  }

  const walkAction = animationActions["Walk"];

  if (activeAction && activeAction !== walkAction) {
    activeAction.fadeOut(crossfadeDuration);
  }

  walkAction.reset().setLoop(THREE.LoopRepeat).fadeIn(crossfadeDuration).play();
  activeAction = walkAction;
}

function cancelInteraction() {
  isInteracting = false;
  interactionTarget = null;
  if (progressBarContainer) {
    progressBarContainer.style.display = "none";
  }
  if (progressBarFill) {
    progressBarFill.style.width = "0%";
  }
  switchToDefaultAnimation();
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.object);

  raycaster = new THREE.Raycaster();

  camera.position.set(4, PLAYER_HALF_HEIGHT + 0.1, 4);
  camera.lookAt(0, 0, 0);

  gui = new GUI();
  gui.add(settings, "moveSpeed", 0.1, 20, 0.1).name("Move Speed");
  gui
    .add(settings, "cameraBodyRadius", 0.05, 1.0, 0.01)
    .name("Min Gap to Wall");
  gui.add(settings, "armProtrusion", 0.0, 1.0, 0.01).name("Arm Protrusion");

  // Setup Start Modal button click
  const modal = document.getElementById("startModal");
  const messCounter = document.getElementById("messCounter");

  if (window.location.pathname.includes('game.html')) {
    document.getElementById("startGameBtn").addEventListener("click", () => {
      modal.style.display = "none";
      messCounter.style.display = "block";
      gameStarted = true;
      controls.lock(); // lock view
    });
  }

  // Progress Bar UI
  progressBarContainer = document.createElement("div");
  progressBarContainer.style.position = "fixed";
  progressBarContainer.style.bottom = "20%";
  progressBarContainer.style.left = "50%";
  progressBarContainer.style.transform = "translateX(-50%)";
  progressBarContainer.style.width = "200px";
  progressBarContainer.style.height = "20px";
  progressBarContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  progressBarContainer.style.border = "1px solid #fff";
  progressBarContainer.style.borderRadius = "5px";
  progressBarContainer.style.display = "none"; // Hidden by default
  progressBarContainer.style.zIndex = "101";
  document.body.appendChild(progressBarContainer);

  progressBarFill = document.createElement("div");
  progressBarFill.style.width = "0%";
  progressBarFill.style.height = "100%";
  progressBarFill.style.backgroundColor = "#4CAF50"; // Green
  progressBarFill.style.borderRadius = "4px";
  progressBarContainer.appendChild(progressBarFill);

  loadHouse();
  setupInteractableObjects();

  if (window.location.pathname.includes('game.html')) {
    setTimeout(() => {
      document.getElementById("messCounter").textContent = `Mess Counter: ${interactableObjects.length}`;
    }, 1000); // delay to ensure messes loaded  
  }
  // Load initial hands model
  loadHandsModel("fp_arms.glb");

  window.addEventListener("resize", onWindowResize, false);

  document.body.addEventListener("click", () => {
    if (!controls.isLocked) {
      controls.lock();
    }
  });

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  document.addEventListener("mousedown", (event) => {
    if (
      event.button === 0 &&
      controls.isLocked &&
      highlightedObject &&
      !isInteracting
    ) {
      isInteracting = true;
      interactionStartTime = performance.now();
      interactionTarget = highlightedObject;
      progressBarContainer.style.display = "block";
      progressBarFill.style.width = "0%";
      playTargetAnimation("Sprint_Type_1", false); // Play "Take" animation once
      event.stopPropagation();
    }
  });

  document.addEventListener("mouseup", (event) => {
    if (event.button === 0 && isInteracting) {
      cancelInteraction();
    }
  });

  controls.addEventListener("unlock", () => {
    if (isInteracting) {
      cancelInteraction();
    }
  });

  let pickingMode = { value: false }; // Shared reactive reference

  // Call coordinate picker with mode reference
  enableCoordinatePicking(scene, camera, controls, { modeRef: pickingMode });

  // Toggle on 'P' key press
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") {
      pickingMode.value = !pickingMode.value;
      console.log(
        `🖱️ Coordinate Picker Mode: ${pickingMode.value ? "ON" : "OFF"}`
      );
    }
  });

  if (window.location.pathname.includes('game.html')) {
    document.querySelector('.lil-gui')?.remove(); // Or gui.destroy();
  }
}

function onKeyDown(event) {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      moveForward = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      moveLeft = true;
      break;
    case "KeyS":
    case "ArrowDown":
      moveBackward = true;
      break;
    case "KeyD":
    case "ArrowRight":
      moveRight = true;
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      moveForward = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      moveLeft = false;
      break;
    case "KeyS":
    case "ArrowDown":
      moveBackward = false;
      break;
    case "KeyD":
    case "ArrowRight":
      moveRight = false;
      break;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  if (controls.isLocked === true) {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = INTERACTION_DISTANCE;

    const intersects = raycaster.intersectObjects(interactableObjects, false);

    let currentTarget = null;
    if (intersects.length > 0) {
      if (intersects[0].object.userData.isInteractable) {
        currentTarget = intersects[0].object;
      }
    }

    if (
      highlightedObject &&
      highlightedObject !== currentTarget &&
      !isInteracting
    ) {
      // unhighlightObject(highlightedObject);
      const mat = highlightedObject.material;
      if (mat && "emissive" in mat) {
        unhighlightObject(highlightedObject);
      } else {
        unhighlightWithColor(highlightedObject);
      }
      highlightedObject = null;
    }

    if (
      currentTarget &&
      currentTarget !== highlightedObject &&
      !isInteracting
    ) {
      // highlightObject(currentTarget);
      highlightedObject = currentTarget;
      const mat = currentTarget.material;
      if (mat && "emissive" in mat) {
        highlightObject(currentTarget); // your original emissive glow
      } else {
        highlightWithColor(currentTarget); // fallback for MeshBasicMaterial etc.
      }
      handleObjectInteraction(currentTarget.userData.object_type);
    } else if (!currentTarget && highlightedObject && !isInteracting) {
      // unhighlightObject(highlightedObject);
      const mat = highlightedObject.material;
      if (mat && "emissive" in mat) {
        unhighlightObject(highlightedObject);
      } else {
        unhighlightWithColor(highlightedObject);
      }
      highlightedObject = null;
    }

    if (isInteracting) {
      if (!controls.isLocked || highlightedObject !== interactionTarget) {
        cancelInteraction();
      } else {
        const elapsedTime = performance.now() - interactionStartTime;
        const progress = Math.min(elapsedTime / INTERACTION_DURATION, 1);
        progressBarFill.style.width = progress * 100 + "%";

        if (progress >= 1) {
          // handleClothesInteraction(currentTarget);
          handleMessInteraction(currentTarget);
          console.log("Interaction complete with:", interactionTarget.userData.object_type);

          // Update mess counter
          document.getElementById("messCounter").textContent = `Mess Counter: ${interactableObjects.length}`;

          // Note: cancelInteraction() will call switchToDefaultAnimation()
          cancelInteraction();
          highlightedObject = null;
        }
      }
    }

    const speedDelta = settings.moveSpeed * delta;

    const inputDirection = new THREE.Vector3(
      Number(moveRight) - Number(moveLeft),
      0,
      Number(moveBackward) - Number(moveForward)
    );

    if (inputDirection.lengthSq() > 0) {
      inputDirection.normalize();

      const worldVelocity = inputDirection
        .clone()
        .applyQuaternion(controls.object.quaternion)
        .multiplyScalar(speedDelta);

      const moveX = new THREE.Vector3(worldVelocity.x, 0, 0);
      if (worldVelocity.x !== 0 && !checkCollision(moveX)) {
        controls.object.position.add(moveX);
      }

      const moveZ = new THREE.Vector3(0, 0, worldVelocity.z);
      if (worldVelocity.z !== 0 && !checkCollision(moveZ)) {
        controls.object.position.add(moveZ);
      }
    }
  } else {
    if (highlightedObject && !isInteracting) {
      unhighlightObject(highlightedObject);
      highlightedObject = null;
    }
    if (isInteracting) {
      cancelInteraction();
    }
  }

  renderer.render(scene, camera);
}

function isInsideAntiCollision(playerTargetPosition) {
  const antiCollisionObject = antiCollidableObjects.find((obj) => {
    let objectBox;
    if (obj instanceof THREE.Mesh) {
      if (!obj.geometry.boundingBox) {
        obj.geometry.computeBoundingBox();
      }
      objectBox = obj.geometry.boundingBox
        .clone()
        .applyMatrix4(obj.matrixWorld);
    } else {
      objectBox = new THREE.Box3().setFromObject(obj);
    }

    // Check if player's position is inside the expanded box
    const isInside = objectBox.containsPoint(playerTargetPosition);

    if (isInside) {
      return true;
    }
    return false;
  });

  return !!antiCollisionObject;
}

function checkCollision(displacementVector) {
  const playerCurrentPosition = controls.object.position;
  const playerTargetPosition = playerCurrentPosition
    .clone()
    .add(displacementVector);

  const playerHalfSize = new THREE.Vector3(
    settings.cameraBodyRadius,
    PLAYER_HALF_HEIGHT,
    settings.cameraBodyRadius
  );
  playerWorldAABB.setFromCenterAndSize(
    playerTargetPosition,
    playerHalfSize.multiplyScalar(2)
  );

  if (isInsideAntiCollision(playerTargetPosition)) {
    return false;
  }

  for (const collidableObject of collidableObjects) {
    if (collidableObject instanceof THREE.Mesh) {
      if (collidableObject.updateWorldMatrix) {
        collidableObject?.updateWorldMatrix(true, false);
      }
      if (!collidableObject.geometry.boundingBox) {
        collidableObject.geometry.computeBoundingBox();
      }
      wallWorldAABB
        .copy(collidableObject.geometry.boundingBox)
        .applyMatrix4(collidableObject.matrixWorld);

      if (playerWorldAABB.intersectsBox(wallWorldAABB)) {
        return true;
      }
    } else if (collidableObject instanceof THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(collidableObject);

      if (playerWorldAABB.intersectsBox(box)) {
        return true;
      }
    }
  }
  return false;
}

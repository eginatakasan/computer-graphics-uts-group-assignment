import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";

let scene, camera, renderer, controls;
let currentHandsModel; // Renamed from boxModel
let handsGuiFolder; // To manage the GUI folder for hands
let gui;
let collidableObjects = [];
let interactableObjects = []; // To store objects that can be interacted with
let raycaster; // For detecting what the camera is looking at
let highlightedObject = null; // To keep track of the currently highlighted object
const INTERACTION_DISTANCE = 7; // Max distance to interact/highlight

// Player constants
const PLAYER_HALF_HEIGHT = 0.9; // Player is 1.8 units tall

// Reusable Box3 instances for AABB collision
let playerWorldAABB = new THREE.Box3();
let wallWorldAABB = new THREE.Box3();

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

// Store the path of the currently active model
let activeModelPath = "";
let previousActiveModelPath = ""; // To revert on load failure

// Button style constants
const ACTIVE_BUTTON_STYLE_ARMS1 = {
  backgroundColor: "#2e7d32",
  fontWeight: "bold",
  border: "2px solid white",
};
const INACTIVE_BUTTON_STYLE_ARMS1 = {
  backgroundColor: "#4caf50",
  fontWeight: "normal",
  border: "none",
};
const ACTIVE_BUTTON_STYLE_ARMS2 = {
  backgroundColor: "#006080",
  fontWeight: "bold",
  border: "2px solid white",
};
const INACTIVE_BUTTON_STYLE_ARMS2 = {
  backgroundColor: "#008cba",
  fontWeight: "normal",
  border: "none",
};

init();
animate();

// Helper function to create an interactable box
function createInteractableBox(size, color, position, objectType) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshLambertMaterial({ color: color });
  const box = new THREE.Mesh(geometry, material);
  box.position.copy(position);
  box.userData.object_type = objectType;
  box.userData.isInteractable = true;
  box.userData.originalEmissive = material.emissive.getHex(); // Store original emissive
  scene.add(box);
  interactableObjects.push(box);
  collidableObjects.push(box); // Also make them collidable
  return box;
}

// Helper function to create an interactable sphere
function createInteractableSphere(radius, color, position, objectType) {
  const geometry = new THREE.SphereGeometry(radius, 32, 16);
  const material = new THREE.MeshLambertMaterial({ color: color });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);
  sphere.userData.object_type = objectType;
  sphere.userData.isInteractable = true;
  sphere.userData.originalEmissive = material.emissive.getHex();
  scene.add(sphere);
  interactableObjects.push(sphere);
  collidableObjects.push(sphere); // Also make them collidable
  return sphere;
}

function setupInteractableObjects() {
  // Room 1 is centered around Z = -roomSize / 2 = -5
  // Floor is at Y = 0
  createInteractableBox(
    new THREE.Vector3(0.5, 0.5, 0.5), // size
    0x00ff00, // Green color
    new THREE.Vector3(2, 0.25, -3), // position (y = height/2)
    "health_pack" // object_type
  );
  createInteractableSphere(
    0.3, // radius
    0xff0000, // Red color
    new THREE.Vector3(-2, 0.3, -4), // position (y = radius)
    "ammo_box" // object_type
  );

  // Room 2 is centered around Z = roomSize / 2 = 5
  createInteractableBox(
    new THREE.Vector3(0.4, 0.8, 0.4), // size
    0x0000ff, // Blue color
    new THREE.Vector3(1, 0.4, 3.5), // position
    "quest_item_A" // object_type
  );
  createInteractableSphere(
    0.25, // radius
    0xffff00, // Yellow color
    new THREE.Vector3(-1.5, 0.25, 4.5), // position
    "info_panel" // object_type
  );
}

function highlightObject(object) {
  if (object && object.material && object.material.emissive) {
    object.material.emissive.setHex(0x777777); // A subtle gray highlight
  }
}

function unhighlightObject(object) {
  if (object && object.material && object.material.emissive) {
    object.material.emissive.setHex(
      object.userData.originalEmissive || 0x000000
    );
  }
}

function handleObjectInteraction(objectType) {
  // This function is called when an interactable object is being looked at.
  // Add specific actions based on objectType here.
  console.log("Player is looking at:", objectType);
}

function createWall(width, height, depth, color) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshLambertMaterial({ color: color });
  const wall = new THREE.Mesh(geometry, material);
  scene.add(wall);
  collidableObjects.push(wall);
  return wall;
}

function createFloor(width, depth, color) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshLambertMaterial({
    color: color,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
  scene.add(floor);
  return floor;
}

function setupRooms() {
  const roomSize = 10;
  const wallHeight = 3;
  const wallThickness = 0.2;
  const doorWidth = 2;
  const doorHeight = 2.2;

  const wallColor1 = 0xffaaaa;
  const wallColor2 = 0xaaffaa;
  const sharedWallColor = 0xaaaaff;
  const wallColor3 = 0xffffaa;
  const wallColor4 = 0xffaaff;

  const floorColor = 0x888888;

  const room1ZOffset = -roomSize / 2;

  const floor1 = createFloor(roomSize, roomSize, floorColor);
  floor1.position.set(0, 0, room1ZOffset);

  const wall1Back = createWall(
    roomSize + wallThickness,
    wallHeight,
    wallThickness,
    wallColor1
  );
  wall1Back.position.set(0, wallHeight / 2, room1ZOffset - roomSize / 2);

  const wall1Left = createWall(wallThickness, wallHeight, roomSize, wallColor2);
  wall1Left.position.set(-roomSize / 2, wallHeight / 2, room1ZOffset);

  const wall1Right = createWall(
    wallThickness,
    wallHeight,
    roomSize,
    wallColor2
  );
  wall1Right.position.set(roomSize / 2, wallHeight / 2, room1ZOffset);

  const frontWall1Part1Width = (roomSize - doorWidth) / 2;
  const wall1FrontLeft = createWall(
    frontWall1Part1Width,
    wallHeight,
    wallThickness,
    sharedWallColor
  );
  wall1FrontLeft.position.set(
    -(doorWidth / 2 + frontWall1Part1Width / 2),
    wallHeight / 2,
    room1ZOffset + roomSize / 2 - wallThickness / 2
  );

  const wall1FrontRight = createWall(
    frontWall1Part1Width,
    wallHeight,
    wallThickness,
    sharedWallColor
  );
  wall1FrontRight.position.set(
    doorWidth / 2 + frontWall1Part1Width / 2,
    wallHeight / 2,
    room1ZOffset + roomSize / 2 - wallThickness / 2
  );

  const wall1FrontAboveDoorHeight = wallHeight - doorHeight;
  const wall1FrontAboveDoor = createWall(
    doorWidth,
    wall1FrontAboveDoorHeight,
    wallThickness,
    sharedWallColor
  );
  wall1FrontAboveDoor.position.set(
    0,
    doorHeight + wall1FrontAboveDoorHeight / 2,
    room1ZOffset + roomSize / 2 - wallThickness / 2
  );

  const room2ZOffset = roomSize / 2;

  const floor2 = createFloor(roomSize, roomSize, floorColor);
  floor2.position.set(0, 0, room2ZOffset);

  const wall2Front = createWall(
    roomSize + wallThickness,
    wallHeight,
    wallThickness,
    wallColor4
  );
  wall2Front.position.set(0, wallHeight / 2, room2ZOffset + roomSize / 2);

  const wall2Left = createWall(wallThickness, wallHeight, roomSize, wallColor3);
  wall2Left.position.set(-roomSize / 2, wallHeight / 2, room2ZOffset);

  const wall2Right = createWall(
    wallThickness,
    wallHeight,
    roomSize,
    wallColor3
  );
  wall2Right.position.set(roomSize / 2, wallHeight / 2, room2ZOffset);
}

function updateArmSelectionUI() {
  const btnArms1 = document.getElementById("showFirstArms");
  const btnArms2 = document.getElementById("showSecondArms");

  if (!btnArms1 || !btnArms2) {
    console.warn("Arm selection buttons not found in DOM for UI update.");
    return;
  }

  // Apply inactive styles by default
  Object.assign(btnArms1.style, INACTIVE_BUTTON_STYLE_ARMS1);
  Object.assign(btnArms2.style, INACTIVE_BUTTON_STYLE_ARMS2);

  if (activeModelPath === "fp_arms.glb") {
    Object.assign(btnArms1.style, ACTIVE_BUTTON_STYLE_ARMS1);
  } else if (activeModelPath === "second_arms.glb") {
    Object.assign(btnArms2.style, ACTIVE_BUTTON_STYLE_ARMS2);
  }
}

function loadHandsModel(modelPath) {
  // If the requested model is already active and loaded, do nothing further.
  if (activeModelPath === modelPath && currentHandsModel) {
    updateArmSelectionUI(); // Ensure UI is consistent
    return;
  }

  previousActiveModelPath = activeModelPath; // Store current before attempting to load new
  activeModelPath = modelPath; // Tentatively set new active path

  // Remove existing model and its GUI folder if they exist
  if (currentHandsModel) {
    camera.remove(currentHandsModel);
    currentHandsModel = null;
  }
  if (handsGuiFolder) {
    handsGuiFolder.destroy();
    handsGuiFolder = null;
  }

  updateArmSelectionUI(); // Update UI to reflect the *attempt* to load.

  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    function (gltf) {
      currentHandsModel = gltf.scene;
      camera.add(currentHandsModel);

      // Default position and rotation, adjust as needed
      currentHandsModel.position.set(0, -0.36, -0.36);
      currentHandsModel.rotation.set(1, Math.PI, 0); // Example rotation

      if (modelPath === "second_arms.glb") {
        currentHandsModel.scale.set(0.01, 0.01, 0.01); // Adjust scale for second model
      }

      currentHandsModel.traverse(function (child) {
        if (child.isMesh) {
          child.frustumCulled = false;
        }
      });
      currentHandsModel.frustumCulled = false;

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
      // Revert to previous model path and update UI
      activeModelPath = previousActiveModelPath;
      console.log(
        `Reverted active model path to: ${activeModelPath || "none"}`
      );
      updateArmSelectionUI(); // Reflect that the attempted model is not active
    }
  );
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

  camera.position.set(1, PLAYER_HALF_HEIGHT + 0.1, 1);
  camera.lookAt(0, 0, 0);

  const axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);

  gui = new GUI();
  gui.add(settings, "moveSpeed", 0.1, 20, 0.1).name("Move Speed");
  gui
    .add(settings, "cameraBodyRadius", 0.05, 1.0, 0.01)
    .name("Min Gap to Wall");
  gui.add(settings, "armProtrusion", 0.0, 1.0, 0.01).name("Arm Protrusion");

  setupRooms();
  setupInteractableObjects();

  // Load initial hands model
  loadHandsModel("fp_arms.glb");

  // Event listeners for model switching buttons
  document.getElementById("showFirstArms").addEventListener("click", () => {
    if (activeModelPath !== "fp_arms.glb") {
      loadHandsModel("fp_arms.glb");
    }
  });
  document.getElementById("showSecondArms").addEventListener("click", () => {
    if (activeModelPath !== "second_arms.glb") {
      loadHandsModel("second_arms.glb"); // Make sure second_arms.glb exists
    }
  });

  window.addEventListener("resize", onWindowResize, false);

  document.body.addEventListener("click", () => {
    if (!controls.isLocked) {
      controls.lock();
    }
  });

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
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
    case "Digit1": // Key '1'
      if (activeModelPath !== "fp_arms.glb") {
        loadHandsModel("fp_arms.glb");
      }
      break;
    case "Digit2": // Key '2'
      if (activeModelPath !== "second_arms.glb") {
        loadHandsModel("second_arms.glb");
      }
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

    if (highlightedObject && highlightedObject !== currentTarget) {
      unhighlightObject(highlightedObject);
      highlightedObject = null;
    }

    if (currentTarget && currentTarget !== highlightedObject) {
      highlightObject(currentTarget);
      highlightedObject = currentTarget;
      handleObjectInteraction(currentTarget.userData.object_type);
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
    if (highlightedObject) {
      unhighlightObject(highlightedObject);
      highlightedObject = null;
    }
  }

  renderer.render(scene, camera);
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

  for (const wall of collidableObjects) {
    wall.updateWorldMatrix(true, false);
    if (!wall.geometry.boundingBox) {
      wall.geometry.computeBoundingBox();
    }
    wallWorldAABB
      .copy(wall.geometry.boundingBox)
      .applyMatrix4(wall.matrixWorld);

    if (playerWorldAABB.intersectsBox(wallWorldAABB)) {
      return true;
    }
  }
  return false;
}

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";

let scene, camera, renderer, controls;
let boxModel;
let gui;
let collidableObjects = [];

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

init();
animate();

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
        scene.add(object);
      });

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      scene.add(new THREE.DirectionalLight(0xffffff, 0.7));
    })
    .catch((error) => {
      console.error("Error loading scene:", error);
    });
}

function loadHouse() {
  loadPositions("/positions/house.json");
  console.log("House loaded", scene.children);
}

function setupRooms() {
  const roomSize = 10;
  const wallHeight = 3;
  const wallThickness = 0.2;
  const doorWidth = 2;
  const doorHeight = 2.2;

  // Define multiple wall colors
  const wallColor1 = 0xffaaaa; // Light red for room 1 back wall
  const wallColor2 = 0xaaffaa; // Light green for room 1 side walls
  const sharedWallColor = 0xaaaaff; // Light blue for the shared wall with door
  const wallColor3 = 0xffffaa; // Light yellow for room 2 side walls
  const wallColor4 = 0xffaaff; // Light purple for room 2 front wall

  const floorColor = 0x888888;

  // Room 1 (centered slightly in -Z)
  const room1ZOffset = -roomSize / 2;

  // Floor 1
  const floor1 = createFloor(roomSize, roomSize, floorColor);
  floor1.position.set(0, 0, room1ZOffset);

  // Walls for Room 1
  // Back wall (furthest -Z)
  const wall1Back = createWall(
    roomSize + wallThickness,
    wallHeight,
    wallThickness,
    wallColor1 // Use wallColor1
  );
  wall1Back.position.set(0, wallHeight / 2, room1ZOffset - roomSize / 2);

  // Left wall
  const wall1Left = createWall(wallThickness, wallHeight, roomSize, wallColor2); // Use wallColor2
  wall1Left.position.set(-roomSize / 2, wallHeight / 2, room1ZOffset);

  // Right wall
  const wall1Right = createWall(
    wallThickness,
    wallHeight,
    roomSize,
    wallColor2
  ); // Use wallColor2
  wall1Right.position.set(roomSize / 2, wallHeight / 2, room1ZOffset);

  // Front wall (shared wall, with doorway) - Part 1 (left of door)
  const frontWall1Part1Width = (roomSize - doorWidth) / 2;
  const wall1FrontLeft = createWall(
    frontWall1Part1Width,
    wallHeight,
    wallThickness,
    sharedWallColor // Use sharedWallColor
  );
  wall1FrontLeft.position.set(
    -(doorWidth / 2 + frontWall1Part1Width / 2),
    wallHeight / 2,
    room1ZOffset + roomSize / 2 - wallThickness / 2
  );

  // Front wall - Part 2 (right of door)
  const wall1FrontRight = createWall(
    frontWall1Part1Width,
    wallHeight,
    wallThickness,
    sharedWallColor // Use sharedWallColor
  );
  wall1FrontRight.position.set(
    doorWidth / 2 + frontWall1Part1Width / 2,
    wallHeight / 2,
    room1ZOffset + roomSize / 2 - wallThickness / 2
  );

  // Front wall - Part 3 (above door)
  const wall1FrontAboveDoorHeight = wallHeight - doorHeight;
  const wall1FrontAboveDoor = createWall(
    doorWidth,
    wall1FrontAboveDoorHeight,
    wallThickness,
    sharedWallColor // Use sharedWallColor
  );
  wall1FrontAboveDoor.position.set(
    0,
    doorHeight + wall1FrontAboveDoorHeight / 2,
    room1ZOffset + roomSize / 2 - wallThickness / 2
  );

  // Room 2 (centered slightly in +Z)
  const room2ZOffset = roomSize / 2;

  // Floor 2
  const floor2 = createFloor(roomSize, roomSize, floorColor);
  floor2.position.set(0, 0, room2ZOffset);

  // Walls for Room 2
  // Front wall (furthest +Z)
  const wall2Front = createWall(
    roomSize + wallThickness,
    wallHeight,
    wallThickness,
    wallColor4 // Use wallColor4
  );
  wall2Front.position.set(0, wallHeight / 2, room2ZOffset + roomSize / 2);

  // Left wall
  const wall2Left = createWall(wallThickness, wallHeight, roomSize, wallColor3); // Use wallColor3
  wall2Left.position.set(-roomSize / 2, wallHeight / 2, room2ZOffset);

  // Right wall
  const wall2Right = createWall(
    wallThickness,
    wallHeight,
    roomSize,
    wallColor3
  ); // Use wallColor3
  wall2Right.position.set(roomSize / 2, wallHeight / 2, room2ZOffset);

  // Back wall for Room 2 is the Front wall of Room 1 (already created with doorway)
  // No need to create it again, the doorway serves both.
}

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // PointerLockControls
  controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.object); // Add the rig to the scene

  camera.position.set(1, 1, 1);
  camera.lookAt(0, 0, 0); // Look at the origin

  // Add AxesHelper
  const axesHelper = new THREE.AxesHelper(2); // The number is the size of the axes
  scene.add(axesHelper);

  gui = new GUI();
  gui.add(settings, "moveSpeed", 0.1, 20, 0.1).name("Move Speed");
  gui
    .add(settings, "cameraBodyRadius", 0.05, 1.0, 0.01)
    .name("Min Gap to Wall");
  gui.add(settings, "armProtrusion", 0.0, 1.0, 0.01).name("Arm Protrusion");

  // setupRooms(); // Call to create the rooms

  loadHouse();

  // Load the first-person arms model
  const loader = new GLTFLoader();
  loader.load(
    "fp_arms.glb", // Path to your GLB file
    function (gltf) {
      boxModel = gltf.scene;
      camera.add(boxModel); // Add the model directly to the camera

      // Set initial transformations (relative to camera)
      boxModel.position.set(0, -0.36, -0.36); // Position: slightly right, down, and in front
      boxModel.rotation.set(1, Math.PI, 0); // Slight rotation, adjust as needed

      // Ensure the model and its children are not frustum culled
      boxModel.traverse(function (child) {
        if (child.isMesh) {
          child.frustumCulled = false;
        }
      });
      boxModel.frustumCulled = false;

      console.log("GLTF model 'fp_arms.glb' loaded and added to camera.");

      // --- Setup GUI controls for boxModel ---
      const handsFolder = gui.addFolder("Hands Model (Relative to Camera)");

      const posFolder = handsFolder.addFolder("Position");
      posFolder.add(boxModel.position, "x", -2, 2, 0.01).name("X");
      posFolder.add(boxModel.position, "y", -2, 2, 0.01).name("Y");
      posFolder.add(boxModel.position, "z", -2, 2, 0.01).name("Z (front)");

      const rotFolder = handsFolder.addFolder("Rotation");
      rotFolder
        .add(boxModel.rotation, "x", -Math.PI, Math.PI, 0.01)
        .name("X (rad)");
      rotFolder
        .add(boxModel.rotation, "y", -Math.PI, Math.PI, 0.01)
        .name("Y (rad)");
      rotFolder
        .add(boxModel.rotation, "z", -Math.PI, Math.PI, 0.01)
        .name("Z (rad)");

      const scaleFolder = handsFolder.addFolder("Scale");
      scaleFolder.add(boxModel.scale, "x", 0.01, 2, 0.01).name("X");
      scaleFolder.add(boxModel.scale, "y", 0.01, 2, 0.01).name("Y");
      scaleFolder.add(boxModel.scale, "z", 0.01, 2, 0.01).name("Z");

      handsFolder.open();
    },
    undefined, // onProgress callback (optional)
    function (error) {
      console.error("An error happened while loading the GLTF model:", error);
    }
  );

  // Handle window resize
  window.addEventListener("resize", onWindowResize, false);

  document.body.addEventListener("click", () => {
    if (!controls.isLocked) {
      controls.lock();
    }
  });

  // Keyboard event listeners for movement
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

  // Helper function to check for collision if player moves by displacementVector
  const checkCollision = (displacementVector) => {
    const playerCurrentPosition = controls.object.position;
    const playerTargetPosition = playerCurrentPosition
      .clone()
      .add(displacementVector);

    // Define player's AABB at the target position
    // Assumes cameraBodyRadius is the half-width/depth of the player
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
      // Ensure the wall's matrix is up to date for correct AABB calculation
      wall.updateWorldMatrix(true, false);
      if (!wall.geometry.boundingBox) {
        wall.geometry.computeBoundingBox(); // Should have been computed on creation ideally
      }
      wallWorldAABB
        .copy(wall.geometry.boundingBox)
        .applyMatrix4(wall.matrixWorld);

      if (playerWorldAABB.intersectsBox(wallWorldAABB)) {
        return true; // Collision detected
      }
    }
    return false; // No collision
  };

  const delta = clock.getDelta(); // Get time difference between frames

  if (controls.isLocked === true) {
    const speedDelta = settings.moveSpeed * delta;

    const inputDirection = new THREE.Vector3( // Local direction based on input
      Number(moveRight) - Number(moveLeft),
      0,
      Number(moveBackward) - Number(moveForward)
    );

    if (inputDirection.lengthSq() > 0) {
      // Only if there's input
      inputDirection.normalize();

      const worldVelocity = inputDirection
        .clone()
        .applyQuaternion(controls.object.quaternion)
        .multiplyScalar(speedDelta);

      // Attempt to move along X component of worldVelocity
      const moveX = new THREE.Vector3(worldVelocity.x, 0, 0);
      if (worldVelocity.x !== 0 && !checkCollision(moveX)) {
        controls.object.position.add(moveX);
      }

      // Attempt to move along Z component of worldVelocity
      // (Y component is not handled here as there's no vertical movement input yet)
      const moveZ = new THREE.Vector3(0, 0, worldVelocity.z);
      if (worldVelocity.z !== 0 && !checkCollision(moveZ)) {
        controls.object.position.add(moveZ);
      }
    }
  }

  renderer.render(scene, camera);
}

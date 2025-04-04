// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 8, 15);

// Renderer setup
const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

// Room dimensions
const roomWidth = 10;
const roomHeight = 4;
const roomDepth = 10;
const wallThickness = 0.2;

// Create rooms
function createRoom(x, z, roomType, floorColor) {
  const room = new THREE.Group();
  room.userData = { roomType: roomType };

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const floorMaterial = new THREE.MeshBasicMaterial({
    color: floorColor,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0, z);
  room.add(floor);

  // Create room identifier - text on the floor
  const roomLabel = document.createElement("canvas");
  roomLabel.width = 256;
  roomLabel.height = 256;
  const context = roomLabel.getContext("2d");
  context.fillStyle = "black";
  context.font = "Bold 40px Arial";
  context.textAlign = "center";
  context.fillText(roomType, 128, 128);

  const textTexture = new THREE.CanvasTexture(roomLabel);
  const textMaterial = new THREE.MeshBasicMaterial({
    map: textTexture,
    transparent: true,
  });
  const textGeometry = new THREE.PlaneGeometry(3, 3);
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.rotation.x = -Math.PI / 2;
  textMesh.position.set(x, 0.01, z);
  room.add(textMesh);

  // Walls
  const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });

  // Back wall (North)
  if (roomType === "Bedroom" || roomType === "Dining Room") {
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomWidth, roomHeight, wallThickness),
      wallMaterial
    );
    backWall.position.set(x, roomHeight / 2, z - roomDepth / 2);
    room.add(backWall);
  }

  // Front wall (South)
  if (roomType === "Bedroom" || roomType === "Living Room") {
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomWidth, roomHeight, wallThickness),
      wallMaterial
    );
    frontWall.position.set(x, roomHeight / 2, z + roomDepth / 2);
    room.add(frontWall);
  }

  // Left wall (West)
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, roomHeight, roomDepth),
    wallMaterial
  );
  leftWall.position.set(x - roomWidth / 2, roomHeight / 2, z);
  room.add(leftWall);

  // Right wall (East)
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, roomHeight, roomDepth),
    wallMaterial
  );
  rightWall.position.set(x + roomWidth / 2, roomHeight / 2, z);
  room.add(rightWall);

  scene.add(room);
  return room;
}

// Create doorways between rooms
function createDoorway(startRoom, endRoom, position) {
  const doorwayGeometry = new THREE.BoxGeometry(3, 3, 0.5);
  const doorwayMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black doorway
  const doorway = new THREE.Mesh(doorwayGeometry, doorwayMaterial);
  doorway.position.copy(position);
  doorway.userData = {
    isDoorway: true,
    connects: [startRoom.userData.roomType, endRoom.userData.roomType],
  };
  scene.add(doorway);
}

// Create rooms
const livingRoom = createRoom(0, 0, "Living Room", 0x90ee90); // Light green
const diningRoom = createRoom(0, -roomDepth, "Dining Room", 0xffd700); // Gold

// Create doorway - aligned with wall
createDoorway(
  livingRoom,
  diningRoom,
  new THREE.Vector3(0, 1.5, -roomDepth / 2)
);

// Function to create furniture
function createFurniture(geometry, color, x, y, z, name, roomType) {
  const material = new THREE.MeshBasicMaterial({ color: color });
  const furniture = new THREE.Mesh(geometry, material);
  furniture.position.set(x, y, z);
  furniture.name = name;
  furniture.userData = {
    selectable: true,
    originalColor: color,
    roomType: roomType,
  };
  scene.add(furniture);
  return furniture;
}

// Living Room Furniture
const sofaGeometry = new THREE.BoxGeometry(4, 1, 1.5);
createFurniture(sofaGeometry, 0x6495ed, -2, 0.5, 3, "Sofa", "Living Room");

const coffeeTableGeometry = new THREE.BoxGeometry(2, 0.5, 1);
createFurniture(
  coffeeTableGeometry,
  0x8b4513,
  0,
  0.25,
  1,
  "Coffee Table",
  "Living Room"
);

// Dining Room Furniture
const tableGeometry = new THREE.BoxGeometry(3, 0.5, 1.5);
createFurniture(
  tableGeometry,
  0x8b4513,
  0,
  0.25,
  -roomDepth,
  "Dining Table",
  "Dining Room"
);

const chairGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
createFurniture(
  chairGeometry,
  0xa0522d,
  -1,
  0.3,
  -roomDepth - 1,
  "Chair 1",
  "Dining Room"
);
createFurniture(
  chairGeometry,
  0xa0522d,
  1,
  0.3,
  -roomDepth - 1,
  "Chair 2",
  "Dining Room"
);
createFurniture(
  chairGeometry,
  0xa0522d,
  -1,
  0.3,
  -roomDepth + 1,
  "Chair 3",
  "Dining Room"
);
createFurniture(
  chairGeometry,
  0xa0522d,
  1,
  0.3,
  -roomDepth + 1,
  "Chair 4",
  "Dining Room"
);

// No bedroom furniture

// Create character
const characterGeometry = new THREE.BoxGeometry(0.5, 1.7, 0.5);
const characterMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red character
const character = new THREE.Mesh(characterGeometry, characterMaterial);
character.position.set(0, 0.85, 4); // Start in the living room
scene.add(character);

// Third-person camera setup
const cameraOffset = new THREE.Vector3(0, 5, 8); // Camera offset from character
let currentRoomType = "Living Room";
document.getElementById(
  "room-info"
).textContent = `Current Room: ${currentRoomType}`;

// Interaction variables
let isDragging = false;
let isRightDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let selectedObject = null;
let isMovingObject = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersectionPoint = new THREE.Vector3();
const offset = new THREE.Vector3();
const selectorInfo = document.getElementById("selector-info");

// Character movement
const moveSpeed = 0.15;
const keys = { w: false, a: false, s: false, d: false };
const characterDirection = new THREE.Vector3(0, 0, -1);
let characterRotation = 0;

// Keyboard event handlers
function onKeyDown(event) {
  if (event.key.toLowerCase() === "w") keys.w = true;
  if (event.key.toLowerCase() === "a") keys.a = true;
  if (event.key.toLowerCase() === "s") keys.s = true;
  if (event.key.toLowerCase() === "d") keys.d = true;

  // Press G to grab and move selected object
  if (event.key === "g" && selectedObject && !isMovingObject) {
    isMovingObject = true;
    selectorInfo.textContent = `Moving: ${selectedObject.name}`;

    // Create a reference point for the offset
    mouse.x = (previousMousePosition.x / window.innerWidth) * 2 - 1;
    mouse.y = -(previousMousePosition.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(intersectionPlane, intersectionPoint)) {
      offset.copy(intersectionPoint).sub(selectedObject.position);
    }
  }
}

function onKeyUp(event) {
  if (event.key.toLowerCase() === "w") keys.w = false;
  if (event.key.toLowerCase() === "a") keys.a = false;
  if (event.key.toLowerCase() === "s") keys.s = false;
  if (event.key.toLowerCase() === "d") keys.d = false;

  if (event.key === "g" && isMovingObject) {
    isMovingObject = false;
    selectorInfo.textContent = `Selected: ${
      selectedObject ? selectedObject.name : "None"
    }`;
  }
}

// Mouse event handlers
function onMouseDown(event) {
  if (event.button === 0) {
    // Left mouse button
    isDragging = true;

    // Check if we're clicking on an object
    if (!isMovingObject) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children);

      // Deselect previous object
      if (selectedObject) {
        selectedObject.material.color.setHex(
          selectedObject.userData.originalColor
        );
      }

      selectedObject = null;
      selectorInfo.textContent = "No object selected";

      // Select new object
      for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;

        if (obj.userData && obj.userData.selectable) {
          selectedObject = obj;

          // Highlight the selected object
          selectedObject.material.color.setHex(0xff0000);

          selectorInfo.textContent = `Selected: ${selectedObject.name}`;
          break;
        }
      }
    }
  } else if (event.button === 2) {
    // Right mouse button
    isRightDragging = true;
  }

  previousMousePosition = {
    x: event.clientX,
    y: event.clientY,
  };
}

function onMouseMove(event) {
  if (isMovingObject && selectedObject) {
    // Convert mouse position to normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster
    raycaster.setFromCamera(mouse, camera);

    // Find the intersection with the floor plane
    if (raycaster.ray.intersectPlane(intersectionPlane, intersectionPoint)) {
      // Move the object to the new position, considering the offset
      selectedObject.position.copy(intersectionPoint.sub(offset));
    }
  } else if (isDragging) {
    // Calculate the movement delta
    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    // Rotate the camera horizontally around the character
    const rotateSpeed = 0.01;
    cameraOffset.x =
      Math.cos(deltaX * rotateSpeed) * cameraOffset.x -
      Math.sin(deltaX * rotateSpeed) * cameraOffset.z;
    cameraOffset.z =
      Math.sin(deltaX * rotateSpeed) * cameraOffset.x +
      Math.cos(deltaX * rotateSpeed) * cameraOffset.z;

    // Adjust camera height with left mouse as well
    cameraOffset.y += deltaY * 0.05;
    cameraOffset.y = Math.max(3, Math.min(10, cameraOffset.y));
  }
  // Removed the isRightDragging condition as right mouse button should have no effect

  previousMousePosition = {
    x: event.clientX,
    y: event.clientY,
  };
}

function onMouseUp(event) {
  if (event.button === 0) {
    isDragging = false;
  } else if (event.button === 2) {
    isRightDragging = false;
  }
}

function onWheel(event) {
  // Adjust zoom by scaling the camera offset
  const zoomSpeed = 0.1;
  const zoomFactor = 1 + Math.sign(event.deltaY) * zoomSpeed;

  cameraOffset.multiplyScalar(zoomFactor);

  // Limit zoom range
  const distance = cameraOffset.length();
  if (distance < 5) {
    cameraOffset.normalize().multiplyScalar(5);
  } else if (distance > 15) {
    cameraOffset.normalize().multiplyScalar(15);
  }
}

// Check which room the character is in
function checkCurrentRoom() {
  // Simple check based on position
  if (character.position.z < -roomDepth / 2) {
    if (currentRoomType !== "Dining Room") {
      currentRoomType = "Dining Room";
      document.getElementById(
        "room-info"
      ).textContent = `Current Room: ${currentRoomType}`;
    }
  } else {
    if (currentRoomType !== "Living Room") {
      currentRoomType = "Living Room";
      document.getElementById(
        "room-info"
      ).textContent = `Current Room: ${currentRoomType}`;
    }
  }
}

// Event listeners
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
canvas.addEventListener("mousedown", onMouseDown);
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("mouseup", onMouseUp);
window.addEventListener("wheel", onWheel);

// Prevent context menu on right-click
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Handle character movement
  const moveVector = new THREE.Vector3(0, 0, 0);

  if (keys.w) moveVector.z -= moveSpeed;
  if (keys.s) moveVector.z += moveSpeed;
  if (keys.a) moveVector.x -= moveSpeed;
  if (keys.d) moveVector.x += moveSpeed;

  // Only update if there's movement
  if (moveVector.length() > 0) {
    character.position.add(moveVector);

    // Simple boundary checks to stay within rooms
    character.position.x = Math.max(
      -roomWidth / 2 + 0.5,
      Math.min(roomWidth / 2 - 0.5, character.position.x)
    );
    character.position.z = Math.max(
      -roomDepth * 1.5 + 0.5,
      Math.min(roomDepth / 2 - 0.5, character.position.z)
    );

    // Check which room we're in
    checkCurrentRoom();
  }

  // Update camera position to follow character
  camera.position.copy(character.position).add(cameraOffset);
  camera.lookAt(character.position);

  renderer.render(scene, camera);
}

animate();

import * as THREE from "three";
import { loadModelAtGroundLevel } from "./loader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { TWO_SEATER_COUCH, FLOOR_LAMP } from "../public/models";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export const RoomConstructor = (gltfLoader: GLTFLoader) => {
  function createRoom(
    roomType: string,
    x: number,
    z: number,
    roomDimensions: { width: number; height: number; depth: number }
  ) {
    const wallThickness = 0.2;
    const roomHeight = 4;
    const roomDepth = 10;

    const room = new THREE.Group();
    room.userData = { roomType: roomType };

    const { width, height, depth } = roomDimensions;

    // Walls
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xff50aa });

    // Back wall (North)
    if (roomType === "Bedroom" || roomType === "Dining Room") {
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, wallThickness),
        wallMaterial
      );
      backWall.position.set(x, roomHeight / 2, z - roomDepth / 2);
      room.add(backWall);
    }

    // Front wall (South)
    if (roomType === "Bedroom" || roomType === "Living Room") {
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, wallThickness),
        wallMaterial
      );
      frontWall.position.set(x, roomHeight / 2, z + roomDepth / 2);
      room.add(frontWall);
    }

    // Left wall (West)
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      wallMaterial
    );
    leftWall.position.set(x - width / 2, height / 2, z);
    room.add(leftWall);

    // Right wall (East)
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      wallMaterial
    );
    rightWall.position.set(x + width / 2, height / 2, z);
    room.add(rightWall);

    return room;
  }

  function createLivingRoom() {
    const width = 50;
    const depth = 50;
    const x = 0;
    const z = 0;
    const livingRoom = createRoom("Living Room", x, z, {
      width,
      height: 4,
      depth,
    });

    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x8b4513,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0, z);
    livingRoom.add(floor);

    loadModelAtGroundLevel(
      gltfLoader,
      TWO_SEATER_COUCH,
      livingRoom,
      new THREE.Vector3(0, 0, 0)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      FLOOR_LAMP,
      livingRoom,
      new THREE.Vector3(2.5, 0, 0)
    );

    return livingRoom;
  }

  return { createRoom, createLivingRoom };
};

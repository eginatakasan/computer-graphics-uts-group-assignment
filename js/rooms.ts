import * as THREE from "three";
import { loadLightsAtGroundLevel, loadModelAtGroundLevel } from "./loader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import {
  TWO_SEATER_COUCH,
  FLOOR_LAMP,
  THREE_SEATER_COUCH,
  CLUB_ARM_CHAIR,
  ROUNDED_COFFEE_TABLE,
  FIREPLACE,
  LARGE_BOOK_SHELF,
} from "../public/models";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const wallThickness = 0.2;
const roomHeight = 12;

export const RoomConstructor = (
  gltfLoader: GLTFLoader,
  textureLoader: THREE.TextureLoader
) => {
  function createRoom(
    roomType: string,
    position: THREE.Vector3,
    roomDimensions: { width: number; length: number },
    wallMaterial: THREE.Material,
    floorMaterial: THREE.Material
  ) {
    const room = new THREE.Group();
    room.userData = { roomType: roomType };

    const { width, length } = roomDimensions;

    const floorGeometry = new THREE.PlaneGeometry(width, length);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(position.x, 0, position.z);
    room.add(floor);

    // Front wall (South)
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, roomHeight, wallThickness),
      wallMaterial
    );
    frontWall.position.set(position.x, roomHeight / 2, position.z + length / 2);
    room.add(frontWall);

    // Front wall (South)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, roomHeight, wallThickness),
      wallMaterial
    );
    backWall.position.set(position.x, roomHeight / 2, position.z - length / 2);
    room.add(backWall);

    // Left wall (West)
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, roomHeight, length),
      wallMaterial
    );
    leftWall.position.set(position.x - width / 2, roomHeight / 2, position.z);
    room.add(leftWall);

    // Right wall (East)
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, roomHeight, length),
      wallMaterial
    );
    rightWall.position.set(position.x + width / 2, roomHeight / 2, position.z);
    room.add(rightWall);

    return room;
  }

  function createLivingRoom(position: THREE.Vector3) {
    const width = 30;
    const length = 35;

    // repeat texture
    const leafyTexture = textureLoader.load(
      "./textures/carioca.jpg",
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(6, 2);
      }
    );
    const wallMaterial = new THREE.MeshLambertMaterial({ map: leafyTexture });

    const woodTexture = textureLoader.load("./textures/dark-wood.jpg");
    woodTexture.repeat.set(0, 1);
    const floorMaterial = new THREE.MeshLambertMaterial({
      map: woodTexture,
    });
    const livingRoom = createRoom(
      "Living Room",
      position,
      {
        width,
        length,
      },
      wallMaterial,
      floorMaterial
    );

    const cameralight = new THREE.PointLight(new THREE.Color(1, 1, 1), 10);
    cameralight.position.set(0, 5, 0);
    cameralight.visible = true;
    livingRoom.add(cameralight);

    loadModelAtGroundLevel(
      gltfLoader,
      TWO_SEATER_COUCH,
      livingRoom,
      new THREE.Vector3(position.x, 0, position.z)
    );
    loadLightsAtGroundLevel(
      gltfLoader,
      FLOOR_LAMP,
      livingRoom,
      new THREE.Vector3(position.x + 5, 0, position.z)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      ROUNDED_COFFEE_TABLE,
      livingRoom,
      new THREE.Vector3(position.x, 0, position.z + 5)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      CLUB_ARM_CHAIR,
      livingRoom,
      new THREE.Vector3(position.x - 5, 0, position.z + 5),
      new THREE.Matrix4().makeRotationY(Math.PI / 2)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      CLUB_ARM_CHAIR,
      livingRoom,
      new THREE.Vector3(position.x + 5, 0, position.z + 5),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      FIREPLACE,
      livingRoom,
      new THREE.Vector3(position.x, 0, position.z + length / 2 - 1.7),
      new THREE.Matrix4().makeRotationY(-Math.PI)
    );

    loadModelAtGroundLevel(
      gltfLoader,
      LARGE_BOOK_SHELF,
      livingRoom,
      new THREE.Vector3(
        position.x + length / 2 - 3.5,
        0,
        position.z + length / 2 - 6
      ),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      LARGE_BOOK_SHELF,
      livingRoom,
      new THREE.Vector3(
        position.x + length / 2 - 3.5,
        0,
        position.z + length / 2 - 17
      ),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      LARGE_BOOK_SHELF,
      livingRoom,
      new THREE.Vector3(
        position.x + length / 2 - 3.5,
        0,
        position.z + length / 2 - 28
      ),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );

    loadModelAtGroundLevel(
      gltfLoader,
      LARGE_BOOK_SHELF,
      livingRoom,
      new THREE.Vector3(
        position.x - length / 2 + 3,
        0,
        position.z - length / 2 + 6
      ),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      LARGE_BOOK_SHELF,
      livingRoom,
      new THREE.Vector3(
        position.x - length / 2 + 3,
        0,
        position.z - length / 2 + 17
      ),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );
    loadModelAtGroundLevel(
      gltfLoader,
      LARGE_BOOK_SHELF,
      livingRoom,
      new THREE.Vector3(
        position.x - length / 2 + 3,
        0,
        position.z - length / 2 + 28
      ),
      new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    );

    return livingRoom;
  }

  return { createRoom, createLivingRoom };
};

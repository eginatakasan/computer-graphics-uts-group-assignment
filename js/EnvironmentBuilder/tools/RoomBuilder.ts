import * as THREE from "three";
import { StateManager } from "../core/StateManager";

const wallHeight = 3;
const wallThickness = 0.1;

export class RoomBuilder {
  private scene: THREE.Scene;
  private stateManager: StateManager;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private roomStartPoint: THREE.Vector2 = new THREE.Vector2();
  private currentRoom: THREE.Group | null = null;
  private canvas: HTMLCanvasElement;
  private placedObjects: THREE.Object3D[] = [];

  constructor(stateManager: StateManager) {
    this.scene = stateManager.scene;
    this.camera = stateManager.camera;
    this.stateManager = stateManager;
    this.canvas = document.querySelector("canvas");
    this.placedObjects = stateManager.placedObjects;
  }

  public startBuildingRoom(clientX: number, clientY: number): void {
    this.stateManager.setBuildingRoom(true);
    console.log("Mouse down", clientX, clientY);
    this.roomStartPoint.set(clientX, clientY);

    // Create initial preview room
    this.currentRoom = this.createRoom(
      this.roomStartPoint,
      this.roomStartPoint,
      true
    );
    this.scene.add(this.currentRoom);
  }

  public updateRoomPreview(clientX: number, clientY: number): void {
    if (this.stateManager.getBuildingRoom() && this.currentRoom) {
      // Update preview room
      this.scene.remove(this.currentRoom);
      const currentPoint = new THREE.Vector2(clientX, clientY);
      this.currentRoom = this.createRoom(
        this.roomStartPoint,
        currentPoint,
        true
      );
      this.scene.add(this.currentRoom);
    }
  }

  public finishBuildingRoom(clientX: number, clientY: number): void {
    if (this.stateManager.getBuildingRoom() && this.currentRoom) {
      console.log("Mouse up", clientX, clientY);
      // Remove preview room
      this.scene.remove(this.currentRoom);

      // Create final room
      const endPoint = new THREE.Vector2(clientX, clientY);
      const finalRoom = this.createRoom(this.roomStartPoint, endPoint, false);
      this.scene.add(finalRoom);
      this.placedObjects.push(finalRoom);

      this.stateManager.setBuildingRoom(false);
      this.currentRoom = null;
    }
  }

  public cleanupRoomPreview(): void {
    if (this.currentRoom) {
      this.scene.remove(this.currentRoom);
      this.currentRoom = null;
    }
  }

  private createRoom(
    startPoint: THREE.Vector2,
    endPoint: THREE.Vector2,
    isPreview: boolean = false
  ): THREE.Group {
    const room = new THREE.Group();
    room.name = "room";

    // Convert screen coordinates to world coordinates
    const startWorld = this.screenToWorld(startPoint.x, startPoint.y);
    const endWorld = this.screenToWorld(endPoint.x, endPoint.y);

    // Calculate dimensions
    const width = endWorld.x - startWorld.x - 0.1;
    const depth = endWorld.z - startWorld.z - 0.1;
    const height = wallHeight; // Standard room height

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: isPreview ? 0x00ff00 : 0x000000,
      opacity: 1,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.name = "floor";
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(
      (startWorld.x + endWorld.x) / 2,
      0,
      (startWorld.z + endWorld.z) / 2
    );
    room.add(floor);

    // Create walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: isPreview ? 0x00ff00 : 0x000000,
      opacity: 1,
    });

    // Front wall
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      wallMaterial
    );
    frontWall.name = "frontWall";
    frontWall.position.set(startWorld.x + width / 2, height / 2, startWorld.z);
    room.add(frontWall);

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      wallMaterial
    );
    backWall.position.set(
      startWorld.x + width / 2,
      height / 2,
      startWorld.z + depth
    );
    backWall.name = "backWall";
    room.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      wallMaterial
    );
    leftWall.position.set(startWorld.x, height / 2, startWorld.z + depth / 2);
    leftWall.name = "leftWall";
    room.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      wallMaterial
    );
    rightWall.position.set(
      startWorld.x + width,
      height / 2,
      startWorld.z + depth / 2
    );
    rightWall.name = "rightWall";
    room.add(rightWall);

    return room;
  }

  private screenToWorld(screenX: number, screenY: number): THREE.Vector3 {
    // Convert screen coordinates to normalized device coordinates (-1 to +1)
    const ndc = new THREE.Vector2(
      (screenX / this.canvas.clientWidth) * 2 - 1,
      -(screenY / this.canvas.clientHeight) * 2 + 1
    );

    // Create a ray from the camera
    this.raycaster.setFromCamera(ndc, this.camera);

    // Create a plane at y=0 (ground plane)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0.4, 0), 0);

    // Find intersection point
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersectionPoint);
    intersectionPoint.x = Math.round(intersectionPoint.x / 2) * 2;
    intersectionPoint.z = Math.round(intersectionPoint.z / 2) * 2;

    return intersectionPoint;
  }
}

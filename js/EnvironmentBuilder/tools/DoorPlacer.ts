import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { StateManager } from "../core/StateManager";
import { DOOR } from "../../../public/models";
import { Object3D } from "three";
import { Object3DEventMap } from "three";
import { Intersection } from "three";

const doorWidth = 1.2;
const doorHeight = 2.5;
const wallThickness = 0.1;

export class DoorPlacer {
  private scene: THREE.Scene;
  private stateManager: StateManager;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private canvas: HTMLCanvasElement;
  private doorModel: THREE.Group | null = null;
  private previewDoor: THREE.Group | null = null;
  private placedObjects: THREE.Object3D[] = [];
  private loader: GLTFLoader;

  constructor(stateManager: StateManager) {
    this.scene = stateManager.scene;
    this.camera = stateManager.camera;
    this.stateManager = stateManager;
    this.canvas = document.querySelector("canvas");
    this.placedObjects = stateManager.placedObjects;
    this.loader = new GLTFLoader();

    this.loadDoorModel();
  }

  private async loadDoorModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(DOOR);
      this.doorModel = this.transformModel(gltf.scene, 0.8);
    } catch (error) {
      console.error("Error loading door model:", error);
    }
  }

  private transformModel(
    model: THREE.Group<THREE.Object3DEventMap>,
    scale: number
  ): THREE.Group<THREE.Object3DEventMap> {
    const box = new THREE.Box3().setFromObject(model);
    var sca = new THREE.Matrix4();
    var tra = new THREE.Matrix4();

    sca.makeScale(scale, scale, scale);
    box.applyMatrix4(sca);
    tra.makeTranslation(0, -box.min.y, 0);

    var combinedTransform = new THREE.Matrix4();
    combinedTransform.multiply(tra);
    combinedTransform.multiply(sca);

    model.applyMatrix4(combinedTransform);
    return model;
  }

  public setupDoorPlacement(): void {
    if (!this.doorModel) return;

    // Create preview door
    this.previewDoor = this.doorModel.clone();
    this.previewDoor.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.5;
      }
    });
    this.scene.add(this.previewDoor);
  }

  public cleanupDoorPlacement(): void {
    if (this.previewDoor) {
      this.scene.remove(this.previewDoor);
      this.previewDoor = null;
    }
  }

  public handleDoorPreview = (event: MouseEvent): void => {
    if (!this.previewDoor || !this.doorModel) return;

    const mouse = new THREE.Vector2(
      (event.clientX / this.canvas.clientWidth) * 2 - 1,
      -(event.clientY / this.canvas.clientHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    for (const intersect of intersects) {
      const wall = intersect.object;
      if (wall.name.includes("Wall")) {
        // Position door at intersection point but keep y at 0
        const position = new THREE.Vector3(
          Math.round(intersect.point.x / 2) * 2,
          0, // Set y to ground level
          Math.round(intersect.point.z / 2) * 2
        );
        this.previewDoor.position.copy(position);

        // Align door with wall
        const wallNormal = intersect.face?.normal;
        if (wallNormal) {
          this.previewDoor.lookAt(
            position.x + wallNormal.x,
            position.y + wallNormal.y,
            position.z + wallNormal.z
          );
        }
        break;
      }
    }
  };

  public handleDoorPlacement = (event: MouseEvent): void => {
    if (!this.doorModel) return;

    const mouse = new THREE.Vector2(
      (event.clientX / this.canvas.clientWidth) * 2 - 1,
      -(event.clientY / this.canvas.clientHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    var intersectedWalls: Intersection<Object3D<Object3DEventMap>>[] | null =
      [];
    intersects.find((intersect) => {
      if (intersect.object.name.includes("Wall")) {
        if (intersectedWalls.length <= 2) {
          intersectedWalls.push(intersect);
          if (intersectedWalls.length === 2) {
            return true;
          }
        }
      }
    });

    if (intersectedWalls.length === 0) {
      return;
    }

    const wall = intersectedWalls[0];
    // Create new door instance
    const door = this.doorModel.clone();
    // Position door at intersection point but keep y at 0
    const position = new THREE.Vector3(
      Math.round(wall.point.x / 2) * 2,
      0, // Set y to ground level
      Math.round(wall.point.z / 2) * 2
    );
    door.position.copy(position);

    // Align door with wall
    const wallNormal = wall.face?.normal;
    if (wallNormal) {
      door.lookAt(
        position.x + wallNormal.x,
        position.y + wallNormal.y,
        position.z + wallNormal.z
      );
    }

    this.scene.add(door);
    this.placedObjects.push(door);

    for (const intersection of intersectedWalls) {
      // Create hole in the wall
      this.makeAHole(intersection.object as THREE.Mesh, position);
    }
  };

  private makeAHole(wall: THREE.Mesh, position: THREE.Vector3): void {
    const isFrontOrBackWall =
      wall.name.includes("front") || wall.name.includes("back");

    // Store the current material properties
    const currentMaterial = wall.clone().material as THREE.MeshStandardMaterial;
    const currentTexture = currentMaterial.map;

    // Create a shape for the wall
    const wallBox = new THREE.Box3().setFromObject(wall);
    const wallSize = wallBox.getSize(new THREE.Vector3());
    const wallWidth = isFrontOrBackWall ? wallSize.x : wallSize.z;
    const wallHeight = wallSize.y;

    const shape = new THREE.Shape();
    shape.moveTo(-wallWidth / 2, wallHeight / 2);
    shape.lineTo(-wallWidth / 2, -wallHeight / 2);
    shape.lineTo(wallWidth / 2, -wallHeight / 2);
    shape.lineTo(wallWidth / 2, wallHeight / 2);
    shape.lineTo(-wallWidth / 2, wallHeight / 2);

    // Convert door position to wall's local space
    const doorPosition = position.clone();
    wall.worldToLocal(doorPosition);

    // Create hole path
    const hole = new THREE.Path();
    const holeWidth = doorWidth - wallThickness;
    const holeHeight = doorHeight - wallThickness;

    // Position hole at ground level (y=0)
    const holeX = isFrontOrBackWall ? doorPosition.x : doorPosition.z;
    const holeY = -wallHeight / 2 + holeHeight / 2; // This centers the hole vertically at ground level

    hole.moveTo(holeX - holeWidth / 2, holeY + holeHeight / 2);
    hole.lineTo(holeX - holeWidth / 2, holeY - holeHeight / 2);
    hole.lineTo(holeX + holeWidth / 2, holeY - holeHeight / 2);
    hole.lineTo(holeX + holeWidth / 2, holeY + holeHeight / 2);
    hole.lineTo(holeX - holeWidth / 2, holeY + holeHeight / 2);

    shape.holes.push(hole);

    // Create extruded geometry with exact wall thickness
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: wallThickness,
      bevelEnabled: false,
    };

    const extrudeGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    extrudeGeometry.translate(0, 0, -wallThickness / 2);
    if (!isFrontOrBackWall) {
      extrudeGeometry.rotateY(-Math.PI / 2);
    }

    wall.name += "Doorway";

    // Update wall geometry
    wall.geometry.dispose();
    wall.geometry = extrudeGeometry;

    // Create new material with preserved texture settings
    const newMaterial = currentMaterial.clone();
    if (currentTexture) {
      newMaterial.map = currentTexture.clone();
      newMaterial.map.repeat.set(
        this.stateManager.getTextureRepeatU(),
        this.stateManager.getTextureRepeatV()
      );
      newMaterial.map.wrapS = THREE.RepeatWrapping;
      newMaterial.map.wrapT = THREE.RepeatWrapping;
    }
    wall.material = newMaterial;
  }
}

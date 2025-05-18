import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { StateManager } from "../core/StateManager";
import { DOOR } from "../../../public/models";
import { Object3D } from "three";
import { Object3DEventMap } from "three";
import { Intersection } from "three";

const doorWidth = 2;
const doorHeight = 2.5;
const wallThickness = 0.1;

export class DoorPlacer {
  private stateManager: StateManager;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private canvas: HTMLCanvasElement;
  private doorModel: THREE.Group | null = null;
  private previewDoor: THREE.Group | null = null;
  private loader: GLTFLoader;

  constructor(stateManager: StateManager) {
    this.camera = stateManager.camera;
    this.stateManager = stateManager;
    this.canvas = document.querySelector("canvas");
    this.loader = new GLTFLoader();

    this.loadDoorModel();
  }

  private async loadDoorModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(DOOR);
      this.doorModel = this.transformModel(gltf.scene, 1.2);
      this.doorModel.name = "door";
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
    this.stateManager.scene.add(this.previewDoor);
  }

  public cleanupDoorPlacement(): void {
    if (this.previewDoor) {
      this.stateManager.scene.remove(this.previewDoor);
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
      this.stateManager.scene.children,
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
      this.stateManager.scene.children,
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
    const wall1 = intersectedWalls[1];
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

    this.makeAHole(wall.object as THREE.Mesh, position);
    if (wall1) {
      this.makeAHole(wall1.object as THREE.Mesh, position);
    }
    this.stateManager.scene.add(door);
    this.stateManager.addPlacedObject(door);
  };

  private makeAHole(wall: THREE.Mesh, position: THREE.Vector3): void {
    const isFrontOrBackWall =
      wall.name.includes("front") || wall.name.includes("back");

    // Store the current material properties
    const currentMaterial = wall.clone().material as THREE.MeshStandardMaterial;
    const currentTexture = currentMaterial.map;

    // Get wall dimensions
    wall.geometry.computeBoundingBox();
    const wallBox = new THREE.Box3().copy(wall.geometry.boundingBox);
    const wallSize = wallBox.getSize(new THREE.Vector3());
    const wallWidth = isFrontOrBackWall ? wallSize.x : wallSize.z;
    const wallHeight = 3;

    // Convert door position to wall's local space
    const doorPosition = position.clone();
    wall.worldToLocal(doorPosition);

    // Create or get existing doorways
    let doorways: { x: number; width: number; height: number }[] = [];
    if (wall.userData.doorways) {
      doorways = wall.userData.doorways;
    }

    // Add new doorway
    const holeWidth = 2 - wallThickness;
    const holeHeight = 2.5;
    const holeX = isFrontOrBackWall ? doorPosition.x : doorPosition.z;
    doorways.push({
      x: holeX,
      width: holeWidth,
      height: holeHeight,
    });

    // Store updated doorways
    wall.userData.doorways = doorways;

    // Sort doorways by x position to ensure consistent shape creation
    doorways.sort((a, b) => a.x - b.x);

    // Create shape with all doorways
    const shape = new THREE.Shape();
    shape.moveTo(-wallWidth / 2, wallHeight / 2);
    shape.lineTo(-wallWidth / 2, -wallHeight / 2);

    // Add segments for each doorway
    let currentX = -wallWidth / 2;
    for (const doorway of doorways) {
      // Add segment to doorway
      shape.lineTo(doorway.x - doorway.width / 2, -wallHeight / 2);
      shape.lineTo(
        doorway.x - doorway.width / 2,
        -wallHeight / 2 + doorway.height
      );
      shape.lineTo(
        doorway.x + doorway.width / 2,
        -wallHeight / 2 + doorway.height
      );
      shape.lineTo(doorway.x + doorway.width / 2, -wallHeight / 2);
      currentX = doorway.x + doorway.width / 2;
    }

    // Complete the shape
    shape.lineTo(wallWidth / 2, -wallHeight / 2);
    shape.lineTo(wallWidth / 2, wallHeight / 2);
    shape.lineTo(-wallWidth / 2, wallHeight / 2);

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

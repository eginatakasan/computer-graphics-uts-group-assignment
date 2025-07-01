import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { StateManager } from "../core/StateManager";
import {
  FLOOR_LAMP,
  CEILING_LAMP_VARIANT_1,
  TABLE_LAMP,
  CEILING_LAMP,
} from "../../../public/models/index";

const LIGHT_COLOR = 0xffee88;

export class LightsPlacer {
  private stateManager: StateManager;
  private loader: GLTFLoader;
  private isActive: boolean = false;
  private currentLampType: string | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private canvas: HTMLCanvasElement;
  private previewLamp: THREE.Group | null = null;
  private lampModel: THREE.Group | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.camera = stateManager.camera;
    this.canvas = document.querySelector("canvas");
    this.loader = new GLTFLoader();

    this.stateManager.subscribe("lightsPlacementActive", (active: boolean) => {
      this.setActive(active);
    });
  }

  private handleLampPlacement = async (event: MouseEvent): Promise<void> => {
    if (!this.isActive || !this.currentLampType || !this.lampModel) return;

    const mouse = new THREE.Vector2(
      (event.clientX / this.canvas.clientWidth) * 2 - 1,
      -(event.clientY / this.canvas.clientHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.stateManager.scene.children,
      true
    );

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const position = new THREE.Vector3(
        (point.x / 2) * 2,
        this.lampModel.position.y,
        (point.z / 2) * 2
      );
      await this.placeLamp(position);
    }
  };

  public setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.setupLampPreview();
    } else {
      this.cleanupLampPreview();
    }
  }

  public setLampType(type: string): void {
    this.currentLampType = type;
    if (this.isActive) {
      this.cleanupLampPreview();
      this.setupLampPreview();
    }
  }

  private async loadLampModel(type: string): Promise<THREE.Group> {
    let modelPath: string;
    switch (type) {
      case "floor":
        modelPath = FLOOR_LAMP;
        break;
      case "ceiling":
        modelPath = CEILING_LAMP_VARIANT_1;
        break;
      case "ceiling2":
        modelPath = CEILING_LAMP;
        break;
      case "table":
        modelPath = TABLE_LAMP;
        break;
      default:
        throw new Error("Invalid lamp type");
    }

    const gltf = await this.loader.loadAsync(modelPath);
    const lampObject = this.transformModel(
      gltf.scene,
      this.stateManager.getModelScale()
    );
    return lampObject;
  }

  private async setupLampPreview(): Promise<void> {
    if (!this.currentLampType) return;

    try {
      console.log("setupLampPreview");
      const baseModel = await this.loadLampModel(this.currentLampType);

      // Create preview lamp
      this.previewLamp = new THREE.Group();
      const lampClone = baseModel.clone();

      // Make the lamp model semi-transparent
      lampClone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.5;
        }
      });

      // Add box helper for preview
      const boxHelper = new THREE.BoxHelper(lampClone, 0x00ff00);
      const light = new THREE.PointLight(
        this.stateManager.lightColor,
        this.stateManager.lightIntensity,
        this.stateManager.lightDistance
      );

      this.previewLamp.add(lampClone);
      this.previewLamp.add(boxHelper);
      this.previewLamp.add(light);
      light.position.set(0, lampClone.position.y, 0);
      this.stateManager.scene.add(this.previewLamp);

      // Store the base model for placement
      this.lampModel = baseModel;

      // Add mouse move listener
      this.canvas.addEventListener("mousemove", this.handleLampPreview);
      // Add click handler when tool is activated
      this.canvas.addEventListener("click", this.handleLampPlacement);
    } catch (error) {
      console.error("Error loading lamp model:", error);
    }
  }

  private cleanupLampPreview(): void {
    if (this.previewLamp) {
      this.stateManager.scene.remove(this.previewLamp);
      this.previewLamp = null;
    }
    this.canvas.removeEventListener("mousemove", this.handleLampPreview);
    // Remove click handler when tool is deactivated
    this.canvas.removeEventListener("click", this.handleLampPlacement);
  }

  private handleLampPreview = (event: MouseEvent): void => {
    if (!this.previewLamp) return;

    const mouse = new THREE.Vector2(
      (event.clientX / this.canvas.clientWidth) * 2 - 1,
      -(event.clientY / this.canvas.clientHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.stateManager.scene.children,
      true
    );

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const position = new THREE.Vector3(
        (point.x / 2) * 2,
        this.previewLamp.position.y,
        (point.z / 2) * 2
      );
      this.previewLamp.position.copy(position);
    }
  };

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

  public async placeLamp(position: THREE.Vector3): Promise<void> {
    if (!this.isActive || !this.currentLampType || !this.lampModel) return;

    try {
      // Create new lamp instance
      const group = new THREE.Group();
      group.name = `${this.currentLampType}Lamp [Lamp] [placeableObject]`;
      const baseModel = await this.loadLampModel(this.currentLampType);
      const lampClone = baseModel.clone();
      lampClone.position.copy(position);

      // Create light and helpers
      const light = new THREE.PointLight(
        this.stateManager.lightColor,
        this.stateManager.lightIntensity,
        this.stateManager.lightDistance
      );
      light.position.copy(position);

      group.add(lampClone);
      group.add(light);

      // Add to scene
      this.stateManager.scene.add(group);

      // Add to placed objects
      this.stateManager.addPlacedObject(group);
    } catch (error) {
      console.error("Error placing lamp:", error);
    }
  }
}

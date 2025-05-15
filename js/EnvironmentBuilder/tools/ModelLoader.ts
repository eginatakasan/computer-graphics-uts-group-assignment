import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { StateManager } from "../core/StateManager";
import { CommandManager } from "../core/CommandManager";

export class ModelLoader {
  private loader: GLTFLoader;
  private scene: THREE.Scene;
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private placedObjects: THREE.Object3D[] = [];

  constructor(stateManager: StateManager, commandManager: CommandManager) {
    this.loader = new GLTFLoader();
    this.scene = stateManager.scene;
    this.stateManager = stateManager;
    this.commandManager = commandManager;
    this.placedObjects = stateManager.placedObjects;
  }

  public async loadModel(url: string): Promise<THREE.Group> {
    try {
      const gltf = await this.loader.loadAsync(url);
      const model = this.transformModel(gltf.scene);

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.metalness = 0;
        }
      });

      // Create a group to hold the model
      const group = new THREE.Group();
      group.add(model);
      group.name = "placeableObject";

      // Center the group
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      group.position.sub(center);
      group.position.y = 0;

      return group;
    } catch (error) {
      console.error("Error loading model:", error);
      throw error;
    }
  }

  public async loadModelAndAddToScene(url: string): Promise<THREE.Group> {
    const group = await this.loadModel(url);

    // Add to scene
    this.scene.add(group);
    this.placedObjects.push(group);

    return group;
  }

  public async loadModelAtPosition(
    path: string,
    position: THREE.Vector3,
    transform?: THREE.Matrix4,
    color?: THREE.Color
  ): Promise<THREE.Group> {
    try {
      const group = await this.loadModel(path);

      // Apply position
      group.position.copy(position);

      // Apply additional transform if provided
      if (transform) {
        group.applyMatrix4(transform);
      }

      // Apply color if provided
      if (color) {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = child.material.clone();
            child.material.color = color;
          }
        });
      }

      this.scene.add(group);
      this.placedObjects.push(group);
      return group;
    } catch (error) {
      console.error("Error loading model at position:", error);
      throw error;
    }
  }

  public async loadModelAtGroundLevel(
    path: string,
    position: THREE.Vector3,
    transform?: THREE.Matrix4,
    color?: THREE.Color
  ): Promise<THREE.Group> {
    // Create a position at ground level (y = 0)
    const groundPosition = new THREE.Vector3(position.x, 0, position.z);
    return this.loadModelAtPosition(path, groundPosition, transform, color);
  }

  public async loadLightsAtGroundLevel(
    path: string,
    position: THREE.Vector3,
    transform?: THREE.Matrix4,
    color: THREE.Color = new THREE.Color(0xffffff)
  ): Promise<{ model: THREE.Group; light: THREE.PointLight }> {
    // Load the model at ground level
    const model = await this.loadModelAtGroundLevel(
      path,
      position,
      transform,
      color
    );

    // Get the height of the model
    const box = new THREE.Box3().setFromObject(model);
    const modelHeight = box.max.y;

    // Create and position the light above the model
    const light = new THREE.PointLight(color, 10);
    light.position.set(position.x, modelHeight, position.z);
    light.visible = true;

    // Add light helper for visualization
    const helper = new THREE.PointLightHelper(light, 1);

    // Add to scene
    this.scene.add(light);
    this.scene.add(helper);

    return { model, light };
  }

  public openModelPicker(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".gltf,.glb";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        try {
          await this.loadModelAndAddToScene(url);
        } catch (error) {
          console.error("Error loading model:", error);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    };

    input.click();
  }

  public transformModel(
    model: THREE.Group<THREE.Object3DEventMap>,
    scale?: number
  ): THREE.Group<THREE.Object3DEventMap> {
    const modelScale = scale ?? this.stateManager.getModelScale();

    const box = new THREE.Box3().setFromObject(model);
    var sca = new THREE.Matrix4();
    var tra = new THREE.Matrix4();

    sca.makeScale(modelScale, modelScale, modelScale);
    box.applyMatrix4(sca);
    tra.makeTranslation(0, -box.min.y, 0);

    var combinedTransform = new THREE.Matrix4();
    combinedTransform.multiply(tra);
    combinedTransform.multiply(sca);

    model.applyMatrix4(combinedTransform);
    return model;
  }

  public getPlacedObjects(): THREE.Object3D[] {
    return this.placedObjects;
  }

  public removePlacedObject(object: THREE.Object3D): void {
    const index = this.placedObjects.indexOf(object);
    if (index !== -1) {
      this.placedObjects.splice(index, 1);
      this.scene.remove(object);
    }
  }

  public clearPlacedObjects(): void {
    this.placedObjects.forEach((object) => {
      this.scene.remove(object);
    });
    this.placedObjects = [];
  }

  public savePositions(): void {
    const copyScene = this.scene.clone();
    const json = copyScene.toJSON();

    const dataStr = JSON.stringify(json, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = "object_positions.json";
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }

  public async loadPositions(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);

            this.scene.clear();
            this.placedObjects = [];

            new THREE.ObjectLoader().parse(json, (object) => {
              const placeableObjects: THREE.Object3D<THREE.Object3DEventMap>[] =
                [];
              object.children.forEach((child, index) => {
                if (child.name === "ground") {
                  return;
                }
                child.traverse((c) => {
                  if (c instanceof THREE.Mesh) {
                    c.material.emissive.set(0x000000);
                  }

                  if (c.name === "ground") {
                    return;
                  }

                  if (
                    c.name.includes("Doorway") &&
                    !c.name.includes("front") &&
                    !c.name.includes("back")
                  ) {
                    c.rotateY(-Math.PI / 2);
                    console.log("c.name before", c.name);
                    c.name = c.name.replace("Doorway", "");
                    console.log("c.name after", c.name);
                  } else if (c.name === "placeableObject") {
                    placeableObjects.push(c);
                  }
                });
              });
              this.placedObjects = placeableObjects;
              this.scene.add(object);
            });
          } catch (error) {
            console.error("Error loading positions:", error);
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }
}

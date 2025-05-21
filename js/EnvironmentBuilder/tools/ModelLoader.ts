import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { StateManager } from "../core/StateManager";
import { CommandManager } from "../core/CommandManager";

export class ModelLoader {
  private loader: GLTFLoader;
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private placedObjects: THREE.Object3D[] = [];

  constructor(stateManager: StateManager, commandManager: CommandManager) {
    this.loader = new GLTFLoader();
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
      group.name = "[placeableObject]";

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
    this.stateManager.scene.add(group);
    // Use StateManager to add to placedObjects
    this.stateManager.addPlacedObject(group);
    // Add to drag controls
    // if (this.stateManager.dragControls) {
    //   this.stateManager.dragControls.objects.push(group);
    // }

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

      this.stateManager.scene.add(group);
      // Use StateManager to add to placedObjects
      this.stateManager.addPlacedObject(group);
      // Add to drag controls
      if (this.stateManager.dragControls) {
        this.stateManager.dragControls.objects.push(group);
      }

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
    this.stateManager.scene.add(light);
    this.stateManager.scene.add(helper);

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

  public removePlacedObject(object: THREE.Object3D): void {
    this.stateManager.scene.remove(object);
    this.stateManager.removePlacedObject(object);

    // Remove from drag controls if it exists
    if (this.stateManager.dragControls) {
      const index = this.stateManager.dragControls.objects.indexOf(object);
      if (index !== -1) {
        this.stateManager.dragControls.objects.splice(index, 1);
      }
    }
  }

  public clearPlacedObjects(): void {
    // Remove all objects from scene
    this.stateManager.placedObjects.forEach((object) => {
      this.stateManager.scene.remove(object);
    });

    // Clear drag controls objects
    if (this.stateManager.dragControls) {
      this.stateManager.dragControls.objects = [];
    }

    // Clear placedObjects in state manager
    this.stateManager.clearPlacedObjects();
  }

  public savePositions(): void {
    // Create a scene to export
    const exportScene = new THREE.Scene();

    // Add all placed objects to the export scene
    this.stateManager.placedObjects.forEach((obj) => {
      exportScene.add(obj.clone());
    });

    this.stateManager.roomObjects.forEach((obj) => {
      exportScene.add(obj.clone());
    });

    // Convert to JSON
    const json = exportScene.toJSON();
    const jsonString = JSON.stringify(json, null, 2);

    // Create a download link
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scene.json";
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  }

  public addCeilings(roomObjects: THREE.Object3D[]): THREE.Object3D[] {
    roomObjects.forEach((obj) => {
      obj.traverse((child) => {
        if (child.name === "floor" && child instanceof THREE.Mesh) {
          const ceiling = child.clone();
          if (ceiling.geometry instanceof THREE.PlaneGeometry) {
            ceiling.up = new THREE.Vector3(0, -1, 0);
            ceiling.material = new THREE.MeshStandardMaterial({
              color: 0xffffff,
            });
            ceiling.position.y = 5;
            ceiling.name = "ceiling";
            obj.add(ceiling);
          }
        }
      });
    });
    return roomObjects;
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

            this.stateManager.resetScene();

            new THREE.ObjectLoader().parse(json, (object) => {
              const placeableObjects: THREE.Object3D<THREE.Object3DEventMap>[] =
                [];
              const roomObjects: THREE.Object3D<THREE.Object3DEventMap>[] = [];
              object.children.forEach((child, index) => {
                if (child.name === "ground") {
                  return;
                }
                child.traverse((c) => {
                  // if (c instanceof THREE.Mesh) {
                  //   c.material.emissive.set(0x000000);
                  // }

                  if (c.name === "ground") {
                    roomObjects.push(c);
                    return;
                  }

                  if (c.name.includes("[Room]")) {
                    roomObjects.push(c);
                    return;
                  }

                  if (c.name.includes("[Door]")) {
                    roomObjects.push(c);
                    return;
                  }

                  if (c.name.includes("[placeableObject]")) {
                    placeableObjects.push(c);

                    if (c.name.includes("[Lamp]")) {
                      c.traverse((child) => {
                        if (
                          child instanceof THREE.Mesh &&
                          [
                            "FloorLamp1_3",
                            "FloorLamp1_2",
                            "TableLamp1_3",
                            "TableLamp1_2",
                            "CeilingLamp1_2",
                            "CeilingLamp5_2",
                          ].includes(child.name)
                        ) {
                          child.material.emissive.set(0xffffff);

                          if (
                            child.name === "FloorLamp1_3" ||
                            child.name === "TableLamp1_3" ||
                            child.name === "CeilingLamp1_2" ||
                            child.name === "CeilingLamp5_2"
                          ) {
                            child.material.emissiveIntensity = 1;
                          } else {
                            child.material.emissiveIntensity = 0.2;
                          }
                        }
                      });
                    }
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

              // Update placedObjects in state manager

              //addCeilings
              // roomObjects = this.addCeilings(roomObjects);

              this.stateManager.setPlacedObjects(placeableObjects);
              this.stateManager.setRoomObjects(roomObjects);

              // Update drag controls
              if (this.stateManager.dragControls) {
                this.stateManager.dragControls.objects = [...placeableObjects];
              }

              // Add loaded objects to scene
              placeableObjects.forEach((obj) => {
                this.stateManager.scene.add(obj);
              });
              roomObjects.forEach((obj) => {
                this.stateManager.scene.add(obj);
              });
            });
          } catch (error) {
            console.error("Error loading scene:", error);
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }

  public loadPositionsAt(path: string): void {
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
        this.stateManager.resetScene();

        new THREE.ObjectLoader().parse(json, (object) => {
          const placeableObjects: THREE.Object3D<THREE.Object3DEventMap>[] = [];
          const roomObjects: THREE.Object3D<THREE.Object3DEventMap>[] = [];
          object.children.forEach((child, index) => {
            if (child.name === "ground") {
              return;
            }
            child.traverse((c) => {
              if (c instanceof THREE.Mesh) {
                c.material.emissive.set(0x000000);
              }

              if (c.name === "ground") {
                roomObjects.push(c);
                return;
              }

              if (c.name.includes("[Room]")) {
                roomObjects.push(c);
                return;
              }

              if (c.name.includes("[Door]")) {
                roomObjects.push(c);
                return;
              }

              if (c.name.includes("[placeableObject]")) {
                placeableObjects.push(c);
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

          // Update placedObjects in state manager

          roomObjects.forEach((obj) => {
            obj.traverse((child) => {
              if (child.name.includes("Wall")) {
                if (child instanceof THREE.Mesh) {
                  child.scale.set(1, 5 / 3, 1);
                  child.geometry.computeBoundingBox();
                  // const repeat = child.material.map?.repeat;
                  // child.material.map.repeat.set(
                  //   repeat.x,
                  //   (repeat.y * 5) / 3
                  // );
                  const box = new THREE.Box3();
                  box.copy(child.geometry.boundingBox);
                  child.position.y = 2.5;
                }
              }
            });
          });

          this.stateManager.setPlacedObjects(placeableObjects);
          this.stateManager.setRoomObjects(roomObjects);

          // Update drag controls
          if (this.stateManager.dragControls) {
            this.stateManager.dragControls.objects = [...placeableObjects];
          }

          // Add loaded objects to scene
          placeableObjects.forEach((obj) => {
            this.stateManager.scene.add(obj);
          });
          roomObjects.forEach((obj) => {
            this.stateManager.scene.add(obj);
          });
        });
      });
  }
}

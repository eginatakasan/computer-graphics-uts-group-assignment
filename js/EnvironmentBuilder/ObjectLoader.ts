import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { Controller } from "./Controller";
import { SceneSetup } from "./SceneSetup";
import { DOOR } from "../../public/models";

const roomSize = 10;
const wallHeight = 3;
const wallThickness = 0.1;
const doorWidth = 2;
const doorHeight = 2.2;

export class ObjectLoader {
  private loader: GLTFLoader;
  private scene: THREE.Scene;
  private controller: Controller;
  private placedObjects: THREE.Object3D<THREE.Object3DEventMap>[] = [];
  private gui: GUI;
  private sceneSetup: SceneSetup;
  private isRoomToolActive: boolean = false;
  private roomToolElement: HTMLDivElement;
  private doorButtonElement: HTMLButtonElement;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;
  private isBuildingRoom: boolean = false;
  private isDoorPlacementActive: boolean = false;
  private previewDoor: THREE.Group | null = null;
  private doorModel: THREE.Group | null = null;
  private roomStartPoint: THREE.Vector2 = new THREE.Vector2();
  private currentRoom: THREE.Group | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  private camera: THREE.Camera;

  constructor(
    scene: THREE.Scene,
    controller: Controller,
    gui: GUI,
    sceneSetup: SceneSetup,
    container: HTMLElement,
    placedObjects: THREE.Object3D<THREE.Object3DEventMap>[]
  ) {
    this.scene = scene;
    this.controller = controller;
    this.loader = new GLTFLoader();
    this.gui = gui;
    this.sceneSetup = sceneSetup;
    this.roomToolElement = document.querySelector("button#room-tool");
    this.canvas = document.querySelector("canvas");
    this.camera = controller.getCamera();
    this.container = container;
    this.placedObjects = placedObjects;
    this.setupGUI();
    this.setupDoubleClickHandler();
    this.loadDoorModel();

    this.controller.setEventHandler(
      (object: THREE.Object3D) => this.removePlacedObject(object),
      () => this.undo()
    );
  }

  private undo(): void {
    const lastObject = this.placedObjects.pop();
    if (lastObject) {
      this.scene.remove(lastObject);
    }
  }

  private transformModel(
    model: THREE.Group<THREE.Object3DEventMap>,
    scale: number = 0.7
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

  private async loadDoorModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(DOOR);
      this.doorModel = this.transformModel(gltf.scene, 1);
      this.doorModel.scale.set(1, 0.8, 1);
    } catch (error) {
      console.error("Error loading door model:", error);
    }
  }

  public async loadModel(url: string): Promise<void> {
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

    // Add to scene
    this.scene.add(group);

    this.placedObjects.push(group);
    this.controller.getDragControls().objects.push(model);
  }

  public getPlacedObjects(): THREE.Object3D<THREE.Object3DEventMap>[] {
    return this.placedObjects;
  }

  public removePlacedObject(
    object: THREE.Object3D<THREE.Object3DEventMap>
  ): void {
    const index = this.placedObjects.indexOf(object);
    if (index !== -1) {
      this.placedObjects.splice(index, 1);
    }
  }

  public clearPlacedObjects(): void {
    this.placedObjects.forEach((object) => {
      this.scene.remove(object);
    });
    this.placedObjects = [];
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
    intersectionPoint.x = Math.round(intersectionPoint.x / 10) * 10;
    intersectionPoint.z = Math.round(intersectionPoint.z / 10) * 10;

    return intersectionPoint;
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
    const width = endWorld.x - startWorld.x;
    const depth = endWorld.z - startWorld.z;
    const height = wallHeight; // Standard room height

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshLambertMaterial({
      color: isPreview ? 0x00ff00 : 0xffffff,
      opacity: isPreview ? 0.5 : 1,
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
      color: isPreview ? 0x00ff00 : 0xffffff,
      opacity: isPreview ? 0.5 : 1,
      side: THREE.DoubleSide,
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

  private toggleRoomTool(): void {
    this.isRoomToolActive = !this.isRoomToolActive;
    this.isDoorPlacementActive = false;
    console.log("toggleRoomTool", this.isRoomToolActive);
    console.log("toggleDoorPlacement", this.isDoorPlacementActive);
    this.doorButtonElement.style.backgroundColor = this.isDoorPlacementActive
      ? "#00ff00"
      : "#fff";
    this.roomToolElement.style.backgroundColor = this.isRoomToolActive
      ? "#00ff00"
      : "#fff";
    this.controller.setDragControlsEnabled(
      !this.isDoorPlacementActive && !this.isRoomToolActive
    );
    this.canvas.style.cursor = this.isRoomToolActive ? "crosshair" : "default";
  }

  private toggleDoorPlacement(): void {
    this.isRoomToolActive = false;
    this.isDoorPlacementActive = !this.isDoorPlacementActive;
    console.log("toggleDoorPlacement", this.isDoorPlacementActive);
    console.log("toggleRoomTool", this.isRoomToolActive);
    this.doorButtonElement.style.backgroundColor = this.isDoorPlacementActive
      ? "#00ff00"
      : "#fff";
    this.roomToolElement.style.backgroundColor = this.isRoomToolActive
      ? "#00ff00"
      : "#fff";
    this.controller.setDragControlsEnabled(
      !this.isDoorPlacementActive && !this.isRoomToolActive
    );
  }

  private setupGUI(): void {
    const saveLoadFolder = this.gui.addFolder("Save/Load");
    saveLoadFolder
      .add({ savePositions: () => this.savePositions() }, "savePositions")
      .name("Save Positions");
    saveLoadFolder
      .add({ loadPositions: () => this.loadPositions() }, "loadPositions")
      .name("Load Positions");

    // Add Load Model button
    const modelFolder = this.gui.addFolder("Models");
    modelFolder
      .add({ loadModel: () => this.openModelPicker() }, "loadModel")
      .name("Load Model");

    // Add Door Placement button
    this.doorButtonElement = document.createElement("button");
    this.doorButtonElement.id = "door-tool";
    this.doorButtonElement.textContent = "Place Door";
    this.doorButtonElement.style.marginTop = "10px";
    this.roomToolElement.parentNode?.insertBefore(
      this.doorButtonElement,
      this.roomToolElement.nextSibling
    );

    this.doorButtonElement.addEventListener("click", () => {
      this.toggleDoorPlacement();
      if (this.isDoorPlacementActive) {
        this.isBuildingRoom = false;
        this.setupDoorPlacement();
      } else {
        this.cleanupDoorPlacement();
      }
    });

    this.roomToolElement.addEventListener("click", (event: MouseEvent) => {
      if (event.button === 0) {
        this.toggleRoomTool();
        this.isBuildingRoom = false;
        this.currentRoom = null;

        if (this.isRoomToolActive) {
          this.mouseDownHandler = (event: MouseEvent) => {
            if (this.isRoomToolActive && event.button === 0) {
              this.isBuildingRoom = true;
              console.log("Mouse down", event.clientX, event.clientY);
              this.roomStartPoint.set(event.clientX, event.clientY);

              // Create initial preview room
              this.currentRoom = this.createRoom(
                this.roomStartPoint,
                this.roomStartPoint,
                true
              );
              this.scene.add(this.currentRoom);
            }
          };

          this.mouseUpHandler = (event: MouseEvent) => {
            if (this.isRoomToolActive && event.button === 0) {
              if (this.isBuildingRoom && this.currentRoom) {
                console.log("Mouse up", event.clientX, event.clientY);
                console.log(this.controller.scene);
                // Remove preview room
                this.scene.remove(this.currentRoom);

                // Create final room
                const endPoint = new THREE.Vector2(
                  event.clientX,
                  event.clientY
                );
                const finalRoom = this.createRoom(
                  this.roomStartPoint,
                  endPoint,
                  false
                );
                this.scene.add(finalRoom);
                this.placedObjects.push(finalRoom);

                this.isBuildingRoom = false;
                this.currentRoom = null;
              }
            }
          };

          this.canvas.addEventListener("mousedown", this.mouseDownHandler);
          this.canvas.addEventListener("mouseup", this.mouseUpHandler);
          this.canvas.addEventListener("mousemove", (event: MouseEvent) => {
            if (this.isBuildingRoom && this.currentRoom) {
              // Update preview room
              this.scene.remove(this.currentRoom);
              const currentPoint = new THREE.Vector2(
                event.clientX,
                event.clientY
              );
              this.currentRoom = this.createRoom(
                this.roomStartPoint,
                currentPoint,
                true
              );
              this.scene.add(this.currentRoom);
            }
          });
        } else {
          console.log("Room tool deactivated");
          // Remove event listeners when tool is deactivated
          this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
          this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
          if (this.currentRoom) {
            this.scene.remove(this.currentRoom);
            this.currentRoom = null;
          }
        }
      }
    });
  }

  private setupDoubleClickHandler(): void {
    this.canvas.addEventListener("dblclick", (event: MouseEvent) => {
      if (this.isDoorPlacementActive) return;
      // Convert mouse position to normalized device coordinates
      const mouse = new THREE.Vector2(
        (event.clientX / this.canvas.clientWidth) * 2 - 1,
        -(event.clientY / this.canvas.clientHeight) * 2 + 1
      );

      // Update the picking ray with the camera and mouse position
      this.raycaster.setFromCamera(mouse, this.camera);

      // Calculate objects intersecting the picking ray
      const intersects = this.raycaster.intersectObjects(
        this.scene.children,
        true
      );

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (clickedObject instanceof THREE.Mesh) {
          console.log("clickedObject", clickedObject);
          this.openTexturePicker(clickedObject);
        }
      }
    });
  }

  private openTexturePicker(mesh: THREE.Mesh): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const textureLoader = new THREE.TextureLoader();
        const url = URL.createObjectURL(file);

        try {
          const texture = await textureLoader.loadAsync(url);
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(4, 2);

          if (
            mesh.material instanceof THREE.MeshStandardMaterial ||
            mesh.material instanceof THREE.MeshLambertMaterial ||
            mesh.material instanceof THREE.MeshBasicMaterial
          ) {
            mesh.material.map = texture;
            mesh.material.color.set(0xffffff);
            mesh.material.needsUpdate = true;
          } else if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              if (
                mat instanceof THREE.MeshStandardMaterial ||
                mat instanceof THREE.MeshLambertMaterial ||
                mat instanceof THREE.MeshBasicMaterial
              ) {
                mat.map = texture;
                mat.color.set(0xffffff);
                mat.needsUpdate = true;
              }
            });
          }
        } catch (error) {
          console.error("Error loading texture:", error);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    };

    input.click();
  }

  private savePositions(): void {
    const copyScene = this.scene.clone().remove(this.sceneSetup.ground);
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

  private async loadPositions(): Promise<void> {
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
              console.log("object.children", object.children);
              const placeableObjects: THREE.Object3D<THREE.Object3DEventMap>[] =
                [];
              const objects: THREE.Object3D<THREE.Object3DEventMap>[] = [];
              object.children.forEach((child, index) => {
                if (child.name === "placeableObject") {
                  placeableObjects.push(child);
                }
                objects.push(child);
              });
              console.log("placeableObjects", placeableObjects);
              this.placedObjects = placeableObjects;
              this.controller.getDragControls().objects = placeableObjects;
              console.log(
                "draggableObjects",
                this.controller.getDragControls().objects
              );
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

  private openModelPicker(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".gltf,.glb";
    // input.setAttribute("webkitdirectory", "");
    // input.setAttribute("directory", "");

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        try {
          await this.loadModel(url);
        } catch (error) {
          console.error("Error loading model:", error);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    };

    input.click();
  }

  private setupDoorPlacement(): void {
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

    // Add mousemove handler for preview
    this.canvas.addEventListener("mousemove", this.handleDoorPreview);
    this.canvas.addEventListener("click", this.handleDoorPlacement);
  }

  private cleanupDoorPlacement(): void {
    if (this.previewDoor) {
      this.scene.remove(this.previewDoor);
      this.previewDoor = null;
    }
    this.canvas.removeEventListener("mousemove", this.handleDoorPreview);
    this.canvas.removeEventListener("click", this.handleDoorPlacement);
  }

  private handleDoorPreview = (event: MouseEvent): void => {
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
          Math.round(intersect.point.x / 5) * 5,
          0, // Set y to ground level
          Math.round(intersect.point.z / 5) * 5
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

  private handleDoorPlacement = (event: MouseEvent): void => {
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

    for (const intersect of intersects) {
      const wall = intersect.object;
      if (wall.name.includes("Wall")) {
        // Create new door instance
        const door = this.doorModel.clone();
        // Position door at intersection point but keep y at 0
        const position = new THREE.Vector3(
          Math.round(intersect.point.x / 5) * 5,
          0, // Set y to ground level
          Math.round(intersect.point.z / 5) * 5
        );
        door.position.copy(position);

        // Align door with wall
        const wallNormal = intersect.face?.normal;
        if (wallNormal) {
          door.lookAt(
            position.x + wallNormal.x,
            position.y + wallNormal.y,
            position.z + wallNormal.z
          );
        }

        this.scene.add(door);
        this.placedObjects.push(door);
        break;
      }
    }
  };

  public async loadModelAtPosition(
    path: string,
    position: THREE.Vector3,
    transform?: THREE.Matrix4,
    color?: THREE.Color
  ): Promise<THREE.Group> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const model = this.transformModel(gltf.scene);

      // Apply position
      model.position.copy(position);

      // Apply additional transform if provided
      if (transform) {
        model.applyMatrix4(transform);
      }

      // Apply color if provided
      if (color) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = child.material.clone();
            child.material.color = color;
          }
        });
      }

      this.scene.add(model);
      return model;
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
}

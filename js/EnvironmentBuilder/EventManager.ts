import * as THREE from "three";
import { Controller } from "./Controller";
import { UIManager } from "./UIManager";
import { TextureManager } from "./tools/TextureManager";
import { DoorPlacer } from "./tools/DoorPlacer";
import { StateManager } from "./core/StateManager";
import { ModelLoader } from "./tools/ModelLoader";
import { RoomBuilder } from "./tools/RoomBuilder";
import { CommandManager } from "./core/CommandManager";
import { BoxPlacer } from "./tools/BoxPlacer";

export class EventManager {
  private controller: Controller;
  private uiManager: UIManager;
  private canvas: HTMLCanvasElement;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private modelLoader: ModelLoader;
  private roomBuilder: RoomBuilder;
  private doorPlacer: DoorPlacer;
  private boxPlacer: BoxPlacer;
  private textureManager: TextureManager;
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;
  private mouseMoveHandler: (event: MouseEvent) => void;
  private boxMoveHandler: (event: MouseEvent) => void;
  private boxClickHandler: (event: MouseEvent) => void;

  constructor(stateManager: StateManager, controller: Controller) {
    this.stateManager = stateManager;
    this.controller = controller;
    this.camera = stateManager.camera;
    this.canvas = document.querySelector("canvas");

    this.uiManager = null;
  }

  public setupEventListeners(): void {
    this.setupDoubleClickHandler();
    this.setupObjectSelectionHandler();
    this.setupKeyboardShortcuts();
  }

  private setupDoubleClickHandler(): void {
    this.canvas.addEventListener("dblclick", (event: MouseEvent) => {
      if (this.stateManager.isDoorPlacementActive) return;

      // Convert mouse position to normalized device coordinates
      const mouse = new THREE.Vector2(
        (event.clientX / this.canvas.clientWidth) * 2 - 1,
        -(event.clientY / this.canvas.clientHeight) * 2 + 1
      );

      // Update the picking ray with the camera and mouse position
      this.raycaster.setFromCamera(mouse, this.camera);

      // Calculate objects intersecting the picking ray
      const intersects = this.raycaster.intersectObjects(
        this.controller.scene.children,
        true
      );
      console.log("intersects", intersects);

      while (
        intersects.length > 0 &&
        !(intersects[0].object instanceof THREE.Mesh)
      ) {
        intersects.shift();
      }
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (clickedObject instanceof THREE.Mesh) {
          this.textureManager.openTexturePicker(clickedObject);
        }
      }
    });
  }

  private setupObjectSelectionHandler(): void {
    this.canvas.addEventListener("click", (event: MouseEvent) => {
      if (
        this.stateManager.isRoomToolActive ||
        this.stateManager.isDoorPlacementActive
      )
        return;

      const mouse = new THREE.Vector2(
        (event.clientX / this.canvas.clientWidth) * 2 - 1,
        -(event.clientY / this.canvas.clientHeight) * 2 + 1
      );

      this.raycaster.setFromCamera(mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(
        this.controller.scene.children,
        true
      );

      // Handle delete tool
      if (this.uiManager.isDeleteToolActive && intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Find the top-level parent that's a placed object
        let objectToDelete = clickedObject;
        const placedObjects = this.stateManager.placedObjects;

        if (
          objectToDelete.parent &&
          placedObjects.includes(objectToDelete.parent)
        ) {
          objectToDelete = objectToDelete.parent;
        }

        // If we found a parent that's in placedObjects, remove it
        if (placedObjects.includes(objectToDelete)) {
          this.modelLoader.removePlacedObject(objectToDelete);
        }
        return;
      }

      // Handle object selection
      this.handleObjectSelection(intersects);
    });
  }

  private handleObjectSelection(intersects: THREE.Intersection[]): void {
    // If no intersects, just clear selection
    // console.log("intersects", intersects);
    if (intersects.length === 0 || intersects[0].object.type === "GridHelper") {
      if (this.stateManager.selectedObject) {
        this.stateManager.setSelectedObject(null);
        this.uiManager.removeObjectScaleFolder();
      }
      return;
    }

    const selectedMesh = intersects[0].object;

    // Don't select ground
    if (selectedMesh.name === "ground") {
      return;
    }

    // Handle room selection
    const isRoomsSelectable = this.uiManager.isRoomsSelectableEnabled();
    if (
      !isRoomsSelectable &&
      (selectedMesh.name.includes("Wall") ||
        selectedMesh.name.includes("floor"))
    ) {
      return;
    }

    // Find the appropriate object to select
    let objectToSelect = selectedMesh;
    if (!isRoomsSelectable) {
      // Find the top-level parent that's a placed object
      const placedObjects = this.stateManager.placedObjects;
      while (objectToSelect.parent && !placedObjects.includes(objectToSelect)) {
        objectToSelect = objectToSelect.parent;
      }

      // Only select if it's a placed object
      if (!placedObjects.includes(objectToSelect)) {
        return;
      }
    }

    // Set the selected object
    this.stateManager.setSelectedObject(objectToSelect);

    // Create scale folder for the selected object
    this.uiManager.createObjectScaleFolder(objectToSelect);
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener("keydown", (event) => {
      // Delete key - remove selected object
      if (event.key === "Delete" && this.stateManager.selectedObject) {
        this.modelLoader.removePlacedObject(this.stateManager.selectedObject);
        this.stateManager.selectedObject = null;
      }

      // Ctrl+Z - undo
      if (event.ctrlKey && event.key === "z") {
        this.controller.undo();
      }

      // Ctrl+C - copy selected object
      if (
        event.ctrlKey &&
        event.key === "c" &&
        this.stateManager.selectedObject
      ) {
        this.controller.copySelectedObject();
      }

      // Handle translateY with keys 9 and 0
      if (this.stateManager.selectedObject) {
        const translateAmount = 0.1;
        if (event.key === "9") {
          // Move up
          this.stateManager.selectedObject.position.y += translateAmount;
        } else if (event.key === "0") {
          // Move down
          this.stateManager.selectedObject.position.y -= translateAmount;
        }
      }
    });
  }

  public setupRoomToolHandlers(): void {
    this.mouseDownHandler = (event: MouseEvent) => {
      if (this.stateManager.isRoomToolActive && event.button === 0) {
        this.roomBuilder.startBuildingRoom(event.clientX, event.clientY);
      }
    };

    this.mouseUpHandler = (event: MouseEvent) => {
      if (this.stateManager.isRoomToolActive && event.button === 0) {
        this.roomBuilder.finishBuildingRoom(event.clientX, event.clientY);
      }
    };

    this.mouseMoveHandler = (event: MouseEvent) => {
      if (
        this.stateManager.isRoomToolActive &&
        this.stateManager.isBuildingRoom
      ) {
        this.roomBuilder.updateRoomPreview(event.clientX, event.clientY);
      }
    };

    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }

  public removeRoomToolHandlers(): void {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
  }

  public setupDoorPlacementHandlers(): void {
    this.canvas.addEventListener(
      "mousemove",
      this.doorPlacer.handleDoorPreview
    );
    this.canvas.addEventListener("click", this.doorPlacer.handleDoorPlacement);
  }

  public removeDoorPlacementHandlers(): void {
    this.canvas.removeEventListener(
      "mousemove",
      this.doorPlacer.handleDoorPreview
    );
    this.canvas.removeEventListener(
      "click",
      this.doorPlacer.handleDoorPlacement
    );
  }

  public setupBoxPlacementHandlers(): void {
    this.boxMoveHandler = (event: MouseEvent) => {
      this.boxPlacer.update(event);
    };

    this.boxClickHandler = (event: MouseEvent) => {
      this.boxPlacer.onClick(event);
    };

    this.canvas.addEventListener("mousemove", this.boxMoveHandler);
    this.canvas.addEventListener("click", this.boxClickHandler);
  }

  public removeBoxPlacementHandlers(): void {
    this.canvas.removeEventListener("mousemove", this.boxMoveHandler);
    this.canvas.removeEventListener("click", this.boxClickHandler);
  }

  public setModelLoader(modelLoader: ModelLoader): void {
    this.modelLoader = modelLoader;
  }
  public setRoomBuilder(roomBuilder: RoomBuilder): void {
    this.roomBuilder = roomBuilder;
  }
  public setDoorPlacer(doorPlacer: DoorPlacer): void {
    this.doorPlacer = doorPlacer;
  }
  public setBoxPlacer(boxPlacer: BoxPlacer): void {
    this.boxPlacer = boxPlacer;
  }
  public setTextureManager(textureManager: TextureManager): void {
    this.textureManager = textureManager;
  }
  public setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
  }
  public setCommandManager(commandManager: CommandManager): void {
    this.commandManager = commandManager;
  }
  public setUIManager(uiManager: UIManager): void {
    this.uiManager = uiManager;
  }
}

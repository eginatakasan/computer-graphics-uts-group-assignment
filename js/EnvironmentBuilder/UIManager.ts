import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { Controller } from "./Controller";
import { ModelLoader } from "./tools/ModelLoader";
import { RoomBuilder } from "./tools/RoomBuilder";
import { StateManager } from "./core/StateManager";
import { DoorPlacer } from "./tools/DoorPlacer";
import { TextureManager } from "./tools/TextureManager";
import { CommandManager } from "./core/CommandManager";
import { ObjectLoader } from "three";
import { LightsPlacer } from "./tools/LightsPlacer";

export class UIManager {
  private gui: GUI;
  private controller: Controller;
  private toolsContainer: HTMLDivElement;
  private roomToolElement: HTMLButtonElement;
  private doorButtonElement: HTMLButtonElement;
  private deleteButtonElement: HTMLButtonElement;
  private boxButtonElement: HTMLButtonElement;
  private lightsButtonElement: HTMLButtonElement;
  private canvas: HTMLCanvasElement;
  private objectLoader: ObjectLoader;
  private modelLoader: ModelLoader;
  private roomBuilder: RoomBuilder;
  private doorPlacer: DoorPlacer;
  private textureManager: TextureManager;
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private lightsPlacer: LightsPlacer;
  private objectScaleFolder: GUI | null = null;
  private objectListContainer: HTMLDivElement | null = null;
  private objectListFolder: GUI | null = null;
  private lampTypeFolder: GUI | null = null;
  private lightControlsFolder: GUI | null = null;
  public isRoomToolActive: boolean = false;
  public isDoorPlacementActive: boolean = false;
  public isDeleteToolActive: boolean = false;
  public isBoxPlacementActive: boolean = false;
  public isLightsPlacementActive: boolean = false;
  public isRoomsSelectable: boolean = false;
  public modelScale: number = 1.2;
  public textureRepeatU: number = 1;
  public textureRepeatV: number = 1;

  constructor(stateManager: StateManager, controller: Controller, gui: GUI) {
    this.gui = gui;
    this.stateManager = stateManager;
    this.controller = controller;
    this.canvas = document.querySelector("canvas");
    this.toolsContainer = document.querySelector("#tools");
    this.roomToolElement = document.querySelector("button#room-tool");

    this.setupGUI();
    this.createObjectListUI();
    this.setupToolButtons();

    // Subscribe to state changes to update object list
    this.stateManager.subscribe("placedObjectsChanged", () => {
      this.updateObjectList();
    });

    // Subscribe to room objects changes
    this.stateManager.subscribe("roomObjectsChanged", () => {
      this.updateObjectList();
    });
  }

  private setupGUI(): void {
    const saveLoadFolder = this.gui.addFolder("Save/Load");
    saveLoadFolder
      .add(
        { savePositions: () => this.modelLoader.savePositions() },
        "savePositions"
      )
      .name("Save Positions");
    saveLoadFolder
      .add(
        { loadPositions: () => this.modelLoader.loadPositions() },
        "loadPositions"
      )
      .name("Load Positions");

    // Add Load Model button and scale slider
    const modelFolder = this.gui.addFolder("Models");
    modelFolder
      .add({ loadModel: () => this.modelLoader.openModelPicker() }, "loadModel")
      .name("Load Model");

    // Add scale slider
    const scaleControl = { scale: this.modelScale };
    modelFolder
      .add(scaleControl, "scale", 0.1, 3.0, 0.1)
      .name("Model Scale")
      .onChange((value) => {
        this.modelScale = value;
        this.stateManager.setModelScale(value);
      });

    // Add texture repeat slider
    const textureFolder = this.gui.addFolder("Texture Settings");
    textureFolder
      .add({ repeatU: this.textureRepeatU }, "repeatU", 0.05, 5, 0.05)
      .name("Texture Repeat U")
      .onChange((value) => {
        this.textureRepeatU = value;
        this.stateManager.setTextureRepeatU(value);
      });

    textureFolder
      .add({ repeatV: this.textureRepeatV }, "repeatV", 0.05, 5, 0.05)
      .name("Texture Repeat V")
      .onChange((value) => {
        this.textureRepeatV = value;
        this.stateManager.setTextureRepeatV(value);
      });

    // Add selection settings
    const selectionFolder = this.gui.addFolder("Selection Settings");
    selectionFolder
      .add({ roomsSelectable: this.isRoomsSelectable }, "roomsSelectable")
      .name("Selectable Rooms")
      .onChange((value) => {
        this.isRoomsSelectable = value;
        this.stateManager.setRoomsSelectable(value);
        console.log("Rooms selectable:", this.isRoomsSelectable);
      });
  }

  private createObjectListUI(): void {
    // Create a container for both lists
    this.objectListContainer = document.createElement("div");
    this.objectListContainer.id = "object-list-container";
    this.objectListContainer.style.position = "absolute";
    this.objectListContainer.style.bottom = "10px";
    this.objectListContainer.style.left = "10px";
    this.objectListContainer.style.width = "250px";
    this.objectListContainer.style.maxHeight = "400px";
    this.objectListContainer.style.overflowY = "auto";
    this.objectListContainer.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    this.objectListContainer.style.border = "1px solid #ccc";
    this.objectListContainer.style.borderRadius = "5px";
    this.objectListContainer.style.padding = "10px";
    this.objectListContainer.style.zIndex = "1000";

    // Add title for room objects
    const roomTitle = document.createElement("h3");
    roomTitle.textContent = "Room Objects";
    roomTitle.style.margin = "0 0 10px 0";
    roomTitle.style.padding = "0 0 5px 0";
    roomTitle.style.borderBottom = "1px solid #ccc";
    this.objectListContainer.appendChild(roomTitle);

    // Create room objects list container
    const roomListElement = document.createElement("ul");
    roomListElement.id = "room-object-list";
    roomListElement.style.listStyle = "none";
    roomListElement.style.padding = "0";
    roomListElement.style.margin = "0 0 20px 0";
    this.objectListContainer.appendChild(roomListElement);

    // Add title for regular objects
    const title = document.createElement("h3");
    title.textContent = "Scene Objects";
    title.style.margin = "0 0 10px 0";
    title.style.padding = "0 0 5px 0";
    title.style.borderBottom = "1px solid #ccc";
    this.objectListContainer.appendChild(title);

    // Create regular objects list container
    const listElement = document.createElement("ul");
    listElement.id = "object-list";
    listElement.style.listStyle = "none";
    listElement.style.padding = "0";
    listElement.style.margin = "0";
    this.objectListContainer.appendChild(listElement);

    // Add to document
    document.body.appendChild(this.objectListContainer);

    // Initial population of both lists
    this.updateObjectList();
  }

  public updateObjectList(): void {
    if (!this.objectListContainer) return;

    const roomListElement =
      this.objectListContainer.querySelector("#room-object-list");
    const listElement = this.objectListContainer.querySelector("#object-list");
    if (!roomListElement || !listElement) return;

    // Clear existing lists
    roomListElement.innerHTML = "";
    listElement.innerHTML = "";

    // Add room objects to the room list
    if (
      this.stateManager.roomObjects &&
      this.stateManager.roomObjects.length > 0
    ) {
      this.stateManager.roomObjects.forEach((room, roomIndex) => {
        // Create room header
        const roomHeader = document.createElement("li");
        roomHeader.style.padding = "5px";
        roomHeader.style.margin = "2px 0";
        roomHeader.style.backgroundColor = "#e0e0e0";
        roomHeader.style.borderRadius = "3px";
        roomHeader.style.cursor = "pointer";
        roomHeader.style.display = "flex";
        roomHeader.style.justifyContent = "space-between";
        roomHeader.style.alignItems = "center";
        roomHeader.style.fontWeight = "bold";

        // Create container for room name
        const roomNameContainer = document.createElement("span");
        roomNameContainer.style.flex = "1";

        // Highlight selected room
        if (this.stateManager.selectedObject === room) {
          roomHeader.style.backgroundColor = "#a0e0a0";
        }

        // Set room name or default name
        const roomName = room.name || `Room ${roomIndex + 1}`;
        roomNameContainer.textContent = roomName;

        // Create rename button for room
        const roomRenameButton = document.createElement("button");
        roomRenameButton.textContent = "✎";
        roomRenameButton.style.marginLeft = "5px";
        roomRenameButton.style.padding = "2px 5px";
        roomRenameButton.style.border = "none";
        roomRenameButton.style.borderRadius = "3px";
        roomRenameButton.style.backgroundColor = "#4CAF50";
        roomRenameButton.style.color = "white";
        roomRenameButton.style.cursor = "pointer";
        roomRenameButton.title = "Rename room";

        // Add click events for room
        roomNameContainer.addEventListener("click", () => {
          this.selectObject(room);
        });

        roomRenameButton.addEventListener("click", (e) => {
          e.stopPropagation();
          this.renameObject(room, roomNameContainer);
        });

        roomHeader.appendChild(roomNameContainer);
        roomHeader.appendChild(roomRenameButton);
        roomListElement.appendChild(roomHeader);

        // Add room children
        room.children.forEach((child, childIndex) => {
          const childItem = document.createElement("li");
          childItem.style.padding = "5px 5px 5px 20px"; // Indent children
          childItem.style.margin = "2px 0";
          childItem.style.backgroundColor = "#f0f0f0";
          childItem.style.borderRadius = "3px";
          childItem.style.cursor = "pointer";
          childItem.style.display = "flex";
          childItem.style.justifyContent = "space-between";
          childItem.style.alignItems = "center";

          // Create container for child name
          const childNameContainer = document.createElement("span");
          childNameContainer.style.flex = "1";

          // Highlight selected child
          if (this.stateManager.selectedObject === child) {
            childItem.style.backgroundColor = "#a0e0a0";
            childNameContainer.style.fontWeight = "bold";
          }

          // Set child name or default name
          const childName = child.name || `${roomName} Part ${childIndex + 1}`;
          childNameContainer.textContent = childName;

          // Create rename button for child
          const childRenameButton = document.createElement("button");
          childRenameButton.textContent = "✎";
          childRenameButton.style.marginLeft = "5px";
          childRenameButton.style.padding = "2px 5px";
          childRenameButton.style.border = "none";
          childRenameButton.style.borderRadius = "3px";
          childRenameButton.style.backgroundColor = "#4CAF50";
          childRenameButton.style.color = "white";
          childRenameButton.style.cursor = "pointer";
          childRenameButton.title = "Rename part";

          // Add click events for child
          childNameContainer.addEventListener("click", () => {
            this.selectObject(child);
          });

          childRenameButton.addEventListener("click", (e) => {
            e.stopPropagation();
            this.renameObject(child, childNameContainer);
          });

          childItem.appendChild(childNameContainer);
          childItem.appendChild(childRenameButton);
          roomListElement.appendChild(childItem);
        });
      });
    } else {
      const emptyMessage = document.createElement("li");
      emptyMessage.textContent = "No rooms in scene";
      emptyMessage.style.fontStyle = "italic";
      emptyMessage.style.color = "#666";
      roomListElement.appendChild(emptyMessage);
    }

    // Add regular objects to the object list
    if (
      this.stateManager.placedObjects &&
      this.stateManager.placedObjects.length > 0
    ) {
      this.stateManager.placedObjects.forEach((object, index) => {
        const listItem = document.createElement("li");
        listItem.style.padding = "5px";
        listItem.style.margin = "2px 0";
        listItem.style.backgroundColor = "#f0f0f0";
        listItem.style.borderRadius = "3px";
        listItem.style.cursor = "pointer";
        listItem.style.display = "flex";
        listItem.style.justifyContent = "space-between";
        listItem.style.alignItems = "center";

        // Create container for object name
        const nameContainer = document.createElement("span");
        nameContainer.style.flex = "1";

        // Highlight selected object
        if (this.stateManager.selectedObject === object) {
          listItem.style.backgroundColor = "#a0e0a0";
          nameContainer.style.fontWeight = "bold";
        }

        // Set object name or default name
        const objectName = object.name || `Object ${index + 1}`;
        nameContainer.textContent = objectName;

        // Create rename button
        const renameButton = document.createElement("button");
        renameButton.textContent = "✎";
        renameButton.style.marginLeft = "5px";
        renameButton.style.padding = "2px 5px";
        renameButton.style.border = "none";
        renameButton.style.borderRadius = "3px";
        renameButton.style.backgroundColor = "#4CAF50";
        renameButton.style.color = "white";
        renameButton.style.cursor = "pointer";
        renameButton.title = "Rename object";

        // Add click event to select the object
        nameContainer.addEventListener("click", () => {
          this.selectObject(object);
        });

        // Add click event to rename the object
        renameButton.addEventListener("click", (e) => {
          e.stopPropagation();
          this.renameObject(object, nameContainer);
        });

        listItem.appendChild(nameContainer);
        listItem.appendChild(renameButton);
        listElement.appendChild(listItem);
      });
    } else {
      const emptyMessage = document.createElement("li");
      emptyMessage.textContent = "No objects in scene";
      emptyMessage.style.fontStyle = "italic";
      emptyMessage.style.color = "#666";
      listElement.appendChild(emptyMessage);
    }
  }

  private renameObject(
    object: THREE.Object3D,
    nameContainer: HTMLElement
  ): void {
    const currentName = object.name || "";
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.style.width = "100%";
    input.style.padding = "2px";
    input.style.marginRight = "5px";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "3px";

    // Replace the text content with input
    const originalContent = nameContainer.textContent;
    nameContainer.textContent = "";
    nameContainer.appendChild(input);
    input.focus();
    input.select();

    const handleRename = () => {
      const newName = input.value.trim();
      if (newName) {
        object.name = newName;
        nameContainer.textContent = newName;
      } else {
        nameContainer.textContent = originalContent;
      }
      this.updateObjectList(); // Refresh the list to update all instances
    };

    input.addEventListener("blur", handleRename);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleRename();
      }
    });
  }

  private selectObject(object: THREE.Object3D): void {
    // Deselect previous object if exists
    if (this.stateManager.selectedObject) {
      this.stateManager.selectedObject.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.emissive.set(0x000000);
        }
      });
    }

    // Select new object
    this.stateManager.setSelectedObject(object);

    // Highlight the selected object
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.emissive.set(0x00ff00);
      }
    });

    // Update the object scale folder
    this.createObjectScaleFolder(object);

    // If the selected object is a lamp, create light controls
    if (object.name.includes("[Lamp]")) {
      this.createLightControls(object);
    } else {
      this.removeLightControls();
    }

    // Update the object list UI to reflect selection
    this.updateObjectList();
  }

  public createLightControls(lampObject: THREE.Object3D): void {
    // Remove existing light controls if any
    this.removeLightControls();

    // Find the point light in the lamp object
    const light = lampObject.children.find(
      (child) => child instanceof THREE.PointLight
    ) as THREE.PointLight;

    if (!light) return;

    // Create light controls folder
    this.lightControlsFolder = this.gui.addFolder("Light Controls");

    // Add intensity control
    this.lightControlsFolder
      .add(light, "intensity", 0, 20, 0.1)
      .name("Intensity")
      .onChange(() => {
        this.stateManager.setLightIntensity(light.intensity);
      });

    // Add distance control
    this.lightControlsFolder
      .add(light, "distance", 0, 200, 1)
      .name("Radius")
      .onChange(() => {
        this.stateManager.setLightDistance(light.distance);
      });

    // Add color control
    // const colorControl = { color: light.color.getHex() };
    // this.lightControlsFolder
    //   .addColor(colorControl, "color")
    //   .name("Color")
    //   .onFinishChange((value) => {
    //     console.log("color", value);
    //     const color = new THREE.Color(value);
    //     this.stateManager.setLightColor(color.getHex());
    //   });

    // Add position controls
    // const positionFolder = this.lightControlsFolder.addFolder("Light Position");
    // positionFolder
    //   .add(light.position, "y", 0, 10, 0.1)
    //   .name("Height")
    //   .onChange(() => {
    //     // Update light helper if it exists
    //     const lightHelper = lampObject.children.find(
    //       (child) => child instanceof THREE.PointLightHelper
    //     );
    //     if (lightHelper) {
    //       lightHelper.update();
    //     }
    //   });
  }

  public removeLightControls(): void {
    if (this.lightControlsFolder) {
      this.lightControlsFolder.destroy();
      this.lightControlsFolder = null;
    }
  }

  private setupToolButtons(): void {
    // Add Lights Placement button
    this.lightsButtonElement = document.createElement("button");
    this.lightsButtonElement.id = "lights-tool";
    this.lightsButtonElement.textContent = "Place Lights";
    this.lightsButtonElement.style.marginTop = "10px";
    this.roomToolElement.parentNode?.insertBefore(
      this.lightsButtonElement,
      this.roomToolElement.nextSibling
    );

    this.lightsButtonElement.addEventListener("click", () => {
      this.toggleLightsPlacement();
    });

    // Add Box Placement button
    this.boxButtonElement = document.createElement("button");
    this.boxButtonElement.id = "box-tool";
    this.boxButtonElement.textContent = "Place Box";
    this.boxButtonElement.style.marginTop = "10px";
    this.roomToolElement.parentNode?.insertBefore(
      this.boxButtonElement,
      this.roomToolElement.nextSibling
    );

    this.boxButtonElement.addEventListener("click", () => {
      this.toggleBoxPlacement();
    });

    // Add Delete Tool button
    this.deleteButtonElement = document.createElement("button");
    this.deleteButtonElement.id = "delete-tool";
    this.deleteButtonElement.textContent = "Delete Tool";
    this.deleteButtonElement.style.marginTop = "10px";
    this.roomToolElement.parentNode?.insertBefore(
      this.deleteButtonElement,
      this.roomToolElement.nextSibling
    );

    this.deleteButtonElement.addEventListener("click", () => {
      this.toggleDeleteTool();
    });

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
    });

    this.roomToolElement.addEventListener("click", (event: MouseEvent) => {
      if (event.button === 0) {
        this.toggleRoomTool();
      }
    });
  }

  public toggleRoomTool(): void {
    this.isRoomToolActive = !this.isRoomToolActive;
    this.isDoorPlacementActive = false;
    this.isDeleteToolActive = false;
    this.isBoxPlacementActive = false;

    this.updateButtonStyles();
    this.controller.setDragControlsEnabled(!this.isRoomToolActive);
    this.canvas.style.cursor = this.isRoomToolActive ? "crosshair" : "default";

    this.stateManager.setRoomToolActive(this.isRoomToolActive);
  }

  public toggleDoorPlacement(): void {
    this.isRoomToolActive = false;
    this.isDeleteToolActive = false;
    this.isDoorPlacementActive = !this.isDoorPlacementActive;
    this.isBoxPlacementActive = false;

    this.updateButtonStyles();
    this.controller.setDragControlsEnabled(!this.isDoorPlacementActive);

    this.stateManager.setDoorPlacementActive(this.isDoorPlacementActive);
  }

  public toggleDeleteTool(): void {
    this.isDeleteToolActive = !this.isDeleteToolActive;
    this.isRoomToolActive = false;
    this.isDoorPlacementActive = false;
    this.isBoxPlacementActive = false;

    this.updateButtonStyles();
    this.canvas.style.cursor = this.isDeleteToolActive
      ? "crosshair"
      : "default";
    this.controller.setDragControlsEnabled(!this.isDeleteToolActive);

    this.stateManager.setDeleteToolActive(this.isDeleteToolActive);
  }

  public toggleBoxPlacement(): void {
    this.isBoxPlacementActive = !this.isBoxPlacementActive;
    this.isRoomToolActive = false;
    this.isDoorPlacementActive = false;
    this.isDeleteToolActive = false;

    this.updateButtonStyles();
    this.controller.setDragControlsEnabled(!this.isBoxPlacementActive);
    this.canvas.style.cursor = this.isBoxPlacementActive
      ? "crosshair"
      : "default";

    this.stateManager.setBoxPlacementActive(this.isBoxPlacementActive);
  }

  public toggleLightsPlacement(): void {
    this.isLightsPlacementActive = !this.isLightsPlacementActive;
    this.isRoomToolActive = false;
    this.isDoorPlacementActive = false;
    this.isDeleteToolActive = false;
    this.isBoxPlacementActive = false;

    this.modelScale = 1.7;
    this.stateManager.setModelScale(1.7);

    this.updateButtonStyles();
    this.stateManager.setLightsPlacementActive(this.isLightsPlacementActive);
    this.controller.setDragControlsEnabled(!this.isLightsPlacementActive);
    this.canvas.style.cursor = this.isLightsPlacementActive
      ? "crosshair"
      : "default";

    if (this.isLightsPlacementActive) {
      this.showLampTypeSelector();
    } else {
      this.cleanupLampTypeSelector();
    }
  }

  private showLampTypeSelector(): void {
    // Remove existing folder if it exists
    this.cleanupLampTypeSelector();

    // Create new folder
    this.lampTypeFolder = this.gui.addFolder("Lamp Types");

    this.lampTypeFolder
      .add({ type: "floor" }, "type", ["floor", "ceiling", "ceiling2", "table"])
      .name("Select Lamp Type")
      .onChange((value) => {
        this.lightsPlacer.setLampType(value);
      });

    // Set default lamp type
    this.lightsPlacer.setLampType("floor");
  }

  private cleanupLampTypeSelector(): void {
    if (this.lampTypeFolder) {
      this.lampTypeFolder.destroy();
      this.lampTypeFolder = null;
    }
  }

  private updateButtonStyles(): void {
    this.deleteButtonElement.style.backgroundColor = this.isDeleteToolActive
      ? "#00ff00"
      : "#fff";
    this.doorButtonElement.style.backgroundColor = this.isDoorPlacementActive
      ? "#00ff00"
      : "#fff";
    this.roomToolElement.style.backgroundColor = this.isRoomToolActive
      ? "#00ff00"
      : "#fff";
    this.boxButtonElement.style.backgroundColor = this.isBoxPlacementActive
      ? "#00ff00"
      : "#fff";
    this.lightsButtonElement.style.backgroundColor = this
      .isLightsPlacementActive
      ? "#00ff00"
      : "#fff";
  }

  public createObjectScaleFolder(selectedObject: THREE.Object3D): void {
    // Remove existing folder if it exists
    if (this.objectScaleFolder) {
      this.objectScaleFolder.destroy();
      this.objectScaleFolder = null;
    }

    // Create scale slider for selected object
    this.objectScaleFolder = this.gui.addFolder("Selected Object");
    const scaleControl = { scale: 1.0 };
    this.objectScaleFolder
      .add(scaleControl, "scale", 0.01, 5.0, 0.01)
      .name("Scale")
      .onChange((value) => {
        if (selectedObject) {
          selectedObject.scale.set(value, value, value);
        }
      });
  }

  public removeObjectScaleFolder(): void {
    if (this.objectScaleFolder) {
      this.objectScaleFolder.destroy();
      this.objectScaleFolder = null;
    }
  }

  public isRoomsSelectableEnabled(): boolean {
    return this.isRoomsSelectable;
  }

  public getModelScale(): number {
    return this.modelScale;
  }

  public getTextureRepeatU(): number {
    return this.textureRepeatU;
  }

  public getTextureRepeatV(): number {
    return this.textureRepeatV;
  }

  public setModelLoader(modelLoader) {
    this.modelLoader = modelLoader;
  }
  public setRoomBuilder(roomBuilder) {
    this.roomBuilder = roomBuilder;
  }
  public setDoorPlacer(doorPlacer) {
    this.doorPlacer = doorPlacer;
  }
  public setTextureManager(textureManager) {
    this.textureManager = textureManager;
  }
  public setStateManager(stateManager) {
    this.stateManager = stateManager;
  }
  public setCommandManager(commandManager) {
    this.commandManager = commandManager;
  }
  public setLightsPlacer(lightsPlacer: LightsPlacer) {
    this.lightsPlacer = lightsPlacer;
  }
}

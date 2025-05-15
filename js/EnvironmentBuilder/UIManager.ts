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

export class UIManager {
  private gui: GUI;
  private controller: Controller;
  private roomToolElement: HTMLButtonElement;
  private doorButtonElement: HTMLButtonElement;
  private deleteButtonElement: HTMLButtonElement;
  private canvas: HTMLCanvasElement;
  private objectLoader: ObjectLoader;
  private modelLoader: ModelLoader;
  private roomBuilder: RoomBuilder;
  private doorPlacer: DoorPlacer;
  private textureManager: TextureManager;
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private objectScaleFolder: GUI | null = null;
  public isRoomToolActive: boolean = false;
  public isDoorPlacementActive: boolean = false;
  public isDeleteToolActive: boolean = false;
  public isRoomsSelectable: boolean = false;
  public modelScale: number = 0.7;
  public textureRepeatU: number = 1;
  public textureRepeatV: number = 1;

  constructor(stateManager: StateManager, controller: Controller, gui: GUI) {
    this.gui = gui;
    this.stateManager = stateManager;
    this.controller = controller;
    this.canvas = document.querySelector("canvas");
    this.roomToolElement = document.querySelector("button#room-tool");

    this.setupGUI();
  }

  public setObjectLoader(objectLoader: ObjectLoader): void {
    this.objectLoader = objectLoader;
    this.setupGUI();
    this.setupToolButtons();
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
      .add({ repeatU: this.textureRepeatU }, "repeatU", 0.25, 5, 0.25)
      .name("Texture Repeat U")
      .onChange((value) => {
        this.textureRepeatU = value;
        this.stateManager.setTextureRepeatU(value);
      });

    textureFolder
      .add({ repeatV: this.textureRepeatV }, "repeatV", 0.25, 5, 0.25)
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

  private setupToolButtons(): void {
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

    this.updateButtonStyles();
    this.controller.setDragControlsEnabled(!this.isRoomToolActive);
    this.canvas.style.cursor = this.isRoomToolActive ? "crosshair" : "default";

    this.stateManager.setRoomToolActive(this.isRoomToolActive);
  }

  public toggleDoorPlacement(): void {
    this.isRoomToolActive = false;
    this.isDeleteToolActive = false;
    this.isDoorPlacementActive = !this.isDoorPlacementActive;

    this.updateButtonStyles();
    this.controller.setDragControlsEnabled(!this.isDoorPlacementActive);

    this.stateManager.setDoorPlacementActive(this.isDoorPlacementActive);
  }

  public toggleDeleteTool(): void {
    this.isDeleteToolActive = !this.isDeleteToolActive;
    this.isRoomToolActive = false;
    this.isDoorPlacementActive = false;

    this.updateButtonStyles();
    this.canvas.style.cursor = this.isDeleteToolActive
      ? "crosshair"
      : "default";
    this.controller.setDragControlsEnabled(!this.isDeleteToolActive);

    this.stateManager.setDeleteToolActive(this.isDeleteToolActive);
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
      .add(scaleControl, "scale", 0.1, 3.0, 0.1)
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
}

import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { SceneSetup } from "./SceneSetup";
import { Controller } from "./Controller";
import { StateManager } from "./core/StateManager";
import { CommandManager } from "./core/CommandManager";
import { ModelLoader } from "./tools/ModelLoader";
import { RoomBuilder } from "./tools/RoomBuilder";
import { DoorPlacer } from "./tools/DoorPlacer";
import { TextureManager } from "./tools/TextureManager";
import { UIManager } from "./UIManager";
import { EventManager } from "./EventManager";
import { BoxPlacer } from "./tools/BoxPlacer";
import { LightsPlacer } from "./tools/LightsPlacer";

export class EnvironmentBuilder {
  private container: HTMLElement;
  private sceneSetup: SceneSetup;
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private modelLoader: ModelLoader;
  private roomBuilder: RoomBuilder;
  private doorPlacer: DoorPlacer;
  private lightsPlacer: LightsPlacer;
  private textureManager: TextureManager;
  private boxPlacer: BoxPlacer;
  private uiManager: UIManager;
  private eventManager: EventManager;
  private controller: Controller;

  constructor(container: HTMLElement) {
    this.container = container;

    // Initialize core systems
    this.stateManager = new StateManager();
    this.commandManager = new CommandManager();

    // Initialize scene
    this.sceneSetup = new SceneSetup(container, this.stateManager);

    // Initialize controller
    this.controller = new Controller(this.stateManager);

    // Initialize tools
    this.modelLoader = new ModelLoader(this.stateManager, this.commandManager);

    this.roomBuilder = new RoomBuilder(this.stateManager);

    this.doorPlacer = new DoorPlacer(this.stateManager);

    this.lightsPlacer = new LightsPlacer(this.stateManager);

    this.textureManager = new TextureManager(this.stateManager);

    this.boxPlacer = new BoxPlacer(this.stateManager, this.commandManager);

    // Initialize UI and event handling
    this.uiManager = new UIManager(
      this.stateManager,
      this.controller,
      new GUI()
    );
    this.eventManager = new EventManager(this.stateManager, this.controller);

    // Connect components
    this.setupConnections();

    // Setup event listeners
    this.setupEventListeners();

    // Handle window resize
    window.addEventListener("resize", this.onWindowResize.bind(this));

    // Start animation loop
    this.animate();
  }

  private setupConnections(): void {
    // Connect UI manager to tools
    this.uiManager.setModelLoader(this.modelLoader);
    this.uiManager.setRoomBuilder(this.roomBuilder);
    this.uiManager.setDoorPlacer(this.doorPlacer);
    this.uiManager.setTextureManager(this.textureManager);
    this.uiManager.setStateManager(this.stateManager);
    this.uiManager.setCommandManager(this.commandManager);
    this.uiManager.setLightsPlacer(this.lightsPlacer);

    // Connect controller to UI manager
    this.controller.setUIManager(this.uiManager);

    // Connect event manager to tools and UI
    this.eventManager.setModelLoader(this.modelLoader);
    this.eventManager.setRoomBuilder(this.roomBuilder);
    this.eventManager.setDoorPlacer(this.doorPlacer);
    this.eventManager.setTextureManager(this.textureManager);
    this.eventManager.setStateManager(this.stateManager);
    this.eventManager.setCommandManager(this.commandManager);
    this.eventManager.setUIManager(this.uiManager);
    this.eventManager.setBoxPlacer(this.boxPlacer);
  }

  private setupEventListeners(): void {
    // Set up event handlers for controller
    this.controller.setEventHandler(
      (object) => {
        this.modelLoader.removePlacedObject(object);
      },
      () => {
        this.commandManager.undo();
      }
    );

    // Setup keyboard shortcuts
    window.addEventListener("keydown", (event) => {
      // Ctrl+Z - Undo
      if (event.ctrlKey && event.key === "z") {
        this.commandManager.undo();
      }

      // Ctrl+Y - Redo
      if (event.ctrlKey && event.key === "y") {
        this.commandManager.redo();
      }

      // Delete - Remove selected object
      if (event.key === "Delete") {
        const selectedObject = this.stateManager.getSelectedObject();
        if (selectedObject) {
          // Remove from placedObjects and scene
          this.modelLoader.removePlacedObject(selectedObject);

          // Remove from dragControls.objects
          if (this.stateManager.dragControls) {
            const index =
              this.stateManager.dragControls.objects.indexOf(selectedObject);
            if (index !== -1) {
              this.stateManager.dragControls.objects.splice(index, 1);
            }
          }

          this.stateManager.setSelectedObject(null);
        }
      }
    });

    // Setup state change listeners
    this.stateManager.subscribe("roomToolActive", (active: boolean) => {
      if (active) {
        this.eventManager.setupRoomToolHandlers();
      } else {
        this.eventManager.removeRoomToolHandlers();
        this.roomBuilder.cleanupRoomPreview();
      }
    });

    this.stateManager.subscribe("doorPlacementActive", (active: boolean) => {
      if (active) {
        this.eventManager.setupDoorPlacementHandlers();
        this.doorPlacer.setupDoorPlacement();
      } else {
        this.eventManager.removeDoorPlacementHandlers();
        this.doorPlacer.cleanupDoorPlacement();
      }
    });

    this.stateManager.subscribe("boxPlacementActive", (active: boolean) => {
      if (active) {
        this.eventManager.setupBoxPlacementHandlers();
      } else {
        this.eventManager.removeBoxPlacementHandlers();
      }
    });

    // Setup event listeners
    this.eventManager.setupEventListeners();
  }

  private onWindowResize(): void {
    this.stateManager.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.stateManager.camera.updateProjectionMatrix();
    this.stateManager.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.controller.onWindowResize();
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    this.controller.update();
    this.stateManager.renderer.render(
      this.stateManager.scene,
      this.stateManager.camera
    );
  }

  public setSceneSize(size: number): void {
    this.sceneSetup.setSceneSize(size);
  }

  // Public API methods
  public getScene(): THREE.Scene {
    return this.stateManager.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.stateManager.camera;
  }

  public getModelLoader(): ModelLoader {
    return this.modelLoader;
  }

  public getRoomBuilder(): RoomBuilder {
    return this.roomBuilder;
  }

  public getDoorPlacer(): DoorPlacer {
    return this.doorPlacer;
  }

  public getTextureManager(): TextureManager {
    return this.textureManager;
  }

  public getStateManager(): StateManager {
    return this.stateManager;
  }

  public getCommandManager(): CommandManager {
    return this.commandManager;
  }
}

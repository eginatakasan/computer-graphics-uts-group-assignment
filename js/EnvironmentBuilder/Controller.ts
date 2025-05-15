import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { SceneSetup } from "./SceneSetup";
import { UIManager } from "./UIManager";
import { StateManager } from "./core/StateManager";

const WALL_NAMES = ["frontWall", "backWall", "leftWall", "rightWall"];

export class Controller {
  private controls: MapControls;
  private sceneSetup: SceneSetup;
  private dragControls: DragControls;
  private stateManager: StateManager;

  private isRotating: boolean = false;
  private lastMousePosition: THREE.Vector2 = new THREE.Vector2();
  private originalPosition: THREE.Vector3 = new THREE.Vector3();
  private isColliding: boolean = false;
  public onUndo: () => void;
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public onDelete: (object: THREE.Object3D) => void;

  private uiManager: UIManager;

  constructor(sceneSetup: SceneSetup, stateManager: StateManager) {
    this.sceneSetup = sceneSetup;
    this.stateManager = stateManager;

    this.scene = stateManager.scene;
    this.renderer = stateManager.renderer;

    this.setupControls(stateManager.renderer);
    this.setupDragControls(stateManager.renderer, stateManager.camera);
    this.setupUndoListener();

    stateManager.dragControls = this.dragControls;
    stateManager.controls = this.controls;
  }

  private setupUndoListener(): void {
    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "z") {
        this.undo();
      }
    });
  }

  public undo(): void {
    if (this.onUndo) {
      this.onUndo();
    }
  }

  private setupControls(renderer: THREE.WebGLRenderer): void {
    this.controls = new MapControls(
      this.stateManager.camera,
      renderer.domElement
    );
    this.controls.mouseButtons.LEFT = undefined;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.keyPanSpeed = 20;
    this.controls.keys = {
      LEFT: "KeyA",
      UP: "KeyW",
      RIGHT: "KeyD",
      BOTTOM: "KeyS",
    };
    this.controls.listenToKeyEvents(window);
    this.controls.enablePan = true;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.enableZoom = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
  }

  private setupDragControls(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera
  ): void {
    this.dragControls = new DragControls([], camera, renderer.domElement);

    window.addEventListener("mousedown", (event) => {
      if (
        event.button === THREE.MOUSE.RIGHT &&
        this.stateManager.selectedObject
      ) {
        this.lastMousePosition.copy(
          new THREE.Vector2(event.clientX, event.clientY)
        );
        this.isRotating = true;
      }
    });

    // Add keydown event listener for keyboard shortcuts
    window.addEventListener("keydown", (event) => {
      // Delete key - remove selected object
      if (event.key === "Delete" && this.stateManager.selectedObject) {
        let objectToDelete = this.stateManager.selectedObject;
        console.log("Selected object:", objectToDelete.toJSON());
        if (
          objectToDelete.parent &&
          this.stateManager.placedObjects.includes(objectToDelete.parent)
        ) {
          objectToDelete = objectToDelete.parent;
        }
        console.log(objectToDelete.toJSON());
        // Remove object from scene
        this.scene.remove(objectToDelete);
        this.sceneSetup.scene.remove(objectToDelete);

        // Remove object from drag controls
        // const index = this.dragControls.objects.indexOf(this.selectedObject);
        // if (index !== -1) {
        //   this.dragControls.objects.splice(index, 1);
        // }

        // Remove object from placed objects
        // this.onDelete(this.selectedObject);

        // Clear selected object
        this.stateManager.selectedObject = null;
      }

      // Ctrl+C - copy selected object
      if (
        event.ctrlKey &&
        event.key === "c" &&
        this.stateManager.selectedObject
      ) {
        console.log("Copying object:", this.stateManager.selectedObject.name);
        this.copySelectedObject();
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

    window.addEventListener("mousemove", (event) => {
      if (this.isRotating) {
        const dx = (event.clientX - this.lastMousePosition.x) / 20;
        const snapConstant = THREE.MathUtils.degToRad(45);
        const euler = new THREE.Euler(
          0,
          Math.round(dx / snapConstant) * snapConstant,
          0,
          THREE.Euler.DEFAULT_ORDER
        );
        this.stateManager.selectedObject.rotation.copy(euler);
      }
    });

    window.addEventListener("mouseup", () => {
      this.isRotating = false;
    });

    this.dragControls.transformGroup = true;
    this.dragControls.addEventListener("dragstart", (event) => {
      if (this.dragControls.enabled) {
        this.controls.enabled = false;
        this.stateManager.selectedObject = event.object;
        this.originalPosition.copy(event.object.position);
        this.isColliding = false;
        event.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material.emissive.set(0x00ff00);
          }
        });
      }
    });

    this.dragControls.addEventListener("drag", (event) => {
      if (this.dragControls.enabled) {
        event.object.position.y = 0;

        const newPosition = new THREE.Vector3(
          event.object.position.x,
          event.object.position.y,
          event.object.position.z
        );
        event.object.position.copy(newPosition);
      }
    });

    this.dragControls.addEventListener("dragend", (event) => {
      if (this.dragControls.enabled) {
        this.controls.enabled = true;

        this.stateManager.selectedObject = null;
        event.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material.emissive.set(0x000000);
          }
        });
      }
    });
  }

  // TODO: This is a temporary function to check collisions with walls
  private checkCollisions(
    object: THREE.Group<THREE.Object3DEventMap>,
    newPosition: THREE.Vector3
  ): boolean {
    // Create a temporary box for the object at its new position
    const tempBox = new THREE.Box3().setFromObject(object);
    const offset = newPosition.sub(object.position);
    tempBox.translate(offset);

    // Check collisions with walls
    let isCollidingWithWall = false;
    this.scene.traverse((child) => {
      if (WALL_NAMES.includes(child.name)) {
        const wallBox = new THREE.Box3().setFromObject(child);

        if (tempBox.intersectsBox(wallBox)) {
          isCollidingWithWall = true;
        }
      }
    });

    if (isCollidingWithWall) return true;

    // Check collisions with other objects
    for (const otherObject of this.stateManager.placedObjects) {
      if (otherObject !== object && otherObject.name !== "room") {
        const otherBox = new THREE.Box3().setFromObject(otherObject);

        if (tempBox.intersectsBox(otherBox)) {
          return true;
        }
      }
    }
    return false;
  }

  // TODO: This is a temporary function to check collisions with walls
  public checkObjectCollisions(
    object: THREE.Object3D,
    newPosition: THREE.Vector3
  ): boolean {
    return this.checkCollisions(object as THREE.Group, newPosition);
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.stateManager.camera;
  }

  public getControls(): MapControls {
    return this.controls;
  }

  public getDragControls(): DragControls {
    return this.dragControls;
  }

  public setDragControlsEnabled(enabled: boolean): void {
    this.dragControls.enabled = enabled;
  }

  public onWindowResize(): void {
    this.stateManager.camera.aspect = window.innerWidth / window.innerHeight;
    this.stateManager.camera.updateProjectionMatrix();
  }

  public update(): void {
    this.controls.update();
  }

  public setMapControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  public setOnUndo(onUndo: () => void): void {
    this.onUndo = onUndo;
  }

  public setOnDelete(onDelete: (object: THREE.Object3D) => void): void {
    this.onDelete = onDelete;
  }

  public setEventHandler(
    onDelete: (object: THREE.Object3D) => void,
    onUndo: () => void
  ): void {
    this.onDelete = onDelete;
    this.onUndo = onUndo;
  }

  public copySelectedObject(): void {
    if (!this.stateManager.selectedObject) return;

    // Clone the selected object
    const clone = this.stateManager.selectedObject.clone();

    // Offset the position slightly to make it visible
    clone.position.x += 1;
    clone.position.z += 1;

    // Add to scene
    this.scene.add(clone);

    // Add to drag controls objects
    this.dragControls.objects.push(clone);

    // Add to placed objects
    if (this.stateManager.placedObjects) {
      this.stateManager.placedObjects.push(clone);
    }

    console.log("Object copied and placed in scene");
  }

  public getUIManager(): UIManager {
    return this.uiManager;
  }
}

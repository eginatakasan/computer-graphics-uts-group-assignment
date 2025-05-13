import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { SceneSetup } from "./SceneSetup";
import { ObjectLoader } from "./ObjectLoader";

const WALL_NAMES = ["frontWall", "backWall", "leftWall", "rightWall"];

export class Controller {
  private camera: THREE.PerspectiveCamera;
  private controls: MapControls;
  private dragControls: DragControls;
  private selectedObject: THREE.Object3D | null = null;
  private isRotating: boolean = false;
  private lastMousePosition: THREE.Vector2 = new THREE.Vector2();
  private originalPosition: THREE.Vector3 = new THREE.Vector3();
  private isColliding: boolean = false;
  private placedObjects: THREE.Object3D[] = [];
  private onUndo: () => void;
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public onDelete: (object: THREE.Object3D) => void;

  constructor(sceneSetup: SceneSetup, placedObjects: THREE.Object3D[]) {
    this.scene = sceneSetup.getScene();
    this.renderer = sceneSetup.getRenderer();
    this.setupCamera();
    this.setupControls(this.renderer);
    this.setupDragControls(this.renderer);
    this.placedObjects = placedObjects;
    this.setupUndoListener();
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

  private setupCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
  }

  private setupControls(renderer: THREE.WebGLRenderer): void {
    this.controls = new MapControls(this.camera, renderer.domElement);
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

  private setupDragControls(renderer: THREE.WebGLRenderer): void {
    this.dragControls = new DragControls([], this.camera, renderer.domElement);

    window.addEventListener("mousedown", (event) => {
      if (event.button === THREE.MOUSE.RIGHT && this.selectedObject) {
        this.lastMousePosition.copy(
          new THREE.Vector2(event.clientX, event.clientY)
        );
        this.isRotating = true;
      }
    });

    // Add keydown event listener for DELETE key
    window.addEventListener("keydown", (event) => {
      if (event.key === "Delete" && this.selectedObject) {
        // Remove object from scene
        this.scene.remove(this.selectedObject);

        // Remove object from drag controls
        const index = this.dragControls.objects.indexOf(this.selectedObject);
        if (index !== -1) {
          this.dragControls.objects.splice(index, 1);
        }

        // Remove object from placed objects
        this.onDelete(this.selectedObject);

        // Clear selected object
        this.selectedObject = null;
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
        this.selectedObject.rotation.copy(euler);
      }
    });

    window.addEventListener("mouseup", () => {
      this.isRotating = false;
    });

    this.dragControls.transformGroup = true;
    this.dragControls.addEventListener("dragstart", (event) => {
      if (this.dragControls.enabled) {
        this.controls.enabled = false;
        this.selectedObject = event.object;
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
          0,
          event.object.position.z
        );
        event.object.position.copy(newPosition);

        // // Check for collisions
        // const isColliding = this.checkObjectCollisions(
        //   event.object,
        //   newPosition
        // );

        // if (isColliding !== this.isColliding) {
        //   this.isColliding = isColliding;
        //   event.object.traverse((child) => {
        //     if (child instanceof THREE.Mesh) {
        //       child.material.emissive.set(isColliding ? 0xff0000 : 0x00ff00);
        //     }
        //   });
        // }
      }
    });

    this.dragControls.addEventListener("dragend", (event) => {
      if (this.dragControls.enabled) {
        this.controls.enabled = true;

        this.selectedObject = null;
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
    for (const otherObject of this.placedObjects) {
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
    return this.camera;
  }

  public getControls(): MapControls {
    return this.controls;
  }

  public getDragControls(): DragControls {
    return this.dragControls;
  }

  public onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  public update(): void {
    this.controls.update();
  }

  public setMapControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  public setDragControlsEnabled(enabled: boolean): void {
    this.dragControls.enabled = enabled;
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
}

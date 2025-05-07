import * as THREE from "three";
import { SINGLE_BED, SMALL_BOOKSHELF } from "../../public/models";
import { SceneSetup } from "./SceneSetup";
import { Controller } from "./Controller";
import { ObjectLoader } from "./ObjectLoader";

export class HouseBuildingSimulator {
  private sceneSetup: SceneSetup;
  private controllerSetup: Controller;
  private objectLoader: ObjectLoader;
  private placedObjects: THREE.Object3D<THREE.Object3DEventMap>[] = [];

  constructor(container: HTMLElement) {
    // Initialize scene
    this.sceneSetup = new SceneSetup(container);

    // Initialize camera
    this.controllerSetup = new Controller(this.sceneSetup, this.placedObjects);

    // Initialize object loader
    this.objectLoader = new ObjectLoader(
      this.sceneSetup.getScene(),
      this.controllerSetup,
      this.sceneSetup.getGUI(),
      this.sceneSetup,
      container,
      this.placedObjects
    );

    // Handle window resizde
    window.addEventListener("resize", this.onWindowResize.bind(this));

    // Start animation loop
    this.animate();
  }

  private onWindowResize(): void {
    this.sceneSetup.onWindowResize();
    this.controllerSetup.onWindowResize();
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    this.controllerSetup.update();
    this.sceneSetup
      .getRenderer()
      .render(this.sceneSetup.getScene(), this.controllerSetup.getCamera());
  }

  public setSceneSize(size: number): void {
    this.sceneSetup.setSceneSize(size);
  }
}

// Initialize the scene
const container = document.getElementById("container");
if (container) {
  const scene = new HouseBuildingSimulator(container);
  scene.setSceneSize(200);
}

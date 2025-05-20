import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { StateManager } from "./core/StateManager";

export class SceneSetup {
  public scene: THREE.Scene;
  public stateManager: StateManager;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private gridHelper: THREE.GridHelper;
  private sceneSize: number = 100;
  public ground: THREE.Mesh;

  public setup(container: HTMLElement): void {
    this.setupScene();
    this.setupRenderer(container);
    this.setupGrid();
    this.setupLights();
    this.setupCamera();
  }

  constructor(container: HTMLElement, stateManager: StateManager) {
    this.scene = new THREE.Scene();
    this.setup(container);
    this.stateManager = stateManager;
    stateManager.scene = this.scene;
    stateManager.camera = this.camera;
    stateManager.renderer = this.renderer;
    stateManager.gridHelper = this.gridHelper;

    this.stateManager.subscribe("resetScene", () => {
      this.resetScene();
    });
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0x1a1a1a);

    // add ground
    const grassTexture = new THREE.TextureLoader().load("/textures/grass.jpg");
    grassTexture.repeat = new THREE.Vector2(50, 50);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    const material = new THREE.MeshLambertMaterial({
      map: grassTexture,
      side: THREE.DoubleSide,
    });
    // this.ground = new THREE.Mesh(
    //   new THREE.PlaneGeometry(this.sceneSize * 2, this.sceneSize * 2),
    //   material
    // );
    // this.ground.name = "ground";
    // this.ground.rotation.x = -Math.PI / 2;
    // this.ground.position.y = -0.5;
    // this.scene.add(this.ground);
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

  private setupRenderer(container: HTMLElement): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);
  }

  private setupGrid(): void {
    this.gridHelper = new THREE.GridHelper(this.sceneSize, this.sceneSize / 2);
    this.scene.add(this.gridHelper);
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public setSceneSize(size: number): void {
    this.sceneSize = size;
    this.scene.remove(this.gridHelper);
    this.gridHelper = new THREE.GridHelper(size, size / 2);
    this.scene.add(this.gridHelper);
  }

  public onWindowResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public resetScene(): void {
    this.setupGrid();
    this.setupLights();
    this.setupCamera();
  }
}

import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

export class SceneSetup {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private gridHelper: THREE.GridHelper;
  private gui: GUI;
  private sceneSize: number = 100;
  public ground: THREE.Mesh;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.setupScene();
    this.setupRenderer(container);
    this.setupGrid();
    this.setupLights();
    this.setupGUI();
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
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.sceneSize * 2, this.sceneSize * 2),
      material
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.5;
    this.scene.add(this.ground);
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
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  private setupGUI(): void {
    this.gui = new GUI();
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getGUI(): GUI {
    return this.gui;
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
}

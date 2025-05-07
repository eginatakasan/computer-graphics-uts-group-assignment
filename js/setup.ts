import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RoomConstructor } from "./rooms";

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const roomConstructor = RoomConstructor(gltfLoader, textureLoader);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

async function loadPositions(path?: string) {
  if (path) {
    try {
      const response = await fetch(path);
      const json = await response.json();

      // Clear existing objects from scene
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }

      // Load the objects from JSON
      new THREE.ObjectLoader().parse(json, (object) => {
        scene.add(object);
      });
    } catch (error) {
      console.error("Error loading positions:", error);
    }
    return;
  }

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

          // Clear existing objects from scene
          while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
          }

          // Load the objects from JSON
          new THREE.ObjectLoader().parse(json, (object) => {
            scene.add(object);
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

function setup() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

  // const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  // scene.add(ambientLight);

  // var hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  // hemiLight.position.set(0, 1, 0);
  // scene.add(hemiLight);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 8, 15);

  const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  window.addEventListener("resize", onWindowResize);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.enableZoom = true;

  // Add load positions button
  // const loadButton = document.createElement("button");
  // loadButton.textContent = "Load Positions";
  // loadButton.style.position = "absolute";
  // loadButton.style.top = "10px";
  // loadButton.style.left = "10px";
  // loadButton.style.zIndex = "1000";
  // loadButton.onclick = loadPositions;
  // document.body.appendChild(loadButton);

  // const livingRoom = roomConstructor.createLivingRoom(
  //   new THREE.Vector3(0, 0, 0)
  // );
  // scene.add(livingRoom);
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
}

setup();
loadPositions("/positions/example.json");
renderer.setAnimationLoop(animate);

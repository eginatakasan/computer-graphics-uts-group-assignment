import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export function loadModelAtPosition(
  loader: GLTFLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3
) {
  loader.load(path, function (gltf) {
    const object = gltf.scene;
    scene.add(object);
    object.position.set(position.x, position.y, position.z);
  });
}

export function loadModelAtGroundLevel(
  loader: GLTFLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3
) {
  loader.load(path, function (gltf) {
    const object = gltf.scene;
    scene.add(object);

    if (object.isObject3D) {
      const box = new THREE.Box3().setFromObject(object);

      const size = box.getSize(new THREE.Vector3());
      const height = size.y;

      object.position.set(position.x, height / 2, position.z);
    }
  });
}

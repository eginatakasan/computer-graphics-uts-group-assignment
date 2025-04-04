import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function setMaterial(parent: THREE.Group) {
  parent.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const mesh = object as THREE.Mesh;
      // if (object.name === type) {
      if (mesh.material instanceof THREE.Material) {
        if (
          mesh.material instanceof THREE.MeshStandardMaterial ||
          mesh.material instanceof THREE.MeshPhongMaterial ||
          mesh.material instanceof THREE.MeshToonMaterial ||
          mesh.material instanceof THREE.MeshBasicMaterial
        ) {
          console.log(mesh.material);
          mesh.material.flatShading = true;
          mesh.material.metalness = 0;
          // mesh.material.emissive = new THREE.Color(0x00ff00); // Add emissive property
          // mesh.material.emissiveIntensity = 0.5; // Control emissive intensity
        }
      }
      // }
    }
  });
}

export function loadModelAtPosition(
  loader: FBXLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  color?: THREE.Color
) {
  loader.load(path, function (geometry) {
    const object = geometry;
    object.castShadow = true;
    object.receiveShadow = true;

    scene.add(object);
    object.position.set(position.x, position.y, position.z);

    setMaterial(object, color);
  });
}

export function loadModelAtGroundLevel(
  loader: GLTFLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  color?: THREE.Color
) {
  loader.load(path, function (geometry) {
    const object = geometry.scene;

    object.castShadow = true;
    object.receiveShadow = true;

    if (object.isObject3D) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      var sca = new THREE.Matrix4();
      var tra = new THREE.Matrix4();

      var scale = 5 / size.length();

      sca.makeScale(scale, scale, scale);
      box.applyMatrix4(sca);
      tra.makeTranslation(position.x, -box.min.y, position.z);

      object.applyMatrix4(sca);
      object.applyMatrix4(tra);

      // object.traverse((object) => {
      //   if (object instanceof THREE.Mesh && object.isMesh) {
      //     object.material.metalness = 0;
      //   }
      // });

      setMaterial(object);

      scene.add(object);
    }
  });
}

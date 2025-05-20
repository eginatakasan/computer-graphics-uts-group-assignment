import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function setMaterial(parent: THREE.Group) {
  parent.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const mesh = object as THREE.Mesh;
      // if (object.name === type) {
      if (mesh.material instanceof THREE.Material) {
        const material = new THREE.MeshLambertMaterial({
          ...mesh.material,
        });
        if (
          mesh.material instanceof THREE.MeshStandardMaterial ||
          mesh.material instanceof THREE.MeshPhongMaterial ||
          mesh.material instanceof THREE.MeshToonMaterial ||
          mesh.material instanceof THREE.MeshBasicMaterial
        ) {
          console.log(mesh.material);
          mesh.material = material;
        }
      }
    }
  });
}

export function loadModelAtPosition(
  loader: GLTFLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  transform?: THREE.Matrix4,
  color?: THREE.Color
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  let result = null;
  return new Promise((resolve) => {
    loader.load(path, function (geometry) {
      const object = geometry.scene;

      object.castShadow = true;
      object.receiveShadow = true;

      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      var sca = new THREE.Matrix4();
      var tra = new THREE.Matrix4();

      var scale = 3;

      sca.makeScale(scale, scale, scale);
      box.applyMatrix4(sca);
      tra.makeTranslation(position.x, -box.min.y + position.y, position.z);

      var combinedTransform = new THREE.Matrix4();
      combinedTransform.multiply(tra);
      combinedTransform.multiply(sca);

      if (transform) {
        combinedTransform.multiply(transform);
      }
      object.applyMatrix4(combinedTransform);

      setMaterial(object);

      scene.add(object);
      result = object;
      resolve(result);
    });
  });
}

export async function loadModelAtGroundLevel(
  loader: GLTFLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  transform?: THREE.Matrix4,
  color?: THREE.Color
) {
  const object = await loadModelAtPosition(
    loader,
    path,
    scene,
    new THREE.Vector3(position.x, 0, position.z),
    transform,
    color
  );
  return object;
}

export const loadLightsAtGroundLevel = async (
  loader: GLTFLoader,
  path: string,
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  transform?: THREE.Matrix4,
  color?: THREE.Color
) => {
  const object = await loadModelAtGroundLevel(
    loader,
    path,
    scene,
    position,
    transform,
    color
  );

  const box = new THREE.Box3().setFromObject(object);
  const light = new THREE.PointLight(color, 10);
  light.position.set(position.x, box.max.y, position.z);
  light.visible = true;

  const helper = new THREE.PointLightHelper(light, 1);
  scene.add(light);
  scene.add(helper);
};

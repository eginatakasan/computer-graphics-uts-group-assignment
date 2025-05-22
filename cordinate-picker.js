import * as THREE from "three";

export function enableCoordinatePicking(scene, camera, controls, options = {}) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const isPickingMode = options.modeRef || { value: false };

    const onClick = (event) => {
        if (!controls.isLocked || !isPickingMode.value) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;

            console.log(`📌 Mess Point:`);
            console.log(`"position": {  "x": ${point.x.toFixed(2)},  "y": ${point.y.toFixed(2)},  "z": ${point.z.toFixed(2)}},`);
            const marker = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            marker.position.copy(point);
            scene.add(marker);
        }
    };

    document.addEventListener("click", onClick);
    console.log("🛠️ Coordinate picking enabled (toggle mode with 'P').");

    return isPickingMode;
}
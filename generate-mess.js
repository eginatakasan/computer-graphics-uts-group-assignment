import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ----- UTILITY FUNCTIONS -----

const gltfLoader = new GLTFLoader();

/**
 * Loads and places a random paper ball model at the given position.
 */
export function loadPaperBall(scene, position, interactables = []) {
    const modelPath = '/models/paper_ball1.glb';
    const scale = 0.5;

    gltfLoader.load(modelPath, (gltf) => {
        const paperGroup = gltf.scene;

        paperGroup.position.set(position.x, position.y + 0.15, position.z);
        paperGroup.rotation.y = Math.random() * Math.PI * 2;
        paperGroup.scale.setScalar(scale);

        // Traverse and register all mesh children as interactable
        paperGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.isMess = true;
                child.userData.type = 'paperBall';
                child.userData.isInteractable = true;
                child.userData.object_type = 'paperBall';

                interactables.push(child); // ✅ Now mesh can be interacted with
            }
        });

        scene.add(paperGroup);
    }, undefined, (error) => {
        console.error("❌ Failed to load paper ball model:", error);
    });
}


// Organic stain mesh
export function createStainMesh(position, location = "floor", options = {}, interactables = []) {
    const {
        radius = 0.4,
        points = 16,
        noiseFactor = 0.4,
        color = Math.random() < 0.5 ? 0x5c3317 : 0x7b1113
    } = options;

    const shape = new THREE.Shape();
    const angleStep = (Math.PI * 2) / points;

    for (let i = 0; i <= points; i++) {
        const angle = i * angleStep;
        const r = radius * (1 - noiseFactor / 2 + Math.random() * noiseFactor);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const stain = new THREE.Mesh(geometry, material);

    // Align based on location
    if (location === "floor") {
        stain.rotation.x = -Math.PI / 2;
        stain.position.set(position.x, position.y + 0.01, position.z);
    } else if (location === "faceWall") {
        stain.rotation.z = Math.PI / 2;
        stain.position.set(position.x, position.y, position.z + 0.01); // push off wall
    } else if (location === "sideWall") {
        stain.rotation.z = Math.PI / 2;
        stain.rotation.y = Math.PI / 2;
        stain.position.set(position.x + 0.01, position.y, position.z);
    }

    stain.userData.isMess = true;
    stain.userData.type = "stain";
    stain.userData.subtype = "wallStain";
    stain.userData.isInteractable = true;
    stain.userData.object_type = "stain";

    interactables.push(stain);
    return stain;
}


// Utility: pick N random positions from array
function pickRandomPositions(arr, count) {
    return arr.sort(() => 0.5 - Math.random()).slice(0, count);
}



//dust bunnies?
export function createDustBunny(position, interactables = []) {
    const group = new THREE.Group();
    const strandCount = 40;
    const colors = [0x2e2e2e, 0x3a3a3a, 0x4b4b4b];

    function randomSpherePoint(radius = 0.2) {
        let v;
        do {
            v = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            );
        } while (v.lengthSq() > 1);
        return v.multiplyScalar(radius);
    }

    for (let i = 0; i < strandCount; i++) {
        const controlPoints = Array.from({ length: 8 }).map(() => randomSpherePoint(0.2));
        const curve = new THREE.CatmullRomCurve3(controlPoints);
        curve.tension = 0.5;

        const geometry = new THREE.TubeGeometry(curve, 50, 0.002, 4, false);
        const material = new THREE.MeshStandardMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            roughness: 1,
            metalness: 0
        });

        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
    }

    group.position.set(position.x, position.y + 0.01, position.z);
    group.scale.setScalar(0.8);

    // Traverse and mark individual meshes as interactable
    const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false }) // set visible: true for debugging
    );
    proxy.position.copy(group.position);
    proxy.userData.isMess = true;
    proxy.userData.type = "debris";
    proxy.userData.subtype = "dustBunny";
    proxy.userData.isInteractable = true;
    proxy.userData.object_type = "dustBunny";
    proxy.userData.ownerGroup = group; // link to the visual group

    interactables.push(proxy);

    return { group, proxy };
}

//clothes mess
export function loadClothesMess(scene, position, interactables = []) {
    gltfLoader.load('/models/clothes_mess.glb', (gltf) => {
        const messGroup = gltf.scene;

        messGroup.position.copy(position);
        messGroup.scale.setScalar(0.5);
        messGroup.rotation.y = Math.random() * Math.PI * 2;

        // ✅ Traverse all children and register meshes as interactable
        messGroup.traverse((child) => {
            if (child.isMesh) {
                child.userData.isMess = true;
                child.userData.type = 'objectMess';
                child.userData.subtype = 'clothes';
                child.userData.isInteractable = true;
                child.userData.object_type = 'clothes';
                child.userData.modelSwap = '/models/clothes_pile.glb';
                child.userData.position = position.clone();
                child.userData.parentGroup = messGroup; // For optional cleanup

                interactables.push(child); // ✅ Add each mesh to interaction
            }
        });

        scene.add(messGroup);
    }, undefined, (err) => {
        console.error("❌ Failed to load clothes_mess.glb:", err);
    });
}


// ------ Main export -------

/**
 * Dynamically generates messes in the scene from JSON coordinates
 * @param {*} scene - three.js scene
 * @param {*} roomId - room key in the JSON file
 * @param {*} count - number of messes to create
 * @param {*} jsonPath - path to the mess-positions.json file
 */
export function generateRoomFloorMesses(
    scene,
    roomId = 'room1',
    count = 3,
    jsonPath = 'mess-positions.json',
    interactableObjects = []
) {
    fetch(jsonPath)
        .then(res => {
            if (!res.ok) throw new Error(`Failed to load ${jsonPath}`);
            return res.json();
        })
        .then(data => {
            const points = data[roomId];
            if (!points) {
                console.warn(`No points found for room: ${roomId}`);
                return;
            }

            const floorPoints = points.filter(p => p.location === "floor");

            if (floorPoints.length < count) {
                console.warn(`Not enough floor points for ${roomId}. Requested: ${count}, Found: ${floorPoints.length}`);
                count = floorPoints.length;
            }

            const selected = pickRandomPositions(floorPoints, count);

            selected.forEach((point, index) => {
                const pos = new THREE.Vector3(
                    point.position.x,
                    point.position.y,
                    point.position.z
                );
                const messTypes = ['stain', 'paperBall', 'dustBunny'];
                const type = messTypes[Math.floor(Math.random() * messTypes.length)];

                if (type === 'paperBall') {
                    loadPaperBall(scene, pos, interactableObjects);
                } else if (type === 'dustBunny') {
                    const { group, proxy } = createDustBunny(pos, interactableObjects);
                    scene.add(group);
                    scene.add(proxy);
                } else {
                    const stain = createStainMesh(pos, "floor", {}, interactableObjects);
                    scene.add(stain);
                }

                console.log(`🧽 ${type} placed on floor at (${pos.x}, ${pos.y}, ${pos.z})`);
            });

            console.log(`✅ Generated ${count} floor messes in room: ${roomId}`);
        })
        .catch(err => console.error("Error loading mess positions:", err));
}


export function generateRoomWallMesses(
    scene,
    roomId = 'room1',
    count = 3,
    jsonPath = 'mess-positions.json',
    interactableObjects = []
) {
    fetch(jsonPath)
        .then(res => {
            if (!res.ok) throw new Error(`Failed to load ${jsonPath}`);
            return res.json();
        })
        .then(data => {
            const points = data[roomId];
            if (!points) {
                console.warn(`No points found for room: ${roomId}`);
                return;
            }

            const wallPoints = points.filter(p =>
                p.location === "faceWall" || p.location === "sideWall"
            );

            if (wallPoints.length < count) {
                console.warn(`Not enough wall points for ${roomId}. Requested: ${count}, Found: ${wallPoints.length}`);
                count = wallPoints.length;
            }

            const selected = pickRandomPositions(wallPoints, count);

            selected.forEach((point, index) => {
                const pos = new THREE.Vector3(
                    point.position.x,
                    point.position.y,
                    point.position.z
                );

                const stain = createStainMesh(pos, point.location, {}, interactableObjects);
                scene.add(stain);

                console.log(`🧱 Wall stain ${index + 1} at ${point.location}`, pos);
            });

            console.log(`✅ Placed ${count} wall stains in room: ${roomId}`);
        })
        .catch(err => console.error("Error loading wall stains:", err));
}

export function generateRoomObjectMesses(
    scene,
    roomId = 'room1',
    count = 1,
    jsonPath = 'mess-positions.json',
    interactableObjects = []
) {
    fetch(jsonPath)
        .then(res => {
            if (!res.ok) throw new Error(`Failed to load ${jsonPath}`);
            return res.json();
        })
        .then(data => {
            const points = data[roomId];
            if (!points) {
                console.warn(`No points found for room: ${roomId}`);
                return;
            }

            const objectPoints = points.filter(p => p.location === "object");

            if (objectPoints.length < count) {
                console.warn(`Not enough object mess points for ${roomId}. Requested: ${count}, Found: ${objectPoints.length}`);
                count = objectPoints.length;
            }

            const selected = pickRandomPositions(objectPoints, count);

            selected.forEach((point, index) => {
                const pos = new THREE.Vector3(
                    point.position.x,
                    point.position.y,
                    point.position.z
                );

                loadClothesMess(scene, pos, interactableObjects);
                console.log(`👕 Clothes mess ${index + 1} added at object (${pos.x}, ${pos.y}, ${pos.z})`);
            });

            console.log(`✅ Placed ${count} object messes (clothes) in room: ${roomId}`);
        })
        .catch(err => console.error("Error loading object messes:", err));
}


// ----- SHADERS ------

const HairShaderMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
  
      void main() {
        vNormal = normal;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
  
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
  
      void main() {
        float alpha = smoothstep(0.0, 0.5, 1.0 - length(vNormal));
        vec3 color = vec3(0.2, 0.2, 0.2);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
});

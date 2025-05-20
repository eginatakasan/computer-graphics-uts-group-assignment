import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ----- UTILITY FUNCTIONS -----

// Procedural crumpled paper ball
function createPaperBallMesh(position) {
    const radius = 0.3;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    for (let i = 0; i < geometry.attributes.position.count; i++) {
        const x = geometry.attributes.position.getX(i);
        const y = geometry.attributes.position.getY(i);
        const z = geometry.attributes.position.getZ(i);
        const dist = Math.sqrt(x * x + y * y + z * z) / radius;
        const crumple = (Math.random() - 0.5) * 0.18 * (1 - Math.abs(dist - 1));
        geometry.attributes.position.setXYZ(i, x + crumple * x, y + crumple * y, z + crumple * z);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.0
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + 0.3, position.z); // slightly above floor
    return mesh;
}

const modelPath = '/models/paper_ball1.glb';
const scale = 0.3;

const gltfLoader = new GLTFLoader();

/**
 * Loads and places a random paper ball model at the given position.
 */
export function loadPaperBall(scene, position) {
    gltfLoader.load(modelPath, (gltf) => {
        const paper = gltf.scene;

        paper.position.set(position.x, position.y + 0.15, position.z);
        paper.rotation.y = Math.random() * Math.PI * 2;
        paper.scale.setScalar(scale);

        paper.userData.isMess = true;
        paper.userData.type = 'paperBall';

        scene.add(paper);
    }, undefined, (error) => {
        console.error("❌ Failed to load paper ball model:", error);
    });
}

// Organic stain mesh
export function createStainMesh(center, rotationY = 0, options = {}) {
    const {
        radius = 0.4,
        points = 16,
        noiseFactor = 0.4,
        color = 0x5c3317
    } = options;

    const shape = new THREE.Shape();
    const angleStep = (Math.PI * 2) / points;

    // Use polar coordinates with radial jitter
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
    stain.rotation.x = -Math.PI / 2;
    stain.rotation.y = rotationY;
    stain.position.copy(center);
    stain.position.y += 0.01;

    stain.userData.isMess = true;
    stain.userData.type = "stain";

    return stain;
}

// Utility: pick N random positions from array
function pickRandomPositions(arr, count) {
    return arr.sort(() => 0.5 - Math.random()).slice(0, count);
}

/**
 * Helper to create a stain mesh (flat on wall surface)
 */
function createWallStainMesh(center, rotationY = 0, color = 0x5c3317, radius = 0.3) {
    const shape = new THREE.Shape();
    const points = 10;
    const angleStep = (Math.PI * 2) / points;
    for (let i = 0; i < points; i++) {
        const angle = i * angleStep;
        const r = radius * (0.75 + Math.random() * 0.4);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const stain = new THREE.Mesh(geometry, material);
    stain.rotation.y = rotationY;
    stain.rotation.x = 0;
    stain.rotation.z = Math.PI / 2; // Rotate to lay against wall

    stain.position.copy(center);
    return stain;
}

//dust bunnies?
export function createDustBunny(position) {
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
        curve.curveType = 'catmullrom'; // default but explicit
        curve.tension = 0.5; // smooths the interpolation


        const geometry = new THREE.TubeGeometry(curve, 50, 0.002, 4, false);
        const material = new THREE.MeshStandardMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            roughness: 1,
            metalness: 0
        });

        // const mesh = new THREE.Mesh(geometry, material);
        const mesh = new THREE.Mesh(geometry, HairShaderMaterial.clone());
        group.add(mesh);
    }

    group.position.set(
        position.x,
        position.y + 0.01,
        position.z
    );
    group.scale.setScalar(0.6);

    return group;
}


// ------ Main export -------

/**
 * Dynamically generates messes in the scene from JSON coordinates
 * @param {*} scene - three.js scene
 * @param {*} roomId - room key in the JSON file
 * @param {*} count - number of messes to create
 * @param {*} jsonPath - path to the mess-positions.json file
 */
export function generateRoomMesses(scene, roomId = 'room1', count = 3, jsonPath = 'mess-positions.json') {
    fetch(jsonPath)
        .then(res => {
            if (!res.ok) throw new Error(`Failed to load ${jsonPath}`);
            return res.json();
        })
        .then(data => {
            const points = data[roomId];
            if (!points || points.length < count) {
                console.warn(`Not enough points in room: ${roomId}`);
                return;
            }

            const selected = pickRandomPositions(points, count);

            selected.forEach((posData, index) => {
                const pos = new THREE.Vector3(posData.x, posData.y, posData.z);
                const type = Math.random() < 0.5 ? 'stain' : 'paperBall'; // 50/50 chance

                if (type === 'paperBall') {
                    loadPaperBall(scene, pos);
                } else {
                    scene.add(createStainMesh(pos));
                }

                console.log(`🧽 Mess ${index + 1}: ${type} at (${pos.x}, ${pos.y}, ${pos.z})`);
            });

            console.log(`✅ Generated ${count} messes in room: ${roomId}`);
        })
        .catch(err => console.error("Error loading mess positions:", err));
}

/**
 * Main function: Generates 2 stains on each wall mesh found in the room data
 */
export function generateStainsFromWallsJSON(scene, jsonPath = 'walls.json') {
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${jsonPath}`);
            }
            return response.json();
        })
        .then(wallsData => {
            wallsData.forEach((wall, index) => {
                const basePos = new THREE.Vector3(
                    wall.position.x,
                    wall.position.y,
                    wall.position.z
                );

                for (let i = 0; i < 2; i++) {
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * 1.2,
                        (Math.random() - 0.5) * 1.2,
                        (Math.random() - 0.5) * 0.1
                    );
                    const stainPos = basePos.clone().add(offset);
                    const stain = createWallStainMesh(stainPos);
                    scene.add(stain);
                }
            });

            console.log(`🧱 ${wallsData.length * 2} wall stains created from ${jsonPath}`);
        })
        .catch(err => {
            console.error("❌ Error loading wall stain data:", err);
        });
}

export function generateHardcodedWallStains(scene) {
    const wallPositions = [
        new THREE.Vector3(5.95, 1.5, 2),
        new THREE.Vector3(5.95, 1.5, 11.9),
        new THREE.Vector3(0, 1.5, 6.95),
        new THREE.Vector3(11.9, 1.5, 6.95)
    ];

    wallPositions.forEach((wallPos, i) => {
        for (let j = 0; j < 2; j++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 1.2,
                (Math.random() - 0.5) * 1.2,
                (Math.random() - 0.5) * 0.1
            );
            const stainPos = wallPos.clone().add(offset);
            const stain = createWallStainMesh(stainPos);
            scene.add(stain);
        }
    });

    console.log(`🧱 Hardcoded: 8 wall stains created`);
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

import * as THREE from "three";
import { StateManager } from "../core/StateManager";
import { CommandManager } from "../core/CommandManager";

export class BoxPlacer {
  private stateManager: StateManager;
  private commandManager: CommandManager;
  private previewBox: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor(stateManager: StateManager, commandManager: CommandManager) {
    this.stateManager = stateManager;
    this.commandManager = commandManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.createPreviewBox();

    // Subscribe to state changes
    this.stateManager.subscribe("boxPlacementActive", (active: boolean) => {
      if (this.previewBox) {
        this.previewBox.visible = active;
      }
    });

    // Subscribe to scene reset
    this.stateManager.subscribe("resetScene", () => {
      this.createPreviewBox();
    });
  }

  private createPreviewBox(): void {
    // Remove existing preview box if it exists
    if (this.previewBox) {
      this.stateManager.scene.remove(this.previewBox);
      this.previewBox.geometry.dispose();
      (this.previewBox.material as THREE.Material).dispose();
    }

    // Create new preview box
    const geometry = new THREE.BoxGeometry(2, 5, 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
    });
    this.previewBox = new THREE.Mesh(geometry, material);
    this.previewBox.visible = this.stateManager.getBoxPlacementActive();
    this.stateManager.scene.add(this.previewBox);
  }

  public update(event: MouseEvent): void {
    if (!this.stateManager.getBoxPlacementActive() || !this.previewBox) return;

    // Update mouse position
    const rect = this.stateManager.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.stateManager.camera);

    // Find intersection with ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    // Update preview box position
    this.previewBox.position.copy(intersectionPoint);
    this.previewBox.position.y = 1.25; // Half height of the box
  }

  public onClick(event: MouseEvent): void {
    if (!this.stateManager.getBoxPlacementActive() || !this.previewBox) return;

    // Create a new box at the preview position
    const geometry = new THREE.BoxGeometry(2, 5, 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    material.opacity = 0.2;
    const box = new THREE.Mesh(geometry, material);
    box.position.copy(this.previewBox.position);
    box.name = "Box";

    // Add to scene
    this.stateManager.scene.add(box);
    this.stateManager.addPlacedObject(box);
  }

  public dispose(): void {
    if (this.previewBox) {
      this.stateManager.scene.remove(this.previewBox);
      this.previewBox.geometry.dispose();
      (this.previewBox.material as THREE.Material).dispose();
      this.previewBox = null;
    }
  }
}

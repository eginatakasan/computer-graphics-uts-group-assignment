import * as THREE from "three";
import { StateManager } from "../core/StateManager";

export class TextureManager {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  public openTexturePicker(mesh: THREE.Mesh): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const textureLoader = new THREE.TextureLoader();
        const url = URL.createObjectURL(file);

        try {
          const texture = await textureLoader.loadAsync(url);
          this.applyTextureToMesh(mesh, texture);
        } catch (error) {
          console.error("Error loading texture:", error);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    };

    input.click();
  }

  public applyTextureToMesh(mesh: THREE.Mesh, texture: THREE.Texture): void {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(
      this.stateManager.getTextureRepeatU(),
      this.stateManager.getTextureRepeatV()
    );

    if (
      mesh.material instanceof THREE.MeshStandardMaterial ||
      mesh.material instanceof THREE.MeshLambertMaterial ||
      mesh.material instanceof THREE.MeshBasicMaterial
    ) {
      mesh.material.map = texture;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
    } else if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => {
        if (
          mat instanceof THREE.MeshStandardMaterial ||
          mat instanceof THREE.MeshLambertMaterial ||
          mat instanceof THREE.MeshBasicMaterial
        ) {
          mat.map = texture;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        }
      });
    }
  }

  public applyTextureToObject(
    object: THREE.Object3D,
    texture: THREE.Texture
  ): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.applyTextureToMesh(child, texture);
      }
    });
  }

  public loadTextureFromUrl(url: string): Promise<THREE.Texture> {
    const textureLoader = new THREE.TextureLoader();
    return textureLoader.loadAsync(url);
  }

  public async loadAndApplyTexture(
    mesh: THREE.Mesh,
    url: string
  ): Promise<void> {
    try {
      const texture = await this.loadTextureFromUrl(url);
      this.applyTextureToMesh(mesh, texture);
    } catch (error) {
      console.error("Error loading texture from URL:", error);
    }
  }

  public updateTextureSettings(texture: THREE.Texture): void {
    texture.repeat.set(
      this.stateManager.getTextureRepeatU(),
      this.stateManager.getTextureRepeatV()
    );
    texture.needsUpdate = true;
  }
}

import * as THREE from "three";
import { StateManager } from "./StateManager";

// Command interface
export interface Command {
  execute(): void;
  undo(): void;
}

// Concrete command implementations
export class PlaceObjectCommand implements Command {
  private scene: THREE.Scene;
  private object: THREE.Object3D;
  private stateManager: StateManager;

  constructor(
    scene: THREE.Scene,
    object: THREE.Object3D,
    stateManager: StateManager
  ) {
    this.scene = scene;
    this.object = object;
    this.stateManager = stateManager;
  }

  execute(): void {
    this.scene.add(this.object);
    this.stateManager.addPlacedObject(this.object);
  }

  undo(): void {
    this.scene.remove(this.object);
    this.stateManager.removePlacedObject(this.object);
  }
}

export class RemoveObjectCommand implements Command {
  private scene: THREE.Scene;
  private object: THREE.Object3D;
  private stateManager: StateManager;
  private index: number;

  constructor(
    scene: THREE.Scene,
    object: THREE.Object3D,
    stateManager: StateManager
  ) {
    this.scene = scene;
    this.object = object;
    this.stateManager = stateManager;
    this.index = this.stateManager.placedObjects.indexOf(object);
  }

  execute(): void {
    this.scene.remove(this.object);
    this.stateManager.removePlacedObject(this.object);
  }

  undo(): void {
    this.scene.add(this.object);
    if (
      this.index !== -1 &&
      this.index <= this.stateManager.placedObjects.length
    ) {
      // Use a temporary array to reinsert at the correct index
      const updatedObjects = [...this.stateManager.placedObjects];
      updatedObjects.splice(this.index, 0, this.object);
      this.stateManager.setPlacedObjects(updatedObjects);
    } else {
      this.stateManager.addPlacedObject(this.object);
    }
  }
}

export class CreateRoomCommand implements Command {
  private scene: THREE.Scene;
  private room: THREE.Group;
  private placedObjects: THREE.Object3D[];

  constructor(
    scene: THREE.Scene,
    room: THREE.Group,
    placedObjects: THREE.Object3D[]
  ) {
    this.scene = scene;
    this.room = room;
    this.placedObjects = placedObjects;
  }

  execute(): void {
    this.scene.add(this.room);
    this.placedObjects.push(this.room);
  }

  undo(): void {
    this.scene.remove(this.room);
    const index = this.placedObjects.indexOf(this.room);
    if (index !== -1) {
      this.placedObjects.splice(index, 1);
    }
  }
}

export class PlaceDoorCommand implements Command {
  private scene: THREE.Scene;
  private door: THREE.Group;
  private walls: THREE.Mesh[];
  private originalWallGeometries: THREE.BufferGeometry[];
  private originalWallMaterials: (THREE.Material | THREE.Material[])[];
  private modifiedWalls: THREE.Mesh[];
  private placedObjects: THREE.Object3D[];

  constructor(
    scene: THREE.Scene,
    door: THREE.Group,
    walls: THREE.Mesh[],
    modifiedWalls: THREE.Mesh[],
    placedObjects: THREE.Object3D[]
  ) {
    this.scene = scene;
    this.door = door;
    this.walls = walls;
    this.modifiedWalls = modifiedWalls;
    this.placedObjects = placedObjects;

    // Store original wall geometries and materials for undo
    this.originalWallGeometries = walls.map((wall) => wall.geometry.clone());
    this.originalWallMaterials = walls.map((wall) => {
      if (Array.isArray(wall.material)) {
        return wall.material.map((mat) => mat.clone());
      } else {
        return wall.material.clone();
      }
    });
  }

  execute(): void {
    this.scene.add(this.door);
    this.placedObjects.push(this.door);

    // Apply the modified walls (with holes)
    for (let i = 0; i < this.walls.length; i++) {
      this.walls[i].geometry.dispose();
      this.walls[i].geometry = this.modifiedWalls[i].geometry.clone();

      const originalMaterial = this.originalWallMaterials[i];
      const wallMaterial = this.walls[i].material;

      if (Array.isArray(originalMaterial) && Array.isArray(wallMaterial)) {
        // Both are arrays
        for (
          let j = 0;
          j < originalMaterial.length && j < wallMaterial.length;
          j++
        ) {
          wallMaterial[j] = originalMaterial[j].clone();
        }
      } else if (
        !Array.isArray(originalMaterial) &&
        !Array.isArray(wallMaterial)
      ) {
        // Both are single materials
        this.walls[i].material = originalMaterial.clone();
      } else if (
        Array.isArray(originalMaterial) &&
        !Array.isArray(wallMaterial)
      ) {
        // Original is array, current is single
        this.walls[i].material =
          originalMaterial.length > 0
            ? originalMaterial[0].clone()
            : new THREE.MeshBasicMaterial();
      } else if (
        !Array.isArray(originalMaterial) &&
        Array.isArray(wallMaterial)
      ) {
        // Original is single, current is array
        for (let j = 0; j < wallMaterial.length; j++) {
          wallMaterial[j] = originalMaterial.clone();
        }
      }

      // Remove "Doorway" suffix from wall name if it exists
      if (this.walls[i].name.includes("Doorway")) {
        this.walls[i].name = this.walls[i].name.replace("Doorway", "");
      }
    }
  }

  undo(): void {
    this.scene.remove(this.door);
    const index = this.placedObjects.indexOf(this.door);
    if (index !== -1) {
      this.placedObjects.splice(index, 1);
    }

    // Restore original wall geometries and materials
    for (let i = 0; i < this.walls.length; i++) {
      this.walls[i].geometry.dispose();
      this.walls[i].geometry = this.originalWallGeometries[i].clone();

      const originalMaterial = this.originalWallMaterials[i];
      const wallMaterial = this.walls[i].material;

      if (Array.isArray(originalMaterial) && Array.isArray(wallMaterial)) {
        // Both are arrays
        for (
          let j = 0;
          j < originalMaterial.length && j < wallMaterial.length;
          j++
        ) {
          wallMaterial[j] = originalMaterial[j].clone();
        }
      } else if (
        !Array.isArray(originalMaterial) &&
        !Array.isArray(wallMaterial)
      ) {
        // Both are single materials
        this.walls[i].material = originalMaterial.clone();
      } else if (
        Array.isArray(originalMaterial) &&
        !Array.isArray(wallMaterial)
      ) {
        // Original is array, current is single
        this.walls[i].material =
          originalMaterial.length > 0
            ? originalMaterial[0].clone()
            : new THREE.MeshBasicMaterial();
      } else if (
        !Array.isArray(originalMaterial) &&
        Array.isArray(wallMaterial)
      ) {
        // Original is single, current is array
        for (let j = 0; j < wallMaterial.length; j++) {
          wallMaterial[j] = originalMaterial.clone();
        }
      }

      // Remove "Doorway" suffix from wall name if it exists
      if (this.walls[i].name.includes("Doorway")) {
        this.walls[i].name = this.walls[i].name.replace("Doorway", "");
      }
    }
  }
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor() {}

  public execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;

    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;

    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

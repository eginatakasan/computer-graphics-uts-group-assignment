import * as THREE from "three";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { MapControls } from "three/examples/jsm/controls/MapControls";

export class StateManager {
  // Scene states
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: MapControls;
  public dragControls: DragControls;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;
  public gridHelper: THREE.GridHelper;

  // Tool states
  public isRoomToolActive: boolean = false;
  public isDoorPlacementActive: boolean = false;
  public isDeleteToolActive: boolean = false;
  public isBuildingRoom: boolean = false;
  public isRoomsSelectable: boolean = false;
  public isBoxPlacementActive: boolean = false;
  public isLightsPlacementActive: boolean = false;

  // Settings
  public modelScale: number = 0.7;
  public textureRepeatU: number = 1;
  public textureRepeatV: number = 1;
  public lightIntensity: number = 5;
  public lightDistance: number = 100;
  public lightColor: number = 0xffffff;
  public ceilingVisible: boolean = true;

  // Selection state
  public selectedObject: THREE.Object3D | null = null;
  public placedObjects: THREE.Object3D[] = [];
  public roomObjects: THREE.Object3D[] = [];

  // Observers pattern for state changes
  private listeners: Map<string, Function[]> = new Map();

  // Tool state getters/setters
  public setRoomToolActive(active: boolean): void {
    if (active) {
      this.isDoorPlacementActive = false;
      this.isDeleteToolActive = false;
    }
    this.isRoomToolActive = active;
    this.notifyListeners("roomToolActive", active);
  }

  public getRoomToolActive(): boolean {
    return this.isRoomToolActive;
  }

  public setDoorPlacementActive(active: boolean): void {
    if (active) {
      this.isRoomToolActive = false;
      this.isDeleteToolActive = false;
    }
    this.isDoorPlacementActive = active;
    this.notifyListeners("doorPlacementActive", active);
  }

  public getDoorPlacementActive(): boolean {
    return this.isDoorPlacementActive;
  }

  public setDeleteToolActive(active: boolean): void {
    if (active) {
      this.isRoomToolActive = false;
      this.isDoorPlacementActive = false;
    }
    this.isDeleteToolActive = active;
    this.notifyListeners("deleteToolActive", active);
  }

  public getDeleteToolActive(): boolean {
    return this.isDeleteToolActive;
  }

  public setBuildingRoom(building: boolean): void {
    this.isBuildingRoom = building;
    this.notifyListeners("buildingRoom", building);
  }

  public getBuildingRoom(): boolean {
    return this.isBuildingRoom;
  }

  public setRoomsSelectable(selectable: boolean): void {
    this.isRoomsSelectable = selectable;
    this.notifyListeners("roomsSelectable", selectable);
  }

  public getRoomsSelectable(): boolean {
    return this.isRoomsSelectable;
  }

  public setBoxPlacementActive(active: boolean): void {
    if (active) {
      this.isRoomToolActive = false;
      this.isDoorPlacementActive = false;
      this.isDeleteToolActive = false;
    }
    this.isBoxPlacementActive = active;
    this.notifyListeners("boxPlacementActive", active);
  }

  public getBoxPlacementActive(): boolean {
    return this.isBoxPlacementActive;
  }

  public setLightsPlacementActive(active: boolean): void {
    this.isLightsPlacementActive = active;
    this.notifyListeners("lightsPlacementActive", active);
  }

  public setLightIntensity(intensity: number): void {
    this.lightIntensity = intensity;
    this.notifyListeners("lightIntensity", intensity);
  }

  public setLightDistance(distance: number): void {
    this.lightDistance = distance;
    this.notifyListeners("lightDistance", distance);
  }

  public setLightColor(color: number): void {
    this.lightColor = color;
    this.notifyListeners("lightColor", color);
  }

  public getLightColor(): number {
    return this.lightColor;
  }

  public setCeilingVisible(visible: boolean): void {
    this.ceilingVisible = visible;
    this.notifyListeners("ceilingVisible", visible);
  }

  public getCeilingVisible(): boolean {
    return this.ceilingVisible;
  }

  // Settings getters/setters
  public setModelScale(scale: number): void {
    this.modelScale = scale;
    this.notifyListeners("modelScale", scale);
  }

  public getModelScale(): number {
    return this.modelScale;
  }

  public setTextureRepeatU(value: number): void {
    this.textureRepeatU = value;
    this.notifyListeners("textureRepeatU", value);
  }

  public getTextureRepeatU(): number {
    return this.textureRepeatU;
  }

  public setTextureRepeatV(value: number): void {
    this.textureRepeatV = value;
    this.notifyListeners("textureRepeatV", value);
  }

  public getTextureRepeatV(): number {
    return this.textureRepeatV;
  }

  // Selection getters/setters
  public setSelectedObject(object: THREE.Object3D | null): void {
    this.selectedObject = object;
    this.notifyListeners("selectedObject", object);
  }

  public getSelectedObject(): THREE.Object3D | null {
    return this.selectedObject;
  }

  // PlacedObjects methods
  public addPlacedObject(object: THREE.Object3D): void {
    this.placedObjects.push(object);
    console.log("Placed objects:", this.placedObjects);
    this.notifyListeners("placedObjectsChanged", this.placedObjects);
  }

  public removePlacedObject(object: THREE.Object3D): void {
    const index = this.placedObjects.indexOf(object);
    if (index !== -1) {
      this.placedObjects.splice(index, 1);
      this.notifyListeners("placedObjectsChanged", this.placedObjects);
    }
  }

  public clearPlacedObjects(): void {
    this.placedObjects = [];
    this.notifyListeners("placedObjectsChanged", this.placedObjects);
  }

  public setPlacedObjects(objects: THREE.Object3D[]): void {
    this.placedObjects = objects;
    this.notifyListeners("placedObjectsChanged", this.placedObjects);
  }

  public setRoomObjects(objects: THREE.Object3D[]): void {
    this.roomObjects = objects;
    this.notifyListeners("roomObjectsChanged", this.roomObjects);
  }

  // Observer pattern methods
  public subscribe(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  public unsubscribe(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  }

  public setDragControls(dragControls: DragControls): void {
    this.dragControls = dragControls;
    this.notifyListeners("dragControls", dragControls);
  }

  public resetScene(): void {
    this.scene.clear();
    this.clearPlacedObjects();
    this.notifyListeners("resetScene", null);
  }
}

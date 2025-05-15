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

  // Settings
  public modelScale: number = 0.7;
  public textureRepeatU: number = 1;
  public textureRepeatV: number = 1;

  // Selection state
  public selectedObject: THREE.Object3D | null = null;
  public placedObjects: THREE.Object3D[] = [];

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
}

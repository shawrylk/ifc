import * as THREE from 'three';
import CameraControls from 'camera-controls';

export interface ThreeState {
  controls2d: CameraControls;
  controls3d: CameraControls;
  activeControls: CameraControls;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  isInitialized: boolean;
  clock: THREE.Clock;
  container: HTMLElement;
  isPaused: boolean;
}

export interface IFCPropertyValue {
  type: string;
  value: any;
}

export interface IFCProperty {
  [key: string]: IFCPropertyValue;
}

export interface IFCProperties {
  [expressId: string]: IFCProperty;
}

export type AttributeValuePairs<T> = {
  [K in keyof T]: T[K] extends { value: infer V } ? V : T[K];
};

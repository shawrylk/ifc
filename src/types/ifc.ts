import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { CameraType } from '@/types/three';

export interface ThreeState {
  camera: CameraType;
  controls: CameraControls;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  isInitialized: boolean;
  clock: THREE.Clock;
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

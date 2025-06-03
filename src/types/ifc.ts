import * as THREE from 'three';

export interface ThreeState {
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

import { ThreeState } from '@/types/ifc';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import InfiniteGridHelper from '@/composables/InfiniteGridHelper';

// cannot save to pinia store because of thread-safety issues
const store: ThreeState & {
  initialize(container: HTMLElement): void;
  handleResize(viewerContainer: HTMLElement): void;
  dispose(): void;
  render(forceUpdate?: boolean): void;
} = {
  isInitialized: false,
  camera: null!,
  controls: null!,
  scene: null!,
  renderer: null!,
  clock: null!,

  initialize: (container: HTMLElement) => {
    if (store.isInitialized) return;
    if (!container) {
      console.error('Container element is required for initialization');
      return;
    }

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222a32);

      // Add infinite grid
      const gridSize = 200;
      const cellSize = 1;
      const visibleDistance = gridSize;
      const gridHelper = new InfiniteGridHelper(
        gridSize,
        cellSize,
        new THREE.Color(0xc0c0c0),
        visibleDistance
      );
      gridHelper.position.y = -0.01; // Slightly below 0 to prevent z-fighting
      scene.add(gridHelper);

      // Add axes helper
      const axesHelper = new THREE.AxesHelper(1);
      scene.add(axesHelper);

      // renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      // camera
      const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );

      // controls
      const controls = new CameraControls(camera, renderer.domElement);
      controls.setLookAt(5, 5, 5, 0, 0, 0);

      // light
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
      directionalLight.position.set(0, 10, 0);
      scene.add(ambientLight);
      scene.add(directionalLight);

      store.isInitialized = true;
      store.camera = camera;
      store.controls = controls;
      store.scene = scene;
      store.renderer = renderer;
      store.clock = new THREE.Clock();

      // Initial render
      store.render();
    } catch (error) {
      console.error('Error initializing IFC viewer:', error);
      store.dispose();
      throw error;
    }
  },

  handleResize: (viewerContainer: HTMLElement) => {
    if (!store.isInitialized) return;

    const camera = store.camera as THREE.PerspectiveCamera;
    camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
    camera.updateProjectionMatrix();
    store.renderer!.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    store.render();
  },

  render: (forceUpdate = false) => {
    if (!store.isInitialized) return;

    if (forceUpdate) {
      store.renderer.render(store.scene, store.camera);
      return;
    } else {
      const delta = store.clock.getDelta();
      const hasControlsUpdated = store.controls.update(delta);
      if (hasControlsUpdated) {
        store.renderer.render(store.scene, store.camera);
      }
    }

    requestAnimationFrame(() => {
      store.render();
    });
  },

  dispose: () => {
    if (store.renderer) {
      store.controls.dispose();
      store.renderer.dispose();
      store.isInitialized = false;
    }
  },
};

export const useThree = () => store;

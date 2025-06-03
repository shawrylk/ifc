import * as THREE from 'three';
import InfiniteGridHelper from '@/composables/InfiniteGridHelper';
import { Viewport, ViewportMode } from '@/composables/Viewport';

export type ViewMode = '2d' | '3d';

// Define a new type for the store that omits controls2d, controls3d, and activeControls
// since these are now managed by the mainViewport
interface ThreeStoreState {
  isInitialized: boolean;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  container: HTMLElement;
  isPaused: boolean;
  mode: ViewMode;
  mainViewport: Viewport | null;
  initialize(container: HTMLElement): void;
  handleResize(viewerContainer: HTMLElement): void;
  dispose(): void;
  render(forceUpdate?: boolean): void;
  setRender(pause: boolean): void;
}

const startRenderLoop = () => {
  if (!store.isInitialized || !store.mainViewport) return;
  requestAnimationFrame(() => {
    store.render();
    startRenderLoop();
  });
};

const store: ThreeStoreState = {
  isInitialized: false,
  scene: null!,
  renderer: null!,
  clock: null!,
  container: null!,
  isPaused: false,
  mode: '3d',
  mainViewport: null,

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

      // light
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
      directionalLight.position.set(0, 10, 0);
      scene.add(ambientLight);
      scene.add(directionalLight);

      store.scene = scene;
      store.renderer = renderer;
      store.clock = new THREE.Clock();
      store.isInitialized = true;
      store.container = container;

      // Create the main viewport for the main app
      store.mainViewport = new Viewport({
        renderer: renderer,
        region: {
          x: 0,
          y: 0,
          width: container.clientWidth,
          height: container.clientHeight,
        },
        container: container,
        initialPosition: new THREE.Vector3(5, 5, 5),
        initialTarget: new THREE.Vector3(0, 0, 0),
        defaultMode: ViewportMode.THREE_D,
      });

      startRenderLoop();
    } catch (error) {
      console.error('Error initializing IFC viewer:', error);
      store.dispose();
      throw error;
    }
  },

  handleResize: (viewerContainer: HTMLElement) => {
    if (!store.isInitialized || !store.mainViewport) return;
    store.renderer!.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    store.mainViewport.updateRegion({
      x: 0,
      y: 0,
      width: viewerContainer.clientWidth,
      height: viewerContainer.clientHeight,
    });
    store.render(true);
  },

  render: (forceUpdate = false) => {
    if (!store.isInitialized || !store.mainViewport) return;
    if (store.isPaused) return;

    const delta = store.clock.getDelta();
    const hasControlsUpdated = store.mainViewport.controls.update(delta);
    if (hasControlsUpdated) {
      store.mainViewport.render(store.clock.getDelta());
    } else if (forceUpdate) {
      store.mainViewport.render(store.clock.getDelta());
    }
  },

  setRender: (pause: boolean) => {
    store.isPaused = pause;
  },

  dispose: () => {
    if (store.renderer) {
      if (store.mainViewport) {
        store.mainViewport.dispose();
        store.mainViewport = null;
      }
      store.renderer.dispose();
      store.isInitialized = false;
    }
  },
};

export const useThree = () => store;

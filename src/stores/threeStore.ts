import * as THREE from 'three';
import InfiniteGridHelper from '@/composables/InfiniteGridHelper';
import { Viewport, ViewportMode } from '@/composables/Viewport';
import { FragmentsModels } from '@thatopen/fragments';

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
  subViewports: Viewport[];
  initialize(container: HTMLElement): void;
  handleResize(viewerContainer: HTMLElement): void;
  dispose(): void;
  render(forceUpdate?: boolean): void;
  setRender(pause: boolean): void;
  addSubViewport(viewport: Viewport): void;
  removeSubViewport(viewport: Viewport): void;
  forceUpdate(viewport: Viewport | null, fragmentsModels: FragmentsModels | null): void;
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
  subViewports: [],

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

      // renderer with improved settings for cross-browser consistency
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false, // Improves performance
        premultipliedAlpha: false, // Better color accuracy
      });

      // Set pixel ratio, but cap it to avoid performance issues on high-DPI displays
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pixelRatio);

      // Ensure container dimensions are properly calculated
      const containerRect = container.getBoundingClientRect();
      const width = containerRect.width || container.clientWidth || container.offsetWidth;
      const height = containerRect.height || container.clientHeight || container.offsetHeight;

      renderer.setSize(width, height);

      // Ensure canvas positioning
      const canvas = renderer.domElement;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';

      // Clear container and append canvas
      container.innerHTML = '';
      container.appendChild(canvas);

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
          width: width,
          height: height,
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

    // Get accurate container dimensions
    const containerRect = viewerContainer.getBoundingClientRect();
    const width = containerRect.width || viewerContainer.clientWidth || viewerContainer.offsetWidth;
    const height =
      containerRect.height || viewerContainer.clientHeight || viewerContainer.offsetHeight;

    // Only resize if dimensions are valid
    if (width > 0 && height > 0) {
      store.renderer!.setSize(width, height);
      store.mainViewport.updateRegion({
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
      store.render(true);
    }
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

  addSubViewport: (viewport: Viewport) => {
    store.subViewports.push(viewport);
  },

  removeSubViewport: (viewport: Viewport) => {
    store.subViewports = store.subViewports.filter((v) => v !== viewport);
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

  async forceUpdate(viewport: Viewport | null, fragmentsModels: FragmentsModels | null) {
    const view = viewport ?? store.mainViewport;
    // cheat: model is not refreshed immediately, so request animation frame 20 times
    let i = 0;
    const controls = view?.controls;
    const updateScene = async () => {
      if (i < 20 && controls) {
        controls.update(store.clock.getDelta());
        await fragmentsModels?.update();
        await fragmentsModels?.update(true);
        store.render(true);
        i++;
        requestAnimationFrame(updateScene);
      }
    };
    requestAnimationFrame(updateScene);
  },
};

export const useThree = () => store;

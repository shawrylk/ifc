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
  toggleRender(pause: boolean): void;
} = {
  isInitialized: false,
  controls2d: null!,
  controls3d: null!,
  activeControls: null!,
  scene: null!,
  renderer: null!,
  clock: null!,
  container: null!,
  isPaused: false,

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
      const camera2d = new THREE.OrthographicCamera(
        -window.innerWidth / 2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        -window.innerHeight / 2,
        0.1,
        1000
      );
      const camera3d = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );

      // controls
      const controls2d = new CameraControls(camera2d, renderer.domElement);
      controls2d.setLookAt(5, 5, 5, 0, 0, 0);
      controls2d.mouseButtons.left = CameraControls.ACTION.NONE;
      controls2d.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
      const controls3d = new CameraControls(camera3d, renderer.domElement);
      controls3d.setLookAt(5, 5, 5, 0, 0, 0);

      // light
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
      directionalLight.position.set(0, 10, 0);
      scene.add(ambientLight);
      scene.add(directionalLight);

      store.controls2d = controls2d;
      store.controls3d = controls3d;
      store.activeControls = controls3d;
      store.scene = scene;
      store.renderer = renderer;
      store.clock = new THREE.Clock();
      store.isInitialized = true;
      store.container = container;

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

    const camera = store.activeControls.camera;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -viewerContainer.clientWidth / 2;
      camera.right = viewerContainer.clientWidth / 2;
      camera.top = viewerContainer.clientHeight / 2;
      camera.bottom = -viewerContainer.clientHeight / 2;
      camera.updateProjectionMatrix();
    }
    store.renderer!.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    store.render();
  },

  render: (forceUpdate = false) => {
    if (!store.isInitialized) return;
    if (store.isPaused) return;

    if (forceUpdate) {
      store.renderer.render(store.scene, store.activeControls.camera);
      return;
    } else {
      const delta = store.clock.getDelta();
      const hasControlsUpdated = store.activeControls.update(delta);
      if (hasControlsUpdated) {
        store.renderer.render(store.scene, store.activeControls.camera);
      }
    }

    requestAnimationFrame(() => {
      store.render();
    });
  },

  toggleRender: (pause: boolean) => {
    store.isPaused = pause;
  },

  dispose: () => {
    if (store.renderer) {
      store.controls2d.dispose();
      store.controls3d.dispose();
      store.renderer.dispose();
      store.activeControls = null!;
      store.isInitialized = false;
    }
  },
};

export const useThree = () => store;

import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { useThree } from '@/stores/threeStore';
import { useIFCStore } from '@/stores/ifcStore';

export interface ViewportConfig {
  initialPosition?: THREE.Vector3;
  initialTarget?: THREE.Vector3;
  renderer: THREE.WebGLRenderer;
  region: { x: number; y: number; width: number; height: number };
  controlsTarget?: HTMLElement | null;
  container: HTMLElement;
  defaultMode?: ViewportMode;
  margin?: number;
  visibleLayers?: number[]; // Array of layer numbers that should be visible
}

export enum ViewportMode {
  TWO_D = '2d',
  THREE_D = '3d',
}

export class Viewport {
  private mode: ViewportMode;
  private readonly camera2d: THREE.OrthographicCamera;
  private readonly camera3d: THREE.PerspectiveCamera;
  public readonly controls2d: CameraControls;
  public readonly controls3d: CameraControls;
  private container: HTMLElement;
  private scene: THREE.Scene;
  private region: { x: number; y: number; width: number; height: number };
  private renderer: THREE.WebGLRenderer;
  private isDisposed: boolean = false;
  private margin: number;

  constructor(config: ViewportConfig) {
    this.mode = config.defaultMode ?? ViewportMode.THREE_D;
    this.container = config.container;
    this.scene = useThree().scene;
    this.margin = config.margin ?? 0;

    // 2D camera
    this.camera2d = new THREE.OrthographicCamera(
      config.region.width / -2,
      config.region.width / 2,
      config.region.height / 2,
      config.region.height / -2,
      0.1,
      1000
    );

    // 3D camera
    this.camera3d = new THREE.PerspectiveCamera(
      75,
      config.region.width / config.region.height,
      0.1,
      1000
    );

    // Configure camera layers if specified
    if (config.visibleLayers && config.visibleLayers.length > 0) {
      this.setVisibleLayers(config.visibleLayers);
    }

    // 2D controls
    this.controls2d = new CameraControls(this.camera2d, this.container);
    this.controls2d.mouseButtons.left = CameraControls.ACTION.NONE;
    this.controls2d.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
    this.controls2d.dollySpeed = 3;

    const position = config.initialPosition || { x: 5, y: 5, z: 5 };
    const targetPos = config.initialTarget || { x: 0, y: 0, z: 0 };

    this.controls2d.setLookAt(
      position.x,
      position.y,
      position.z,
      targetPos.x,
      targetPos.y,
      targetPos.z
    );
    const size = (config.initialPosition ?? new THREE.Vector3()).distanceTo(
      config.initialTarget ?? new THREE.Vector3()
    );
    this.controls2d.fitToBox(
      new THREE.Box3(new THREE.Vector3(-size, -size, -size), new THREE.Vector3(size, size, size)),
      true
    );

    // 3D controls
    this.controls3d = new CameraControls(this.camera3d, this.container);
    this.controls3d.setLookAt(
      position.x,
      position.y,
      position.z,
      targetPos.x,
      targetPos.y,
      targetPos.z
    );

    this.region = config.region;
    this.renderer = config.renderer;
    this.handleResize(); // Initial size setup
  }

  private handleResize = () => {
    if (this.isDisposed) return;

    const aspect = this.region.width / this.region.height;

    // Update 2D camera
    if (this.camera2d) {
      this.camera2d.left = this.region.width / -2;
      this.camera2d.right = this.region.width / 2;
      this.camera2d.top = this.region.height / 2;
      this.camera2d.bottom = this.region.height / -2;
      this.camera2d.updateProjectionMatrix();
    }

    // Update 3D camera
    if (this.camera3d) {
      this.camera3d.aspect = aspect;
      this.camera3d.updateProjectionMatrix();
    }
  };

  public render(delta: number) {
    if (this.isDisposed) return;

    const activeControls = this.mode === ViewportMode.TWO_D ? this.controls2d : this.controls3d;
    const activeCamera = this.mode === ViewportMode.TWO_D ? this.camera2d : this.camera3d;

    if (activeControls && activeCamera) {
      // Get offset of container relative to renderer's canvas
      const containerRect = this.container.getBoundingClientRect();
      const canvasRect = this.renderer.domElement.getBoundingClientRect();
      const offsetX = containerRect.left - canvasRect.left;
      const offsetY = containerRect.top - canvasRect.top;

      const { x, y, width, height } = this.region;

      // Calculate available space after margins
      const availableWidth = Math.max(0, width - this.margin * 2);
      const availableHeight = Math.max(0, height - this.margin * 2);

      // Calculate original aspect ratio
      const originalAspect = width / height;
      const availableAspect = availableWidth / availableHeight;

      let finalWidth: number;
      let finalHeight: number;
      let centerOffsetX: number;
      let centerOffsetY: number;

      if (originalAspect > availableAspect) {
        // Original is wider - fit to available width
        finalWidth = availableWidth;
        finalHeight = availableWidth / originalAspect;
        centerOffsetX = 0;
        centerOffsetY = (availableHeight - finalHeight) / 2;
      } else {
        // Original is taller - fit to available height
        finalWidth = availableHeight * originalAspect;
        finalHeight = availableHeight;
        centerOffsetX = (availableWidth - finalWidth) / 2;
        centerOffsetY = 0;
      }

      // Calculate final position with margins and centering
      const finalX = x + this.margin + centerOffsetX;
      const finalY = y + this.margin + centerOffsetY;

      // Flip y for Three.js (canvas y=0 is top, Three.js y=0 is bottom)
      const flippedY = this.renderer.domElement.height - (finalY + offsetY) - finalHeight;

      this.renderer.setViewport(finalX + offsetX, flippedY, finalWidth, finalHeight);
      this.renderer.setScissor(finalX + offsetX, flippedY, finalWidth, finalHeight);
      this.renderer.setScissorTest(true);

      // Render the scene
      activeControls.update(delta);
      // Always render the scene
      this.renderer.render(this.scene, activeCamera);
    }
  }

  /**
   * Set which layers should be visible in this viewport using Three.js camera layers
   */
  public setVisibleLayers(layers: number[]) {
    // Clear all layers first
    this.camera2d.layers.disableAll();
    this.camera3d.layers.disableAll();

    if (layers.length === 0) {
      // If no layers specified, enable all layers (default behavior)
      this.camera2d.layers.enableAll();
      this.camera3d.layers.enableAll();
    } else {
      // Enable only the specified layers
      layers.forEach((layer) => {
        this.camera2d.layers.enable(layer);
        this.camera3d.layers.enable(layer);
      });
    }
  }

  /**
   * Get the currently visible layers for this viewport
   */
  public getVisibleLayers(): number[] {
    const layers: number[] = [];
    // Check which layers are enabled (0-31)
    for (let i = 0; i < 32; i++) {
      const testLayer = new THREE.Layers();
      testLayer.set(i);
      if (this.camera3d.layers.test(testLayer)) {
        layers.push(i);
      }
    }
    return layers;
  }

  public switchMode(mode: ViewportMode) {
    this.mode = mode;
    const fragmentModels = useIFCStore().getFragmentsModels();
    for (const [_, model] of fragmentModels?.models?.list ?? []) {
      model.useCamera(this.camera);
    }
    this.controls.camera.updateProjectionMatrix();
  }

  public updateRegion(region: { x: number; y: number; width: number; height: number }) {
    if (this.isDisposed) return;
    this.region = region;
    this.handleResize();
  }

  public dispose() {
    if (this.isDisposed) return;

    this.isDisposed = true;

    if (this.controls2d) {
      this.controls2d.dispose();
    }
    if (this.controls3d) {
      this.controls3d.dispose();
    }
  }

  public get controls() {
    return this.mode === ViewportMode.TWO_D ? this.controls2d : this.controls3d;
  }

  public get camera() {
    return this.mode === ViewportMode.TWO_D ? this.camera2d : this.camera3d;
  }
}

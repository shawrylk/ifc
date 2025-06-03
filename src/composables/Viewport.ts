import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { useThree } from '@/stores/threeStore';

export interface ViewportConfig {
  initialPosition?: THREE.Vector3;
  initialTarget?: THREE.Vector3;
  renderer: THREE.WebGLRenderer;
  region: { x: number; y: number; width: number; height: number };
  controlsTarget?: HTMLElement | null;
  container: HTMLElement;
}

export enum ViewportMode {
  THREE_D = '3d',
  TWO_D = '2d',
}

export class Viewport {
  private mode: ViewportMode = ViewportMode.TWO_D;
  private camera2d: THREE.OrthographicCamera | null = null;
  private camera3d: THREE.PerspectiveCamera | null = null;
  private controls2d: CameraControls | null = null;
  private controls3d: CameraControls | null = null;
  private container: HTMLElement;
  private scene: THREE.Scene;
  private region: { x: number; y: number; width: number; height: number };
  private renderer: THREE.WebGLRenderer;
  private isDisposed: boolean = false;

  constructor(config: ViewportConfig) {
    this.container = config.container;
    this.scene = useThree().scene;
    this.createCameras(config.region);
    this.createControls(config);
    this.region = config.region;
    this.renderer = config.renderer;
    window.addEventListener('resize', this.handleResize);
    this.handleResize(); // Initial size setup
  }

  private createCameras(region: typeof this.region) {
    const aspect = region.width / region.height;

    // Create 2D camera
    this.camera2d = new THREE.OrthographicCamera(
      region.width / -2,
      region.width / 2,
      region.height / 2,
      region.height / -2,
      0.1,
      1000
    );

    // Create 3D camera
    this.camera3d = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  }

  private createControls(config: ViewportConfig) {
    if (!this.camera2d || !this.camera3d) return;

    // Dispose old controls if target changed
    if (this.controls2d) this.controls2d.dispose();
    if (this.controls3d) this.controls3d.dispose();

    this.controls2d = new CameraControls(this.camera2d, this.container);
    this.controls2d.mouseButtons.left = CameraControls.ACTION.NONE;
    this.controls2d.mouseButtons.wheel = CameraControls.ACTION.ZOOM;

    this.controls3d = new CameraControls(this.camera3d, this.container);

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

    this.controls3d.setLookAt(
      position.x,
      position.y,
      position.z,
      targetPos.x,
      targetPos.y,
      targetPos.z
    );
  }

  private handleResize = () => {
    if (this.isDisposed) return;

    const aspect = this.region.width / this.region.height;

    if (this.camera2d) {
      this.camera2d.left = this.region.width / -2;
      this.camera2d.right = this.region.width / 2;
      this.camera2d.top = this.region.height / 2;
      this.camera2d.bottom = this.region.height / -2;
      this.camera2d.updateProjectionMatrix();
    }

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
      const hasControlsUpdated = activeControls.update(delta);
      if (hasControlsUpdated) {
        // Get offset of container relative to renderer's canvas
        const containerRect = this.container.getBoundingClientRect();
        const canvasRect = this.renderer.domElement.getBoundingClientRect();
        const offsetX = containerRect.left - canvasRect.left;
        const offsetY = containerRect.top - canvasRect.top;

        const { x, y, width, height } = this.region;
        // Flip y for Three.js (canvas y=0 is top, Three.js y=0 is bottom)
        const flippedY = this.renderer.domElement.height - (y + offsetY) - height;

        this.renderer.setViewport(x + offsetX, flippedY, width, height);
        this.renderer.setScissor(x + offsetX, flippedY, width, height);
        this.renderer.setScissorTest(true);

        // Render the scene
        this.renderer.render(this.scene, activeCamera);
      }
    }
  }

  public toggleMode() {
    if (this.isDisposed) return;
    this.mode = this.mode === ViewportMode.THREE_D ? ViewportMode.TWO_D : ViewportMode.THREE_D;
  }

  public updateRegion(region: { x: number; y: number; width: number; height: number }) {
    if (this.isDisposed) return;
    this.region = region;
  }

  public dispose() {
    if (this.isDisposed) return;

    this.isDisposed = true;
    if (this.controls2d) {
      this.controls2d.dispose();
      this.controls2d = null;
    }
    if (this.controls3d) {
      this.controls3d.dispose();
      this.controls3d = null;
    }
    if (this.camera2d) {
      this.camera2d = null;
    }
    if (this.camera3d) {
      this.camera3d = null;
    }
    window.removeEventListener('resize', this.handleResize);
  }
}

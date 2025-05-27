import { IFCViewerState } from '@/types/ifc';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';

// cannot save to pinia store because of thread-safety issues
const store = {
  components: null,
  world: null,
  fragmentsModels: null,
  isInitialized: false,

  initialize(container: HTMLElement) {
    if (this.isInitialized) return;
    if (!container) {
      console.error('Container element is required for initialization');
      return;
    }

    try {
      const components = new OBC.Components();

      // initialize world
      const worlds = components.get(OBC.Worlds);
      const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBCF.PostproductionRenderer>();
      world.scene = new OBC.SimpleScene(components);
      world.scene.setup();
      world.renderer = new OBCF.PostproductionRenderer(components, container);
      world.camera = new OBC.SimpleCamera(components);

      // initialize components
      components.init();

      world.renderer.postproduction.enabled = true;

      // initialize grids
      const grids = components.get(OBC.Grids);
      const grid = grids.create(world);
      world.renderer.postproduction.customEffects.excludedMeshes.push(grid.three);

      // initialize camera
      world.camera.controls?.setLookAt(12, 6, 8, 0, 0, -10);

      // Enable postprocessing
      world.renderer.postproduction.enabled = true;

      this.world = world;
      this.components = components;
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing IFC viewer:', error);
      this.dispose();
      throw error;
    }
  },

  dispose() {
    if (this.components) {
      this.components.dispose();
      this.components = null;
      this.world = null;
      this.isInitialized = false;
    }
  },
} as IFCViewerState & {
  initialize(container: HTMLElement): void;
  dispose(): void;
};

export const useIFCViewerStore = () => store;

import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import type { IFCViewerState } from '@/types/ifc';

interface ExtendedIFCViewerState extends IFCViewerState {
  currentModel: any | null;
}

const store = {
  components: null,
  world: null,
  fragmentsModels: null,
  isInitialized: false,
  currentModel: null,

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

      // initialize ifc loader
      const fragmentIfcLoader = components.get(OBC.IfcLoader);
      fragmentIfcLoader.setup();

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
      this.currentModel = null;
    }
  },

  // Get model information
  async getModelInfo(localId: number) {
    if (!this.currentModel || !localId) return null;

    const [data] = await this.currentModel.getItemsData([localId], {
      attributesDefault: true,
    });

    return data;
  },

  // Get property sets
  async getPropertySets(localId: number) {
    if (!this.currentModel || !localId) return null;

    const psets = await this.currentModel.getPropertySets([localId]);
    return psets;
  },

  // Get spatial structure
  async getSpatialStructure() {
    if (!this.currentModel) return null;

    const structure = await this.currentModel.getSpatialTree();
    return structure;
  },

  // Get items by category
  async getItemsByCategory(category: string) {
    if (!this.currentModel) return null;

    const items = await this.currentModel.getItemsOfCategory(category);
    return items;
  },
} as ExtendedIFCViewerState & {
  initialize(container: HTMLElement): void;
  dispose(): void;
  getModelInfo(localId: number): Promise<any>;
  getPropertySets(localId: number): Promise<any>;
  getSpatialStructure(): Promise<any>;
  getItemsByCategory(category: string): Promise<any>;
};

export const useIFCViewerStore = () => store;

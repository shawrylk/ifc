import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useIFCViewerStore } from './ifcViewer';
import { useModelHighlight } from '@/composables/useModelHighlight';
import type { Ref } from 'vue';
import { useModelSelection } from '@/composables/useModelSelection';

interface ModelInfoStore {
  setup: () => void;
  dispose: () => void;
  getModelInfo: (localId: number) => Promise<any | null>;
  // getPropertySets: (localId: number) => Promise<any | null>;
  // getSpatialStructure: () => Promise<any | null>;
  getItemsByCategory: (category: string) => Promise<any | null>;
  selectedId: Ref<number | null>;
  selectedInfo: Ref<any | null>;
}

export const useModelInfoStore = defineStore('modelInfo', (): ModelInfoStore => {
  const store = useIFCViewerStore();
  const { setupHighlighting } = useModelHighlight();
  const { registerSelectionCallback, registerDeselectionCallback } = useModelSelection();

  const selectedId = ref<number | null>(null);
  const selectedInfo = ref<any | null>(null);
  const selectedPsets = ref<any | null>(null);

  const getModelInfo = async (localId: number) => {
    const { fragmentsModels } = store;
    const currentModel = fragmentsModels?.models.list.values().next().value;
    if (!currentModel || !localId) return null;

    const [data] = await currentModel.getItemsData([localId], {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        DefinesOcurrence: { attributes: false, relations: false },
      },
    });

    return data;
  };

  // const getPropertySets = async (localId: number) => {
  //   if (!currentModel || !localId) return null;

  //   const psets = await currentModel.getItemsData([localId], {
  //     properties: true,
  //   });
  //   return psets;
  // };

  // const getSpatialStructure = async () => {
  //   if (!currentModel) return null;

  //   const structure = await currentModel.getSpatialTree();
  //   return structure;
  // };

  const getItemsByCategory = async (category: string) => {
    const { fragmentsModels } = store;
    const currentModel = fragmentsModels?.models.list.values().next().value;
    if (!currentModel) return null;

    const items = await currentModel.getItemsOfCategory(category);
    return items;
  };

  const setup = () => {
    setupHighlighting();

    // Setup selection handlers
    registerSelectionCallback(async ({ localId }) => {
      // Get the first selected fragment and its ID
      if (!localId) return;

      selectedId.value = localId;

      // Get model info
      const info = await getModelInfo(localId);
      selectedInfo.value = info;

      // Get property sets
      // const psets = await getPropertySets(localId);
      // selectedPsets.value = psets;
    });

    registerDeselectionCallback(() => {
      selectedId.value = null;
      selectedInfo.value = null;
      selectedPsets.value = null;
    });
  };

  const dispose = () => {
    selectedId.value = null;
    selectedInfo.value = null;
    selectedPsets.value = null;
  };

  return {
    setup,
    dispose,
    getModelInfo,
    // getPropertySets,
    // getSpatialStructure,
    getItemsByCategory,
    selectedId,
    selectedInfo,
  };
});

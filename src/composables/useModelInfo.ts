import { ref } from 'vue';
import { useIFCViewerStore } from '@/stores/ifcViewer';
import { useModelHighlight } from './useModelHighlight';
import type { FragmentIdMap } from '@thatopen/fragments';

export const useModelInfo = () => {
  const store = useIFCViewerStore();
  const {
    setupHighlighting,
    dispose: disposeHighlight,
    onSelect,
    onDeselect,
  } = useModelHighlight(store);

  const selectedId = ref<number | null>(null);
  const selectedInfo = ref<any | null>(null);
  const selectedPsets = ref<any | null>(null);

  const getModelInfo = async (localId: number) => {
    if (!store.currentModel || !localId) return null;

    const [data] = await store.currentModel.getItemsData([localId], {
      attributesDefault: true,
    });

    return data;
  };

  const getPropertySets = async (localId: number) => {
    if (!store.currentModel || !localId) return null;

    const psets = await store.currentModel.getPropertySets([localId]);
    return psets;
  };

  const getSpatialStructure = async () => {
    if (!store.currentModel) return null;

    const structure = await store.currentModel.getSpatialTree();
    return structure;
  };

  const getItemsByCategory = async (category: string) => {
    if (!store.currentModel) return null;

    const items = await store.currentModel.getItemsOfCategory(category);
    return items;
  };

  const setup = () => {
    setupHighlighting();

    // Setup selection handlers
    onSelect(async (data: FragmentIdMap) => {
      // Get the first selected fragment and its ID
      const [fragmentId, localIds] = Object.entries(data)[0] || [];
      if (!fragmentId || !localIds || localIds.size === 0) return;

      // Get the first ID from the Set
      const localId = Array.from(localIds)[0];
      selectedId.value = localId;

      // Get model info
      const info = await getModelInfo(localId);
      selectedInfo.value = info;

      // Get property sets
      const psets = await getPropertySets(localId);
      selectedPsets.value = psets;
    });

    onDeselect(() => {
      selectedId.value = null;
      selectedInfo.value = null;
      selectedPsets.value = null;
    });
  };

  const dispose = () => {
    disposeHighlight();
    selectedId.value = null;
    selectedInfo.value = null;
    selectedPsets.value = null;
  };

  return {
    setup,
    dispose,
    getModelInfo,
    getPropertySets,
    getSpatialStructure,
    getItemsByCategory,
    // Expose reactive state
    selectedId,
    selectedInfo,
    selectedPsets,
  };
};

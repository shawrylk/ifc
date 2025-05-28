import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useIFCViewerStore } from './ifcViewer';
import { useModelHighlight } from '@/composables/useModelHighlight';
import type { Ref } from 'vue';
import { useSelectionCallbacksStore } from './selectionCallbacks';
import CameraControls from 'camera-controls';

interface ModelInfoStore {
  setup: () => void;
  dispose: () => void;
  getModelInfo: (localId: number) => Promise<any | null>;
  getItemsByCategory: (category: string) => Promise<any | null>;
  focusOnSelectedItem: (selectedId: number) => Promise<void>;
  highlightSelectedItem: (selectedId: number) => Promise<void>;
  selectedId: Ref<number | null>;
  selectedInfo: Ref<any | null>;
}

export const useModelInfoStore = defineStore('modelInfo', (): ModelInfoStore => {
  const store = useIFCViewerStore();
  const { setupHighlighting, highlightSelectedItem } = useModelHighlight();
  const { registerSelectionCallback, registerDeselectionCallback } = useSelectionCallbacksStore();

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

  const focusOnSelectedItem = async (selectedId: number) => {
    if (!selectedId) return;

    const model = store.fragmentsModels?.models.list.values().next().value;
    if (!model) return;

    const box = await model.getBoxes([selectedId]);
    const controls = store.world?.camera.controls as CameraControls;
    controls.fitToBox(box[0], true);
  };

  const highlight = async (selectedId: number) => {
    if (!selectedId) return;

    const model = store.fragmentsModels?.models.list.values().next().value;
    if (!model) return;
    highlightSelectedItem(model, selectedId);
  };

  return {
    setup,
    dispose,
    getModelInfo,
    getItemsByCategory,
    focusOnSelectedItem,
    highlightSelectedItem: highlight,
    selectedId,
    selectedInfo,
  };
});

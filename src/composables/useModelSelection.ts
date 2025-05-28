import type { FragmentIdMap } from '@thatopen/fragments';
import { useModelInfoStore } from '@/stores/modelInfo';
import { useSelectionCallbacksStore } from '@/stores/selectionCallbacks';

export function useModelSelection() {
  const modelInfoStore = useModelInfoStore();
  const callbacksStore = useSelectionCallbacksStore();

  const onItemSelected = async (data: FragmentIdMap) => {
    // Get the first selected fragment and its ID
    const [fragmentId, localIds] = Object.entries(data)[0] || [];
    if (!fragmentId || !localIds || localIds.size === 0) return;

    // Get the first ID from the Set
    const localId = Array.from(localIds)[0];

    // Get all relevant data
    const modelInfo = await modelInfoStore.getModelInfo(localId);

    // Call all registered callbacks
    callbacksStore.selectionCallbacks.forEach((callback) => {
      callback({
        localId,
        modelInfo,
        // propertySets,
      });
    });
  };

  const onItemDeselected = () => {
    // Call all registered callbacks
    callbacksStore.deselectionCallbacks.forEach((callback) => {
      callback();
    });
  };

  return {
    onItemSelected,
    onItemDeselected,
  };
}

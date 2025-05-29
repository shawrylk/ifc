import { watch, onUnmounted } from 'vue';
import { useInteractionStore } from '@/stores/interactionStore';
import { useIFCStore } from '@/stores/ifcStore';
import { useThree } from '@/stores/threeStore';

export function useIFCContainer() {
  const interactionStore = useInteractionStore();
  const ifcStore = useIFCStore();
  const threeStore = useThree();
  const { setupHighlighting, focusOnSelectedItem, highlightSelectedItem, dispose } =
    interactionStore;

  watch(
    () => ifcStore.isLoaded,
    (newIsIFCLoaded) => {
      if (newIsIFCLoaded) {
        setupHighlighting();
      }
    }
  );

  watch(
    () => interactionStore.selectedId,
    (newSelectedId: number | null) => {
      if (newSelectedId !== null) {
        const model = ifcStore.getFragmentsModels()?.models.list.values().next().value;
        if (model) {
          focusOnSelectedItem(threeStore, ifcStore, newSelectedId);
          highlightSelectedItem(model, newSelectedId);
        }
      }
    }
  );

  onUnmounted(() => {
    dispose();
  });
}

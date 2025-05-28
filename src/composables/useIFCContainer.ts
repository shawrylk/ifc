import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useScene } from './useScene';
import { useIFCLoader } from './useIFCLoader';
import { useModelInfoStore } from '@/stores/modelInfo';

export function useIFCContainer() {
  const viewerContainer = ref<HTMLElement | null>(null);
  const { initialize, handleResize, isInitialized } = useScene();
  const { loadIFCNew } = useIFCLoader();
  const modelInfoStore = useModelInfoStore();
  const { setup, dispose, focusOnSelectedItem, highlightSelectedItem } = useModelInfoStore();

  const handleFileUpload = async (event: Event) => {
    if (!isInitialized.value) return;

    const target = event.target as HTMLInputElement;
    if (!target.files?.length) return;

    try {
      await loadIFCNew(target.files[0]);
      // Setup model info after model is loaded
      setup();
    } catch (error) {
      console.error('Error loading IFC file:', error);
    }
  };

  // Initialize when container is available
  watch(
    viewerContainer,
    (newContainer) => {
      if (newContainer && newContainer.clientWidth > 0 && newContainer.clientHeight > 0) {
        initialize(newContainer);
      }
    },
    { immediate: true }
  );

  watch(
    () => modelInfoStore.selectedId,
    (newSelectedId: number | null) => {
      if (newSelectedId !== null) {
        focusOnSelectedItem(newSelectedId);
        highlightSelectedItem(newSelectedId);
      }
    }
  );

  // Handle window resize
  onMounted(() => {
    window.addEventListener('resize', handleResize);
    // Ensure initialization if container is ready
    if (
      viewerContainer.value &&
      viewerContainer.value.clientWidth > 0 &&
      viewerContainer.value.clientHeight > 0
    ) {
      if (viewerContainer.value) {
        initialize(viewerContainer.value);
      }
    }
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    dispose();
  });

  return {
    viewerContainer,
    handleFileUpload,
  };
}

import { ref, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useIFCViewerStore } from '@/stores/ifcViewer';

export function useScene() {
  const store = useIFCViewerStore();
  const isInitialized = ref(false);
  const container = ref<HTMLElement | null>(null);

  const init = (viewerContainer: HTMLElement) => {
    if (isInitialized.value || !viewerContainer) return;

    container.value = viewerContainer;
    store.initialize(viewerContainer);
    isInitialized.value = true;
  };

  const handleResize = () => {
    if (!store.world?.renderer || !container.value) return;

    const camera = store.world.camera.three as THREE.PerspectiveCamera;
    camera.aspect = container.value.clientWidth / container.value.clientHeight;
    camera.updateProjectionMatrix();
    store.world.renderer.three.setSize(container.value.clientWidth, container.value.clientHeight);
  };

  onUnmounted(() => {
    store.dispose();
    isInitialized.value = false;
  });

  return {
    initialize: init,
    handleResize,
    isInitialized,
  };
}

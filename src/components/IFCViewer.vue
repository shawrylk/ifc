<template>
  <div class="ifc-viewer">
    <div ref="viewerContainer" class="viewer-container"></div>
    <div class="controls">
      <input type="file" @change="handleFileUpload" accept=".ifc" />
    </div>
    <div v-if="selectedId" class="info-panel">
      <button @click="logAttributes">Log Attributes</button>
      <button @click="logPropertySets">Log Property Sets</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useScene } from '@/composables/useScene';
import { useIFCLoader } from '@/composables/useIFCLoader';
import { useModelInfo } from '@/composables/useModelInfo';

const viewerContainer = ref<HTMLElement | null>(null);
const { initialize, handleResize, isInitialized } = useScene();
const { loadIFC } = useIFCLoader();
const {
  setup: setupModelInfo,
  dispose: disposeModelInfo,
  selectedId,
  getModelInfo,
  getPropertySets,
} = useModelInfo();

const handleFileUpload = async (event: Event) => {
  if (!isInitialized.value) return;

  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;

  try {
    await loadIFC(target.files[0]);
    // Setup model info after model is loaded
    setupModelInfo();
  } catch (error) {
    console.error('Error loading IFC file:', error);
  }
};

const logAttributes = async () => {
  if (!selectedId.value) return;
  const attributes = await getModelInfo(selectedId.value);
  console.log('Selected object attributes:', attributes);
};

const logPropertySets = async () => {
  if (!selectedId.value) return;
  const propertySets = await getPropertySets(selectedId.value);
  console.log('Selected object property sets:', propertySets);
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
  disposeModelInfo();
});
</script>

<style scoped>
.ifc-viewer {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewer-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  background: white;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  background: white;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

button {
  padding: 8px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #45a049;
}
</style>

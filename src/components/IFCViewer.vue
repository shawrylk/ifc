<template>
  <div class="ifc-viewer">
    <div ref="viewerContainer" class="viewer-container"></div>
    <div class="controls">
      <input type="file" @change="handleFileUpload" accept=".ifc" />
    </div>
    <div v-if="store.selectedInfo" class="info-panel scrollable-info-panel">
      <PropertyTreeTable :object="store.selectedInfo" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIFCContainer } from '@/composables/useIFCContainer';
import { useModelInfoStore } from '@/stores/modelInfo';
import PropertyTreeTable from './PropertyTreeTable.vue';

const { viewerContainer, handleFileUpload } = useIFCContainer();
const store = useModelInfoStore();
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
  background: black;
  padding: 1px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-panel.scrollable-info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  background: black;
  padding: 2px;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 320px;
  max-height: 70vh;
  /* overflow-y: auto; */
  font-size: 0.95em;
}
</style>

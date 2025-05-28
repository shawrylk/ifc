<template>
  <div class="ifc-viewer">
    <div ref="viewerContainer" class="viewer-container"></div>
    <div class="controls">
      <input type="file" @change="handleFileUpload" accept=".ifc" />
    </div>
    <DraggablePanel
      v-model:display="display"
      :initial-position="{ x: 10, y: 10 }"
      @update:display="
        (value) => {
          if (!value) handlePanelClose();
          else handlePanelOpen();
        }
      "
    >
      <PropertyTreeTable :object="store.selectedInfo" />
    </DraggablePanel>
  </div>
</template>

<script setup lang="ts">
import { useIFCContainer } from '@/composables/useIFCContainer';
import { useModelInfoStore } from '@/stores/modelInfo';
import PropertyTreeTable from './PropertyTreeTable.vue';
import DraggablePanel from './DraggablePanel.vue';
import { ref, watch } from 'vue';

const { viewerContainer, handleFileUpload } = useIFCContainer();
const store = useModelInfoStore();
const display = ref(false);
const wasExplicitlyClosed = ref(false);

watch(
  () => store.selectedInfo,
  (newValue) => {
    if (newValue && !wasExplicitlyClosed.value) {
      display.value = true;
    } else if (!newValue) {
      display.value = false;
    }
  }
);

const handlePanelClose = () => {
  wasExplicitlyClosed.value = true;
  display.value = false;
};

const handlePanelOpen = () => {
  wasExplicitlyClosed.value = false;
  display.value = true;
};
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
</style>

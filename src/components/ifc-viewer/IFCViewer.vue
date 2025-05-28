<template>
  <div class="ifc-viewer">
    <div ref="viewerContainer" class="viewer-container"></div>
    <PropertiesPanel ref="propertiesPanel" v-model:position="propertiesPanelPosition" />
    <ObjectTreePanel
      ref="objectTreePanel"
      v-model:position="treePanelPosition"
      v-model:size="treePanelSize"
    />
    <ViewerControls
      :objectTreePanel="objectTreePanel"
      :propertiesPanel="propertiesPanel"
      @fileUpload="handleFileUpload"
    />
  </div>
</template>

<script setup lang="ts">
import 'primeicons/primeicons.css';
import { useIFCContainer } from '@/composables/useIFCContainer';
import PropertiesPanel from './children/properties-panel/PropertiesPanel.vue';
import ObjectTreePanel from './children/object-tree-panel/ObjectTreePanel.vue';
import ViewerControls from './children/viewer-controller/ViewerControls.vue';
import { ref, onMounted } from 'vue';

const { viewerContainer, handleFileUpload } = useIFCContainer();
const objectTreePanel = ref<InstanceType<typeof ObjectTreePanel> | null>(null);
const propertiesPanel = ref<InstanceType<typeof PropertiesPanel> | null>(null);

const treePanelPosition = ref({ x: 10, y: 10 });
const treePanelSize = ref({ width: 320, height: 400 });
const propertiesPanelPosition = ref({ x: 10, y: 10 });

onMounted(() => {
  propertiesPanelPosition.value = { x: window.innerWidth - 350, y: 10 };
  treePanelPosition.value = { x: 10, y: 10 };
  treePanelSize.value = { width: 320, height: window.innerHeight - 100 };
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
</style>

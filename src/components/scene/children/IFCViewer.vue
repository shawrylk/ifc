<template>
  <div class="ifc-viewer">
    <PropertiesPanel ref="propertiesPanel" v-model:position="propertiesPanelPosition" />
    <ObjectTreePanel
      ref="objectTreePanel"
      v-model:position="treePanelPosition"
      v-model:size="treePanelSize"
    />
    <PlanViewsPanel ref="planViewsPanel" v-model:position="planViewsPanelPosition" />
    <ViewerControls
      :objectTreePanel="objectTreePanel"
      :propertiesPanel="propertiesPanel"
      :planViewsPanel="planViewsPanel"
    />
  </div>
</template>

<script setup lang="ts">
import 'primeicons/primeicons.css';
import PropertiesPanel from './children/properties-panel/PropertiesPanel.vue';
import ObjectTreePanel from './children/object-tree-panel/ObjectTreePanel.vue';
import PlanViewsPanel from './children/plan-views-panel/PlanViewsPanel.vue';
import ViewerControls from './children/viewer-controller/ViewerControls.vue';
import { ref, onMounted } from 'vue';
import { useIFCContainer } from '@/composables/useIFCContainer';

useIFCContainer();

const objectTreePanel = ref<InstanceType<typeof ObjectTreePanel> | null>(null);
const propertiesPanel = ref<InstanceType<typeof PropertiesPanel> | null>(null);
const planViewsPanel = ref<InstanceType<typeof PlanViewsPanel> | null>(null);

const treePanelPosition = ref({ x: 10, y: 10 });
const treePanelSize = ref({ width: 320, height: 400 });
const propertiesPanelPosition = ref({ x: 10, y: 10 });
const planViewsPanelPosition = ref({ x: 10, y: 10 });

onMounted(() => {
  propertiesPanelPosition.value = { x: window.innerWidth - 350, y: 10 };
  treePanelPosition.value = { x: 10, y: 10 };
  treePanelSize.value = { width: 320, height: window.innerHeight - 100 };
  planViewsPanelPosition.value = { x: window.innerWidth - 350, y: 60 };
});
</script>

<style scoped>
.ifc-viewer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
}
</style>

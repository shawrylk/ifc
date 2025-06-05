<template>
  <div class="ifc-viewer">
    <ViewportPanel
      ref="viewportPanel"
      v-model:position="viewportPanelPosition"
      v-model:size="viewportPanelSize"
      @planChanged="handlePlanChanged"
    />
    <PropertiesPanel ref="propertiesPanel" v-model:position="propertiesPanelPosition" />
    <ObjectTreePanel
      ref="objectTreePanel"
      v-model:position="treePanelPosition"
      v-model:size="treePanelSize"
    />
    <PlanViewsPanel ref="planViewsPanel" v-model:position="planViewsPanelPosition" />
    <CategoryFilterPanel ref="categoryFilterPanel" v-model:position="categoryFilterPanelPosition" />
    <ViewerControls
      ref="viewerControls"
      :objectTreePanel="objectTreePanel"
      :propertiesPanel="propertiesPanel"
      :planViewsPanel="planViewsPanel"
      :categoryFilterPanel="categoryFilterPanel"
      :viewportPanel="viewportPanel"
    />

    <!-- Wireframe Processing Progress -->
    <ProcessingProgress
      :completed="processingStatus.completed"
      :total="processingStatus.total"
      :isProcessing="processingStatus.isProcessing"
      :autoHide="true"
    />
  </div>
</template>

<script setup lang="ts">
import 'primeicons/primeicons.css';
import PropertiesPanel from './children/properties-panel/PropertiesPanel.vue';
import ObjectTreePanel from './children/object-tree-panel/ObjectTreePanel.vue';
import PlanViewsPanel from './children/plan-views-panel/PlanViewsPanel.vue';
import CategoryFilterPanel from './children/category-filter-panel/CategoryFilterPanel.vue';
import ViewerControls from './children/viewer-controller/ViewerControls.vue';
import ProcessingProgress from '@/components/commons/ProcessingProgress.vue';
import { ref, onMounted, computed } from 'vue';
import { useIFCContainer } from '@/composables/useIFCContainer';
import { useIFCStore } from '@/stores/ifcStore';
import { useXRayStore } from '@/stores/xrayStore';
import { useThree } from '@/stores/threeStore';
import * as THREE from 'three';
import ViewportPanel from './children/viewport/ViewportPanel.vue';

useIFCContainer();

const objectTreePanel = ref<InstanceType<typeof ObjectTreePanel> | null>(null);
const propertiesPanel = ref<InstanceType<typeof PropertiesPanel> | null>(null);
const planViewsPanel = ref<InstanceType<typeof PlanViewsPanel> | null>(null);
const categoryFilterPanel = ref<InstanceType<typeof CategoryFilterPanel> | null>(null);
const viewportPanel = ref<InstanceType<typeof ViewportPanel> | null>(null);
const viewerControls = ref<InstanceType<typeof ViewerControls> | null>(null);

const treePanelPosition = ref({ x: 40, y: 0 });
const treePanelSize = ref({ width: 320, height: 400 });
const propertiesPanelPosition = ref({ x: 10, y: 10 });
const planViewsPanelPosition = ref({ x: 40, y: 70 });
const categoryFilterPanelPosition = ref({ x: 370, y: 10 });
const viewportPanelPosition = ref({ x: 50, y: -20 });
const viewportPanelSize = ref({ width: 1800, height: 950 });

// X-ray processing status
const xrayStore = useXRayStore();
const ifcStore = useIFCStore();

const processingStatus = computed(() => {
  return xrayStore.processingStatus;
});

onMounted(() => {
  propertiesPanelPosition.value = { x: window.innerWidth - 350, y: 10 };
  treePanelSize.value = { width: 320, height: window.innerHeight - 100 };
  planViewsPanelPosition.value = { x: window.innerWidth - 350, y: 60 };
  categoryFilterPanelPosition.value = { x: window.innerWidth - 720, y: 10 };
  viewportPanelPosition.value = { x: window.innerWidth - viewportPanelSize.value.width - 20, y: 0 };
});

const handleDoubleClick = () => {
  const { mainViewport } = useThree();
  if (!mainViewport) return;
  const fragmentsModels = ifcStore.getFragmentsModels();
  const currentModel = fragmentsModels?.models.list.values().next().value;
  if (!currentModel) return;
  mainViewport.controls.fitToSphere(currentModel.box.getBoundingSphere(new THREE.Sphere()), true);
};

// Handle plan visibility changes from ViewportPanel
const handlePlanChanged = (planId: number | null) => {
  if (viewerControls.value) {
    viewerControls.value.handlePlanVisibilityChange(planId);
  }
};

defineExpose({
  handleDoubleClick,
});
</script>

<style scoped>
.ifc-viewer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Allow clicks to pass through to the canvas */
  z-index: 10; /* Ensure UI elements are above the canvas */
}

/* Allow pointer events on interactive elements within the viewer */
.ifc-viewer > * {
  pointer-events: auto;
}
</style>

<template>
  <div class="controls-buttons">
    <IconFileInput title="Open IFC" accept=".ifc" @change="handleFileUpload">
      <i class="pi pi-folder-open"></i>
    </IconFileInput>
    <IconButton title="Open Object Tree" @click="handleObjectTreeOpen">
      <i class="pi pi-sitemap"></i>
    </IconButton>
    <IconButton title="Open Properties" @click="handlePropertiesOpen">
      <i class="pi pi-info-circle"></i>
    </IconButton>
    <IconButton title="Plan views" @click="handlePlanViewsOpen">
      <i class="pi pi-map"></i>
    </IconButton>
    <IconButton title="Category Filter" @click="handleCategoryFilterOpen">
      <i class="pi pi-filter"></i>
    </IconButton>
    <IconButton
      :title="xrayStore.isForced ? 'X-Ray (Auto-enabled for plan view)' : 'X-Ray'"
      @click.prevent="handleXRayOpen"
      :disabled="!ifcStore.isLoaded || xrayStore.isForced"
    >
      <i
        class="pi"
        :class="{
          'pi-eye-slash': !enableXRay,
          'pi-eye': enableXRay,
          forced: xrayStore.isForced,
        }"
      ></i>
    </IconButton>
    <IconButton title="Show Viewports" @click="handleShowViewports">
      <i class="pi pi-building"></i>
    </IconButton>
  </div>
</template>

<script setup lang="ts">
import IconButton from '@/components/commons/IconButton.vue';
import IconFileInput from '@/components/commons/IconFileInput.vue';
import ObjectTreePanel from '../object-tree-panel/ObjectTreePanel.vue';
import PropertiesPanel from '../properties-panel/PropertiesPanel.vue';
import PlanViewsPanel from '../plan-views-panel/PlanViewsPanel.vue';
import CategoryFilterPanel from '../category-filter-panel/CategoryFilterPanel.vue';
import { useIFCStore } from '@/stores/ifcStore';
import { useXRayStore } from '@/stores/xrayStore';
import { onUnmounted, watch, computed } from 'vue';
import debounce from 'lodash/debounce';
import ViewportPanel from '../viewport/ViewportPanel.vue';

const props = defineProps<{
  objectTreePanel: InstanceType<typeof ObjectTreePanel> | null;
  propertiesPanel: InstanceType<typeof PropertiesPanel> | null;
  planViewsPanel: InstanceType<typeof PlanViewsPanel> | null;
  categoryFilterPanel: InstanceType<typeof CategoryFilterPanel> | null;
  viewportPanel: InstanceType<typeof ViewportPanel> | null;
}>();

const ifcStore = useIFCStore();
const xrayStore = useXRayStore();
const { loadIFCFile, dispose } = ifcStore;
const enableXRay = computed(() => xrayStore.isEnabled);

// Initialize managers when IFC is loaded
const initializeManagers = async () => {
  const fragmentsModels = ifcStore.getFragmentsModels();
  if (!fragmentsModels) return;

  // Initialize both stores with the same FragmentsModels
  await xrayStore.initialize(fragmentsModels);
};

// Watch for IFC loading state
watch(
  () => ifcStore.isLoaded,
  async (isLoaded) => {
    if (isLoaded) {
      await initializeManagers();
    } else {
      // Clean up when IFC is unloaded
      xrayStore.dispose();
    }
  }
);

const handleXRayOpen = debounce(() => {
  xrayStore.toggleXRay();
}, 100);

const handleFileUpload = debounce(async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;
  await loadIFCFile(target.files[0]);
}, 100);

const handleObjectTreeOpen = () => {
  if (props.objectTreePanel) {
    props.objectTreePanel.handleDisplayChange(true);
    props.objectTreePanel.loadTreeData();
  }
};

const handlePropertiesOpen = () => {
  if (props.propertiesPanel) {
    props.propertiesPanel.handleDisplayChange(true);
  }
};

const handlePlanViewsOpen = () => {
  if (props.planViewsPanel) {
    props.planViewsPanel.handleDisplayChange(true);
    props.planViewsPanel.loadPlans();
  }
};

const handleCategoryFilterOpen = () => {
  if (props.categoryFilterPanel) {
    props.categoryFilterPanel.handleDisplayChange(true);
  }
};

const handleShowViewports = debounce(() => {
  if (props.viewportPanel) {
    props.viewportPanel.handleDisplayChange(!props.viewportPanel.display);
  }
}, 100);

// Method to handle plan visibility changes from external components
const handlePlanVisibilityChange = (planId: number | null) => {
  xrayStore.updateStoreyWireframeVisibility(planId);
};

onUnmounted(() => {
  dispose();
});

// Expose methods for parent components
defineExpose({
  handlePlanVisibilityChange,
});
</script>

<style scoped>
.controls-buttons {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.controls-buttons :deep(.pi) {
  font-size: 1.5rem;
}

.controls-buttons :deep(.pi.forced) {
  color: #ffa500 !important; /* Orange color when forced by plan view */
  opacity: 0.8;
}
</style>

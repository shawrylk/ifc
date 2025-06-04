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
    <IconButton title="X-Ray" @click.prevent="handleXRayOpen" :disabled="!ifcStore.isLoaded">
      <i class="pi" :class="{ 'pi-eye-slash': !enableXRay, 'pi-eye': enableXRay }"></i>
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
import { onUnmounted, ref } from 'vue';
import * as THREE from 'three';
import debounce from 'lodash/debounce';
import { useThree } from '@/stores/threeStore';
import ViewportPanel from '../viewport/ViewportPanel.vue';

const props = defineProps<{
  objectTreePanel: InstanceType<typeof ObjectTreePanel> | null;
  propertiesPanel: InstanceType<typeof PropertiesPanel> | null;
  planViewsPanel: InstanceType<typeof PlanViewsPanel> | null;
  categoryFilterPanel: InstanceType<typeof CategoryFilterPanel> | null;
  viewportPanel: InstanceType<typeof ViewportPanel> | null;
}>();

const { render } = useThree();
const ifcStore = useIFCStore();
const { loadIFCFile, dispose } = ifcStore;
const enableXRay = ref(false);

const handleXRayOpen = debounce(() => {
  const fragmentsModels = ifcStore.getFragmentsModels();
  fragmentsModels?.models.list.forEach((model) => {
    model.object.children.forEach((child) => {
      if (child instanceof THREE.LineSegments && child.name === 'wireframe') {
        const newMaterial = new THREE.LineBasicMaterial({ color: 0x878787 });
        newMaterial.depthTest = !child.material.depthTest;
        newMaterial.depthWrite = !child.material.depthWrite;
        enableXRay.value = !enableXRay.value;
        child.material = newMaterial;
        if (child instanceof THREE.LineSegments) {
          child.material = newMaterial;
          child.material.needsUpdate = true;
        }
      }
    });
  });
  render(true);
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

onUnmounted(() => {
  dispose();
});
</script>

<style scoped>
.controls-buttons {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 100;
}

.controls-buttons :deep(.pi) {
  font-size: 1.5rem;
}
</style>

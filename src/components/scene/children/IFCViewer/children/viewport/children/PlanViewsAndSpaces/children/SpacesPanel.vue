<template>
  <div class="spaces-panel" v-if="visiblePlanId !== null" :style="{ height: height + 'px' }">
    <h4 class="spaces-title">Rooms</h4>
    <ObjectTree
      :treeData="spacesTreeData"
      :categories="['IFCSPACE']"
      :noDataMessage="'No rooms in this storey'"
      @nodeClick="handleSpaceNodeClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import ObjectTree from '@/components/scene/children/IFCViewer/children/object-tree-panel/children/ObjectTree.vue';
import { useIFCStore } from '@/stores/ifcStore';
import { useInteractionStore } from '@/stores/interactionStore';
import { loadTreeData, type TreeNode } from '@/utils/treeUtils';

const props = defineProps<{
  plansManager: any;
  visiblePlanId: number | null;
  height: number;
}>();

const spacesTreeData = ref<TreeNode[]>([]);
const ifcStore = useIFCStore();
const interactionStore = useInteractionStore();

const loadSpacesForPlan = async (planId: number | null) => {
  if (planId === null || !props.plansManager) {
    spacesTreeData.value = [];
    return;
  }

  try {
    // Get the storey from the plans manager using the plan ID
    const storey = props.plansManager.getStorey(planId);
    if (!storey) {
      spacesTreeData.value = [];
      return;
    }

    const fragmentsModels = ifcStore.getFragmentsModels();
    if (!fragmentsModels) {
      spacesTreeData.value = [];
      return;
    }

    const currentModel = fragmentsModels.models.list.values().next().value;
    if (!currentModel) {
      spacesTreeData.value = [];
      return;
    }

    // Get full spatial structure
    const spatialStructure = await currentModel.getSpatialStructure();
    if (!spatialStructure) {
      spacesTreeData.value = [];
      return;
    }

    // Find the specific storey in the spatial structure and extract its spaces
    const findStoreySpaces = (node: any, targetLocalId: number): any => {
      if (node.localId === targetLocalId) {
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const result = findStoreySpaces(child, targetLocalId);
          if (result) return result;
        }
      }
      return null;
    };

    const storeyNode = findStoreySpaces(spatialStructure, storey._localId);
    if (!storeyNode) {
      spacesTreeData.value = [];
      return;
    }

    // Create a mock fragment model with just the storey spatial structure
    const storeyFragmentModel = {
      getSpatialStructure: async () => storeyNode,
    };

    // Load tree data with IFCSPACE filter from the storey's spatial structure
    const storeyTreeData = await loadTreeData(
      storeyFragmentModel as any,
      ['IFCSPACE'],
      storey.name
    );
    spacesTreeData.value = storeyTreeData;
  } catch (error) {
    console.error('Error loading spaces for plan:', error);
    spacesTreeData.value = [];
  }
};

const handleSpaceNodeClick = async (item: any) => {
  if (item.key) {
    const info = await interactionStore.getModelInfo(ifcStore, item.key);
    if (info) {
      interactionStore.selectedInfo = info;
    }
  }
};

// Watch for plan selection changes
watch(
  () => props.visiblePlanId,
  async (newPlanId) => {
    await loadSpacesForPlan(newPlanId);
  },
  { immediate: true }
);
</script>

<style scoped>
.spaces-panel {
  flex: 0 0 auto;
  padding: 12px;
  background: #242424;
  overflow-y: auto;
  position: relative;
}

.spaces-title {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}
</style>

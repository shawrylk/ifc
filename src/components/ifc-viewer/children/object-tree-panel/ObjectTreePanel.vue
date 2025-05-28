<template>
  <DraggablePanel
    title="Object Tree"
    v-model:display="display"
    v-model:position="position"
    @update:display="handleDisplayChange"
  >
    <ObjectTree :treeData="treeData" @nodeClick="handleNodeClick" />
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import ObjectTree from './children/ObjectTree.vue';
import { useIFCViewerStore } from '@/stores/ifcViewer';
import { useModelInfoStore } from '@/stores/modelInfo';

const props = defineProps<{
  position?: { x: number; y: number };
  display?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:position', value: { x: number; y: number }): void;
  (e: 'update:display', value: boolean): void;
}>();

const display = ref(props.display ?? false);
const position = ref(props.position || { x: 10, y: 10 });
const treeData = ref<any[]>([]);
const store = useIFCViewerStore();
const modelInfoStore = useModelInfoStore();

const handleDisplayChange = (value: boolean) => {
  display.value = value;
};

// Expose the display property to parent components
defineExpose({
  display,
  position,
  handleDisplayChange,
});

watch(position, (newValue) => {
  emit('update:position', newValue);
});

watch(
  () => props.display,
  (newValue) => {
    if (newValue !== undefined) {
      display.value = newValue;
    }
  }
);

watch(display, (newValue) => {
  emit('update:display', newValue);
});

const handleNodeClick = async (item: any) => {
  if (item.id) {
    const info = await modelInfoStore.getModelInfo(item.id);
    if (info) {
      modelInfoStore.selectedInfo = info;
    }
  }
};

interface SpatialElement {
  expressID: number;
  Name?: { value: string };
  type: string;
}

const loadTreeData = async () => {
  const { fragmentsModels } = store;
  if (!fragmentsModels) return;

  const currentModel = fragmentsModels.models.list.values().next().value;
  if (!currentModel) return;

  try {
    // Get spatial structure elements
    const spatialElements = await modelInfoStore.getItemsByCategory('IfcSpatialStructureElement');
    if (spatialElements) {
      // Transform the data into a tree structure
      const tree = spatialElements.map((item: SpatialElement) => ({
        id: item.expressID,
        name: item.Name?.value || 'Unnamed',
        type: item.type,
        children: [],
      }));
      treeData.value = tree;
    }
  } catch (error) {
    console.error('Error loading tree data:', error);
  }
};

watch(
  () => store.fragmentsModels,
  (newValue) => {
    if (newValue) {
      loadTreeData();
    } else {
      treeData.value = [];
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.object-tree {
  min-height: 300px;
  max-height: 600px;
  overflow-y: auto;
  padding: 8px;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #666;
  font-style: italic;
}

.tree-container {
  font-size: 14px;
}

.tree-item {
  margin: 4px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.tree-node:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.tree-node i {
  margin-right: 8px;
  font-size: 16px;
}

.tree-children {
  margin-left: 24px;
}

.has-children {
  font-weight: 500;
}
</style>

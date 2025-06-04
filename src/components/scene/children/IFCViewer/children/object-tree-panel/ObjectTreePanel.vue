<template>
  <DraggablePanel
    title="Object Tree"
    v-model:display="display"
    v-model:position="position"
    @update:display="handleDisplayChange"
  >
    <ObjectTree :treeData="treeData" :categories="categories" @nodeClick="handleNodeClick" />
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import ObjectTree from './children/ObjectTree.vue';
import { useInteractionStore } from '@/stores/interactionStore';
import { useIFCStore } from '@/stores/ifcStore';
import { loadTreeData as loadTreeDataUtil, type TreeNode } from '@/utils/treeUtils';

const props = defineProps<{
  position?: { x: number; y: number };
  display?: boolean;
  categories?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:position', value: { x: number; y: number }): void;
  (e: 'update:display', value: boolean): void;
}>();

const display = ref(props.display ?? false);
const position = ref(props.position || { x: 10, y: 10 });
const categories = ref(props.categories || []);
const treeData = ref<TreeNode[]>([]);
const ifcStore = useIFCStore();
const interactionStore = useInteractionStore();

const handleDisplayChange = (value: boolean) => {
  display.value = value;
};

const loadTreeData = async () => {
  const fragmentsModels = ifcStore.getFragmentsModels();
  if (!fragmentsModels) return;

  const currentModel = fragmentsModels.models.list.values().next().value;
  if (!currentModel) return;

  treeData.value = await loadTreeDataUtil(currentModel, categories.value);
};

// Watch for categories changes and reload tree data
watch(
  () => props.categories,
  (newCategories) => {
    categories.value = newCategories || [];
    if (display.value) {
      loadTreeData();
    }
  }
);

// Expose the display property to parent components
defineExpose({
  display,
  position,
  handleDisplayChange,
  loadTreeData,
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

watch(
  () => ifcStore.isLoaded,
  (newValue) => {
    if (newValue) {
      loadTreeData();
    }
  }
);

const handleNodeClick = async (item: any) => {
  if (item.id) {
    const info = await interactionStore.getModelInfo(ifcStore, item.id);
    if (info) {
      interactionStore.selectedInfo = info;
    }
  }
};
</script>

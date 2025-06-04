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
import { useCategoryLookupStore } from '@/stores/categoryLookupStore';
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
const categoryLookupStore = useCategoryLookupStore();

const handleDisplayChange = (value: boolean) => {
  display.value = value;
};

const loadTreeData = async () => {
  const fragmentsModels = ifcStore.getFragmentsModels();
  if (!fragmentsModels) {
    treeData.value = [];
    categoryLookupStore.clearLookupTable();
    return;
  }

  const currentModel = fragmentsModels.models.list.values().next().value;
  if (!currentModel) {
    treeData.value = [];
    categoryLookupStore.clearLookupTable();
    return;
  }

  try {
    const newTreeData = await loadTreeDataUtil(currentModel, categories.value);
    treeData.value = newTreeData;

    // Initialize category lookup store with the loaded tree data
    if (newTreeData && newTreeData.length > 0) {
      categoryLookupStore.buildLookupTable(newTreeData);
      console.log('Category lookup store initialized with tree data');
    } else {
      categoryLookupStore.clearLookupTable();
    }
  } catch (error) {
    console.error('Error loading tree data:', error);
    treeData.value = [];
    categoryLookupStore.clearLookupTable();
  }
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

// Watch for tree data changes to update category filters
watch(
  () => treeData.value,
  (newTreeData) => {
    if (newTreeData && newTreeData.length > 0) {
      // Update category filters based on current categories prop
      if (categories.value && categories.value.length > 0) {
        categoryLookupStore.setCategoryFilters(categories.value);
      } else {
        // If no specific categories are set, clear filters to show all
        categoryLookupStore.clearCategoryFilters();
      }
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
  const id = Number(item.key);
  if (id) {
    const onItemSelected = interactionStore.onItemSelected;
    onItemSelected(id);
  }
};
</script>

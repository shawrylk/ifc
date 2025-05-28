<template>
  <div class="object-tree">
    <div v-if="!treeData.length" class="no-data">No IFC model loaded</div>
    <div v-else class="tree-container">
      <ContextMenu ref="cm" :model="menuItems" />
      <Tree
        :value="treeData"
        selectionMode="single"
        highlightOnSelect
        @node-select="onNodeSelect"
        class="w-full md:w-[30rem] gap-0 padding-0"
        v-model:expandedKeys="expandedKeys"
        v-model:selectionKeys="selectionKeys"
        @contextmenu="onContextMenu"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Tree from 'primevue/tree';
import ContextMenu from 'primevue/contextmenu';
import { TreeNode } from 'primevue/treenode';

const props = defineProps<{
  treeData: any[];
}>();

const emit = defineEmits<{
  (e: 'nodeClick', item: any): void;
}>();

const cm = ref();
const selectedNode = ref<any>(null);
const expandedKeys = ref<{ [key: string]: boolean }>({});
const selectionKeys = ref<{ [key: string]: boolean }>({});

function collectKeys(nodes: any[]): string[] {
  let keys: string[] = [];
  for (const node of nodes) {
    if (node.key) keys.push(node.key);
    if (node.children) keys = keys.concat(collectKeys(node.children));
  }
  return keys;
}

const expandAll = () => {
  const keys = collectKeys(props.treeData);
  expandedKeys.value = Object.fromEntries(keys.map((key) => [key, true]));
};

const collapseAll = () => {
  expandedKeys.value = {};
};

const expandSelected = () => {
  if (!selectedNode.value) return;
  const keys = collectKeys([selectedNode.value]);
  expandedKeys.value = {
    ...expandedKeys.value,
    ...Object.fromEntries(keys.map((key) => [key, true])),
  };
};

const collapseSelected = () => {
  if (!selectedNode.value) return;
  const keys = collectKeys([selectedNode.value]);
  const newKeys = { ...expandedKeys.value };
  keys.forEach((key) => delete newKeys[key]);
  expandedKeys.value = newKeys;
};

const menuItems = [
  {
    label: 'Expand All',
    icon: 'pi pi-fw pi-plus',
    command: expandAll,
  },
  {
    label: 'Expand Selected',
    icon: 'pi pi-fw pi-plus-circle',
    command: expandSelected,
  },
  {
    label: 'Collapse All',
    icon: 'pi pi-fw pi-minus',
    command: collapseAll,
  },
  {
    label: 'Collapse Selected',
    icon: 'pi pi-fw pi-minus-circle',
    command: collapseSelected,
  },
];

const onNodeSelect = (event: TreeNode) => {
  selectedNode.value = event;
  emit('nodeClick', event);
};

const onContextMenu = (event: any) => {
  cm.value.show(event);
};

onMounted(() => {
  expandAll();
});
</script>

<style scoped>
.object-tree {
  overflow-y: auto;
  padding: 0px;
  margin: 0px;
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
  font-size: 12px;
}
</style>

<template>
  <div class="object-tree">
    <div v-if="!treeData.length" class="no-data">No IFC model loaded</div>
    <div v-else class="tree-container">
      <div v-for="(item, index) in treeData" :key="index" class="tree-item">
        <div
          class="tree-node"
          :class="{ 'has-children': item.children?.length }"
          @click="handleNodeClick(item)"
        >
          <i :class="getNodeIcon(item)"></i>
          <span>{{ item.name }}</span>
        </div>
        <div v-if="item.children?.length" class="tree-children">
          <div v-for="(child, childIndex) in item.children" :key="childIndex" class="tree-item">
            <div
              class="tree-node"
              :class="{ 'has-children': child.children?.length }"
              @click="handleNodeClick(child)"
            >
              <i :class="getNodeIcon(child)"></i>
              <span>{{ child.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useIFCViewerStore } from '@/stores/ifcViewer';
import { useModelInfoStore } from '@/stores/modelInfo';
import 'primeicons/primeicons.css';

const props = defineProps<{
  treeData: any[];
}>();

const emit = defineEmits<{
  (e: 'nodeClick', item: any): void;
}>();

const getNodeIcon = (item: any) => {
  if (item.children?.length) {
    return 'pi pi-folder';
  }
  return 'pi pi-box';
};

const handleNodeClick = (item: any) => {
  emit('nodeClick', item);
};
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

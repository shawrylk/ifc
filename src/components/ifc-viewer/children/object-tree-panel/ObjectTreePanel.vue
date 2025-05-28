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

const loadTreeData = async () => {
  const { fragmentsModels } = store;
  if (!fragmentsModels) return;

  const currentModel = fragmentsModels.models.list.values().next().value;
  if (!currentModel) return;

  try {
    // Get spatial structure elements
    const spatialElements = await currentModel.getSpatialStructure();
    if (spatialElements) {
      // Transform the data into a tree structure
      const transformNode = (rootNode: any) => {
        interface StackItem {
          node: any;
          result: any;
          parentLabel?: string;
        }
        const stack: StackItem[] = [{ node: rootNode, result: null }];
        const resultMap = new Map<string, any>();

        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) continue;

          const { node, result, parentLabel } = current;

          // If node has no localId, just pass its label to children
          if (!node.localId) {
            if (node.children && node.children.length > 0) {
              // Push children to stack with parent's label
              for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push({
                  node: node.children[i],
                  result: result,
                  parentLabel: node.category || parentLabel,
                });
              }
            }
            continue;
          }

          const transformedNode = {
            key: node.localId,
            label: `${node.category || parentLabel} (id: ${node.localId})`,
            children: [],
          };

          if (result) {
            result.children.push(transformedNode);
          } else {
            resultMap.set(node.localId, transformedNode);
          }

          if (node.children && node.children.length > 0) {
            // Push children to stack in reverse order to maintain original order
            for (let i = node.children.length - 1; i >= 0; i--) {
              stack.push({
                node: node.children[i],
                result: transformedNode,
                parentLabel: node.category || parentLabel,
              });
            }
          }
        }

        return Array.from(resultMap.values());
      };

      treeData.value = transformNode(spatialElements);
    }
  } catch (error) {
    console.error('Error loading tree data:', error);
  }
};

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

const handleNodeClick = async (item: any) => {
  if (item.id) {
    const info = await modelInfoStore.getModelInfo(item.id);
    if (info) {
      modelInfoStore.selectedInfo = info;
    }
  }
};
</script>

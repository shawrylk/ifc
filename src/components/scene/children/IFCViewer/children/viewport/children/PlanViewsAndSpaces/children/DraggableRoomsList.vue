<template>
  <div class="draggable-rooms-list">
    <div v-if="!treeData.length" class="no-data">{{ message }}</div>
    <div v-else class="rooms-container">
      <div
        v-for="room in flatRoomsList"
        :key="room.key"
        class="room-item"
        :draggable="true"
        @dragstart="onDragStart($event, room)"
        @dragend="onDragEnd"
        @click="onRoomClick(room)"
      >
        <div class="room-content">
          <span class="room-label">{{ room.label }}</span>
          <span class="drag-hint">📋</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TreeNode } from 'primevue/treenode';
import { useInteractionStore } from '@/stores/interactionStore';

const props = defineProps<{
  treeData: TreeNode[];
  categories: string[];
  noDataMessage?: string;
}>();

const message = props.noDataMessage || 'No rooms available';

const emit = defineEmits<{
  (e: 'nodeClick', item: any): void;
  (e: 'nodeDragStart', item: any): void;
}>();

const interactionStore = useInteractionStore();

// Flatten the tree structure to get all IFCSPACE items
const flatRoomsList = computed(() => {
  const rooms: TreeNode[] = [];

  const extractRooms = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (isRoomNode(node)) {
        rooms.push(node);
      }
      if (node.children) {
        extractRooms(node.children);
      }
    }
  };

  extractRooms(props.treeData);
  return rooms;
});

// Check if a node represents a room (IFCSPACE)
const isRoomNode = (node: TreeNode) => {
  return node.label && node.label.includes('IFCSPACE');
};

// Extract room data from node for drag operations
const extractRoomData = (node: TreeNode) => {
  const labelMatch = node.label?.match(/^(.*?)\s*\(id:\s*(\d+)\)$/);
  const name = labelMatch ? labelMatch[1].trim() : node.label || 'Unnamed Room';
  const localId = labelMatch ? parseInt(labelMatch[2]) : parseInt(node.key?.toString() || '0');

  return {
    id: node.key?.toString() || '',
    name: name,
    localId: localId,
    area: extractAreaFromLabel(node.label || ''),
    category: 'IFCSPACE',
  };
};

// Extract area information from label if available
const extractAreaFromLabel = (_label: string): string | undefined => {
  // This is a placeholder - you might want to get area from the actual IFC data
  return undefined; // Could be implemented to extract area from node data
};

const onDragStart = (event: DragEvent, node: TreeNode) => {
  const roomData = extractRoomData(node);

  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(roomData));
    event.dataTransfer.effectAllowed = 'move';

    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'drag-preview';
    dragImage.textContent = roomData.name;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      background: #667eea;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);

    // Clean up drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 100);
  }

  emit('nodeDragStart', roomData);
};

const onDragEnd = (_event: DragEvent) => {
  // Clean up any drag state if needed
};

const onRoomClick = (room: TreeNode) => {
  if ('key' in room) {
    interactionStore.selectedId = Number(room.key);
  }
  emit('nodeClick', room);
};
</script>

<style scoped>
.draggable-rooms-list {
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

.rooms-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px dashed rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s ease;
  font-size: 12px;
}

.room-item:hover {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
  transform: translateY(-1px);
}

.room-item:active {
  cursor: grabbing;
}

.room-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.room-label {
  flex: 1;
  color: #e2e8f0;
  font-weight: 500;
}

.drag-hint {
  opacity: 0.6;
  font-size: 10px;
  margin-left: 8px;
  transition: opacity 0.2s ease;
}

.room-item:hover .drag-hint {
  opacity: 1;
}

/* Custom drag preview styles */
.drag-preview {
  position: absolute;
  background: #667eea;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
</style>

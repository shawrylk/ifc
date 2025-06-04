<template>
  <div class="flow-chart">
    <!-- SVG arrow markers definition -->
    <svg style="position: absolute; width: 0; height: 0">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#667eea" />
        </marker>
      </defs>
    </svg>

    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-viewport="{ zoom: 0.8 }"
      :min-zoom="0.2"
      :max-zoom="2"
      :fit-view-on-init="true"
      :class="['vue-flow-container', { 'drag-over': isDragOver }]"
      :nodes-selectable="true"
      :selection-key-code="true"
      :select-nodes-on-drag="false"
      :pan-on-drag="[1, 2]"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @node-click="onNodeClick"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @selection-change="onSelectionChange"
      @contextmenu="onContextMenu"
    >
      <Background />
      <Controls :show-zoom="false" />

      <!-- Drop zone indicator -->
      <div v-if="isDragOver" class="drop-zone-indicator">
        <div class="drop-zone-text">Drop room here to create a new node</div>
      </div>

      <!-- Duplicate warning -->
      <div v-if="duplicateWarningVisible" class="duplicate-warning">
        <div class="warning-content">
          {{ duplicateWarningMessage }}
        </div>
      </div>

      <!-- Selection info -->
      <div v-if="selectedNodes.length > 0" class="selection-info">
        <div class="selection-text">
          {{ selectedNodes.length }} node{{ selectedNodes.length !== 1 ? 's' : '' }} selected
          <span v-if="canGroupSelectedNodes">(Right-click to group & connect with arrows)</span>
        </div>
      </div>

      <!-- Custom Room Node -->
      <template #node-room="{ data }">
        <div class="room-node" :class="{ 'functional-room': data.isFunctionalRoom }">
          <!-- Connection handles -->
          <Handle id="left" type="target" :position="Position.Left" class="node-handle" />
          <Handle id="right" type="source" :position="Position.Right" class="node-handle" />

          <div class="room-header">
            <span class="room-title">{{ data.label }}</span>
            <span class="ifc-id">ID: {{ data.localId }}</span>
          </div>
          <div v-if="data.rooms && data.rooms.length > 0" class="room-list">
            <div v-for="room in data.rooms" :key="room.id" class="room-item">
              {{ room.name }}
            </div>
          </div>
          <div v-if="data.area" class="room-area">{{ data.area }}</div>
        </div>
      </template>

      <!-- Custom Functional Group Node -->
      <template #node-functional="{ data, id }">
        <div class="functional-node">
          <!-- Connection handles -->
          <Handle id="left" type="target" :position="Position.Left" class="node-handle" />
          <Handle id="right" type="source" :position="Position.Right" class="node-handle" />

          <div class="functional-header">
            <input
              v-model="data.label"
              class="functional-title"
              placeholder="Functional Space Name"
              @blur="updateNodeLabel(id, data.label)"
            />
          </div>
          <div class="functional-content">
            <div class="room-count">{{ data.roomCount || 0 }} rooms</div>
            <div v-if="data.totalArea" class="total-area">{{ data.totalArea }}</div>
          </div>
        </div>
      </template>

      <!-- Context Menu -->
      <div
        v-if="showContextMenu"
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
        @click.stop
      >
        <div v-if="canGroupSelectedNodes" class="context-menu-item" @click="groupSelectedNodes">
          <span class="menu-icon">🔗</span>
          Group & Connect Selected Nodes
        </div>
        <div v-if="hasSelectedNodes" class="context-menu-item" @click="deleteSelectedNodes">
          <span class="menu-icon">🗑️</span>
          Delete Selected
        </div>
        <div class="context-menu-item" @click="clearSelection">
          <span class="menu-icon">❌</span>
          Clear Selection
        </div>
      </div>

      <!-- Selection overlay -->
      <div v-if="showContextMenu" class="context-menu-overlay" @click="hideContextMenu"></div>
    </VueFlow>

    <!-- Helper text at bottom -->
    <div v-if="showHelpText && nodes.length > 0" class="help-text-bottom">
      <div class="help-content">
        💡 Drag rooms from the left panel to create nodes • Ctrl+Click to select multiple •
        Right-click to group & connect
        <button @click="showHelpText = false" class="help-close">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { VueFlow, useVueFlow, Position } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Handle } from '@vue-flow/core';
import type { Node, Edge } from '@vue-flow/core';

interface RoomData {
  id: string;
  name: string;
  localId: number;
  area?: string;
}

interface NodeData {
  label: string;
  isFunctionalRoom?: boolean;
  rooms?: RoomData[];
  roomCount?: number;
  totalArea?: string;
  localId?: number;
  area?: string;
}

const { addNodes, addEdges, removeNodes, updateNode, getNode, getNodes, project } = useVueFlow();

const nodes = ref<Node<NodeData>[]>([]);
const edges = ref<Edge[]>([]);
const isDragOver = ref(false);
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedNodes = ref<Node<NodeData>[]>([]);
const showHelpText = ref(true);

let nodeId = 0;
const getNodeId = () => `node_${++nodeId}`;

// Auto-hide help text after 8 seconds
setTimeout(() => {
  showHelpText.value = false;
}, 8000);

const emit = defineEmits<{
  (e: 'nodeClick', nodeData: any): void;
  (e: 'functionalGroupCreated', groupData: any): void;
}>();

// Computed properties for context menu conditions
const hasSelectedNodes = computed(() => selectedNodes.value.length > 0);
const canGroupSelectedNodes = computed(() => {
  return (
    selectedNodes.value.length >= 2 &&
    selectedNodes.value.every((node) => node.type === 'room' || node.type === 'functional')
  );
});

// Check if room already exists in the flowchart (optimized)
const isRoomAlreadyAdded = (localId: number): boolean => {
  return nodes.value.some((node) => {
    if (node.type === 'room' && node.data?.localId === localId) {
      return true;
    }
    if (node.type === 'functional' && node.data?.rooms) {
      return node.data.rooms.some((room) => room.localId === localId);
    }
    return false;
  });
};

// Show feedback when trying to add duplicate room
const duplicateWarningVisible = ref(false);
const duplicateWarningMessage = ref('');

const showDuplicateWarning = (roomName: string, localId: number) => {
  duplicateWarningMessage.value = `🚫 Room "${roomName}" (ID: ${localId}) is already in the flowchart!`;
  duplicateWarningVisible.value = true;

  // Remove warning after 2 seconds
  setTimeout(() => {
    duplicateWarningVisible.value = false;
  }, 2000);
};

// Handle room drop from spaces panel
const onDrop = (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = false;

  const roomData = event.dataTransfer?.getData('application/json');
  if (!roomData) return;

  const room: RoomData = JSON.parse(roomData);

  // Check if room is already added
  if (isRoomAlreadyAdded(room.localId)) {
    showDuplicateWarning(room.name, room.localId);
    return;
  }

  // Get the flow chart container element
  const flowContainer = event.currentTarget as HTMLElement;
  const containerRect = flowContainer.getBoundingClientRect();

  // Calculate position relative to the flow chart container
  const relativeX = event.clientX - containerRect.left;
  const relativeY = event.clientY - containerRect.top;

  // Convert to flow chart coordinates using vue-flow's project function
  const position = project({ x: relativeX, y: relativeY });

  // Check if dropping on an existing functional node
  const targetNode = getNodeAtPosition(position);

  if (targetNode && targetNode.type === 'functional') {
    // Add room to existing functional group
    addRoomToFunctionalGroup(targetNode.id, room);
  } else {
    // Create new room node at the exact drop position
    createRoomNode(room, position);
  }
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
};

const onDragLeave = (event: DragEvent) => {
  // Only set isDragOver to false if we're actually leaving the container
  const relatedTarget = event.relatedTarget as HTMLElement;
  const currentTarget = event.currentTarget as HTMLElement;

  if (!currentTarget.contains(relatedTarget)) {
    isDragOver.value = false;
  }
};

const getNodeAtPosition = (position: { x: number; y: number }) => {
  const allNodes = getNodes.value;
  return allNodes.find((node) => {
    const nodePos = node.computedPosition || node.position;
    const nodeWidth = node.dimensions?.width || 150;
    const nodeHeight = node.dimensions?.height || 100;

    return (
      position.x >= nodePos.x &&
      position.x <= nodePos.x + nodeWidth &&
      position.y >= nodePos.y &&
      position.y <= nodePos.y + nodeHeight
    );
  });
};

const createRoomNode = (room: RoomData, position: { x: number; y: number }) => {
  // Offset the position slightly to center the node on the drop point
  const adjustedPosition = {
    x: position.x - 75, // Half of typical node width (150px)
    y: position.y - 50, // Half of typical node height (100px)
  };

  const newNode: Node<NodeData> = {
    id: getNodeId(),
    type: 'room',
    position: adjustedPosition,
    data: {
      label: room.name,
      localId: room.localId,
      area: room.area,
      rooms: [room],
    },
    sourcePosition: Position.Left,
    targetPosition: Position.Right,
  };

  addNodes([newNode]);
};

const createFunctionalGroup = (rooms: RoomData[], position: { x: number; y: number }) => {
  const totalArea = rooms.reduce((sum, room) => {
    const area = parseFloat(room.area?.replace(/[^\d.]/g, '') || '0');
    return sum + area;
  }, 0);

  // Offset the position to center the functional node on the drop point
  const adjustedPosition = {
    x: position.x - 100, // Half of typical functional node width (200px)
    y: position.y - 60, // Half of typical functional node height (120px)
  };

  const newNode: Node<NodeData> = {
    id: getNodeId(),
    type: 'functional',
    position: adjustedPosition,
    data: {
      label: 'Functional Space',
      isFunctionalRoom: true,
      rooms,
      roomCount: rooms.length,
      totalArea: `${totalArea.toFixed(2)} m²`,
    },
    sourcePosition: Position.Left,
    targetPosition: Position.Right,
  };

  addNodes([newNode]);

  emit('functionalGroupCreated', {
    id: newNode.id,
    rooms,
    totalArea,
  });

  return newNode.id;
};

const addRoomToFunctionalGroup = (nodeId: string, room: RoomData) => {
  const node = getNode.value(nodeId);
  if (!node || !node.data.rooms) return;

  // Check if room already exists
  const existingRoom = node.data.rooms.find((r: RoomData) => r.localId === room.localId);
  if (existingRoom) return;

  const updatedRooms = [...node.data.rooms, room];
  const totalArea = updatedRooms.reduce((sum: number, r: RoomData) => {
    const area = parseFloat(r.area?.replace(/[^\d.]/g, '') || '0');
    return sum + area;
  }, 0);

  updateNode(nodeId, {
    data: {
      ...node.data,
      rooms: updatedRooms,
      roomCount: updatedRooms.length,
      totalArea: `${totalArea.toFixed(2)} m²`,
    },
  });
};

const updateNodeLabel = (nodeId: string, newLabel: string) => {
  const node = getNode.value(nodeId);
  if (node) {
    updateNode(nodeId, {
      data: { ...node.data, label: newLabel },
    });
  }
};

const onNodeClick = (event: any) => {
  // Handle selection on node click
  const node = event.node;
  const isCtrlPressed = event.event?.ctrlKey || event.event?.metaKey;

  if (isCtrlPressed) {
    // Toggle selection
    const isSelected = selectedNodes.value.some((n) => n.id === node.id);
    if (isSelected) {
      // Remove from selection
      selectedNodes.value = selectedNodes.value.filter((n) => n.id !== node.id);
    } else {
      // Add to selection
      selectedNodes.value = [...selectedNodes.value, node];
    }
  } else {
    // Single selection or clear selection
    selectedNodes.value = [node];
  }

  emit('nodeClick', event.node.data);
};

const onNodesChange = (_changes: any) => {
  // Handle node changes if needed
};

const onEdgesChange = (_changes: any) => {
  // Handle edge changes if needed
};

// Connect nodes with edges
const connectNodes = (sourceId: string, targetId: string) => {
  const newEdge: Edge = {
    id: `edge_${sourceId}_${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle: 'right', // Connect from right side of source node
    targetHandle: 'left', // Connect to left side of target node
    type: 'smoothstep',
    animated: true,
    style: {
      stroke: '#667eea',
      strokeWidth: 2,
    },
  };

  addEdges([newEdge]);
};

// Group selected rooms into functional space
const groupSelectedNodes = () => {
  if (!canGroupSelectedNodes.value) return;

  // Extract room data from selected nodes
  const roomsToGroup: RoomData[] = [];
  let totalX = 0;
  let totalY = 0;
  let rightmostX = 0;

  selectedNodes.value.forEach((node) => {
    if (node.data && node.data.rooms) {
      roomsToGroup.push(...node.data.rooms);
    } else if (node.type === 'room' && node.data) {
      // Handle individual room nodes that might not have a rooms array
      const roomData: RoomData = {
        id: node.id,
        name: node.data.label,
        localId: node.data.localId || 0,
        area: node.data.area,
      };
      roomsToGroup.push(roomData);
    }

    totalX += node.position.x;
    totalY += node.position.y;

    // Find the rightmost position to place the new functional node
    const nodeWidth = node.type === 'functional' ? 200 : 150; // Functional nodes are wider
    const nodeRightEdge = node.position.x + nodeWidth;
    if (nodeRightEdge > rightmostX) {
      rightmostX = nodeRightEdge;
    }
  });

  // Calculate center Y position of selected nodes
  const centerY = totalY / selectedNodes.value.length;

  // Position the new functional node to the right of the selected group
  const functionalNodePosition = {
    x: rightmostX + 100, // 100px gap between rightmost node and new functional node
    y: centerY,
  };

  // Store selected node IDs for connecting arrows
  const selectedNodeIds = selectedNodes.value.map((node) => node.id);

  // Create functional group at the calculated position
  const functionalNodeId = createFunctionalGroup(roomsToGroup, functionalNodePosition);

  // Create arrows connecting each selected node to the new functional group
  selectedNodeIds.forEach((nodeId) => {
    connectNodes(nodeId, functionalNodeId);
  });

  // Clear selection and hide context menu
  clearSelection();
  hideContextMenu();
};

// Expose methods for parent component
defineExpose({
  groupSelectedRooms: groupSelectedNodes,
  connectNodes,
  addRoomToFlow: createRoomNode,
  clearFlow: () => {
    nodes.value = [];
    edges.value = [];
  },
});

// Handle selection changes
const onSelectionChange = (selection: { nodes: Node<NodeData>[]; edges: Edge[] }) => {
  selectedNodes.value = selection.nodes;
  // Hide context menu when selection changes
  hideContextMenu();
};

// Handle context menu
const onContextMenu = (event: MouseEvent) => {
  event.preventDefault();

  // Only show context menu if there are selected nodes
  if (selectedNodes.value.length === 0) return;

  // Calculate position relative to the flow chart container
  const flowContainer = event.currentTarget as HTMLElement;
  const containerRect = flowContainer.getBoundingClientRect();

  contextMenuPosition.value = {
    x: event.clientX - containerRect.left,
    y: event.clientY - containerRect.top,
  };

  showContextMenu.value = true;
};

const hideContextMenu = () => {
  showContextMenu.value = false;
};

const deleteSelectedNodes = () => {
  if (selectedNodes.value.length === 0) return;

  const nodeIdsToRemove = selectedNodes.value.map((node) => node.id);
  removeNodes(nodeIdsToRemove);

  clearSelection();
  hideContextMenu();
};

const clearSelection = () => {
  selectedNodes.value = [];
  hideContextMenu();
};
</script>

<style scoped>
.flow-chart {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  position: relative;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
  position: relative;
  transition: all 0.2s ease;
}

.vue-flow-container.drag-over {
  background: rgba(102, 126, 234, 0.1);
  border: 2px dashed rgba(102, 126, 234, 0.5);
}

/* Room Node Styles */
.room-node {
  background: #2d3748;
  border: 2px solid #4a5568;
  border-radius: 8px;
  padding: 12px;
  min-width: 150px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.room-node:hover {
  border-color: #63b3ed;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
}

.room-node.functional-room {
  background: #2b6cb0;
  border-color: #3182ce;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.room-title {
  font-weight: 600;
  font-size: 14px;
  color: #e2e8f0;
}

.ifc-id {
  font-size: 12px;
  color: #a0aec0;
  font-weight: 500;
}

.remove-btn {
  background: #e53e3e;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.room-list {
  margin-bottom: 8px;
}

.room-item {
  font-size: 12px;
  color: #a0aec0;
  padding: 2px 0;
}

.room-area {
  font-size: 11px;
  color: #68d391;
  font-weight: 500;
}

/* Functional Node Styles */
.functional-node {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 2px solid #8b5cf6;
  border-radius: 12px;
  padding: 16px;
  min-width: 200px;
  color: white;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.functional-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.functional-title {
  background: transparent;
  border: none;
  color: white;
  font-weight: 600;
  font-size: 16px;
  width: 100%;
  margin-right: 8px;
}

.functional-title:focus {
  outline: none;
  border-bottom: 1px solid #a0aec0;
}

.functional-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-count {
  font-size: 12px;
  color: #e2e8f0;
}

.total-area {
  font-size: 12px;
  color: #68d391;
  font-weight: 500;
}

/* Vue Flow specific styles */
:deep(.vue-flow__background) {
  background-color: #1a1a1a;
}

:deep(.vue-flow__edge-path) {
  stroke: #4a5568;
  stroke-width: 2;
}

:deep(.vue-flow__edge.animated .vue-flow__edge-path) {
  stroke: #667eea;
  stroke-width: 3;
  stroke-dasharray: 5;
  animation: dash 0.5s linear infinite;
}

:deep(.vue-flow__edge .vue-flow__edge-path) {
  stroke: #667eea;
  stroke-width: 2;
  marker-end: url(#arrowhead);
}

:deep(.vue-flow__controls) {
  background: #2d3748;
  border: 1px solid #4a5568;
}

:deep(.vue-flow__controls button) {
  background: #4a5568;
  color: white;
  border: none;
}

:deep(.vue-flow__controls button:hover) {
  background: #63b3ed;
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

/* Drop zone styles */
.drop-zone-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(102, 126, 234, 0.15);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  pointer-events: none;
}

.drop-zone-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 16px 24px;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* Newly created node animation */
:deep(.newly-created) {
  animation: nodeCreated 1s ease-out;
}

@keyframes nodeCreated {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Context Menu Styles */
.context-menu {
  position: absolute;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 8px;
  padding: 4px;
  z-index: 1000;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  min-width: 180px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  margin: 2px;
  transition: all 0.2s ease;
}

.context-menu-item:hover {
  background: #4a5568;
  color: white;
}

.context-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-icon {
  margin-right: 10px;
  font-size: 16px;
}

/* Selection overlay styles */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
}

/* Selected node styles */
:deep(.vue-flow__node.selected) {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

:deep(.vue-flow__node.selected .room-node) {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

:deep(.vue-flow__node.selected .functional-node) {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

/* Selection help and info styles */
.selection-help {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  pointer-events: none;
}

.help-text {
  background: rgba(0, 0, 0, 0.5);
  padding: 16px 24px;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

.selection-info {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px;
  border-radius: 8px;
  z-index: 1000;
}

.selection-text {
  color: white;
  font-size: 12px;
  font-weight: 500;
}

/* Duplicate warning styles */
.duplicate-warning {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2000;
  animation: warningSlide 0.3s ease-out;
}

.warning-content {
  background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
  color: white;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  border: 2px solid #fc8181;
}

@keyframes warningSlide {
  from {
    opacity: 0;
    transform: translate(-50%, -60%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* Helper text at bottom */
.help-text-bottom {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 12px 16px;
  border-radius: 8px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
  max-width: 90%;
}

.help-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.help-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  margin-left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.help-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Node handle styles */
.node-handle {
  width: 8px;
  height: 8px;
  background: #667eea;
  border: 2px solid #fff;
  border-radius: 50%;
}

.node-handle:hover {
  background: #4c51bf;
  transform: scale(1.2);
}

/* Vue Flow handle overrides */
:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: #667eea;
  border: 2px solid #fff;
  border-radius: 50%;
}

:deep(.vue-flow__handle:hover) {
  background: #4c51bf;
  transform: scale(1.2);
}
</style>

<template>
  <div
    class="flow-chart"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
  >
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
      :selection-key-code="false"
      :select-nodes-on-drag="false"
      :pan-on-drag="isRangeSelecting ? [] : [1, 2]"
      :connect-on-click="false"
      :nodes-connectable="true"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @node-click="onNodeClick"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @selection-change="onSelectionChange"
      @contextmenu="onContextMenu"
      @pane-click="onPaneClick"
      @connect="onConnect"
      @connect-start="onConnectStart"
      @connect-end="onConnectEnd"
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
          <span v-if="canGroupSelectedNodes">(Right-click to group & connect)</span>
          <span v-else-if="selectedNodes.length === 1">(Click again to deselect)</span>
          <span v-else-if="selectedNodes.length > 1">(Need 2+ compatible nodes to group)</span>
        </div>
      </div>

      <!-- Custom Room Node -->
      <template #node-room="{ data, id }">
        <div
          class="room-node"
          :class="{
            'functional-room': data.isFunctionalRoom,
            [`level-${data.roomLevel || 0}`]: true,
            'custom-selected': isNodeSelected(id),
          }"
        >
          <!-- Connection handles -->
          <Handle id="left" type="target" :position="Position.Left" class="node-handle" />
          <Handle id="right" type="source" :position="Position.Right" class="node-handle" />

          <div class="room-header">
            <span class="room-title">{{ data.label }}</span>
            <span class="ifc-id">ID: {{ data.localId }}</span>
            <span class="room-level">L{{ (data.roomLevel ?? 0) + 1 }}</span>
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
        <div
          class="functional-node"
          :class="[`level-${data.roomLevel || 1}`, { 'custom-selected': isNodeSelected(id) }]"
          :style="{
            background: data.color
              ? `linear-gradient(135deg, ${data.color} 0%, ${adjustColorBrightness(data.color, -20)} 100%)`
              : undefined,
            borderColor: data.color ? adjustColorBrightness(data.color, 20) : undefined,
          }"
        >
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
            <span class="room-level">L{{ (data.roomLevel ?? 1) + 1 }}</span>
          </div>
          <div class="functional-content">
            <div class="room-count">{{ data.roomCount || 0 }} rooms</div>
            <div v-if="data.totalArea" class="total-area">{{ data.totalArea }}</div>
            <div v-if="data.mergedMeshId" class="mesh-info">
              <span class="mesh-indicator" :style="{ backgroundColor: data.color }"></span>
              Merged Geometry
            </div>
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
      </div>

      <!-- Selection overlay -->
      <div v-if="showContextMenu" class="context-menu-overlay" @click="hideContextMenu"></div>
    </VueFlow>

    <!-- Range selection rectangle - positioned relative to flow-chart container -->
    <div
      v-if="isRangeSelecting"
      class="range-selection-rect"
      :style="{
        left: selectionRectDisplay.left + 'px',
        top: selectionRectDisplay.top + 'px',
        width: selectionRectDisplay.width + 'px',
        height: selectionRectDisplay.height + 'px',
      }"
    ></div>

    <!-- Flow Chart Controls -->
    <div class="flow-chart-controls">
      <div class="control-group">
        <button @click="saveCurrentFlowChart" class="control-btn save-btn" title="Save Flow Chart">
          💾 Save
        </button>
        <button @click="showLoadDialog = true" class="control-btn load-btn" title="Load Flow Chart">
          📂 Load
        </button>
        <button @click="createNew" class="control-btn new-btn" title="New Flow Chart">
          ✨ New
        </button>
      </div>
      <div class="flow-chart-name">
        <input
          v-model="flowChartStore.currentName"
          class="name-input"
          placeholder="Flow Chart Name"
          @blur="autoSave"
        />
        <div v-if="hasUnsavedChanges" class="unsaved-indicator" title="Unsaved changes">●</div>
      </div>
    </div>

    <!-- Load Dialog -->
    <div v-if="showLoadDialog" class="load-dialog-overlay" @click="showLoadDialog = false">
      <div class="load-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Load Flow Chart</h3>
          <button @click="showLoadDialog = false" class="close-btn">×</button>
        </div>
        <div class="dialog-content">
          <div v-if="savedFlowCharts.length === 0" class="no-saved-charts">
            No saved flow charts found.
          </div>
          <div v-else class="saved-charts-list">
            <div
              v-for="chart in savedFlowCharts"
              :key="chart.name"
              class="chart-item"
              @click="loadSelectedFlowChart(chart)"
            >
              <div class="chart-info">
                <div class="chart-name">{{ chart.name }}</div>
                <div class="chart-meta">
                  {{ chart.nodes.length }} nodes • Modified: {{ formatDate(chart.modifiedAt) }}
                </div>
              </div>
              <button @click.stop="deleteChart(chart)" class="delete-chart-btn">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Helper text at bottom -->
    <div v-if="showHelpText && nodes.length > 0" class="help-text-bottom">
      <div class="help-content">
        💡 Drag rooms to create nodes • Click to select/deselect • Drag empty space for range
        selection • Drag from handles to connect/group • Delete key to remove • Right-click to group
        <button @click="showHelpText = false" class="help-close">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { VueFlow, useVueFlow, Position } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Handle } from '@vue-flow/core';
import type { Node, Edge } from '@vue-flow/core';
import { roomMerger } from '@/utils/roomMerger';
import { useFlowChartStore } from '@/stores/flowChartStore';
import { ContrastingColorGenerator } from '@/utils/contrastingColorGenerator';

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
  roomLevel?: number; // Track the room hierarchy level (1, 2, 3)
  mergedMeshId?: string; // Reference to the merged Three.js mesh
  color?: string; // Color for visual consistency with 3D merged rooms
}

const { addNodes, addEdges, removeNodes, updateNode, getNode, getNodes, project } = useVueFlow();

// Use flow chart store
const flowChartStore = useFlowChartStore();

// Color generator for consistent node and merged room colors
const colorGenerator = new ContrastingColorGenerator();
const colorIterator = colorGenerator.generate();

const nodes = ref<Node<NodeData>[]>([]);
const edges = ref<Edge[]>([]);
const isDragOver = ref(false);
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedNodes = ref<Node<NodeData>[]>([]);
const selectedNodeIds = ref(new Set<string>());
const showHelpText = ref(true);
const showLoadDialog = ref(false);
const hasUnsavedChanges = ref(false);

// Range selection state - using screen coordinates
const isRangeSelecting = ref(false);
const justFinishedRangeSelection = ref(false);
const rangeSelection = ref({
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
});

// Computed properties for saved flow charts
const savedFlowCharts = computed(() => flowChartStore.getAllFlowCharts());

// Computed property to check if a node is selected
const isNodeSelected = computed(() => (nodeId: string) => {
  const result = selectedNodeIds.value.has(nodeId);
  return result;
});

// Simple reactive coordinates for selection rectangle display
const selectionRectDisplay = ref({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
});

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
      roomLevel: 0, // Default IFCSPACE rooms are level 0
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };

  addNodes([newNode]);
};

const createFunctionalGroup = async (
  rooms: RoomData[],
  position: { x: number; y: number },
  level: number = 1
) => {
  const totalArea = rooms.reduce((sum, room) => {
    const area = parseFloat(room.area?.replace(/[^\d.]/g, '') || '0');
    return sum + area;
  }, 0);

  // Offset the position to center the functional node on the drop point
  const adjustedPosition = {
    x: position.x - 100, // Half of typical functional node width (200px)
    y: position.y - 60, // Half of typical functional node height (120px)
  };

  // Generate a consistent color for this functional group
  const nodeColor = colorIterator.next().value;
  const colorString = nodeColor.rgbString;

  // Create merged geometry using room merger directly
  let mergedMeshId: string | undefined;
  if (rooms.length > 0) {
    try {
      const roomIds = rooms.map((room) => room.localId);
      const chartId = flowChartStore.currentFlowChartId || 'default';
      const mergedMesh = await roomMerger.createMergedRoomGeometry(
        roomIds,
        level,
        chartId,
        colorString
      );
      if (mergedMesh) {
        mergedMeshId = mergedMesh.name;
      }
    } catch (error) {
      console.error('Failed to create merged geometry:', error);
    }
  }

  const newNode: Node<NodeData> = {
    id: getNodeId(),
    type: 'functional',
    position: adjustedPosition,
    data: {
      label: `Functional Space L${level + 1}`,
      isFunctionalRoom: true,
      rooms,
      roomCount: rooms.length,
      totalArea: `${totalArea.toFixed(2)} m²`,
      roomLevel: level,
      mergedMeshId,
      color: colorString,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };

  addNodes([newNode]);

  emit('functionalGroupCreated', {
    id: newNode.id,
    rooms,
    totalArea,
    roomLevel: level,
    mergedMeshId,
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
  // Handle selection on node click - always toggle selection
  const node = event.node;
  const isSelected = selectedNodeIds.value.has(node.id);

  if (isSelected) {
    // Remove from selection (deselect)
    const newSet = new Set(selectedNodeIds.value);
    newSet.delete(node.id);
    selectedNodeIds.value = newSet;
    selectedNodes.value = selectedNodes.value.filter((n) => n.id !== node.id);
  } else {
    // Add to selection (select)
    const newSet = new Set(selectedNodeIds.value);
    newSet.add(node.id);
    selectedNodeIds.value = newSet;
    selectedNodes.value = [...selectedNodes.value, node];
  }

  emit('nodeClick', event.node.data);
};

const onNodesChange = (_changes: any) => {
  // Handle node changes if needed
};

const onEdgesChange = (_changes: any) => {
  // Handle edge changes if needed
};

// Handle connection events for dragging from handles
const onConnect = (params: any) => {
  // Get source and target node IDs from the connection params
  const sourceNodeId = params.source;
  const targetNodeId = params.target;

  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
    return false; // Prevent default edge creation
  }

  // Get both nodes
  const sourceNode = getNode.value(sourceNodeId);
  const targetNode = getNode.value(targetNodeId);

  if (!sourceNode || !targetNode) {
    return false; // Prevent default edge creation
  }

  // Handle different connection scenarios
  if (targetNode.type === 'functional') {
    // Target is a functional group - add source node's room data to it
    addNodeToFunctionalGroup(sourceNode, targetNode);
  } else if (sourceNode.type === 'room' && targetNode.type === 'room') {
    // Both are room nodes - create a new functional group with both
    createFunctionalGroupFromConnection(sourceNode, targetNode);
  } else {
    // Default behavior - create an edge connection
    connectNodes(sourceNodeId, targetNodeId);
    return true; // Allow default edge creation
  }

  return false; // Prevent default edge creation for our custom logic
};

const onConnectStart = () => {
  // Called when starting to drag from a handle
  // Store the source node info for later use if needed
};

const onConnectEnd = () => {
  // Called when ending a connection drag
  // Most of our logic is now handled in onConnect
};

// Add a node's room data to an existing functional group
const addNodeToFunctionalGroup = async (sourceNode: Node<NodeData>, targetNode: Node<NodeData>) => {
  if (!sourceNode.data || !targetNode.data) return;

  let roomsToAdd: RoomData[] = [];

  // Extract room data from source node
  if (sourceNode.type === 'room') {
    roomsToAdd = [
      {
        id: sourceNode.id,
        name: sourceNode.data.label,
        localId: sourceNode.data.localId || 0,
        area: sourceNode.data.area,
      },
    ];
  } else if (sourceNode.type === 'functional' && sourceNode.data.rooms) {
    roomsToAdd = [...sourceNode.data.rooms];
  }

  if (roomsToAdd.length === 0) return;

  // Check for duplicates
  const existingRooms = targetNode.data.rooms || [];
  const newRooms = roomsToAdd.filter(
    (newRoom) => !existingRooms.some((existingRoom) => existingRoom.localId === newRoom.localId)
  );

  if (newRooms.length === 0) {
    // Show duplicate warning
    showDuplicateWarning('Room(s)', 0);
    return;
  }

  // Combine rooms
  const updatedRooms = [...existingRooms, ...newRooms];
  const totalArea = updatedRooms.reduce((sum: number, room: RoomData) => {
    const area = parseFloat(room.area?.replace(/[^\d.]/g, '') || '0');
    return sum + area;
  }, 0);

  // Update target functional group
  updateNode(targetNode.id, {
    data: {
      ...targetNode.data,
      rooms: updatedRooms,
      roomCount: updatedRooms.length,
      totalArea: `${totalArea.toFixed(2)} m²`,
    },
  });

  // Create connection edge
  connectNodes(sourceNode.id, targetNode.id);

  // Update merged geometry if needed
  try {
    const roomIds = updatedRooms.map((room) => room.localId);
    const level = targetNode.data.roomLevel || 1;
    const chartId = flowChartStore.currentFlowChartId || 'default';
    const color = targetNode.data.color || colorIterator.next().value.rgbString;

    const mergedMesh = await roomMerger.createMergedRoomGeometry(roomIds, level, chartId, color);

    if (mergedMesh) {
      updateNode(targetNode.id, {
        data: {
          ...targetNode.data,
          mergedMeshId: mergedMesh.name,
        },
      });
    }
  } catch (error) {
    console.error('Failed to update merged geometry:', error);
  }
};

// Create a new functional group from two connected room nodes
const createFunctionalGroupFromConnection = async (
  sourceNode: Node<NodeData>,
  targetNode: Node<NodeData>
) => {
  if (!sourceNode.data || !targetNode.data) return;

  const roomsToGroup: RoomData[] = [];

  // Add source room
  if (sourceNode.type === 'room') {
    roomsToGroup.push({
      id: sourceNode.id,
      name: sourceNode.data.label,
      localId: sourceNode.data.localId || 0,
      area: sourceNode.data.area,
    });
  }

  // Add target room
  if (targetNode.type === 'room') {
    roomsToGroup.push({
      id: targetNode.id,
      name: targetNode.data.label,
      localId: targetNode.data.localId || 0,
      area: targetNode.data.area,
    });
  }

  if (roomsToGroup.length < 2) return;

  // Position the new functional group between the two nodes
  const midX = (sourceNode.position.x + targetNode.position.x) / 2;
  const midY = (sourceNode.position.y + targetNode.position.y) / 2;
  const position = { x: midX, y: midY };

  // Determine the level (increment from the highest of the two nodes)
  const sourceLevel = sourceNode.data?.roomLevel || 0;
  const targetLevel = targetNode.data?.roomLevel || 0;
  const newLevel = Math.min(Math.max(sourceLevel, targetLevel) + 1, 2);

  try {
    // Create functional group
    const functionalNodeId = await createFunctionalGroup(roomsToGroup, position, newLevel);

    // Connect both original nodes to the new functional group
    connectNodes(sourceNode.id, functionalNodeId);
    connectNodes(targetNode.id, functionalNodeId);
  } catch (error) {
    console.error('Failed to create functional group from connection:', error);
  }
};

// Handle clicking on empty space to clear selection
const onPaneClick = () => {
  if (!isRangeSelecting.value && !justFinishedRangeSelection.value) {
    selectedNodeIds.value = new Set();
    selectedNodes.value = [];
  }
  hideContextMenu();
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
const groupSelectedNodes = async () => {
  if (!canGroupSelectedNodes.value) return;

  // Extract room data from selected nodes and determine the new level
  const roomsToGroup: RoomData[] = [];
  let totalX = 0;
  let totalY = 0;
  let rightmostX = 0;
  let maxLevel = 0; // Track the highest level among selected nodes

  selectedNodes.value.forEach((node) => {
    // Determine the level of this node
    const nodeLevel = node.data?.roomLevel || 0;
    maxLevel = Math.max(maxLevel, nodeLevel);

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

  // Determine the new level (increment from the highest selected level)
  const newLevel = Math.min(maxLevel + 1, 2); // Cap at level 2 (which displays as level 3)

  // Store selected node IDs for connecting arrows
  const selectedNodeIds = selectedNodes.value.map((node) => node.id);

  try {
    // Create functional group at the calculated position
    const functionalNodeId = await createFunctionalGroup(
      roomsToGroup,
      functionalNodePosition,
      newLevel
    );

    // Create arrows connecting each selected node to the new functional group
    selectedNodeIds.forEach((nodeId) => {
      connectNodes(nodeId, functionalNodeId);
    });
  } catch (error) {
    console.error('Failed to create functional group:', error);
  }

  // Clear selection and hide context menu
  selectedNodes.value = [];
  hideContextMenu();
};

// Watch for changes in nodes and edges to update the store
watch(
  [nodes, edges],
  ([newNodes, newEdges]) => {
    flowChartStore.updateCurrentState(newNodes, newEdges);
    // Mark as unsaved when changes are made
    hasUnsavedChanges.value = true;
  },
  { deep: true }
);

// Watch for current flow chart changes and sync with room merger
watch(
  () => flowChartStore.currentFlowChartId,
  (newChartId) => {
    if (newChartId) {
      roomMerger.setActiveChart(newChartId);
    } else {
      roomMerger.setActiveChart(null);
    }
  },
  { immediate: true }
);

// Ensure all functional nodes have colors assigned
const ensureNodeColors = () => {
  let hasChanges = false;
  const updatedNodes = nodes.value.map((node) => {
    if (node.type === 'functional' && node.data && !node.data.color) {
      const nodeColor = colorIterator.next().value;
      hasChanges = true;
      return {
        ...node,
        data: {
          ...node.data,
          color: nodeColor.rgbString,
        },
      } as Node<NodeData>;
    }
    return node;
  });

  if (hasChanges) {
    nodes.value = updatedNodes;
  }
};

// Initialize from store if available
if (flowChartStore.currentNodes.length > 0 || flowChartStore.currentEdges.length > 0) {
  nodes.value = [...flowChartStore.currentNodes];
  edges.value = [...flowChartStore.currentEdges];
  // Ensure all loaded nodes have colors
  ensureNodeColors();
  hasUnsavedChanges.value = false; // Mark as saved when loading existing data
} else if (!flowChartStore.currentFlowChartId) {
  // If no flow chart exists, create a default one
  const defaultName = `Flow Chart ${new Date().toLocaleDateString()}`;
  flowChartStore.createNewFlowChart(defaultName);
  hasUnsavedChanges.value = false; // New flowchart starts as saved
}

// Expose methods for parent component
defineExpose({
  groupSelectedRooms: groupSelectedNodes,
  connectNodes,
  addRoomToFlow: createRoomNode,
  clearFlow: () => {
    nodes.value = [];
    edges.value = [];
    flowChartStore.updateCurrentState([], []);
  },
  // Store operations
  saveFlowChart: (name?: string) => flowChartStore.saveCurrentFlowChart(name),
  loadFlowChart: (flowChartId: string) => {
    const success = flowChartStore.loadFlowChart(flowChartId);
    if (success) {
      nodes.value = [...flowChartStore.currentNodes];
      edges.value = [...flowChartStore.currentEdges];
    }
    return success;
  },
  createNewFlowChart: (name?: string) => flowChartStore.createNewFlowChart(name),
  getAllFlowCharts: () => flowChartStore.getAllFlowCharts(),
  exportFlowChart: (flowChartId: string) => flowChartStore.exportFlowChart(flowChartId),
  importFlowChart: (jsonData: string) => flowChartStore.importFlowChart(jsonData),
  getFlowChartStats: () => flowChartStore.getStats(),
});

// Handle selection changes
const onSelectionChange = (selection: { nodes: Node<NodeData>[]; edges: Edge[] }) => {
  selectedNodes.value = selection.nodes;
  selectedNodeIds.value = new Set(selection.nodes.map((node) => node.id));
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

  selectedNodes.value = [];
  hideContextMenu();
};

// Handle keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // Delete selected nodes with Delete or Backspace key
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodes.value.length > 0) {
    event.preventDefault();
    deleteSelectedNodes();
  }
};

// Add keyboard and global mouse event listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

// Range selection mouse handlers
const onMouseDown = (event: MouseEvent) => {
  // Only start range selection on left mouse button
  if (event.button !== 0) return;

  // Check if clicking on a node or other interactive element
  const target = event.target as HTMLElement;
  if (
    target.closest('.vue-flow__node') ||
    target.closest('.context-menu') ||
    target.closest('.flow-chart-controls') ||
    target.closest('.vue-flow__handle') ||
    target.closest('.vue-flow__edge')
  ) {
    return;
  }

  // Get both container bounds for proper coordinate handling
  const flowContainer = event.currentTarget as HTMLElement;
  const vueFlowElement = flowContainer.querySelector('.vue-flow') as HTMLElement;
  if (!vueFlowElement) return;

  const flowContainerRect = flowContainer.getBoundingClientRect();
  const vueFlowRect = vueFlowElement.getBoundingClientRect();

  // Coordinates relative to flow-chart container (for display)
  const displayX = event.clientX - flowContainerRect.left;
  const displayY = event.clientY - flowContainerRect.top;

  // Coordinates relative to vue-flow container (for project function)
  const vueFlowX = event.clientX - vueFlowRect.left;
  const vueFlowY = event.clientY - vueFlowRect.top;

  rangeSelection.value.startX = vueFlowX;
  rangeSelection.value.startY = vueFlowY;
  rangeSelection.value.currentX = vueFlowX;
  rangeSelection.value.currentY = vueFlowY;

  // Update display rectangle (relative to flow-chart container)
  selectionRectDisplay.value = {
    left: displayX,
    top: displayY,
    width: 0,
    height: 0,
  };

  isRangeSelecting.value = true;
  event.preventDefault();
  event.stopPropagation();
};

const onMouseMove = (event: MouseEvent) => {
  if (!isRangeSelecting.value) return;

  const flowContainer = event.currentTarget as HTMLElement;
  const vueFlowElement = flowContainer.querySelector('.vue-flow') as HTMLElement;
  if (!vueFlowElement) return;

  const flowContainerRect = flowContainer.getBoundingClientRect();
  const vueFlowRect = vueFlowElement.getBoundingClientRect();

  // Coordinates relative to flow-chart container (for display)
  const displayX = event.clientX - flowContainerRect.left;
  const displayY = event.clientY - flowContainerRect.top;

  // Coordinates relative to vue-flow container (for project function)
  const vueFlowX = event.clientX - vueFlowRect.left;
  const vueFlowY = event.clientY - vueFlowRect.top;

  rangeSelection.value.currentX = vueFlowX;
  rangeSelection.value.currentY = vueFlowY;

  // Calculate display coordinates from stored vue-flow relative coordinates
  const startDisplayX = rangeSelection.value.startX + (vueFlowRect.left - flowContainerRect.left);
  const startDisplayY = rangeSelection.value.startY + (vueFlowRect.top - flowContainerRect.top);

  // Update display rectangle (relative to flow-chart container)
  selectionRectDisplay.value = {
    left: Math.min(startDisplayX, displayX),
    top: Math.min(startDisplayY, displayY),
    width: Math.abs(displayX - startDisplayX),
    height: Math.abs(displayY - startDisplayY),
  };

  event.preventDefault();
};

const onMouseUp = () => {
  if (!isRangeSelecting.value) return;

  // Calculate selection rectangle bounds in vue-flow coordinates
  const vueFlowLeft = Math.min(rangeSelection.value.startX, rangeSelection.value.currentX);
  const vueFlowTop = Math.min(rangeSelection.value.startY, rangeSelection.value.currentY);
  const vueFlowRight = Math.max(rangeSelection.value.startX, rangeSelection.value.currentX);
  const vueFlowBottom = Math.max(rangeSelection.value.startY, rangeSelection.value.currentY);

  // Only proceed if there's a meaningful selection area (at least 10px in both dimensions)
  if (Math.abs(vueFlowRight - vueFlowLeft) < 10 || Math.abs(vueFlowBottom - vueFlowTop) < 10) {
    isRangeSelecting.value = false;
    return;
  }

  // Convert vue-flow coordinates to flow coordinates for comparison
  const flowTopLeft = project({ x: vueFlowLeft, y: vueFlowTop });
  const flowBottomRight = project({ x: vueFlowRight, y: vueFlowBottom });

  // Find nodes within the selection rectangle
  const foundNodeIds: string[] = [];
  const allNodes = getNodes.value;

  allNodes.forEach((node) => {
    // Use node position and dimensions directly from Vue Flow
    const nodePos = node.computedPosition || node.position;
    const nodeWidth = node.dimensions?.width || (node.type === 'functional' ? 200 : 150);
    const nodeHeight = node.dimensions?.height || (node.type === 'functional' ? 120 : 100);

    const nodeLeft = nodePos.x;
    const nodeTop = nodePos.y;
    const nodeRight = nodeLeft + nodeWidth;
    const nodeBottom = nodeTop + nodeHeight;

    // Check overlap using flow coordinates
    if (
      nodeLeft < flowBottomRight.x &&
      nodeRight > flowTopLeft.x &&
      nodeTop < flowBottomRight.y &&
      nodeBottom > flowTopLeft.y
    ) {
      foundNodeIds.push(node.id);
    }
  });

  // Update our selection state
  selectedNodeIds.value = new Set(foundNodeIds);
  selectedNodes.value = allNodes.filter((node) => foundNodeIds.includes(node.id));

  // Force reactivity update for visual feedback
  // nextTick(() => {
  //   foundNodeIds.forEach((nodeId) => {
  //     const isSelected = isNodeSelected.value(nodeId);
  //   });
  // });

  isRangeSelecting.value = false;

  // Set flag to prevent immediate pane click from clearing selection
  justFinishedRangeSelection.value = true;

  // Clear the flag after a short delay to allow normal pane clicks to work
  setTimeout(() => {
    justFinishedRangeSelection.value = false;
  }, 100);
};

const onMouseLeave = () => {
  isRangeSelecting.value = false;
  justFinishedRangeSelection.value = false;
};

// Global mouse event handlers for better range selection
const onGlobalMouseMove = (event: MouseEvent) => {
  if (!isRangeSelecting.value) return;

  // Find the flow chart container and vue flow element
  const flowContainer = document.querySelector('.flow-chart') as HTMLElement;
  if (!flowContainer) return;

  const vueFlowElement = flowContainer.querySelector('.vue-flow') as HTMLElement;
  if (!vueFlowElement) return;

  const flowContainerRect = flowContainer.getBoundingClientRect();
  const vueFlowRect = vueFlowElement.getBoundingClientRect();

  // Coordinates relative to flow-chart container (for display)
  const displayX = event.clientX - flowContainerRect.left;
  const displayY = event.clientY - flowContainerRect.top;

  // Coordinates relative to vue-flow container (for project function)
  const vueFlowX = event.clientX - vueFlowRect.left;
  const vueFlowY = event.clientY - vueFlowRect.top;

  rangeSelection.value.currentX = vueFlowX;
  rangeSelection.value.currentY = vueFlowY;

  // Calculate display coordinates from stored vue-flow relative coordinates
  const startDisplayX = rangeSelection.value.startX + (vueFlowRect.left - flowContainerRect.left);
  const startDisplayY = rangeSelection.value.startY + (vueFlowRect.top - flowContainerRect.top);

  // Update display rectangle (relative to flow-chart container)
  selectionRectDisplay.value = {
    left: Math.min(startDisplayX, displayX),
    top: Math.min(startDisplayY, displayY),
    width: Math.abs(displayX - startDisplayX),
    height: Math.abs(displayY - startDisplayY),
  };

  event.preventDefault();
};

const onGlobalMouseUp = () => {
  if (!isRangeSelecting.value) return;
  onMouseUp();
};

// Flow chart store operations
const saveCurrentFlowChart = () => {
  flowChartStore.saveCurrentFlowChart();
  hasUnsavedChanges.value = false;
};

const autoSave = () => {
  if (flowChartStore.currentFlowChartId) {
    flowChartStore.saveCurrentFlowChart(flowChartStore.currentName);
    hasUnsavedChanges.value = false;
  }
};

const createNew = () => {
  const name = `Flow Chart ${new Date().toLocaleDateString()}`;
  flowChartStore.createNewFlowChart(name);
  nodes.value = [];
  edges.value = [];
  showLoadDialog.value = false;
  hasUnsavedChanges.value = false;
};

const loadSelectedFlowChart = (chart: any) => {
  // Find the flow chart ID by comparing the chart data
  const flowChartId = Array.from(flowChartStore.savedFlowCharts.keys()).find((id) => {
    const savedChart = flowChartStore.savedFlowCharts.get(id);
    return savedChart?.name === chart.name && savedChart?.modifiedAt === chart.modifiedAt;
  });

  if (flowChartId) {
    const success = flowChartStore.loadFlowChart(flowChartId);
    if (success) {
      nodes.value = [...flowChartStore.currentNodes];
      edges.value = [...flowChartStore.currentEdges];
      // Ensure all loaded nodes have colors
      ensureNodeColors();
      hasUnsavedChanges.value = false;
    }
  }
  showLoadDialog.value = false;
};

const deleteChart = (chart: any) => {
  if (confirm(`Are you sure you want to delete "${chart.name}"?`)) {
    // Find the flow chart ID
    const flowChartId = Array.from(flowChartStore.savedFlowCharts.keys()).find((id) => {
      const savedChart = flowChartStore.savedFlowCharts.get(id);
      return savedChart?.name === chart.name && savedChart?.modifiedAt === chart.modifiedAt;
    });

    if (flowChartId) {
      flowChartStore.deleteFlowChart(flowChartId);
    }
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

// Utility function to adjust color brightness
const adjustColorBrightness = (color: string, percent: number): string => {
  // Convert RGB string to hex if needed
  let hex = color;
  if (color.startsWith('rgb')) {
    const rgbMatch = color.match(/\d+/g);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[0]);
      const g = parseInt(rgbMatch[1]);
      const b = parseInt(rgbMatch[2]);
      hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
  }

  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB components
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Adjust brightness
  const factor = 1 + percent / 100;
  const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
  const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
  const newB = Math.min(255, Math.max(0, Math.round(b * factor)));

  // Convert back to hex
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
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
  flex-wrap: wrap;
  gap: 4px;
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

/* Room level indicator */
.room-level {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Level-specific styling */
.level-0 {
  border-left: 4px solid #4ade80; /* Green for level 1 (index 0) */
}

.level-1 {
  border-left: 4px solid #3b82f6; /* Blue for level 2 (index 1) */
}

.level-2 {
  border-left: 4px solid #a855f7; /* Purple for level 3 (index 2) */
}

.level-0 .room-level {
  background: #4ade80;
  color: #1f2937;
}

.level-1 .room-level {
  background: #3b82f6;
  color: white;
}

.level-2 .room-level {
  background: #a855f7;
  color: white;
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
  flex-wrap: wrap;
  gap: 8px;
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

.mesh-info {
  font-size: 10px;
  color: #fbbf24;
  font-weight: 500;
  background: rgba(251, 191, 36, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mesh-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
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

/* Custom selected node styles - very high specificity */
.room-node.custom-selected {
  border: 3px solid #667eea !important;
  box-shadow:
    0 0 0 3px rgba(102, 126, 234, 0.4),
    0 0 20px rgba(102, 126, 234, 0.6) !important;
  transform: scale(1.02) !important;
  outline: 3px solid #667eea !important;
  outline-offset: 2px !important;
  background: rgba(102, 126, 234, 0.1) !important;
  z-index: 1000 !important;
  position: relative !important;
}

.functional-node.custom-selected {
  border: 3px solid #667eea !important;
  box-shadow:
    0 0 0 3px rgba(102, 126, 234, 0.4),
    0 0 20px rgba(102, 126, 234, 0.6) !important;
  transform: scale(1.02) !important;
  outline: 3px solid #667eea !important;
  outline-offset: 2px !important;
  z-index: 1000 !important;
  position: relative !important;
}

/* Force override Vue Flow's default styles */
:deep(.vue-flow__node) .room-node.custom-selected,
:deep(.vue-flow__node) .functional-node.custom-selected {
  border: 3px solid #667eea !important;
  box-shadow: 0 0 0 5px rgba(102, 126, 234, 0.5) !important;
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

/* Flow Chart Controls */
.flow-chart-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  display: flex;
  gap: 16px;
  align-items: center;
}

.control-group {
  display: flex;
  gap: 8px;
}

.control-btn {
  background: #2d3748;
  color: #e2e8f0;
  border: 1px solid #4a5568;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.control-btn:hover {
  background: #4a5568;
  color: white;
  border-color: #667eea;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.save-btn:hover {
  background: #38a169;
  border-color: #48bb78;
}

.load-btn:hover {
  background: #3182ce;
  border-color: #4299e1;
}

.new-btn:hover {
  background: #dd6b20;
  border-color: #ed8936;
}

.flow-chart-name {
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-input {
  background: transparent;
  border: none;
  color: #e2e8f0;
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 500;
  min-width: 200px;
}

.name-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.name-input::placeholder {
  color: #a0aec0;
}

.unsaved-indicator {
  color: #f56565;
  font-size: 16px;
  font-weight: bold;
  animation: pulse 2s infinite;
  cursor: help;
  flex-shrink: 0;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}

/* Load Dialog */
.load-dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.load-dialog {
  background: #2d3748;
  border-radius: 12px;
  min-width: 500px;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #1a1a1a;
  border-bottom: 1px solid #4a5568;
}

.dialog-header h3 {
  color: white;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #a0aec0;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #4a5568;
  color: white;
}

.dialog-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.no-saved-charts {
  text-align: center;
  color: #a0aec0;
  padding: 40px 20px;
  font-size: 16px;
}

.saved-charts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1a1a1a;
  border: 1px solid #4a5568;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chart-item:hover {
  background: #2a2a2a;
  border-color: #667eea;
  transform: translateY(-1px);
}

.chart-info {
  flex: 1;
}

.chart-name {
  color: white;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.chart-meta {
  color: #a0aec0;
  font-size: 12px;
}

.delete-chart-btn {
  background: none;
  border: none;
  color: #e53e3e;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.delete-chart-btn:hover {
  background: rgba(229, 62, 62, 0.2);
  transform: scale(1.1);
}

/* Range selection rectangle */
.range-selection-rect {
  position: absolute;
  border: 2px dashed #667eea;
  background: rgba(102, 126, 234, 0.1);
  pointer-events: none;
  z-index: 1001;
  animation: selectionPulse 1s ease-in-out infinite alternate;
}

/* Range selection debug info */
.range-selection-debug {
  position: absolute;
  top: 50px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  z-index: 1002;
  pointer-events: none;
}

/* Selection count debug info */
.selection-count-debug {
  position: absolute;
  top: 110px;
  right: 10px;
  background: rgba(0, 100, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  z-index: 1002;
  pointer-events: none;
}

@keyframes selectionPulse {
  0% {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
  }
  100% {
    border-color: #4c51bf;
    background: rgba(102, 126, 234, 0.2);
  }
}

/* Node handle styles */
.node-handle {
  width: 10px;
  height: 10px;
  background: #667eea;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: grab;
  transition: all 0.2s ease;
  opacity: 0.8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.node-handle:hover {
  background: #4c51bf;
  transform: scale(1.4);
  opacity: 1;
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
  cursor: grabbing;
}

/* Vue Flow handle overrides */
:deep(.vue-flow__handle) {
  width: 10px;
  height: 10px;
  background: #667eea;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: grab;
  transition: all 0.2s ease;
  opacity: 0.8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

:deep(.vue-flow__handle:hover) {
  background: #4c51bf;
  transform: scale(1.4);
  opacity: 1;
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
  cursor: grabbing;
}

/* Handle connection line styles */
:deep(.vue-flow__connection-line) {
  stroke: #667eea;
  stroke-width: 2;
  stroke-dasharray: 5, 5;
  opacity: 0.8;
}

/* Enhance node hover states to show handles better */
.room-node:hover .node-handle,
.functional-node:hover .node-handle {
  opacity: 1;
  transform: scale(1.2);
}
</style>

import { defineStore } from 'pinia';
import { ref } from 'vue';
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
  roomLevel?: number;
  mergedMeshId?: string;
}

interface FlowChartState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  name: string;
  createdAt: string;
  modifiedAt: string;
}

export const useFlowChartStore = defineStore('flowChartStore', () => {
  // Current flow chart state
  const currentNodes = ref<Node<NodeData>[]>([]);
  const currentEdges = ref<Edge[]>([]);
  const currentName = ref<string>('Untitled Flow Chart');

  // Saved flow charts
  const savedFlowCharts = ref<Map<string, FlowChartState>>(new Map());
  const currentFlowChartId = ref<string | null>(null);

  /**
   * Save the current flow chart state
   */
  const saveCurrentFlowChart = (name?: string): string => {
    const flowChartName = name || currentName.value;
    const timestamp = new Date().toISOString();
    const flowChartId = currentFlowChartId.value || `flowchart_${Date.now()}`;

    const flowChartState: FlowChartState = {
      nodes: JSON.parse(JSON.stringify(currentNodes.value)), // Deep clone
      edges: JSON.parse(JSON.stringify(currentEdges.value)), // Deep clone
      name: flowChartName,
      createdAt: savedFlowCharts.value.get(flowChartId)?.createdAt || timestamp,
      modifiedAt: timestamp,
    };

    savedFlowCharts.value.set(flowChartId, flowChartState);
    currentFlowChartId.value = flowChartId;
    currentName.value = flowChartName;

    console.log(`💾 Flow chart saved: "${flowChartName}" (ID: ${flowChartId})`);
    return flowChartId;
  };

  /**
   * Load a flow chart by ID
   */
  const loadFlowChart = (flowChartId: string): boolean => {
    const flowChart = savedFlowCharts.value.get(flowChartId);
    if (!flowChart) {
      console.warn(`Flow chart not found: ${flowChartId}`);
      return false;
    }

    currentNodes.value = JSON.parse(JSON.stringify(flowChart.nodes)); // Deep clone
    currentEdges.value = JSON.parse(JSON.stringify(flowChart.edges)); // Deep clone
    currentName.value = flowChart.name;
    currentFlowChartId.value = flowChartId;

    console.log(`📂 Flow chart loaded: "${flowChart.name}" (ID: ${flowChartId})`);
    return true;
  };

  /**
   * Create a new flow chart
   */
  const createNewFlowChart = (name: string = 'New Flow Chart'): string => {
    const flowChartId = `flowchart_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Clear current state
    currentNodes.value = [];
    currentEdges.value = [];
    currentName.value = name;
    currentFlowChartId.value = flowChartId;

    // Save empty flow chart
    const flowChartState: FlowChartState = {
      nodes: [],
      edges: [],
      name,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };

    savedFlowCharts.value.set(flowChartId, flowChartState);

    console.log(`✨ New flow chart created: "${name}" (ID: ${flowChartId})`);
    return flowChartId;
  };

  /**
   * Delete a flow chart
   */
  const deleteFlowChart = (flowChartId: string): boolean => {
    const flowChart = savedFlowCharts.value.get(flowChartId);
    if (!flowChart) {
      console.warn(`Flow chart not found: ${flowChartId}`);
      return false;
    }

    const flowChartName = flowChart.name;
    savedFlowCharts.value.delete(flowChartId);

    // If we're deleting the current flow chart, clear the current state
    if (currentFlowChartId.value === flowChartId) {
      currentNodes.value = [];
      currentEdges.value = [];
      currentName.value = 'Untitled Flow Chart';
      currentFlowChartId.value = null;
    }

    console.log(`🗑️ Flow chart deleted: "${flowChartName}" (ID: ${flowChartId})`);
    return true;
  };

  /**
   * Update current nodes and edges
   */
  const updateCurrentState = (nodes: Node<NodeData>[], edges: Edge[]) => {
    currentNodes.value = nodes;
    currentEdges.value = edges;
  };

  /**
   * Rename a flow chart
   */
  const renameFlowChart = (flowChartId: string, newName: string): boolean => {
    const flowChart = savedFlowCharts.value.get(flowChartId);
    if (!flowChart) {
      console.warn(`Flow chart not found: ${flowChartId}`);
      return false;
    }

    flowChart.name = newName;
    flowChart.modifiedAt = new Date().toISOString();

    if (currentFlowChartId.value === flowChartId) {
      currentName.value = newName;
    }

    console.log(`✏️ Flow chart renamed to: "${newName}" (ID: ${flowChartId})`);
    return true;
  };

  /**
   * Get all saved flow charts
   */
  const getAllFlowCharts = (): FlowChartState[] => {
    return Array.from(savedFlowCharts.value.values()).sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
  };

  /**
   * Get flow chart by ID
   */
  const getFlowChartById = (flowChartId: string): FlowChartState | null => {
    return savedFlowCharts.value.get(flowChartId) || null;
  };

  /**
   * Export flow chart as JSON
   */
  const exportFlowChart = (flowChartId: string): string | null => {
    const flowChart = savedFlowCharts.value.get(flowChartId);
    if (!flowChart) {
      console.warn(`Flow chart not found: ${flowChartId}`);
      return null;
    }

    return JSON.stringify(flowChart, null, 2);
  };

  /**
   * Import flow chart from JSON
   */
  const importFlowChart = (jsonData: string): string | null => {
    try {
      const flowChart: FlowChartState = JSON.parse(jsonData);
      const flowChartId = `imported_${Date.now()}`;

      // Validate structure
      if (!flowChart.nodes || !flowChart.edges || !flowChart.name) {
        throw new Error('Invalid flow chart structure');
      }

      flowChart.modifiedAt = new Date().toISOString();
      savedFlowCharts.value.set(flowChartId, flowChart);

      console.log(`📥 Flow chart imported: "${flowChart.name}" (ID: ${flowChartId})`);
      return flowChartId;
    } catch (error) {
      console.error('Failed to import flow chart:', error);
      return null;
    }
  };

  /**
   * Get flow chart statistics
   */
  const getStats = () => {
    const totalFlowCharts = savedFlowCharts.value.size;
    const totalNodes = currentNodes.value.length;
    const totalEdges = currentEdges.value.length;
    const roomNodes = currentNodes.value.filter((node) => node.type === 'room').length;
    const functionalNodes = currentNodes.value.filter((node) => node.type === 'functional').length;

    return {
      totalFlowCharts,
      totalNodes,
      totalEdges,
      roomNodes,
      functionalNodes,
      currentFlowChartId: currentFlowChartId.value,
      currentName: currentName.value,
    };
  };

  return {
    // State
    currentNodes,
    currentEdges,
    currentName,
    currentFlowChartId,
    savedFlowCharts,

    // Actions
    saveCurrentFlowChart,
    loadFlowChart,
    createNewFlowChart,
    deleteFlowChart,
    updateCurrentState,
    renameFlowChart,
    getAllFlowCharts,
    getFlowChartById,
    exportFlowChart,
    importFlowChart,
    getStats,
  };
});

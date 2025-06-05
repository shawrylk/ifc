import * as THREE from 'three';
import { useGeometryCacheStore } from '@/stores/geometryCacheStore';
import { useThree } from '@/stores/threeStore';
import { useIFCStore } from '@/stores/ifcStore';
import { ContrastingColorGenerator } from './contrastingColorGenerator';

export interface MergedRoomResult {
  mesh: THREE.Mesh;
  level: number;
  roomIds: number[];
  name: string;
  chartId: string;
}

export interface RoomGroup {
  group: THREE.Group;
  chartId: string;
  mergedRooms: Map<string, MergedRoomResult>;
  isVisible: boolean;
}

export class RoomMerger {
  private static instance: RoomMerger | null = null;
  private roomGroups = new Map<string, RoomGroup>();
  private currentActiveChart: string | null = null;
  private colorGenerator = new ContrastingColorGenerator();
  private colorIterator = this.colorGenerator.generate();

  /**
   * Get singleton instance
   */
  static getInstance(): RoomMerger {
    if (!RoomMerger.instance) {
      RoomMerger.instance = new RoomMerger();
    }
    return RoomMerger.instance;
  }

  /**
   * Set the active flow chart and show its merged rooms
   */
  setActiveChart(chartId: string | null): void {
    // Hide current active chart's rooms
    if (this.currentActiveChart && this.currentActiveChart !== chartId) {
      this.hideChartRooms(this.currentActiveChart);
    }

    this.currentActiveChart = chartId;

    // Show new active chart's rooms
    if (chartId) {
      this.showChartRooms(chartId);
      console.log(`🔄 Active chart changed to: ${chartId}`);
    } else {
      console.log(`🔄 Active chart cleared`);
    }
  }

  /**
   * Get the currently active chart ID
   */
  getActiveChart(): string | null {
    return this.currentActiveChart;
  }

  /**
   * Create or get room group for a flow chart
   */
  private getOrCreateRoomGroup(chartId: string): RoomGroup {
    if (!this.roomGroups.has(chartId)) {
      const group = new THREE.Group();
      group.name = `FlowChart_${chartId}_MergedRooms`;

      // Add to IFC model
      const ifcStore = useIFCStore();
      const fragmentsModels = ifcStore.getFragmentsModels();
      const model = fragmentsModels?.models?.list.values().next().value;
      if (model) {
        model.object.add(group);
      }

      const roomGroup: RoomGroup = {
        group,
        chartId,
        mergedRooms: new Map(),
        isVisible: false,
      };

      this.roomGroups.set(chartId, roomGroup);
      console.log(
        `📦 Created room group for chart: ${chartId}. Current active: ${this.currentActiveChart}`
      );
    }

    return this.roomGroups.get(chartId)!;
  }

  /**
   * Show merged rooms for a specific chart
   */
  private showChartRooms(chartId: string): void {
    const roomGroup = this.roomGroups.get(chartId);
    if (roomGroup) {
      roomGroup.group.visible = true;
      roomGroup.isVisible = true;

      // Force render update
      const { render } = useThree();
      render(true);

      console.log(`👁️ Showing merged rooms for chart: ${chartId}`);
    }
  }

  /**
   * Hide merged rooms for a specific chart
   */
  private hideChartRooms(chartId: string): void {
    const roomGroup = this.roomGroups.get(chartId);
    if (roomGroup) {
      roomGroup.group.visible = false;
      roomGroup.isVisible = false;

      // Force render update
      const { render } = useThree();
      render(true);

      console.log(`🙈 Hiding merged rooms for chart: ${chartId}`);
    }
  }

  /**
   * Delete a flow chart and its associated merged rooms
   */
  deleteChart(chartId: string): void {
    const roomGroup = this.roomGroups.get(chartId);
    if (roomGroup) {
      // Dispose all meshes and materials
      roomGroup.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });

      // Remove from scene
      const parent = roomGroup.group.parent;
      if (parent) {
        parent.remove(roomGroup.group);
      }

      // Show original rooms for all merged rooms in this chart
      for (const mergedRoom of roomGroup.mergedRooms.values()) {
        this.showOriginalRooms(mergedRoom.roomIds);
      }

      this.roomGroups.delete(chartId);

      // If this was the active chart, clear the active chart
      if (this.currentActiveChart === chartId) {
        this.currentActiveChart = null;
      }

      console.log(`🗑️ Deleted chart and merged rooms: ${chartId}`);
    }
  }

  /**
   * Get all room groups
   */
  getAllRoomGroups(): Map<string, RoomGroup> {
    return new Map(this.roomGroups);
  }

  /**
   * Create merged room geometry from multiple room IDs
   * @param roomIds - Array of IFC room IDs to merge
   * @param level - Room level (0 = level 1, 1 = level 2, 2 = level 3)
   * @param chartId - Flow chart ID this merged room belongs to
   * @param color - Optional color for the merged room (defaults to auto-generated)
   * @returns The created merged mesh
   */
  async createMergedRoomGeometry(
    roomIds: number[],
    level: number,
    chartId: string,
    color?: string
  ): Promise<THREE.Mesh | null> {
    const geometryCacheStore = useGeometryCacheStore();

    if (!geometryCacheStore.isInitialized) {
      console.warn('Geometry cache store not initialized');
      return null;
    }

    try {
      console.log(`🔧 Creating merged geometry for level ${level + 1} in chart ${chartId}...`);

      // Get room geometries from the cache store
      const roomGeometriesMap = await geometryCacheStore.getGeometriesForLocalIds(roomIds);

      if (roomGeometriesMap.size === 0) {
        console.warn('No geometries found to merge');
        return null;
      }

      // Collect geometries for merging
      const geometriesToMerge: THREE.BufferGeometry[] = [];

      for (const [_, extractedGeometries] of roomGeometriesMap) {
        extractedGeometries.forEach((extracted) => {
          if (extracted.geometry) {
            // Clone the geometry to avoid modifying the cached version
            const clonedGeometry = extracted.geometry.clone().applyMatrix4(extracted.transform);
            geometriesToMerge.push(clonedGeometry);
          }
        });
      }

      if (geometriesToMerge.length === 0) {
        console.warn('No valid geometries found to merge');
        return null;
      }

      // Merge geometries using Three.js BufferGeometryUtils
      const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
      const mergedGeometry = mergeGeometries(geometriesToMerge);

      if (!mergedGeometry) {
        console.error('Failed to merge geometries');
        return null;
      }

      // Create material for the merged room
      const material = this.createLevelMaterial(color);

      // Create the merged mesh
      const mergedMesh = new THREE.Mesh(mergedGeometry, material);
      mergedMesh.name = `MergedRoom_L${level + 1}_${Date.now()}`;

      // Assign to appropriate layer
      mergedMesh.layers.set(level);

      // Get or create room group for this chart
      const roomGroup = this.getOrCreateRoomGroup(chartId);
      roomGroup.group.add(mergedMesh);

      // Store the merged room result
      const mergedResult: MergedRoomResult = {
        mesh: mergedMesh,
        level,
        roomIds: [...roomIds],
        name: mergedMesh.name,
        chartId,
      };

      roomGroup.mergedRooms.set(mergedMesh.name, mergedResult);

      // Set visibility based on whether this chart is active
      // If no chart is currently active, make this chart active (for first chart scenario)
      if (!this.currentActiveChart) {
        this.currentActiveChart = chartId;
        console.log(`🎯 Auto-activated first chart: ${chartId}`);
      }

      const shouldBeVisible = this.currentActiveChart === chartId;
      roomGroup.group.visible = shouldBeVisible;
      roomGroup.isVisible = shouldBeVisible;

      console.log(
        `🎯 Chart ${chartId} visibility: ${shouldBeVisible} (active: ${this.currentActiveChart})`
      );

      // Hide original rooms
      this.hideOriginalRooms(roomIds);

      // Force render update
      const { render } = useThree();
      render(true);

      console.log(
        `✅ Created merged room at level ${level + 1} for chart ${chartId}:`,
        mergedMesh.name
      );

      // Clean up temporary geometries
      geometriesToMerge.forEach((geo) => geo.dispose());

      return mergedMesh;
    } catch (error) {
      console.error('❌ Error creating merged room geometry:', error);
      return null;
    }
  }

  /**
   * Create material for merged room
   * @param customColor - Optional custom color, otherwise uses auto-generated color
   */
  private createLevelMaterial(customColor?: string): THREE.Material {
    const color = customColor || this.colorIterator.next().value.rgbString;

    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Hide original room meshes
   */
  hideOriginalRooms(roomIds: number[]): void {
    const ifcStore = useIFCStore();
    const fragmentsModels = ifcStore.getFragmentsModels();
    if (!fragmentsModels?.models?.list) return;

    const currentModel = fragmentsModels.models.list.values().next().value;
    if (!currentModel) return;

    roomIds.forEach((roomId) => {
      const mesh = this.findMeshByIfcId(currentModel, roomId);
      if (mesh) {
        mesh.visible = false;
      }
    });
  }

  /**
   * Show original room meshes
   */
  showOriginalRooms(roomIds: number[]): void {
    const ifcStore = useIFCStore();
    const fragmentsModels = ifcStore.getFragmentsModels();
    if (!fragmentsModels?.models?.list) return;

    const currentModel = fragmentsModels.models.list.values().next().value;
    if (!currentModel) return;

    roomIds.forEach((roomId) => {
      const mesh = this.findMeshByIfcId(currentModel, roomId);
      if (mesh) {
        mesh.visible = true;
      }
    });
  }

  /**
   * Find Three.js mesh by IFC ID using fragments
   */
  private findMeshByIfcId(model: any, ifcId: number): THREE.Mesh | null {
    try {
      // Try to get the fragment for this IFC ID
      if (model.getItemFragment) {
        const fragment = model.getItemFragment(ifcId);
        if (fragment && fragment.mesh) {
          return fragment.mesh;
        }
      }

      // Alternative approach: search through fragments
      if (model.fragments) {
        for (const fragment of model.fragments.values()) {
          if (fragment.ids?.has(ifcId) && fragment.mesh) {
            return fragment.mesh;
          }
        }
      }
    } catch (error) {
      // Silent fail for missing fragments
    }

    return null;
  }

  /**
   * Remove a merged room from a specific chart
   */
  removeMergedRoom(meshName: string, chartId: string): void {
    const roomGroup = this.roomGroups.get(chartId);
    if (!roomGroup) return;

    const mergedResult = roomGroup.mergedRooms.get(meshName);
    if (mergedResult) {
      // Remove from group
      roomGroup.group.remove(mergedResult.mesh);

      // Dispose geometry and material
      mergedResult.mesh.geometry.dispose();
      if (mergedResult.mesh.material instanceof THREE.Material) {
        mergedResult.mesh.material.dispose();
      }

      // Remove from tracking
      roomGroup.mergedRooms.delete(meshName);

      // Show original rooms
      this.showOriginalRooms(mergedResult.roomIds);

      console.log(`🗑️ Removed merged room: ${meshName} from chart: ${chartId}`);
    }
  }

  /**
   * Get all merged rooms for a specific chart
   */
  getMergedRoomsForChart(chartId: string): MergedRoomResult[] {
    const roomGroup = this.roomGroups.get(chartId);
    return roomGroup ? Array.from(roomGroup.mergedRooms.values()) : [];
  }

  /**
   * Get all merged rooms across all charts
   */
  getAllMergedRooms(): MergedRoomResult[] {
    const allRooms: MergedRoomResult[] = [];
    for (const roomGroup of this.roomGroups.values()) {
      allRooms.push(...roomGroup.mergedRooms.values());
    }
    return allRooms;
  }

  /**
   * Get merged room by name and chart
   */
  getMergedRoom(meshName: string, chartId: string): MergedRoomResult | null {
    const roomGroup = this.roomGroups.get(chartId);
    return roomGroup?.mergedRooms.get(meshName) || null;
  }

  /**
   * Clear all merged rooms for a specific chart
   */
  clearMergedRoomsForChart(chartId: string): void {
    const roomGroup = this.roomGroups.get(chartId);
    if (!roomGroup) return;

    const roomNames = Array.from(roomGroup.mergedRooms.keys());
    for (const roomName of roomNames) {
      this.removeMergedRoom(roomName, chartId);
    }
  }

  /**
   * Clear all merged rooms across all charts
   */
  clearAllMergedRooms(): void {
    const chartIds = Array.from(this.roomGroups.keys());
    for (const chartId of chartIds) {
      this.clearMergedRoomsForChart(chartId);
    }
  }

  /**
   * Get statistics about merged rooms
   */
  getStats(): {
    totalMerged: number;
    byLevel: Record<number, number>;
    byChart: Record<string, number>;
  } {
    const byLevel: Record<number, number> = {};
    const byChart: Record<string, number> = {};
    let totalMerged = 0;

    for (const [chartId, roomGroup] of this.roomGroups) {
      byChart[chartId] = roomGroup.mergedRooms.size;

      for (const result of roomGroup.mergedRooms.values()) {
        totalMerged++;
        byLevel[result.level] = (byLevel[result.level] || 0) + 1;
      }
    }

    return { totalMerged, byLevel, byChart };
  }
}

// Export singleton instance
export const roomMerger = RoomMerger.getInstance();

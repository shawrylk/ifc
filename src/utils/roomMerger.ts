import * as THREE from 'three';
import { useGeometryCacheStore } from '@/stores/geometryCacheStore';
import { useThree } from '@/stores/threeStore';
import { useIFCStore } from '@/stores/ifcStore';

export interface MergedRoomResult {
  mesh: THREE.Mesh;
  level: number;
  roomIds: number[];
  name: string;
}

export class RoomMerger {
  private static instance: RoomMerger | null = null;
  private mergedRooms = new Map<string, MergedRoomResult>();

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
   * Create merged room geometry from multiple room IDs
   * @param roomIds - Array of IFC room IDs to merge
   * @param level - Room level (0 = level 1, 1 = level 2, 2 = level 3)
   * @returns The created merged mesh
   */
  async createMergedRoomGeometry(roomIds: number[], level: number): Promise<THREE.Mesh | null> {
    const geometryCacheStore = useGeometryCacheStore();

    if (!geometryCacheStore.isInitialized) {
      console.warn('Geometry cache store not initialized');
      return null;
    }

    try {
      console.log(`🔧 Creating merged geometry for level ${level + 1}...`);

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
      const material = this.createLevelMaterial(level);

      // Create the merged mesh
      const mergedMesh = new THREE.Mesh(mergedGeometry, material);
      mergedMesh.name = `MergedRoom_L${level + 1}_${Date.now()}`;

      // Assign to appropriate layer (level 0 -> layer 0, level 1 -> layer 1, etc.)
      mergedMesh.layers.set(level);

      // Add to scene
      const getFragmentsModels = useIFCStore().getFragmentsModels();
      const model = getFragmentsModels?.models?.list.values().next().value;
      if (model) {
        model.object.add(mergedMesh);
      }

      // Store the merged room result
      const mergedResult: MergedRoomResult = {
        mesh: mergedMesh,
        level,
        roomIds: [...roomIds],
        name: mergedMesh.name,
      };

      this.mergedRooms.set(mergedMesh.name, mergedResult);

      // Force render update
      const { render } = useThree();
      render(true);

      console.log(`✅ Created merged room at level ${level + 1}:`, mergedMesh.name);

      // Clean up temporary geometries
      geometriesToMerge.forEach((geo) => geo.dispose());

      return mergedMesh;
    } catch (error) {
      console.error('❌ Error creating merged room geometry:', error);
      return null;
    }
  }

  /**
   * Create material for specific level
   */
  private createLevelMaterial(level: number): THREE.Material {
    const levelColors: Record<number, number> = {
      0: 0x4ade80, // Green for level 1 (index 0)
      1: 0x3b82f6, // Blue for level 2 (index 1)
      2: 0xa855f7, // Purple for level 3 (index 2)
    };

    return new THREE.MeshBasicMaterial({
      color: levelColors[level] || 0x888888,
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
   * Remove a merged room from the scene
   */
  removeMergedRoom(meshName: string): void {
    const mergedResult = this.mergedRooms.get(meshName);
    if (mergedResult) {
      // Remove from scene
      const scene = useThree().scene;
      scene.remove(mergedResult.mesh);

      // Dispose geometry and material
      mergedResult.mesh.geometry.dispose();
      if (mergedResult.mesh.material instanceof THREE.Material) {
        mergedResult.mesh.material.dispose();
      }

      // Remove from tracking
      this.mergedRooms.delete(meshName);

      // Show original rooms
      this.showOriginalRooms(mergedResult.roomIds);

      console.log(`🗑️ Removed merged room: ${meshName}`);
    }
  }

  /**
   * Get all merged rooms
   */
  getAllMergedRooms(): MergedRoomResult[] {
    return Array.from(this.mergedRooms.values());
  }

  /**
   * Get merged room by name
   */
  getMergedRoom(meshName: string): MergedRoomResult | null {
    return this.mergedRooms.get(meshName) || null;
  }

  /**
   * Clear all merged rooms
   */
  clearAllMergedRooms(): void {
    for (const meshName of this.mergedRooms.keys()) {
      this.removeMergedRoom(meshName);
    }
  }

  /**
   * Get statistics about merged rooms
   */
  getStats(): { totalMerged: number; byLevel: Record<number, number> } {
    const byLevel: Record<number, number> = {};
    let totalMerged = 0;

    for (const result of this.mergedRooms.values()) {
      totalMerged++;
      byLevel[result.level] = (byLevel[result.level] || 0) + 1;
    }

    return { totalMerged, byLevel };
  }
}

// Export singleton instance
export const roomMerger = RoomMerger.getInstance();

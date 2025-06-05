import { FragmentsModels, FragmentsModel } from '@thatopen/fragments';
import * as THREE from 'three';
import { PlansManager } from './PlansManager';
import { useThree } from '@/stores/threeStore';

interface StoreyWireframe {
  storeyId: number;
  wireframe: THREE.LineSegments;
  originalVisible: boolean;
  isReady: boolean; // Track if wireframe is ready for display
}

export class XRayManager {
  private _fragmentsModels: FragmentsModels;
  private _model: FragmentsModel | undefined;
  private _plansManager: PlansManager;
  private _storeyWireframes: Map<number, StoreyWireframe> = new Map();
  private _isXRayEnabled = false;
  private _isInitialized = false;
  private _processingProgress: { completed: number; total: number } = { completed: 0, total: 0 };

  constructor(fragmentsModels: FragmentsModels, plansManager: PlansManager) {
    this._fragmentsModels = fragmentsModels;
    this._model = this._fragmentsModels.models.list.values().next().value;
    this._plansManager = plansManager;
  }

  async initialize() {
    if (!this._model) {
      console.warn('No model available for X-ray initialization');
      return;
    }

    // Mark as initialized early
    this._isInitialized = true;

    // Start simple async processing
    this._initializeAsync();
  }

  private async _initializeAsync() {
    try {
      // Generate plans
      const plans = await this._plansManager.generate();

      if (plans.length === 0) {
        return;
      }

      // Collect all storey data first to calculate total children
      const allStoreyData = [];
      let totalChildren = 0;

      for (const plan of plans) {
        const storeyId = parseInt(plan.id);
        const children = await this._model!.getItemsChildren([storeyId]);

        if (children && children.length > 0) {
          allStoreyData.push({ storeyId, children });
          totalChildren += children.length;
        }
      }

      if (totalChildren === 0) {
        return;
      }

      // Initialize progress tracking with total storeys (wireframes) count
      this._processingProgress = { completed: 0, total: allStoreyData.length };

      // Create processing queue with individual children
      const processingQueue = [];
      for (const { storeyId, children } of allStoreyData) {
        // Initialize storey wireframe data
        this._storeyWireframes.set(storeyId, {
          storeyId,
          wireframe: new THREE.LineSegments(), // Placeholder
          originalVisible: false,
          isReady: false,
        });

        // Add each child to the processing queue
        for (const childId of children) {
          processingQueue.push({ storeyId, childId });
        }
      }

      // Start processing first child
      this._processNextChild(processingQueue, 0, new Map());
    } catch (error) {
      console.error('Error during XRay async initialization:', error);
    }
  }

  private _processNextChild(
    processingQueue: Array<{ storeyId: number; childId: number }>,
    currentIndex: number,
    storeyGeometries: Map<number, any[]> // Accumulated geometries per storey
  ) {
    // If we've processed all children, we're done
    if (currentIndex >= processingQueue.length) {
      return;
    }

    const { storeyId, childId } = processingQueue[currentIndex];

    const processCurrentChild = async () => {
      try {
        if (!this._model) return;

        // Get geometry for this specific child
        const { useGeometryCacheStore } = await import('@/stores/geometryCacheStore');
        const geometryCache = useGeometryCacheStore();

        // Initialize cache if needed
        if (!geometryCache.isInitialized) {
          geometryCache.initialize(this._model as any);
        }

        // Get geometry for this child
        const childGeometries = await geometryCache.getGeometriesForLocalIds([childId]);
        const extractedGeometries = Array.from(childGeometries.values()).flat();

        // Accumulate geometries for this storey
        if (extractedGeometries.length > 0) {
          if (!storeyGeometries.has(storeyId)) {
            storeyGeometries.set(storeyId, []);
          }
          storeyGeometries.get(storeyId)!.push(...extractedGeometries);
        }

        // Check if this was the last child for this storey
        const isLastChildOfStorey =
          currentIndex === processingQueue.length - 1 ||
          processingQueue[currentIndex + 1].storeyId !== storeyId;

        if (isLastChildOfStorey) {
          // Create wireframe for this storey now that all children are processed
          await this._createStoreyWireframeFromGeometries(
            storeyId,
            storeyGeometries.get(storeyId) || []
          );

          // Update progress when a wireframe is actually completed
          this._updateProgress();
        }

        // Schedule next child with 100ms delay
        setTimeout(() => {
          this._processNextChild(processingQueue, currentIndex + 1, storeyGeometries);
        }, 10);
      } catch (error) {
        console.error(`Error processing child ${childId} of storey ${storeyId}:`, error);

        // Continue with next child even if this one failed
        setTimeout(() => {
          this._processNextChild(processingQueue, currentIndex + 1, storeyGeometries);
        }, 10);
      }
    };

    // Process current child during idle time
    if ('requestIdleCallback' in window) {
      requestIdleCallback(processCurrentChild, { timeout: 100 });
    } else {
      setTimeout(processCurrentChild, 0);
    }
  }

  private _updateProgress() {
    // Count only completed wireframes
    const completedWireframes = Array.from(this._storeyWireframes.values()).filter(
      (w) => w.isReady
    ).length;
    const totalWireframes = this._processingProgress.total;

    this._processingProgress = { completed: completedWireframes, total: totalWireframes };
  }

  private async _createStoreyWireframeFromGeometries(
    storeyId: number,
    extractedGeometries: any[]
  ): Promise<void> {
    try {
      if (extractedGeometries.length === 0) {
        return;
      }

      // Merge all accumulated geometries for this storey
      const { mergeExtractedGeometries } = await import('@/utils/geometryUtils');
      const mergedGeometry = await mergeExtractedGeometries(extractedGeometries);

      if (!mergedGeometry) {
        return;
      }

      // Create wireframe
      const edges = new THREE.EdgesGeometry(mergedGeometry, 0.1);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x878787,
        toneMapped: true,
        depthTest: false,
        depthWrite: false,
      });

      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      wireframe.name = `wireframe_storey_${storeyId}`;
      wireframe.matrix.copy(this._model!.object.matrix);
      wireframe.visible = false; // Initially hidden

      // Replace placeholder wireframe
      const storeyWireframe = this._storeyWireframes.get(storeyId);
      if (storeyWireframe) {
        // Remove old placeholder
        if (storeyWireframe.wireframe.parent) {
          storeyWireframe.wireframe.parent.remove(storeyWireframe.wireframe);
        }

        // Update with real wireframe
        storeyWireframe.wireframe = wireframe;
        storeyWireframe.isReady = true;

        // Add to scene
        this._model!.object.add(wireframe);

        // If X-ray is currently enabled, make this wireframe visible
        if (this._isXRayEnabled) {
          this._updateWireframeVisibility(storeyId);
        }
      }

      // Clean up temporary geometry
      mergedGeometry.dispose();
      edges.dispose();
    } catch (error) {
      console.error(`Error creating wireframe for storey ${storeyId}:`, error);
    }
  }

  private _updateWireframeVisibility(storeyId?: number) {
    this._storeyWireframes.forEach((storeyWireframe, id) => {
      if (!storeyWireframe.isReady) return; // Skip wireframes that aren't ready yet

      if (this._isXRayEnabled) {
        // Show wireframe with X-ray properties
        if (storeyId === undefined || storeyId === id) {
          storeyWireframe.wireframe.visible = true;
          const material = storeyWireframe.wireframe.material as THREE.LineBasicMaterial;
          material.depthTest = false;
          material.depthWrite = false;
          material.needsUpdate = true;
        } else {
          storeyWireframe.wireframe.visible = false;
        }
      } else {
        // Hide wireframe
        storeyWireframe.wireframe.visible = false;
      }
    });
  }

  toggleXRay(): boolean {
    this._isXRayEnabled = !this._isXRayEnabled;

    // Update visibility of all ready wireframes
    this._updateWireframeVisibility();

    // Force render update
    const { render } = useThree();
    render(true);

    return this._isXRayEnabled;
  }

  updateStoreyWireframeVisibility(storeyId: number | null) {
    if (!this._isXRayEnabled) return;

    if (storeyId === null) {
      // Show all ready wireframes when no specific storey is selected
      this._updateWireframeVisibility();
    } else {
      // Show only the wireframe for the selected storey (if ready)
      const storeyWireframe = this._storeyWireframes.get(storeyId);

      if (storeyWireframe && !storeyWireframe.isReady) {
        // Wireframe not ready yet, try to prioritize its processing
        this._prioritizeStoreyWireframe(storeyId);
      }

      // Update visibility for all wireframes
      this._storeyWireframes.forEach((wireframe, id) => {
        if (!wireframe.isReady) return;
        wireframe.wireframe.visible = this._isXRayEnabled && id === storeyId;
      });
    }

    // Force render update
    const { render } = useThree();
    render(true);
  }

  private async _prioritizeStoreyWireframe(storeyId: number) {
    if (!this._model) return;

    // Get children for this storey
    const children = await this._model.getItemsChildren([storeyId]);
    if (!children || children.length === 0) return;

    // Process this storey immediately by collecting all its geometries
    const { useGeometryCacheStore } = await import('@/stores/geometryCacheStore');
    const geometryCache = useGeometryCacheStore();

    if (!geometryCache.isInitialized) {
      geometryCache.initialize(this._model as any);
    }

    // Get all geometries for this storey's children
    const allGeometries = await geometryCache.getGeometriesForLocalIds(children);
    const extractedGeometries = Array.from(allGeometries.values()).flat();

    // Create wireframe immediately
    await this._createStoreyWireframeFromGeometries(storeyId, extractedGeometries);
  }

  /**
   * Get processing status for progress display
   */
  getProcessingStatus() {
    const completed = Array.from(this._storeyWireframes.values()).filter((w) => w.isReady).length;
    const total = this._processingProgress.total;
    const isProcessing = completed < total && total > 0;

    return {
      completed,
      total,
      isProcessing,
      errors: 0,
      progress: total > 0 ? completed / total : 0,
    };
  }

  /**
   * Get current processing progress (for debugging)
   */
  getProcessingProgress() {
    return this._processingProgress;
  }

  /**
   * Check if a specific storey wireframe is ready
   */
  isStoreyWireframeReady(storeyId: number): boolean {
    const storeyWireframe = this._storeyWireframes.get(storeyId);
    return storeyWireframe ? storeyWireframe.isReady : false;
  }

  /**
   * Get count of ready wireframes
   */
  getReadyWireframesCount(): number {
    return Array.from(this._storeyWireframes.values()).filter((w) => w.isReady).length;
  }

  /**
   * Get total wireframes count
   */
  getTotalWireframesCount(): number {
    return this._storeyWireframes.size;
  }

  dispose() {
    // Track shared resources to avoid disposing them multiple times
    const sharedGeometries = new Set<THREE.BufferGeometry>();
    const sharedMaterials = new Set<THREE.Material>();

    // Remove all wireframes from the scene and collect shared resources
    this._storeyWireframes.forEach((storeyWireframe) => {
      if (storeyWireframe.wireframe.parent) {
        storeyWireframe.wireframe.parent.remove(storeyWireframe.wireframe);
      }

      // Collect shared resources (placeholders) vs individual resources (actual wireframes)
      if (storeyWireframe.isReady) {
        // Individual wireframe - dispose immediately
        storeyWireframe.wireframe.geometry.dispose();
        if (storeyWireframe.wireframe.material instanceof THREE.Material) {
          storeyWireframe.wireframe.material.dispose();
        }
      } else {
        // Shared placeholder resources - collect for later disposal
        sharedGeometries.add(storeyWireframe.wireframe.geometry);
        if (storeyWireframe.wireframe.material instanceof THREE.Material) {
          sharedMaterials.add(storeyWireframe.wireframe.material);
        }
      }
    });

    // Dispose shared resources once
    sharedGeometries.forEach((geometry) => geometry.dispose());
    sharedMaterials.forEach((material) => material.dispose());

    this._storeyWireframes.clear();
    this._isXRayEnabled = false;
    this._isInitialized = false;
  }

  get isEnabled(): boolean {
    return this._isXRayEnabled;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  getStoreyWireframes(): Map<number, StoreyWireframe> {
    return this._storeyWireframes;
  }
}

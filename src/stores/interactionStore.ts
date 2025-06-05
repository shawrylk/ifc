import { defineStore } from 'pinia';
import { Ref, ref } from 'vue';
import * as THREE from 'three';
import * as FRAGS from '@thatopen/fragments';
import { useThree } from '@/stores/threeStore';
import { useIFCStore } from '@/stores/ifcStore';
import { useCategoryLookupStore } from '@/stores/categoryLookupStore';
import { CameraType } from '@/types/three';

// Types
interface ModelInfo {
  [key: string]: string | number;
}

interface SelectionData {
  localId: number;
  modelInfo: ModelInfo;
}

type SelectionCallback = (data: SelectionData) => void;
type DeselectionCallback = () => void;

interface RaycastThrottle {
  lastTime: number;
  timeout: number;
}

const getModelInfo = async (
  ifc: ReturnType<typeof useIFCStore>,
  localId: number
): Promise<ModelInfo | null> => {
  const fragmentsModels = ifc.getFragmentsModels();
  const currentModel = fragmentsModels?.models.list.values().next().value;
  if (!currentModel || !localId) return null;

  const [data] = await currentModel.getItemsData([localId], {
    attributesDefault: true,
    relations: {
      IsDefinedBy: { attributes: true, relations: true },
      DefinesOcurrence: { attributes: false, relations: false },
    },
  });

  if (!data) return null;

  // Transform data to ModelInfo
  return data as unknown as Record<string, string | number>;
};

const focusOnSelectedItem = async (
  three: ReturnType<typeof useThree>,
  ifc: ReturnType<typeof useIFCStore>,
  selectedId: number
) => {
  if (!selectedId) return;

  const model = ifc.getFragmentsModels()?.models.list.values().next().value;
  if (!model) return;

  const box = await model.getBoxes([selectedId]);
  if (Number.isFinite(box[0].min.x)) {
    three.mainViewport?.controls3d.fitToSphere(box[0].getBoundingSphere(new THREE.Sphere()), true);
  }
};

let selectionMeshes: THREE.Mesh[] = [];
let hoverMeshes: THREE.Mesh[] = [];

const createHighlightMeshes = async (
  model: FRAGS.FragmentsModel,
  localId: number,
  meshArray: THREE.Mesh[],
  material: THREE.MeshBasicMaterial
) => {
  const geometriesArray = await model.getItemsGeometry([localId]);
  for (const geometries of geometriesArray) {
    for (const geometry of geometries) {
      const indices: Uint16Array =
        'indices' in geometry ? (geometry.indices as Uint16Array) : new Uint16Array();
      const positions: Float32Array =
        'positions' in geometry ? (geometry.positions as Float32Array) : new Float32Array();
      const normals: Int16Array =
        'normals' in geometry ? (geometry.normals as Int16Array) : new Int16Array();
      const transform: THREE.Matrix4 = new THREE.Matrix4();
      if ('transform' in geometry) {
        if ('elements' in geometry.transform) {
          transform.fromArray(geometry.transform.elements as number[]);
        }
      }

      const tempGeometry = new THREE.BufferGeometry();
      tempGeometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
      tempGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      tempGeometry.setAttribute('normal', new THREE.Int16BufferAttribute(normals, 3));
      const mesh = new THREE.Mesh(tempGeometry, material);
      mesh.applyMatrix4(transform);
      mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);

      // Prevent highlight meshes from being detected by raycast
      mesh.raycast = () => {};

      model?.object.add(mesh);
      meshArray.push(mesh);
    }
  }
};

const setHighlightObject = async (model: FRAGS.FragmentsModel, localId?: number) => {
  // reset selection meshes
  for (const mesh of selectionMeshes) {
    model?.object.remove(mesh);
  }
  selectionMeshes.length = 0;

  if (!localId) return;

  const selectionMaterial = new THREE.MeshBasicMaterial({
    color: 0x39ff14, // Green for selection
    depthWrite: false,
    depthTest: false,
    opacity: 1,
    transparent: false,
  });

  await createHighlightMeshes(model, localId, selectionMeshes, selectionMaterial);
};

const createSetHoverObject =
  (highlightId: Ref<number | null>) => async (model: FRAGS.FragmentsModel, localId?: number) => {
    // reset hover meshes
    for (const mesh of hoverMeshes) {
      model?.object.remove(mesh);
    }
    hoverMeshes.length = 0;

    if (!localId) return;

    // Don't show hover on already selected items
    if (localId === highlightId.value) return;

    // Avoid unnecessary work if clearing already empty hover
    if (localId === undefined && hoverMeshes.length === 0) return;

    const hoverMaterial = new THREE.MeshBasicMaterial({
      color: 0x72ff94, // Light green for hover
      depthWrite: false,
      depthTest: false,
      opacity: 0.5,
      transparent: true,
    });

    await createHighlightMeshes(model, localId, hoverMeshes, hoverMaterial);
  };

export const useInteractionStore = defineStore('interaction', () => {
  const three = useThree();
  const ifc = useIFCStore();
  const categoryLookup = useCategoryLookupStore();

  // Selection state
  const selectedId = ref<number | null>(null);
  const selectedInfo = ref<ModelInfo | null>(null);
  const highlightId = ref<number | null>(null);
  const hoveredId = ref<number | null>(null);
  const setHoverObject = createSetHoverObject(highlightId);

  // Callbacks
  const selectionCallbacks = ref<SelectionCallback[]>([]);
  const deselectionCallbacks = ref<DeselectionCallback[]>([]);

  // Event handlers storage
  const eventHandlers = ref<
    Map<
      string,
      {
        move: (event: MouseEvent) => void;
        click: (event: MouseEvent) => void;
        mousedown: (event: MouseEvent) => void;
      }
    >
  >(new Map());

  const rafId = ref<number | null>(null);
  const raycastThrottleMap = ref<Map<FRAGS.FragmentsModel, RaycastThrottle>>(new Map());

  const onItemSelected = async (localId: number) => {
    if (!localId) return;

    const modelInfo = await getModelInfo(ifc, localId);
    if (!modelInfo) return;
    selectedId.value = localId;
    selectedInfo.value = modelInfo;

    const fragmentsModels = ifc.getFragmentsModels();
    const currentModel = fragmentsModels?.models.list.values().next().value;
    if (!currentModel || !localId) return null;
    setHighlightObject(currentModel, localId); // Highlight the selected item

    selectionCallbacks.value.forEach((callback) => {
      callback({ localId, modelInfo });
    });
  };

  const onItemDeselected = () => {
    selectedId.value = null;
    selectedInfo.value = null;
    const fragmentsModels = ifc.getFragmentsModels();
    const currentModel = fragmentsModels?.models.list.values().next().value;
    if (!currentModel) return null;
    setHighlightObject(currentModel); // Clear selection

    deselectionCallbacks.value.forEach((callback) => {
      callback();
    });
  };

  const getCameras = () => {
    const { mainViewport, subViewports } = three;
    return [mainViewport?.camera, ...subViewports.map((v) => v.camera)];
  };

  const handleMouseMove = async (event: MouseEvent, model: FRAGS.FragmentsModel) => {
    const { renderer, render } = three;
    const container = renderer?.domElement;
    const mouse = new THREE.Vector2(event.clientX, event.clientY);

    // Throttle raycasting for better performance
    let throttle = raycastThrottleMap.value.get(model);
    if (!throttle) {
      throttle = {
        lastTime: 0,
        timeout: 16, // ~60fps
      };
      raycastThrottleMap.value.set(model, throttle);
    }

    const now = performance.now();
    if (now - throttle.lastTime < throttle.timeout) {
      return;
    }
    throttle.lastTime = now;

    // Use requestAnimationFrame to ensure smooth rendering
    if (rafId.value) {
      cancelAnimationFrame(rafId.value);
    }

    rafId.value = requestAnimationFrame(async () => {
      try {
        const cameras = getCameras();
        let newHoveredId: number | null = null;

        // Find the first valid result from all cameras
        for (const camera of cameras) {
          const result = await model.raycast({
            camera: camera as CameraType,
            mouse,
            dom: container,
          });

          if (result) {
            // Check if the hovered item matches category filters
            const matchesFilter = isItemInteractable(result.localId);
            if (matchesFilter) {
              newHoveredId = result.localId;
              break; // Stop at first valid result
            }
          }
        }

        // Only update if hover state actually changed
        if (newHoveredId !== hoveredId.value) {
          hoveredId.value = newHoveredId;

          // Update hover highlighting only if needed
          if (newHoveredId && newHoveredId !== highlightId.value) {
            // Set new hover
            await setHoverObject(model, newHoveredId);
            // Change cursor to pointer
            if (container) {
              container.style.cursor = 'pointer';
            }
          } else {
            // Clear hover
            await setHoverObject(model);
            // Change cursor to default
            if (container) {
              container.style.cursor = 'default';
            }
          }

          // Render only once after state change
          render(true);
        }
      } catch (error) {
        console.error('Error in hover handling:', error);
      }
    });
  };

  const handleSelect = async (event: MouseEvent, model: FRAGS.FragmentsModel) => {
    const { renderer, forceUpdate } = three;
    const container = renderer?.domElement;
    const mouse = new THREE.Vector2(event.clientX, event.clientY);
    const fragmentsModels = ifc.getFragmentsModels();
    if (!fragmentsModels) return;

    const cameras = getCameras();
    for (const camera of cameras) {
      const result = await model.raycast({
        camera: camera as CameraType,
        mouse,
        dom: container,
      });

      if (result) {
        // Check if the selected item matches category filters
        const matchesFilter = isItemInteractable(result.localId);

        if (!matchesFilter) continue;
        if (hoveredId.value) {
          setHoverObject(model); // Clear hover
          hoveredId.value = null;
        }

        highlightId.value = result.localId;

        await fragmentsModels?.update(true);
        onItemSelected(highlightId.value);
        break;
      } else {
        // Reset selection only when clicking on empty space
        if (highlightId.value) {
          highlightId.value = null;
          onItemDeselected();
        }
        setHoverObject(model); // Clear hover
        await fragmentsModels?.update(true);
        forceUpdate(null, fragmentsModels);
      }
    }
  };

  const setupHighlighting = () => {
    const { renderer } = three;
    const fragmentsModels = ifc.getFragmentsModels();
    const container = renderer?.domElement;

    for (const [modelName, model] of fragmentsModels?.models.list ?? []) {
      if (!model || !(model instanceof FRAGS.FragmentsModel)) continue;

      let startX = 0;
      let startY = 0;
      const DRAG_THRESHOLD = 5; // pixels
      let rafId: number | null = null;
      let moveHandler: ((event: MouseEvent) => void) | null = null;
      let mouseDownHandler: ((event: MouseEvent) => void) | null = null;
      let mouseUpHandler: ((event: MouseEvent) => void) | null = null;

      moveHandler = (event: MouseEvent) => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => handleMouseMove(event, model));
      };

      mouseDownHandler = (event: MouseEvent) => {
        startX = event.clientX;
        startY = event.clientY;
      };

      mouseUpHandler = (event: MouseEvent) => {
        const deltaX = Math.abs(event.clientX - startX);
        const deltaY = Math.abs(event.clientY - startY);

        if (deltaX < DRAG_THRESHOLD && deltaY < DRAG_THRESHOLD) {
          handleSelect(event, model);
        }
      };

      // Store handlers for cleanup
      eventHandlers.value.set(modelName, {
        move: moveHandler,
        click: mouseUpHandler,
        mousedown: mouseDownHandler,
      });

      // Add event listeners with passive option for better performance
      container?.addEventListener('mousemove', moveHandler, { passive: true });
      container?.addEventListener('mousedown', mouseDownHandler, { passive: true });
      container?.addEventListener('mouseup', mouseUpHandler, { passive: true });
    }
  };

  const registerSelectionCallback = (callback: SelectionCallback) => {
    selectionCallbacks.value.push(callback);
  };

  const registerDeselectionCallback = (callback: DeselectionCallback) => {
    deselectionCallbacks.value.push(callback);
  };

  const unregisterSelectionCallback = (callback: SelectionCallback) => {
    const index = selectionCallbacks.value.indexOf(callback);
    if (index !== -1) {
      selectionCallbacks.value.splice(index, 1);
    }
  };

  const unregisterDeselectionCallback = (callback: DeselectionCallback) => {
    const index = deselectionCallbacks.value.indexOf(callback);
    if (index !== -1) {
      deselectionCallbacks.value.splice(index, 1);
    }
  };

  const clearAllCallbacks = () => {
    selectionCallbacks.value = [];
    deselectionCallbacks.value = [];
  };

  const dispose = () => {
    const { renderer } = three;
    const container = renderer?.domElement;

    eventHandlers.value.forEach((handlers) => {
      if (container) {
        container.removeEventListener('mousemove', handlers.move);
        container.removeEventListener('mousedown', handlers.mousedown);
        container.removeEventListener('mouseup', handlers.click);
      }
    });

    // Clean up highlight meshes
    const fragmentsModels = ifc.getFragmentsModels();
    if (fragmentsModels) {
      const currentModel = fragmentsModels.models.list.values().next().value;
      if (currentModel) {
        // Remove all depth meshes
        for (const mesh of selectionMeshes) {
          currentModel.object.remove(mesh);
        }
        selectionMeshes.length = 0;

        // Remove all hover meshes
        for (const mesh of hoverMeshes) {
          currentModel.object.remove(mesh);
        }
        hoverMeshes.length = 0;
      }
    }

    // Clear all state
    eventHandlers.value.clear();
    selectedId.value = null;
    selectedInfo.value = null;
    highlightId.value = null;
    hoveredId.value = null;
    raycastThrottleMap.value.clear();

    // Clear any pending animations
    if (rafId.value) {
      cancelAnimationFrame(rafId.value);
      rafId.value = null;
    }
  };

  // Enhanced helper method to check if an item can be interacted with based on filters
  const isItemInteractable = (localId: number): boolean => {
    const matchesFilter = categoryLookup.matchesCategoryFilter(localId);

    // Debug logging for filter matching (can be removed in production)
    if (!matchesFilter) {
      const category = categoryLookup.getCategoryByLocalId(localId);
      const activeFilters = categoryLookup.activeCategoryFiltersList;
      console.debug(
        `Item ${localId} (${category}) blocked by filters. Active: [${activeFilters.join(', ')}]`
      );
    }

    return matchesFilter;
  };

  // Method to force refresh interaction filtering when filters change
  const refreshInteractionFiltering = () => {
    // Clear current hover if it no longer matches filters
    if (hoveredId.value && !isItemInteractable(hoveredId.value)) {
      const fragmentsModels = ifc.getFragmentsModels();
      if (fragmentsModels) {
        const currentModel = fragmentsModels.models.list.values().next().value;
        if (currentModel && hoveredId.value !== highlightId.value) {
          setHoverObject(currentModel); // Clear hover
          hoveredId.value = null;
          fragmentsModels.update(true);
        }
      }
    }

    // Clear current selection if it no longer matches filters
    if (highlightId.value && !isItemInteractable(highlightId.value)) {
      const fragmentsModels = ifc.getFragmentsModels();
      if (fragmentsModels) {
        const currentModel = fragmentsModels.models.list.values().next().value;
        if (currentModel) {
          setHighlightObject(currentModel); // Clear selection
          setHoverObject(currentModel); // Clear hover
          highlightId.value = null;
          onItemDeselected();
          fragmentsModels.update(true);
        }
      }
    }
  };

  // Method to get current filter status info
  const getFilterStatus = () => {
    const activeFilters = categoryLookup.activeCategoryFiltersList;
    const totalCategories = categoryLookup.availableCategoriesList.length;
    const totalItems = categoryLookup.categoryCount;

    return {
      hasFilters: activeFilters.length > 0,
      activeFilters: activeFilters,
      totalCategories: totalCategories,
      totalItems: totalItems,
      isAllSelected: activeFilters.length === totalCategories,
      selectedItemMatches: highlightId.value ? isItemInteractable(highlightId.value) : null,
      hoveredItemMatches: hoveredId.value ? isItemInteractable(hoveredId.value) : null,
    };
  };

  // Helper method to get category for currently selected item
  const getSelectedItemCategory = (): string | null => {
    if (!selectedId.value) return null;
    return categoryLookup.getCategoryByLocalId(selectedId.value);
  };

  // Helper method to get category for currently hovered item
  const getHoveredItemCategory = (): string | null => {
    if (!hoveredId.value) return null;
    return categoryLookup.getCategoryByLocalId(hoveredId.value);
  };

  // Helper method to check if an item can be interacted with based on filters
  const canInteractWithItem = (localId: number): boolean => {
    return isItemInteractable(localId);
  };

  return {
    // State
    selectedId,
    selectedInfo,
    selectionCallbacks,
    deselectionCallbacks,

    // Methods
    getModelInfo,
    focusOnSelectedItem,
    onItemSelected,
    onItemDeselected,
    setupHighlighting,
    registerSelectionCallback,
    registerDeselectionCallback,
    unregisterSelectionCallback,
    unregisterDeselectionCallback,
    clearAllCallbacks,
    dispose,

    // Category filtering methods
    getSelectedItemCategory,
    getHoveredItemCategory,
    canInteractWithItem,
    isItemInteractable,
    refreshInteractionFiltering,
    getFilterStatus,
  };
});

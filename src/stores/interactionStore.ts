import { defineStore } from 'pinia';
import { ref } from 'vue';
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

// Material definitions
const selectionMaterial: FRAGS.MaterialDefinition = {
  color: new THREE.Color(0x39ff14),
  renderedFaces: FRAGS.RenderedFaces.TWO,
  opacity: 1,
  transparent: false,
};

const hoverMaterial: FRAGS.MaterialDefinition = {
  color: new THREE.Color(0x72ff94),
  renderedFaces: FRAGS.RenderedFaces.TWO,
  opacity: 0.5,
  transparent: true,
};

// Utility functions
const highlight = async (
  model: FRAGS.FragmentsModel,
  id: number,
  material: FRAGS.MaterialDefinition
) => {
  if (!id) return;
  await model.highlight([id], material);
};

const resetHighlight = async (model: FRAGS.FragmentsModel) => {
  await model.resetHighlight();
};

const resetHover = async (model: FRAGS.FragmentsModel, id: number) => {
  if (!id) return;
  await model.resetHighlight([id]);
};

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

export const useInteractionStore = defineStore('interaction', () => {
  const three = useThree();
  const ifc = useIFCStore();
  const categoryLookup = useCategoryLookupStore();

  // Selection state
  const selectedId = ref<number | null>(null);
  const selectedInfo = ref<ModelInfo | null>(null);
  const highlightId = ref<number | null>(null);
  const hoveredId = ref<number | null>(null);

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

  const highlightSelectedItem = async (model: FRAGS.FragmentsModel, localId: number) => {
    const fragmentsModels = ifc.getFragmentsModels();
    if (!fragmentsModels) return;

    const promises = [];
    if (selectedId.value) {
      promises.push(resetHighlight(model));
    }

    selectedId.value = localId;
    promises.push(highlight(model, localId, selectionMaterial));
    promises.push(fragmentsModels.update(true));
    await Promise.all(promises);
  };

  const onItemSelected = async (localId: number) => {
    if (!localId) return;

    const modelInfo = await getModelInfo(ifc, localId);
    if (!modelInfo) return;
    selectedId.value = localId;
    selectedInfo.value = modelInfo;

    selectionCallbacks.value.forEach((callback) => {
      callback({ localId, modelInfo });
    });
  };

  const onItemDeselected = () => {
    selectedId.value = null;
    selectedInfo.value = null;

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
    const fragmentsModels = ifc.getFragmentsModels();
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
      const cameras = getCameras();
      for (const camera of cameras) {
        const result = await model.raycast({
          camera: camera as CameraType,
          mouse,
          dom: container,
        });

        const promises = [];
        let newHoveredId = null;

        if (result) {
          // Check if the hovered item matches category filters
          const matchesFilter = isItemInteractable(result.localId);

          if (matchesFilter) {
            newHoveredId = result.localId;
          }
        }

        if (newHoveredId && newHoveredId !== hoveredId.value) {
          // Only hover if item matches category filter
          if (newHoveredId !== highlightId.value) {
            // Reset previous hover
            if (hoveredId.value && hoveredId.value !== highlightId.value) {
              promises.push(resetHover(model, hoveredId.value));
            }
            // Set new hover
            hoveredId.value = newHoveredId;
            promises.push(highlight(model, hoveredId.value, hoverMaterial));
            promises.push(fragmentsModels?.update(true));
            // change cursor to pointer
            if (container) {
              container.style.cursor = 'pointer';
            }
          }
        } else if (hoveredId.value && hoveredId.value !== highlightId.value) {
          // Reset hover when mouse is not over any element or element doesn't match filter
          promises.push(resetHover(model, hoveredId.value));
          hoveredId.value = null;
          promises.push(fragmentsModels?.update(true));
          // change cursor to default
          if (container) {
            container.style.cursor = 'default';
          }
        }

        await Promise.all(promises);
      }
      render(true);
    });
  };

  const handleSelect = async (event: MouseEvent, model: FRAGS.FragmentsModel) => {
    const { renderer } = three;
    const fragmentsModels = ifc.getFragmentsModels();
    const container = renderer?.domElement;
    const mouse = new THREE.Vector2(event.clientX, event.clientY);

    const cameras = getCameras();
    for (const camera of cameras) {
      const result = await model.raycast({
        camera: camera as CameraType,
        mouse,
        dom: container,
      });

      const promises = [];
      if (result) {
        // Check if the selected item matches category filters
        const matchesFilter = isItemInteractable(result.localId);

        if (matchesFilter) {
          // Reset previous selection and hover
          if (highlightId.value) {
            promises.push(resetHighlight(model));
          }
          if (hoveredId.value) {
            promises.push(resetHover(model, hoveredId.value));
            hoveredId.value = null;
          }

          highlightId.value = result.localId;
          promises.push(highlight(model, highlightId.value, selectionMaterial));
          promises.push(fragmentsModels?.update(true));
          onItemSelected(highlightId.value);
        } else {
          // Log when selection is blocked by filter
          const category = categoryLookup.getCategoryByLocalId(result.localId);
          console.log(
            `Selection blocked: localId ${result.localId} (${category}) not in active filters`
          );
        }
        // If item doesn't match filter, we don't select it but also don't deselect current selection
      } else {
        // Reset selection only when clicking on empty space
        if (highlightId.value) {
          promises.push(resetHighlight(model));
          promises.push(fragmentsModels?.update(true));
          highlightId.value = null;
          onItemDeselected();
        }
      }
      await Promise.all(promises);
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
          resetHover(currentModel, hoveredId.value);
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
          resetHighlight(currentModel);
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
    highlightSelectedItem,
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

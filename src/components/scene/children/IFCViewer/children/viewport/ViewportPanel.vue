<template>
  <DraggablePanel
    title="Viewports"
    v-model:display="display"
    v-model:position="position"
    :size="size"
  >
    <section class="viewport-panel">
      <div class="viewport-main-row">
        <div ref="rendererCanvas" class="viewport-canvas-container">
          <!-- Viewport labels -->
          <div class="viewport-labels">
            <div class="viewport-label" :style="{ left: '16.66%' }">
              <span class="label-text">Room Level 1</span>
            </div>
            <div class="viewport-label" :style="{ left: '50%' }">
              <span class="label-text">Room Level 2</span>
            </div>
            <div class="viewport-label" :style="{ left: '83.33%' }">
              <span class="label-text">Room Level 3</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resize handle -->
      <div
        ref="resizeHandle"
        class="resize-handle"
        :class="{ resizing: isResizing }"
        @mousedown="startResize"
        @touchstart="startResize"
      >
        <div class="resize-handle-line"></div>
      </div>

      <footer class="viewport-bottom-bar">
        <aside class="viewport-bottom-left">
          <PlanViewsAndSpaces
            ref="planViewsAndSpaces"
            :plansManager="plansManagerStore.getManager()"
          />
        </aside>

        <!-- Vertical resize handle -->
        <div
          ref="verticalResizeHandle"
          class="vertical-resize-handle"
          :class="{ resizing: isVerticalResizing }"
          @mousedown="startVerticalResize"
          @touchstart="startVerticalResize"
        >
          <div class="vertical-resize-handle-line"></div>
        </div>

        <div class="viewport-bottom-content">
          <FlowChart
            ref="flowChart"
            @nodeClick="handleFlowNodeClick"
            @functionalGroupCreated="handleFunctionalGroupCreated"
          />
        </div>
      </footer>
    </section>
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import * as THREE from 'three';
import { Viewport } from '@/composables/Viewport';
import { markRaw } from 'vue';
import { useThree } from '@/stores/threeStore';
import PlanViewsAndSpaces from './children/PlanViewsAndSpaces/PlanViewsAndSpaces.vue';
import { useIFCStore } from '@/stores/ifcStore';
import { usePlansManagerStore } from '@/stores/plansManagerStore';
import { useInteractionStore } from '@/stores/interactionStore';
import FlowChart from './children/FlowChart/FlowChart.vue';
import { useGeometryCacheStore } from '@/stores/geometryCacheStore';

interface ViewportInitialConfig {
  initialPosition?: THREE.Vector3;
  initialTarget?: THREE.Vector3;
  visibleLayers?: number[];
  name?: string;
}

const props = defineProps<{
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}>();

const emit = defineEmits<{
  (e: 'planChanged', planId: number | null): void;
}>();

const BOTTOM_PANEL_HEIGHT = 550;
const display = defineModel<boolean>('display', { default: false });
const position = ref(props.position ?? { x: 10, y: 10 });
const size = ref(props.size ?? { width: 1400, height: 900 });
const rendererCanvas = ref<HTMLCanvasElement | null>(null);
const planViewsAndSpaces = ref<InstanceType<typeof PlanViewsAndSpaces> | null>(null);
const viewports = shallowRef<Viewport[]>([]);
const isRendering = ref(true);
const plansManagerStore = usePlansManagerStore();
const clock = new THREE.Clock();
const flowChart = ref<InstanceType<typeof FlowChart> | null>(null);
const interactionStore = useInteractionStore();
const ifcStore = useIFCStore();
const resizeObserver = ref<ResizeObserver | null>(null);
const resizeHandle = ref<HTMLElement | null>(null);
const isResizing = ref(false);
const bottomPanelHeight = ref(BOTTOM_PANEL_HEIGHT);
const resizeStartY = ref(0);
const resizeStartHeight = ref(0);
const isVerticalResizing = ref(false);
const verticalResizeHandle = ref<HTMLElement | null>(null);
const leftPanelWidth = ref(300);
const verticalResizeStartX = ref(0);
const verticalResizeStartWidth = ref(0);

// Configure viewports with initial positions and layer visibility
const viewportConfigs: ViewportInitialConfig[] = [
  {
    initialPosition: new THREE.Vector3(0, 25, 0),
    initialTarget: new THREE.Vector3(0, 0, 0),
    visibleLayers: [0], // Show room level 1 (default IFCSPACE rooms)
    name: 'Room Level 1',
  },
  {
    initialPosition: new THREE.Vector3(0, 25, 0),
    initialTarget: new THREE.Vector3(0, 0, 0),
    visibleLayers: [0, 1], // Show room level 2 (merged rooms)
    name: 'Room Level 2',
  },
  {
    initialPosition: new THREE.Vector3(0, 25, 0),
    initialTarget: new THREE.Vector3(0, 0, 0),
    visibleLayers: [0, 2], // Show room level 3 (merged level 2 rooms)
    name: 'Room Level 3',
  },
];

const handleFlowNodeClick = (nodeData: any) => {
  // Handle flow chart node click - could highlight the room in the 3D view
  if (nodeData.localId) {
    interactionStore.selectedId = nodeData.localId;
  }
};

const handleFunctionalGroupCreated = (groupData: any) => {
  // Handle functional group creation - could be used for analytics or reporting
  console.log('Functional group created:', groupData);
};

const startResize = (event: MouseEvent | TouchEvent) => {
  isResizing.value = true;

  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  resizeStartY.value = clientY;
  resizeStartHeight.value = bottomPanelHeight.value;

  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchmove', handleResize, { passive: false });
  document.addEventListener('touchend', stopResize);
  document.body.style.userSelect = 'none'; // Prevent text selection during drag
  event.preventDefault();
};

let resizeThrottle: number | null = null;

const handleResize = (event: MouseEvent | TouchEvent) => {
  if (!isResizing.value) return;

  event.preventDefault();

  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  const deltaY = resizeStartY.value - clientY; // Inverted: moving up increases height
  const newHeight = resizeStartHeight.value + deltaY;

  const minHeight = 200;
  const maxHeight = size.value.height - 200;

  bottomPanelHeight.value = Math.max(minHeight, Math.min(maxHeight, newHeight));

  // Throttle CSS and viewport updates
  if (resizeThrottle) {
    cancelAnimationFrame(resizeThrottle);
  }

  resizeThrottle = requestAnimationFrame(() => {
    // Update CSS variable
    document.documentElement.style.setProperty(
      '--bottom-panel-height',
      `${bottomPanelHeight.value}px`
    );

    // Throttle viewport updates even more
    if (rendererCanvas.value) {
      // Wait for next frame to get updated dimensions
      requestAnimationFrame(() => {
        if (rendererCanvas.value) {
          const canvasRect = rendererCanvas.value.getBoundingClientRect();
          if (canvasRect.width > 0 && canvasRect.height > 0) {
            viewports.value.forEach((viewport, index) => {
              viewport.updateRegion(getActualViewportRegion(index, canvasRect));
            });
          }
        }
      });
    }
  });
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchmove', handleResize);
  document.removeEventListener('touchend', stopResize);
  document.body.style.userSelect = ''; // Restore text selection

  if (resizeThrottle) {
    cancelAnimationFrame(resizeThrottle);
    resizeThrottle = null;
  }
};

const setupResizeObserver = () => {
  if (!rendererCanvas.value || typeof ResizeObserver === 'undefined') return;

  resizeObserver.value = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === rendererCanvas.value) {
        const containerRect = entry.contentRect;
        if (containerRect.width > 0 && containerRect.height > 0) {
          // Update renderer size
          const { renderer } = useThree();
          renderer.setSize(containerRect.width, containerRect.height);

          // Update viewport regions
          viewports.value.forEach((viewport, index) => {
            viewport.updateRegion(getActualViewportRegion(index, containerRect as DOMRect));
          });
        }
        break;
      }
    }
  });

  resizeObserver.value.observe(rendererCanvas.value);
};

const cleanup = () => {
  const { mainViewport } = useThree();
  stopRendering();
  viewports.value.forEach((viewport) => plansManagerStore.resetPlans(viewport));
  plansManagerStore.resetPlans(mainViewport);

  // Dispose all viewports
  viewports.value.forEach((viewport) => viewport.dispose());
  viewports.value = [];

  // Clean up resize observer
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }
};

const resetRenderer = () => {
  const { container, renderer, render, setRender } = useThree();
  if (container) {
    setRender(false);
    // reset scissor test
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    render(true);
  }
};

const render = () => {
  if (!isRendering.value) return;

  // Calculate delta once per frame
  const delta = clock.getDelta();

  // Render each viewport with the same delta
  viewports.value.forEach((viewport) => {
    if (viewport) {
      viewport.render(delta);
    }
  });

  if (isRendering.value) {
    requestAnimationFrame(render);
  }
};

const stopRendering = () => {
  isRendering.value = false;
};

const initRenderer = async () => {
  if (!rendererCanvas.value) return;

  // Wait for DOM to be fully rendered
  await nextTick();

  // Get actual container dimensions
  const containerRect = rendererCanvas.value.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) {
    // Container not ready yet, wait a bit more
    setTimeout(() => initRenderer(), 100);
    return;
  }

  // Ensure plans manager is initialized
  if (!plansManagerStore.isInitialized) {
    console.warn('PlansManager not initialized');
    return;
  }

  // Clean up any existing renderer and viewports
  cleanup();

  const { renderer, setRender, addSubViewport } = useThree();
  setRender(true);
  // Only append if not already in the canvas
  if (!rendererCanvas.value.contains(renderer.domElement)) {
    rendererCanvas.value.appendChild(renderer.domElement);
  }

  // Ensure renderer is sized to container
  renderer.setSize(containerRect.width, containerRect.height);

  // Initialize viewports with actual container dimensions and layer configurations
  viewportConfigs.forEach((config, index) => {
    const viewport = new Viewport({
      ...config,
      renderer: renderer,
      region: getActualViewportRegion(index, containerRect),
      container: rendererCanvas.value!,
      margin: 10,
      visibleLayers: config.visibleLayers, // Pass layer configuration
    });
    viewports.value.push(markRaw(viewport));
    addSubViewport(viewport);

    // Log viewport configuration for debugging
    console.log(
      `Viewport ${index + 1} (${config.name}): Layers ${config.visibleLayers?.length ? config.visibleLayers.join(', ') : 'All'}`
    );
  });

  // Set up resize observer for dynamic size changes
  setupResizeObserver();

  // Start rendering
  isRendering.value = true;
  render();
};

// Watch for display changes to initialize renderer
watch(
  display,
  (newDisplay) => {
    if (newDisplay) {
      // Wait for next tick to ensure canvas is mounted
      nextTick(() => {
        initRenderer();
      });
    } else {
      cleanup();
      resetRenderer();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (display.value) {
    initRenderer();
  }
  // Set CSS variables
  document.documentElement.style.setProperty(
    '--bottom-panel-height',
    `${bottomPanelHeight.value}px`
  );
  document.documentElement.style.setProperty('--left-panel-width', `${leftPanelWidth.value}px`);
});

// Watch for size changes
watch(
  () => size.value,
  () => {
    // Update viewport regions using actual container dimensions if available
    if (rendererCanvas.value) {
      const containerRect = rendererCanvas.value.getBoundingClientRect();
      if (containerRect.width > 0 && containerRect.height > 0) {
        viewports.value.forEach((viewport, index) => {
          viewport.updateRegion(getActualViewportRegion(index, containerRect));
        });
        return;
      }
    }

    // Fallback to size prop if container dimensions not available
    viewports.value.forEach((viewport, index) => {
      viewport.updateRegion(getViewportRegion(index));
    });
  },
  { deep: true }
);

// Watch for plan selection changes and update viewports
watch(
  () => planViewsAndSpaces.value?.visiblePlanId,
  async (newPlanId) => {
    if (plansManagerStore.isInitialized && planViewsAndSpaces.value && newPlanId !== undefined) {
      await Promise.all(
        viewports.value.map((viewport) => planViewsAndSpaces.value?.goToPlan(newPlanId, viewport))
      );
      // Emit plan change event for external components (like X-Ray manager)
      emit('planChanged', newPlanId);
    }
  }
);

/**
 * Initialize geometry cache store and assign IFCSPACE objects to layer 0 (room level 1)
 */
const initializeGeometryAndLayers = async () => {
  if (!plansManagerStore.isInitialized) {
    console.warn('PlansManager not initialized for layer assignment');
    return;
  }

  const fragmentsModels = ifcStore.getFragmentsModels();
  if (!fragmentsModels?.models?.list) return;

  const currentModel = fragmentsModels.models.list.values().next().value;
  if (!currentModel) return;

  try {
    // Initialize geometry cache store first
    const geometryCacheStore = useGeometryCacheStore();
    geometryCacheStore.initialize(currentModel);

    // Get all IFCSPACE objects (rooms)
    const spaces = await currentModel.getItemsOfCategory('IFCSPACE');
    if (!spaces) {
      console.log('No IFCSPACE objects found');
      return;
    }

    console.log('🏗️ Assigning IFCSPACE objects to layer 0 (room level 1)...');
    let assignedCount = 0;

    // Assign all IFCSPACE objects to layer 0 (room level 1)
    for (const [_, space] of Object.entries(spaces)) {
      const spaceData = space as any;
      const spaceId = spaceData._localId;

      // Find the Three.js mesh for this space
      const mesh = findMeshByIfcId(currentModel, spaceId);
      if (mesh) {
        mesh.layers.set(0); // All IFCSPACE objects go to layer 0 (room level 1)
        assignedCount++;
      }
    }

    console.log(`✅ IFCSPACE assignment completed: ${assignedCount} rooms assigned to layer 0`);
    console.log(`✅ Geometry cache store initialized successfully`);
  } catch (error) {
    console.error('❌ Error initializing geometry and layers:', error);
  }
};

/**
 * Extract layer number from storey name
 */
// const extractLayerFromStoreyName = (name: string): number | null => {
//   // Common patterns for floor/level naming
//   const patterns = [
//     /level\s*(\d+)/i,
//     /floor\s*(\d+)/i,
//     /storey\s*(\d+)/i,
//     /l\s*0*(\d+)/i,
//     /^(\d+)(?:st|nd|rd|th)?\s*floor/i,
//     /(\d+)/, // Fallback: any number
//   ];

//   for (const pattern of patterns) {
//     const match = name.match(pattern);
//     if (match) {
//       return parseInt(match[1], 10);
//     }
//   }

//   return null;
// };

/**
 * Find Three.js mesh by IFC ID using fragments
 */
const findMeshByIfcId = (model: any, ifcId: number): THREE.Mesh | null => {
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
};

// Initialize layer assignment when model is loaded
watch(
  () => ifcStore.isLoaded,
  async (isLoaded) => {
    if (isLoaded && plansManagerStore.isInitialized) {
      // Delay to ensure model is fully processed
      setTimeout(initializeGeometryAndLayers, 1500);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  cleanup();
  resetRenderer();
  viewports.value.forEach((viewport) => useThree().removeSubViewport(viewport));
  // Clean up resize event listeners
  stopResize();
  stopVerticalResize();
});

// Helper to get pixel region for each viewport using actual container dimensions
const getActualViewportRegion = (index: number, containerRect: DOMRect) => {
  // 3 viewports in a row
  const total = 3;
  const width = containerRect.width / total;
  const height = containerRect.height; // Use full container height since it's already the canvas area
  const x = index * width;
  const y = 0;
  const region = {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
  return region;
};

// Helper to get pixel region for each viewport
const getViewportRegion = (index: number) => {
  // 3 viewports in a row
  const total = 3;
  const width = size.value.width / total;
  const height = size.value.height - bottomPanelHeight.value - 30;
  const x = index * width;
  const y = 0;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
};

const startVerticalResize = (event: MouseEvent | TouchEvent) => {
  isVerticalResizing.value = true;

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  verticalResizeStartX.value = clientX;
  verticalResizeStartWidth.value = leftPanelWidth.value;

  document.addEventListener('mousemove', handleVerticalResize, { passive: false });
  document.addEventListener('mouseup', stopVerticalResize);
  document.addEventListener('touchmove', handleVerticalResize, { passive: false });
  document.addEventListener('touchend', stopVerticalResize);
  document.body.style.userSelect = 'none'; // Prevent text selection during drag
  event.preventDefault();
};

let verticalResizeThrottle: number | null = null;

const handleVerticalResize = (event: MouseEvent | TouchEvent) => {
  if (!isVerticalResizing.value) return;

  event.preventDefault();

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const deltaX = clientX - verticalResizeStartX.value;
  const newWidth = verticalResizeStartWidth.value + deltaX;

  const minWidth = 200;
  const maxWidth = 600;

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, newWidth));

  // Throttle CSS updates
  if (verticalResizeThrottle) {
    cancelAnimationFrame(verticalResizeThrottle);
  }

  verticalResizeThrottle = requestAnimationFrame(() => {
    // Update CSS variable for left panel width
    document.documentElement.style.setProperty('--left-panel-width', `${leftPanelWidth.value}px`);
  });
};

const stopVerticalResize = () => {
  isVerticalResizing.value = false;
  document.removeEventListener('mousemove', handleVerticalResize);
  document.removeEventListener('mouseup', stopVerticalResize);
  document.removeEventListener('touchmove', handleVerticalResize);
  document.removeEventListener('touchend', stopVerticalResize);
  document.body.style.userSelect = ''; // Restore text selection

  if (verticalResizeThrottle) {
    cancelAnimationFrame(verticalResizeThrottle);
    verticalResizeThrottle = null;
  }
};

/**
 * Add a new object to a specific layer
 * @param object - Three.js object to add
 * @param layer - Layer number (0 = base, 1 = layer 1, 2 = layer 2)
 */
const addObjectToLayer = (object: THREE.Object3D, layer: number) => {
  object.layers.set(layer);
  console.log(`🎯 Added object to layer ${layer}:`, object.name || object.type);

  // Add to scene if not already added
  const scene = useThree().scene;
  if (!object.parent) {
    scene.add(object);
  }

  // Force render update
  const { render } = useThree();
  render(true);
};

/**
 * Create a test object for layer testing
 * @param layer - Layer number to assign the object to
 * @param position - Position for the test object
 */
const createTestObjectOnLayer = (layer: number, position: THREE.Vector3) => {
  // Create a simple colored cube for testing
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const colors = [
    0x808080, // Layer 0 - Gray (base)
    0xff4444, // Layer 1 - Red
    0x4444ff, // Layer 2 - Blue
  ];

  const material = new THREE.MeshBasicMaterial({
    color: colors[layer] || 0x888888,
    transparent: true,
    opacity: 0.8,
  });

  const cube = new THREE.Mesh(geometry, material);
  cube.position.copy(position);
  cube.name = `Test_Layer_${layer}`;

  addObjectToLayer(cube, layer);

  return cube;
};

// Expose methods for external control and layer management
defineExpose({
  viewports,
  display,
  handleDisplayChange: (value: boolean) => {
    display.value = value;
  },
  // Layer management methods
  addObjectToLayer,
  createTestObjectOnLayer,
  getViewportByIndex: (index: number) => viewports.value[index],
});
</script>

<style scoped>
.viewport-panel {
  width: 100%;
  height: 100%;
  background: #181818;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.viewport-main-row {
  flex: 1 1 auto;
  display: flex;
  position: relative;
  min-height: 200px;
  height: calc(100% - var(--bottom-panel-height));
  transition: height 0.1s ease;
}

.viewport-panel:has(.resize-handle.resizing) .viewport-main-row {
  transition: none; /* Disable transition during resize */
}

.viewport-canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #222;
  border-bottom: 1px solid #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewport-labels {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.viewport-label {
  position: absolute;
  top: 10px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #444;
  backdrop-filter: blur(4px);
}

.label-text {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.resize-handle {
  width: 100%;
  height: 10px;
  background: transparent;
  cursor: ns-resize;
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.resize-handle:hover .resize-handle-line {
  background: #555;
  height: 3px;
}

.resize-handle.resizing .resize-handle-line {
  background: #007acc;
  height: 4px;
  transition: none; /* Disable transition during resize */
}

.resize-handle-line {
  width: 100%;
  height: 2px;
  background: #333;
  transition: all 0.2s ease;
}

.viewport-bottom-bar {
  display: flex;
  flex-direction: row;
  height: var(--bottom-panel-height);
  min-height: var(--bottom-panel-height);
  background: #232323;
  border-top: 1px solid #333;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
  transition: height 0.1s ease;
}

.viewport-panel:has(.resize-handle.resizing) .viewport-bottom-bar {
  transition: none; /* Disable transition during resize */
}

.viewport-bottom-left {
  background: #252525;
  border-right: 1px solid #333;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-shrink: 0;
  width: var(--left-panel-width, 300px);
  height: 100%;
  overflow: hidden;
  position: relative;
  transition: width 0.1s ease;
}

.viewport-panel:has(.vertical-resize-handle.resizing) .viewport-bottom-left {
  transition: none; /* Disable transition during resize */
}

.viewport-bottom-content {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #232323;
  min-width: 0;
}

.placeholder {
  color: #888;
  font-size: 1.1rem;
  padding: 1.5rem;
  text-align: center;
  user-select: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.01);
  width: 100%;
}

.vertical-resize-handle {
  width: 10px;
  height: 100%;
  background: transparent;
  cursor: ew-resize;
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vertical-resize-handle:hover .vertical-resize-handle-line {
  background: #555;
  width: 3px;
}

.vertical-resize-handle.resizing .vertical-resize-handle-line {
  background: #007acc;
  width: 4px;
  transition: none; /* Disable transition during resize */
}

.vertical-resize-handle-line {
  width: 2px;
  height: 100%;
  background: #333;
  transition: all 0.2s ease;
}
</style>

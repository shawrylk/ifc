<template>
  <DraggablePanel
    title="Viewports"
    v-model:display="display"
    v-model:position="position"
    :size="size"
    @update:display="handleDisplayChange"
  >
    <section class="viewport-panel">
      <div class="viewport-main-row">
        <div ref="rendererCanvas" class="viewport-canvas-container"></div>
      </div>
      <footer class="viewport-bottom-bar">
        <aside class="viewport-bottom-left">
          <PlanViewsAndSpaces
            ref="planViewsAndSpaces"
            :plansManager="plansManager"
            @plansGenerated="handlePlansGenerated"
          />
        </aside>
        <div class="viewport-bottom-content">
          <div class="placeholder">Bottom Panel</div>
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
import PlanViewsAndSpaces from './children/PlanViewsAndSpaces.vue';
import { PlansManager } from '@/composables/PlansManager';
import { useIFCStore } from '@/stores/ifcStore';

interface ViewportInitialConfig {
  initialPosition?: THREE.Vector3;
  initialTarget?: THREE.Vector3;
}

const props = defineProps<{
  position?: { x: number; y: number };
  display?: boolean;
  size?: { width: number; height: number };
}>();

const emit = defineEmits<{
  (e: 'update:position', value: { x: number; y: number }): void;
  (e: 'update:display', value: boolean): void;
}>();

const BOTTOM_PANEL_HEIGHT = 550;
const display = ref(props.display ?? false);
const position = ref(props.position ?? { x: 10, y: 10 });
const size = ref(props.size ?? { width: 1400, height: 900 });
const rendererCanvas = ref<HTMLCanvasElement | null>(null);
const planViewsAndSpaces = ref<InstanceType<typeof PlanViewsAndSpaces> | null>(null);
const viewports = shallowRef<Viewport[]>([]);
const isRendering = ref(true);
const plansManager = ref<any>(null);
const plans = ref<any[]>([]);
const clock = new THREE.Clock();
const ifcStore = useIFCStore();

// Configure viewports with initial positions
const viewportConfigs: ViewportInitialConfig[] = [
  { initialPosition: new THREE.Vector3(0, 10, 0), initialTarget: new THREE.Vector3(0, 0, 0) },
  { initialPosition: new THREE.Vector3(0, 10, 0), initialTarget: new THREE.Vector3(0, 0, 0) },
  { initialPosition: new THREE.Vector3(0, 10, 0), initialTarget: new THREE.Vector3(0, 0, 0) },
];

const handleDisplayChange = (value: boolean) => {
  display.value = value;
  emit('update:display', value);
};

const handlePlansGenerated = (generatedPlans: any[]) => {
  plans.value = generatedPlans;
};

const cleanup = () => {
  const { mainViewport } = useThree();
  stopRendering();
  viewports.value.forEach((viewport) => plansManager.value?.reset(viewport));
  plansManager.value?.reset(mainViewport);

  // Dispose all viewports
  viewports.value.forEach((viewport) => viewport.dispose());
  viewports.value = [];
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

const loadPlanViews = async (): Promise<PlansManager | null> => {
  if (plansManager.value) return plansManager.value;

  const { getFragmentsModels } = useIFCStore();
  const fragmentsModels = getFragmentsModels();
  if (!fragmentsModels) return null;

  const newPlansManager = new PlansManager(fragmentsModels);
  plansManager.value = newPlansManager;
  return newPlansManager;
};

const initRenderer = async () => {
  if (!rendererCanvas.value) return;

  // Load plans manager first
  plansManager.value = await loadPlanViews();

  // Clean up any existing renderer and viewports
  cleanup();

  const { renderer, setRender } = useThree();
  setRender(true);
  // Only append if not already in the canvas
  if (!rendererCanvas.value.contains(renderer.domElement)) {
    rendererCanvas.value.appendChild(renderer.domElement);
  }

  // Initialize viewports
  viewportConfigs.forEach((config) => {
    const viewport = new Viewport({
      ...config,
      renderer: renderer,
      region: getViewportRegion(viewports.value.length),
      container: rendererCanvas.value!,
    });
    viewports.value.push(markRaw(viewport));
  });

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
  document.documentElement.style.setProperty('--bottom-panel-height', `${BOTTOM_PANEL_HEIGHT}px`);
});

// Watch for size changes
watch(
  () => size.value,
  () => {
    // Update viewport regions
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
    if (plansManager.value && planViewsAndSpaces.value && newPlanId !== undefined) {
      await Promise.all(
        viewports.value.map((viewport) => planViewsAndSpaces.value?.goToPlan(newPlanId, viewport))
      );
    }
  }
);

onUnmounted(() => {
  cleanup();
  resetRenderer();
});

// Helper to get pixel region for each viewport
const getViewportRegion = (index: number) => {
  // 3 viewports in a row
  const total = 3;
  const margin = 10;
  const width = size.value.width / total - margin;
  const height = size.value.height - BOTTOM_PANEL_HEIGHT - 30;
  const x = index * (width + margin);
  const y = 0;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
};

// Expose methods for external control
defineExpose({
  viewports,
  handleDisplayChange,
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
}

.viewport-main-row {
  flex: 1 1 auto;
  display: flex;
  position: relative;
  min-height: 0;
  max-height: calc(100% - var(--bottom-panel-height));
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

.viewport-bottom-bar {
  display: flex;
  flex-direction: row;
  height: var(--bottom-panel-height);
  min-height: var(--bottom-panel-height);
  background: #232323;
  border-top: 1px solid #333;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.viewport-bottom-left {
  background: #252525;
  border-right: 1px solid #333;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-shrink: 0;
  width: 300px;
  height: 100%;
  overflow: hidden;
  position: relative;
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
</style>

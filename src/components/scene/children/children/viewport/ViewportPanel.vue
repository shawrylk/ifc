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
          <div class="placeholder">Left Panel</div>
        </aside>
        <div class="viewport-bottom-content">
          <div class="placeholder">Bottom Panel</div>
        </div>
      </footer>
    </section>
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import * as THREE from 'three';
import { Viewport } from '../../../../../composables/Viewport';
import { markRaw } from 'vue';
import { useThree } from '@/stores/threeStore';

interface ViewportInitialConfig {
  initialPosition?: { x: number; y: number; z: number };
  initialTarget?: { x: number; y: number; z: number };
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
const LEFT_PANEL_WIDTH = 300;
const display = ref(props.display ?? false);
const position = ref(props.position ?? { x: 10, y: 10 });
const size = ref(props.size ?? { width: 1400, height: 900 });
const rendererCanvas = ref<HTMLCanvasElement | null>(null);
const viewports = ref<Viewport[]>([]);
const isRendering = ref(true);
const clock = new THREE.Clock();
const controlsEnabled = ref<boolean[]>([]);

// Configure viewports with initial positions
const viewportConfigs: ViewportInitialConfig[] = [
  { initialPosition: { x: 0, y: 5, z: 0 }, initialTarget: { x: 0, y: 0, z: 0 } },
  { initialPosition: { x: 0, y: 5, z: 0 }, initialTarget: { x: 0, y: 0, z: 0 } },
  { initialPosition: { x: 0, y: 5, z: 0 }, initialTarget: { x: 0, y: 0, z: 0 } },
];

const handleDisplayChange = (value: boolean) => {
  display.value = value;
  emit('update:display', value);
};

const cleanup = () => {
  stopRendering();

  // Dispose all viewports
  viewports.value.forEach((viewport) => viewport.dispose());
  viewports.value = [];
  controlsEnabled.value = [];
};

const resetRenderer = () => {
  const { container, renderer, render, toggleRender } = useThree();
  if (container) {
    toggleRender(false);
    // reset scissor test
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    // first, for re-render
    render(true);
    // second, start rendering loop
    render();
  }
};

const render = () => {
  if (!isRendering.value) return;

  const delta = clock.getDelta();

  // Render each viewport
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

  // Clean up any existing renderer and viewports
  cleanup();

  const { renderer, toggleRender } = useThree();
  toggleRender(true);
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
    controlsEnabled.value.push(false);
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
  document.documentElement.style.setProperty('--left-panel-width', `${LEFT_PANEL_WIDTH}px`);
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
  const height = size.value.height - BOTTOM_PANEL_HEIGHT;
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
  width: var(--left-panel-width);
  min-width: var(--left-panel-width);
  background: #252525;
  border-right: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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

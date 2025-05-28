<template>
  <div v-if="display" class="draggable-panel" :style="panelStyle">
    <div class="panel-header" @mousedown="startDrag">
      <div class="panel-title">{{ title }}</div>
      <div class="panel-controls">
        <button class="control-btn" @click="close">✕</button>
      </div>
    </div>
    <div class="panel-content">
      <slot></slot>
    </div>
    <div class="resize-handle resize-handle-e" @mousedown="startResize('e', $event)"></div>
    <div class="resize-handle resize-handle-s" @mousedown="startResize('s', $event)"></div>
    <div class="resize-handle resize-handle-se" @mousedown="startResize('se', $event)"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue';

const props = defineProps<{
  title: string;
  display: boolean;
  position?: { x: number; y: number };
}>();

const emit = defineEmits<{
  (e: 'update:display', value: boolean): void;
  (e: 'update:position', value: { x: number; y: number }): void;
}>();

const position = ref(props.position || { x: 10, y: 20 });
const size = ref({ width: 320, height: 400 });
const isDragging = ref(false);
const isResizing = ref(false);
const resizeDirection = ref<'e' | 's' | 'se' | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 });

// Watch for changes to the position prop
watch(
  () => props.position,
  (newPosition) => {
    if (newPosition) {
      position.value = { ...newPosition };
    }
  },
  { immediate: true }
);

const panelStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px)`,
  width: `${size.value.width}px`,
  height: `${size.value.height}px`,
}));

const startDrag = (e: MouseEvent) => {
  if (
    !(e.target as HTMLElement).closest('.panel-header') ||
    (e.target as HTMLElement).closest('.control-btn')
  ) {
    return;
  }

  e.preventDefault();
  isDragging.value = true;
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  };

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const startResize = (direction: 'e' | 's' | 'se', e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  isResizing.value = true;
  resizeDirection.value = direction;
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: size.value.width,
    height: size.value.height,
  };

  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
};

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return;

  e.preventDefault();
  const newPosition = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y,
  };
  position.value = newPosition;
  emit('update:position', newPosition);
};

const onResize = (e: MouseEvent) => {
  if (!isResizing.value || !resizeDirection.value) return;

  e.preventDefault();
  e.stopPropagation();

  const deltaX = e.clientX - resizeStart.value.x;
  const deltaY = e.clientY - resizeStart.value.y;

  if (resizeDirection.value.includes('e')) {
    size.value.width = Math.max(320, resizeStart.value.width + deltaX);
  }
  if (resizeDirection.value.includes('s')) {
    size.value.height = Math.max(200, resizeStart.value.height + deltaY);
  }
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};

const stopResize = () => {
  isResizing.value = false;
  resizeDirection.value = null;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
};

const close = () => {
  emit('update:display', false);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
});
</script>

<style scoped>
.draggable-panel {
  position: absolute;
  top: 40px;
  left: 10px;
  background: black;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  min-width: 320px;
  min-height: 200px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0px 12px;
  background: #1a1a1a;
  border-radius: 4px 4px 0 0;
  cursor: move;
  user-select: none;
  height: 32px;
  flex-shrink: 0;
}

.panel-title {
  font-weight: 500;
  font-size: 14px;
  color: #fff;
  user-select: none;
}

.panel-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.2s;
  user-select: none;
}

.control-btn:hover {
  opacity: 1;
}

.panel-content {
  padding: 12px;
  overflow-y: auto;
  overflow-x: auto;
  flex-grow: 1;
}

.resize-handle {
  position: absolute;
  background: transparent;
  z-index: 1001;
  transition: background-color 0.2s;
}

.resize-handle-e {
  right: -2px;
  top: 0;
  width: 4px;
  height: 100%;
  cursor: e-resize;
}

.resize-handle-s {
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 4px;
  cursor: s-resize;
}

.resize-handle-se {
  right: -2px;
  bottom: -2px;
  width: 8px;
  height: 8px;
  cursor: se-resize;
}

.resize-handle:hover,
.resize-handle:active {
  background: rgba(255, 255, 255, 0.2);
}
</style>

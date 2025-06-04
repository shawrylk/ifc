<template>
  <div class="scene">
    <div ref="viewerContainer" class="viewer-container"></div>
    <IFCViewer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useThree } from '@/stores/threeStore';
import IFCViewer from './children/IFCViewer/IFCViewer.vue';

const { initialize, handleResize, dispose } = useThree();
const viewerContainer = ref<HTMLElement | null>(null);

const resize = () => {
  if (!viewerContainer.value) return;
  handleResize(viewerContainer.value);
};

onMounted(() => {
  if (!viewerContainer.value) return;
  initialize(viewerContainer.value);
  window.addEventListener('resize', resize);
});

onUnmounted(() => {
  dispose();
  window.removeEventListener('resize', resize);
});
</script>

<style scoped>
.scene {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.viewer-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
}
</style>

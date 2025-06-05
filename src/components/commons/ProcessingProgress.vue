<template>
  <div v-if="isVisible" class="processing-progress">
    <div class="progress-content">
      <div class="progress-info">
        <i class="pi pi-spin pi-spinner"></i>
        <span class="progress-text">{{ message }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
      <div class="progress-stats">{{ completed }}/{{ total }} wireframes ready</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  completed: number;
  total: number;
  isProcessing: boolean;
  autoHide?: boolean; // Auto-hide when completed
}>();

const progress = computed(() => {
  return props.total > 0 ? Math.round((props.completed / props.total) * 100) : 0;
});

const message = computed(() => {
  if (props.completed === props.total && props.total > 0) {
    return 'All wireframes ready';
  }
  return 'Processing wireframes...';
});

const isVisible = computed(() => {
  if (props.autoHide && props.completed === props.total && props.total > 0) {
    return false; // Hide when completed if autoHide is true
  }
  return props.total > 0 && (props.isProcessing || props.completed < props.total);
});
</script>

<style scoped>
.processing-progress {
  position: fixed;
  top: 60px;
  right: 20px;
  background: rgba(35, 35, 35, 0.95);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 280px;
  z-index: 1000;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e0e0e0;
  font-size: 0.9rem;
}

.progress-text {
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #444;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007acc, #39ff14);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-stats {
  color: #aaa;
  font-size: 0.8rem;
  text-align: center;
}

.pi-spinner {
  color: #007acc;
  font-size: 1rem;
}
</style>

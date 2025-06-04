<template>
  <div class="plan-views-and-spaces">
    <PlanViewsPanel
      ref="planViewsPanel"
      :plansManager="plansManager"
      :height="planViewHeight"
      @plansGenerated="handlePlansGenerated"
      @planChanged="handlePlanChanged"
    />
    <div class="resize-handle" @mousedown="startResize" @touchstart="startResize">
      <div class="resize-handle-line"></div>
    </div>
    <SpacesPanel
      :plansManager="plansManager"
      :visiblePlanId="visiblePlanId"
      :height="spacesHeight"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import PlanViewsPanel from './children/PlanViewsPanel.vue';
import SpacesPanel from './children/SpacesPanel.vue';

defineProps<{
  plansManager: any;
}>();

const emit = defineEmits<{
  (e: 'plansGenerated', plans: any[]): void;
}>();

const planViewsPanel = ref<InstanceType<typeof PlanViewsPanel> | null>(null);
const planViewHeight = ref(200);
const spacesHeight = ref(300);
const isResizing = ref(false);
const visiblePlanId = ref<number | null>(null);

const handlePlansGenerated = (plans: any[]) => {
  emit('plansGenerated', plans);
};

const handlePlanChanged = (planId: number | null) => {
  visiblePlanId.value = planId;
};

const startResize = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isResizing.value = true;

  const startY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  const startPlanHeight = planViewHeight.value;
  const startSpacesHeight = spacesHeight.value;
  const totalHeight = startPlanHeight + startSpacesHeight;

  const onResize = (moveEvent: MouseEvent | TouchEvent) => {
    if (!isResizing.value) return;
    moveEvent.preventDefault();

    const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
    const deltaY = currentY - startY;

    // Calculate new heights ensuring they stay within bounds and maintain total
    let newPlanHeight = startPlanHeight + deltaY;
    let newSpacesHeight = startSpacesHeight - deltaY;

    // Apply constraints
    const minHeight = 120;
    const maxPlanHeight = totalHeight - minHeight;
    // const maxSpacesHeight = totalHeight - minHeight;

    newPlanHeight = Math.max(minHeight, Math.min(maxPlanHeight, newPlanHeight));
    newSpacesHeight = totalHeight - newPlanHeight;

    planViewHeight.value = Math.round(newPlanHeight);
    spacesHeight.value = Math.round(newSpacesHeight);
  };

  const stopResize = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', onResize);
    document.removeEventListener('touchend', stopResize);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'row-resize';
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchmove', onResize, { passive: false });
  document.addEventListener('touchend', stopResize);
};

// Expose methods for parent component
defineExpose({
  visiblePlanId: computed(() => visiblePlanId.value),
  generatePlans: () => planViewsPanel.value?.generatePlans(),
  goToPlan: (planId: number | null, viewport?: any) => {
    return planViewsPanel.value?.goToPlan(planId, viewport);
  },
});
</script>

<style scoped>
.plan-views-and-spaces {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.resize-handle {
  flex: 0 0 auto;
  width: 100%;
  height: 8px;
  background: #333;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  position: relative;
  z-index: 10;
  user-select: none;
}

.resize-handle:hover {
  background: #444;
}

.resize-handle:active {
  background: #555;
}

.resize-handle-line {
  width: 60%;
  height: 2px;
  background: #888;
  border-radius: 1px;
  pointer-events: none;
}
</style>

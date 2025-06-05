<template>
  <DraggablePanel
    title="Plan Views"
    v-model:display="display"
    v-model:position="position"
    :size="{ width: 400, height: 400 }"
    @update:display="handleDisplayChange"
  >
    <PlanViewsList :plans="plans" v-model:visiblePlanId="visiblePlanId" />
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import PlanViewsList from './children/PlanViewsList.vue';
import { useIFCStore } from '@/stores/ifcStore';
import { useXRayStore } from '@/stores/xrayStore';
import { usePlansManagerStore } from '@/stores/plansManagerStore';

const props = defineProps<{
  position?: { x: number; y: number };
  display?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:position', value: { x: number; y: number }): void;
  (e: 'update:display', value: boolean): void;
}>();

const display = ref(props.display ?? false);
const position = ref(props.position ?? { x: 10, y: 10 });
const ifcStore = useIFCStore();
const xrayStore = useXRayStore();
const plansManagerStore = usePlansManagerStore();
const visiblePlanId = ref<number | null>(null);

// Use computed to get plans from the store
const plans = computed(() => plansManagerStore.plans);

const handleDisplayChange = (value: boolean) => {
  display.value = value;
};

const loadPlans = async () => {
  if (!plansManagerStore.isInitialized) {
    console.warn('PlansManager not initialized');
    return;
  }

  try {
    await plansManagerStore.generatePlans();
  } catch (error) {
    console.error('Error loading plans:', error);
  }
};

const handlePlanClick = async (planId: number | null) => {
  if (!plansManagerStore.isInitialized) {
    console.warn('PlansManager not initialized');
    return;
  }

  try {
    await plansManagerStore.goToPlan(planId);

    // Update XRay wireframe visibility for the selected storey using the store
    xrayStore.updateStoreyWireframeVisibility(planId);
  } catch (error) {
    console.error('Error navigating to plan:', error);
  }
};

watch(visiblePlanId, (newValue) => {
  handlePlanClick(newValue);
});

// Expose properties to parent component
defineExpose({
  position,
  handleDisplayChange,
  loadPlans,
});

watch(position, (newValue) => {
  emit('update:position', newValue);
});

watch(display, (newValue) => {
  emit('update:display', newValue);
});

watch(
  () => ifcStore.isLoaded,
  async (newValue) => {
    if (newValue) {
      await loadPlans();
    }
    // No need to clean up here since the stores handle cleanup
  }
);

onUnmounted(() => {
  // No need to dispose anything here since the stores manage lifecycle
});
</script>

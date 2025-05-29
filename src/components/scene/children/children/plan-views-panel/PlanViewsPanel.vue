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
import { ref, watch } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import PlanViewsList from './children/PlanViewsList.vue';
import { useIFCStore } from '@/stores/ifcStore';
import { PlansManager } from '@/composables/PlansManager';

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
const plans = ref<any[]>([]);
const visiblePlanId = ref<number | null>(null);
const plansManager = ref<PlansManager | null>(null);

const loadPlansManager = () => {
  if (plansManager.value) return plansManager.value;

  const { getFragmentsModels } = ifcStore;
  const fragmentsModels = getFragmentsModels();
  if (!fragmentsModels) return null;

  return (plansManager.value = new PlansManager(fragmentsModels));
};

const handleDisplayChange = (value: boolean) => {
  display.value = value;
};

const loadPlans = async () => {
  const plansManager = loadPlansManager();
  if (!plansManager) return;

  try {
    plans.value = await plansManager.generate();
  } catch (error) {
    console.error('Error loading plans:', error);
  }
};

const handlePlanClick = (planId: number | null) => {
  const plansManager = loadPlansManager();
  if (!plansManager) return;

  try {
    plansManager.goTo(planId);
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
</script>

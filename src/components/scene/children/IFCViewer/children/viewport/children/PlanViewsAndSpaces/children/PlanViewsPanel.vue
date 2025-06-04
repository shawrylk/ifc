<template>
  <div class="plan-views-panel" :style="{ height: height + 'px' }">
    <PlanViewsList v-model:plans="plans" v-model:visiblePlanId="visiblePlanId" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import PlanViewsList from '@/components/scene/children/IFCViewer/children/plan-views-panel/children/PlanViewsList.vue';

const props = defineProps<{
  plansManager: any;
  height: number;
}>();

const emit = defineEmits<{
  (e: 'plansGenerated', plans: any[]): void;
  (e: 'planChanged', planId: number | null): void;
}>();

const plans = ref<any[]>([]);
const visiblePlanId = ref<number | null>(null);

const generatePlans = async () => {
  if (props.plansManager) {
    try {
      const generatedPlans = await props.plansManager.generate();
      plans.value = generatedPlans;
      emit('plansGenerated', generatedPlans);
    } catch (error) {
      console.error('Error generating plans:', error);
    }
  }
};

// Watch for changes in plansManager and generate plans
watch(
  () => props.plansManager,
  (newPlansManager) => {
    if (newPlansManager) {
      generatePlans();
    }
  },
  { immediate: true }
);

// Watch for plan selection changes
watch(visiblePlanId, (newPlanId) => {
  emit('planChanged', newPlanId);
});

// Expose methods for parent component
defineExpose({
  visiblePlanId,
  generatePlans,
  goToPlan: (planId: number | null, viewport?: any) => {
    if (props.plansManager) {
      return props.plansManager.goTo(planId, viewport);
    }
  },
});
</script>

<style scoped>
.plan-views-panel {
  flex: 0 0 auto;
  background: #252525;
  overflow-y: auto;
  position: relative;
  border-bottom: 1px solid #333;
}
</style>

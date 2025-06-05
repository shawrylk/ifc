import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PlansManager, Plan } from '@/composables/PlansManager';
import { FragmentsModels } from '@thatopen/fragments';
import { Viewport } from '@/composables/Viewport';

export const usePlansManagerStore = defineStore('plansManagerStore', () => {
  const plansManager = ref<PlansManager | null>(null);
  const plans = ref<Plan[]>([]);
  const isInitialized = ref(false);
  const currentPlanId = ref<number | null>(null);

  /**
   * Initialize the PlansManager with FragmentsModels
   */
  const initialize = (fragmentsModels: FragmentsModels) => {
    // Dispose existing instance if any
    if (plansManager.value) {
      dispose();
    }

    // Create new PlansManager instance
    plansManager.value = new PlansManager(fragmentsModels);
    isInitialized.value = true;
    plans.value = [];
    currentPlanId.value = null;
  };

  /**
   * Generate plans from the current model
   */
  const generatePlans = async (): Promise<Plan[]> => {
    if (!plansManager.value) {
      console.warn('PlansManager not initialized');
      return [];
    }

    try {
      const generatedPlans = await plansManager.value.generate();
      plans.value = generatedPlans;
      return generatedPlans;
    } catch (error) {
      console.error('Error generating plans:', error);
      return [];
    }
  };

  /**
   * Navigate to a specific plan
   */
  const goToPlan = async (planId: number | null, viewport?: Viewport): Promise<void> => {
    if (!plansManager.value) {
      console.warn('PlansManager not initialized');
      return;
    }

    try {
      await plansManager.value.goTo(planId, viewport);
      currentPlanId.value = planId;
    } catch (error) {
      console.error('Error navigating to plan:', error);
    }
  };

  /**
   * Reset viewport to show all plans
   */
  const resetPlans = async (viewport: Viewport | null): Promise<void> => {
    if (!plansManager.value) {
      console.warn('PlansManager not initialized');
      return;
    }

    try {
      await plansManager.value.reset(viewport);
      currentPlanId.value = null;
    } catch (error) {
      console.error('Error resetting plans:', error);
    }
  };

  /**
   * Get storey information by plan ID
   */
  const getStorey = (planId: number) => {
    if (!plansManager.value) {
      console.warn('PlansManager not initialized');
      return null;
    }

    return plansManager.value.getStorey(planId);
  };

  /**
   * Get plan by ID
   */
  const getPlanById = (planId: number): Plan | null => {
    return plans.value.find((plan) => parseInt(plan.id) === planId) || null;
  };

  /**
   * Get all available plans
   */
  const getAllPlans = (): Plan[] => {
    return plans.value;
  };

  /**
   * Check if plans are loaded
   */
  const hasPlans = (): boolean => {
    return plans.value.length > 0;
  };

  /**
   * Get current plan ID
   */
  const getCurrentPlanId = (): number | null => {
    return currentPlanId.value;
  };

  /**
   * Get the PlansManager instance (for advanced usage)
   */
  const getManager = (): PlansManager | null => {
    return plansManager.value as PlansManager | null;
  };

  /**
   * Dispose the PlansManager and clear all data
   */
  const dispose = () => {
    plansManager.value = null;
    plans.value = [];
    currentPlanId.value = null;
    isInitialized.value = false;
  };

  return {
    // State
    plansManager,
    plans,
    isInitialized,
    currentPlanId,

    // Methods
    initialize,
    generatePlans,
    goToPlan,
    resetPlans,
    getStorey,
    getPlanById,
    getAllPlans,
    hasPlans,
    getCurrentPlanId,
    getManager,
    dispose,
  };
});

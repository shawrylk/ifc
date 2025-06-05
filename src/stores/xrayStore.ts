import { defineStore } from 'pinia';
import { ref } from 'vue';
import { XRayManager } from '@/composables/XRayManager';
import { PlansManager } from '@/composables/PlansManager';
import { FragmentsModels } from '@thatopen/fragments';

export const useXRayStore = defineStore('xrayStore', () => {
  const xrayManager = ref<XRayManager | null>(null);
  const isEnabled = ref(false);
  const previousState = ref(false); // Track previous state before forcing
  const isForced = ref(false); // Track if X-ray is currently forced by plan view

  const initialize = async (fragmentsModels: FragmentsModels, plansManager: PlansManager) => {
    // Dispose existing instance if any
    if (xrayManager.value) {
      xrayManager.value.dispose();
    }

    // Create new XRayManager instance
    xrayManager.value = new XRayManager(fragmentsModels, plansManager);
    await xrayManager.value.initialize();
    isEnabled.value = false;
    isForced.value = false;
    previousState.value = false;
  };

  const toggleXRay = (): boolean => {
    if (!xrayManager.value) return false;

    // Only allow manual toggle if not forced by plan view
    if (isForced.value) return isEnabled.value;

    isEnabled.value = xrayManager.value.toggleXRay();
    return isEnabled.value;
  };

  const forceXRayOn = () => {
    if (!xrayManager.value) return;

    // Save current state before forcing
    if (!isForced.value) {
      previousState.value = isEnabled.value;
      isForced.value = true;
    }

    // Force X-ray on if not already enabled
    if (!isEnabled.value) {
      isEnabled.value = xrayManager.value.toggleXRay();
    }
  };

  const restorePreviousXRayState = () => {
    if (!xrayManager.value || !isForced.value) return;

    // Restore to previous state
    if (isEnabled.value !== previousState.value) {
      isEnabled.value = xrayManager.value.toggleXRay();
    }

    isForced.value = false;
  };

  const updateStoreyWireframeVisibility = (storeyId: number | null) => {
    if (!xrayManager.value) return;

    if (storeyId !== null) {
      // Entering plan view - force X-ray on
      forceXRayOn();
    } else {
      // Exiting plan view - restore previous state
      restorePreviousXRayState();
    }

    // Update wireframe visibility if X-ray is enabled
    if (isEnabled.value) {
      xrayManager.value.updateStoreyWireframeVisibility(storeyId);
    }
  };

  const dispose = () => {
    if (xrayManager.value) {
      xrayManager.value.dispose();
      xrayManager.value = null;
    }
    isEnabled.value = false;
    isForced.value = false;
    previousState.value = false;
  };

  const getManager = () => xrayManager.value;

  return {
    xrayManager,
    isEnabled,
    isForced,
    initialize,
    toggleXRay,
    forceXRayOn,
    restorePreviousXRayState,
    updateStoreyWireframeVisibility,
    dispose,
    getManager,
  };
});

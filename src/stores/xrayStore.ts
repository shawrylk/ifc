import { defineStore } from 'pinia';
import { ref } from 'vue';
import { XRayManager } from '@/composables/XRayManager';
import { FragmentsModels } from '@thatopen/fragments';
import { useGeometryCacheStore } from '@/stores/geometryCacheStore';
import { usePlansManagerStore } from '@/stores/plansManagerStore';

export const useXRayStore = defineStore('xrayStore', () => {
  const xrayManager = ref<XRayManager | null>(null);
  const isEnabled = ref(false);
  const previousState = ref(false); // Track previous state before forcing
  const isForced = ref(false); // Track if X-ray is currently forced by plan view
  const geometryCache = useGeometryCacheStore();
  const plansManagerStore = usePlansManagerStore();

  // Reactive processing status
  const processingStatus = ref({
    completed: 0,
    total: 0,
    isProcessing: false,
    errors: 0,
    progress: 0,
  });

  // Update processing status from manager
  const updateProcessingStatus = () => {
    if (xrayManager.value) {
      const status = xrayManager.value.getProcessingStatus();
      processingStatus.value = { ...status };
    }
  };

  // Polling interval for processing status updates
  let statusUpdateInterval: number | null = null;

  const startStatusUpdates = () => {
    if (statusUpdateInterval) return; // Already running

    statusUpdateInterval = window.setInterval(() => {
      updateProcessingStatus();

      // Stop polling when processing is complete
      if (!processingStatus.value.isProcessing && processingStatus.value.total > 0) {
        stopStatusUpdates();
      }
    }, 500); // Update every 500ms
  };

  const stopStatusUpdates = () => {
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
      statusUpdateInterval = null;
    }
  };

  const initialize = async (fragmentsModels: FragmentsModels) => {
    // Dispose existing instance if any
    if (xrayManager.value) {
      xrayManager.value.dispose();
    }

    // Reset processing status
    processingStatus.value = {
      completed: 0,
      total: 0,
      isProcessing: false,
      errors: 0,
      progress: 0,
    };

    // Initialize plans manager first
    plansManagerStore.initialize(fragmentsModels);
    const plansManager = plansManagerStore.getManager();

    if (!plansManager) {
      console.error('Failed to initialize PlansManager');
      return;
    }

    // Initialize geometry cache with the first model
    const model = fragmentsModels.models.list.values().next().value;
    if (model) {
      geometryCache.initialize(model as any);
    }

    // Create new XRayManager instance
    xrayManager.value = new XRayManager(fragmentsModels, plansManager);

    // Start status updates before initialization (so we catch the processing)
    startStatusUpdates();

    await xrayManager.value.initialize();

    isEnabled.value = false;
    isForced.value = false;
    previousState.value = false;

    // Initial status update
    updateProcessingStatus();
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
    // Stop status updates
    stopStatusUpdates();

    if (xrayManager.value) {
      xrayManager.value.dispose();
      xrayManager.value = null;
    }
    // Dispose geometry cache
    geometryCache.dispose();
    // Dispose plans manager
    plansManagerStore.dispose();
    isEnabled.value = false;
    isForced.value = false;
    previousState.value = false;

    // Reset processing status
    processingStatus.value = {
      completed: 0,
      total: 0,
      isProcessing: false,
      errors: 0,
      progress: 0,
    };
  };

  const getManager = () => xrayManager.value;

  return {
    xrayManager,
    isEnabled,
    isForced,
    processingStatus,
    initialize,
    toggleXRay,
    forceXRayOn,
    restorePreviousXRayState,
    updateStoreyWireframeVisibility,
    dispose,
    getManager,
  };
});

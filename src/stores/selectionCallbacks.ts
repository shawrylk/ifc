import { defineStore } from 'pinia';
import { ref } from 'vue';

type SelectionCallback = (data: {
  localId: number;
  modelInfo: any;
  // propertySets: any;
  // properties: any;
}) => void;

type DeselectionCallback = () => void;

export const useSelectionCallbacksStore = defineStore('selectionCallbacks', () => {
  const selectionCallbacks = ref<SelectionCallback[]>([]);
  const deselectionCallbacks = ref<DeselectionCallback[]>([]);

  const registerSelectionCallback = (callback: SelectionCallback) => {
    selectionCallbacks.value.push(callback);
  };

  const registerDeselectionCallback = (callback: DeselectionCallback) => {
    deselectionCallbacks.value.push(callback);
  };

  const unregisterSelectionCallback = (callback: SelectionCallback) => {
    const index = selectionCallbacks.value.indexOf(callback);
    if (index !== -1) {
      selectionCallbacks.value.splice(index, 1);
    }
  };

  const unregisterDeselectionCallback = (callback: DeselectionCallback) => {
    const index = deselectionCallbacks.value.indexOf(callback);
    if (index !== -1) {
      deselectionCallbacks.value.splice(index, 1);
    }
  };

  const clearAllCallbacks = () => {
    selectionCallbacks.value = [];
    deselectionCallbacks.value = [];
  };

  return {
    selectionCallbacks,
    deselectionCallbacks,
    registerSelectionCallback,
    registerDeselectionCallback,
    unregisterSelectionCallback,
    unregisterDeselectionCallback,
    clearAllCallbacks,
  };
});

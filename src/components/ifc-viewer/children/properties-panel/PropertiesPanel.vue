<template>
  <DraggablePanel
    title="Properties"
    v-model:display="display"
    v-model:position="position"
    @update:display="handleDisplayChange"
  >
    <PropertyTreeTable :object="store.selectedInfo" />
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import { useModelInfoStore } from '@/stores/modelInfo';
import PropertyTreeTable from './children/PropertyTreeTable.vue';

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
const store = useModelInfoStore();
const wasExplicitlyClosed = ref(false);

watch(
  () => props.position,
  (newValue) => {
    if (!newValue) return;
    position.value = newValue;
  }
);

watch(
  () => props.display,
  (newValue) => {
    if (newValue !== undefined) {
      display.value = newValue;
    }
  }
);

const handleDisplayChange = (value: boolean) => {
  display.value = value;
  if (!value) {
    wasExplicitlyClosed.value = true;
  } else {
    wasExplicitlyClosed.value = false;
  }
};

// Expose properties to parent component
defineExpose({
  position,
  handleDisplayChange,
});

watch(position, (newValue) => {
  emit('update:position', newValue);
});

watch(display, (newValue) => {
  emit('update:display', newValue);
});

watch(
  () => store.selectedInfo,
  (newValue) => {
    if (newValue && !wasExplicitlyClosed.value) {
      display.value = true;
    } else if (!newValue) {
      display.value = false;
    }
  }
);
</script>

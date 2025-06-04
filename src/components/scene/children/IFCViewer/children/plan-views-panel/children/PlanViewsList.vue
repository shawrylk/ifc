<template>
  <div ref="table" class="tabulator-table"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { OptionsColumns, Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';
import { Plan } from '@/composables/PlansManager';

const props = defineProps<{
  plans: Plan[];
  visiblePlanId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:visiblePlanId', value: number | null): void;
}>();

const table = ref<HTMLElement | null>(null);
const isInitialized = ref(false);
let tabulator: Tabulator | null = null;

const columns: OptionsColumns['columns'] = [
  {
    title: 'ID',
    field: 'id',
    resizable: 'header',
  },
  {
    title: 'Name',
    field: 'name',
    resizable: 'header',
  },
  {
    title: 'Elevation',
    field: 'elevation',
    resizable: 'header',
    formatter: (cell) => `${cell.getValue()}m`,
  },
  {
    title: 'Visibility',
    field: 'id',
    resizable: 'header',
    formatter: (cell) => {
      const isVisible = cell.getValue() === props.visiblePlanId;
      return `<div class="visibility-radio">
        <input type="radio" name="visibility" ${isVisible ? 'checked' : ''} />
        <span class="radio-label"></span>
      </div>`;
    },
    cellClick: (_: UIEvent, cell: any) => {
      const planId = cell.getValue();
      if (planId === props.visiblePlanId) {
        emit('update:visiblePlanId', null);
      } else {
        emit('update:visiblePlanId', planId);
      }
    },
  },
];

onMounted(() => {
  tabulator = new Tabulator(table.value as HTMLElement, {
    data: props.plans,
    columns,
  });

  tabulator.on('tableBuilt', () => {
    isInitialized.value = true;
  });
});

watch(
  () => props.visiblePlanId,
  () => {
    if (tabulator && isInitialized.value) {
      tabulator.replaceData(props.plans);
    }
  }
);

// Add watcher for plans prop
watch(
  () => props.plans,
  (newPlans) => {
    if (tabulator && isInitialized.value) {
      tabulator.replaceData(newPlans);
    }
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (tabulator) tabulator.destroy();
});
</script>

<style scoped>
.tabulator-table {
  min-height: 300px;
  font-size: 12px;
}

:deep(.tabulator) {
  font-size: 12px;
}

:deep(.tabulator-header) {
  font-size: 12px;
}

:deep(.tabulator-row) {
  cursor: pointer;
}

:deep(.tabulator-row:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.visibility-radio) {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 4px;
}

:deep(.visibility-radio input[type='radio']) {
  cursor: pointer;
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #4caf50;
}

:deep(.radio-label) {
  font-size: 12px;
  color: #fff;
}

:deep(.tabulator-cell) {
  padding: 4px;
}
</style>

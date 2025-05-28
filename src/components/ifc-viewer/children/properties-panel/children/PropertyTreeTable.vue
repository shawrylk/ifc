<template>
  <div ref="table" class="tabulator-table"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { OptionsColumns, Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';

const props = defineProps<{ object: any }>();
const table = ref<HTMLElement | null>(null);
let tabulator: Tabulator | null = null;

type TabulatorRow = {
  [key: string]: any;
  _children?: TabulatorRow[];
};

function toTabulatorTree(obj: any, id = 0): TabulatorRow {
  if (Array.isArray(obj)) {
    return obj.map(toTabulatorTree);
  } else if (obj && typeof obj === 'object') {
    // If this is a { value, type } leaf, return as object
    if (
      Object.keys(obj).length === 2 &&
      'value' in obj &&
      'type' in obj &&
      typeof obj.value !== 'object'
    ) {
      return { value: obj.value, type: obj.type };
    }

    const row: TabulatorRow = { id: id++ };
    const children: TabulatorRow[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (!key.startsWith('_')) {
        if (Array.isArray(value)) {
          children.push(...value.map((v) => toTabulatorTree(v, id)));
        } else if (value && typeof value === 'object') {
          if ('value' in value && 'type' in value) {
            row[key] = toTabulatorTree(value, id);
          } else {
            children.push(toTabulatorTree(value, id));
          }
        } else {
          row[key] = value;
        }
      }
    }

    if (children.length > 0) {
      row._children = children;
    }

    return row;
  }
  // If it's a primitive, wrap it in an object
  return { id: id++, value: obj };
}

const columns: OptionsColumns['columns'] = [
  {
    title: 'Name',
    field: 'Name.value',
  },
  {
    title: 'Nominal Value',
    field: 'NominalValue.value',
  },
  {
    title: 'Object Type',
    field: 'ObjectType.value',
  },
  {
    title: 'Predefined Type',
    field: 'PredefinedType.value',
  },
];

onMounted(() => {
  const treeData = [toTabulatorTree(props.object)];
  tabulator = new Tabulator(table.value as HTMLElement, {
    dataTree: true,
    data: treeData,
    columns,
    dataTreeStartExpanded: true,
  });
});

watch(
  () => props.object,
  (newObj) => {
    if (tabulator) {
      const treeData = [toTabulatorTree(newObj)];
      tabulator.replaceData(treeData);
      tabulator.redraw();
    }
  }
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
</style>

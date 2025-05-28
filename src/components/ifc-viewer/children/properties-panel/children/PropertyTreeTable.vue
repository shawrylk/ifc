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

function toTabulatorTree(obj: any): TabulatorRow {
  if (Array.isArray(obj)) {
    return obj.map(toTabulatorTree);
  } else if (obj && typeof obj === 'object') {
    // If this is a { value, type } leaf, return as object

    if ('value' in obj && typeof obj.value !== 'object') {
      return { value: obj.value, type: obj.type || '' };
    }

    const row: TabulatorRow = {};
    const children: TabulatorRow[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        children.push(...value.map((v) => toTabulatorTree(v)));
      } else if (value && typeof value === 'object') {
        if ('value' in value) {
          row[key] = toTabulatorTree(value);
        } else {
          children.push(toTabulatorTree(value));
        }
      } else {
        row[key] = value;
      }
    }

    if (children.length > 0) {
      row._children = children;
    }

    return row;
  }
  // If it's a primitive, wrap it in an object
  return { value: obj };
}

const columns: OptionsColumns['columns'] = [
  {
    title: 'ID',
    field: '_localId.value',
    resizable: 'header',
  },
  {
    title: 'Name',
    field: 'Name.value',
    resizable: 'header',
  },
  {
    title: 'Nominal Value',
    field: 'NominalValue.value',
    resizable: 'header',
  },
  {
    title: 'Object Type',
    field: 'ObjectType.value',
    resizable: 'header',
  },
  {
    title: 'Predefined Type',
    field: 'PredefinedType.value',
    resizable: 'header',
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

<template>
  <DraggablePanel
    title="Hover/Selection Category Filter"
    v-model:display="display"
    v-model:position="position"
    :size="{ width: 300, height: 400 }"
    @update:display="handleDisplayChange"
  >
    <div class="category-filter-panel">
      <div class="filter-header">
        <div class="filter-info">
          <span v-if="isDataAvailable" class="stats-text">
            {{ categoryLookupStore.categoryCount }} items in
            {{ categoryLookupStore.availableCategoriesList.length }} categories
          </span>
          <span v-else class="stats-text">No categories available</span>
        </div>
        <div class="filter-actions">
          <Button size="small" severity="secondary" @click="selectAll" title="Select All">
            All
          </Button>
          <Button size="small" severity="secondary" @click="clearAll" title="Clear All">
            None
          </Button>
        </div>
      </div>

      <div class="filter-content" v-if="isDataAvailable">
        <div class="category-list">
          <div v-for="category in sortedCategories" :key="category.name" class="category-item">
            <Checkbox
              v-model="selectedCategories"
              :inputId="category.name"
              :value="category.name"
              @change="updateFilters"
            />
            <label
              :for="category.name"
              class="category-label"
              :title="`${category.name} (${category.count} items)`"
            >
              <span class="category-name">{{ category.name }}</span>
              <span class="category-count">({{ category.count }})</span>
            </label>
          </div>
        </div>
      </div>

      <div v-else class="no-categories">
        <div class="no-categories-message">
          <i class="pi pi-info-circle"></i>
          <span v-if="!ifcStore.isLoaded">Load an IFC model to see available categories</span>
          <span v-else-if="ifcStore.isLoaded && categoryLookupStore.categoryCount === 0">
            Processing IFC model... Please open the Object Tree to initialize categories.
          </span>
          <span v-else>No categories available</span>
        </div>
      </div>

      <div class="filter-footer" v-if="categoryLookupStore.activeCategoryFiltersList.length > 0">
        <div class="active-filters">
          <span class="active-filters-label">Active filters:</span>
          <div class="active-filter-tags">
            <Tag
              v-for="filter in categoryLookupStore.activeCategoryFiltersList"
              :key="filter"
              :value="filter"
              severity="info"
              class="active-filter-tag"
            >
              {{ filter }}
            </Tag>
          </div>
        </div>
      </div>
    </div>
  </DraggablePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import DraggablePanel from '@/components/commons/DraggablePanel.vue';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useCategoryLookupStore } from '@/stores/categoryLookupStore';
import { useIFCStore } from '@/stores/ifcStore';
import { useInteractionStore } from '@/stores/interactionStore';

const props = defineProps<{
  position?: { x: number; y: number };
  display?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:position', value: { x: number; y: number }): void;
  (e: 'update:display', value: boolean): void;
}>();

const display = ref(props.display ?? false);
const position = ref(props.position || { x: 350, y: 10 });
const selectedCategories = ref<string[]>([]);
const categoryLookupStore = useCategoryLookupStore();
const ifcStore = useIFCStore();
const interactionStore = useInteractionStore();

// Computed property to get sorted categories with counts
const sortedCategories = computed(() => {
  const stats = categoryLookupStore.getStats();
  const categoryBreakdown = stats.categoryBreakdown;

  return categoryLookupStore.availableCategoriesList
    .map((category) => ({
      name: category,
      count: categoryBreakdown[category] || 0,
    }))
    .sort((a, b) => {
      // Sort by count (descending), then by name (ascending)
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    });
});

// Computed property to check if IFC is loaded and data is available
const isDataAvailable = computed(() => {
  return ifcStore.isLoaded && categoryLookupStore.categoryCount > 0;
});

const handleDisplayChange = (value: boolean) => {
  display.value = value;
  emit('update:display', value);
};

const updateFilters = () => {
  // Update the category lookup store with selected categories
  categoryLookupStore.setCategoryFilters(selectedCategories.value);

  // Refresh interaction filtering to apply changes immediately
  interactionStore.refreshInteractionFiltering();

  // Log filter status for debugging
  const filterStatus = interactionStore.getFilterStatus();
  console.log('Category filters updated:', {
    activeFilters: filterStatus.activeFilters,
    totalCategories: filterStatus.totalCategories,
    hasFilters: filterStatus.hasFilters,
  });
};

const selectAll = () => {
  selectedCategories.value = [...categoryLookupStore.availableCategoriesList];
  updateFilters();
};

const clearAll = () => {
  selectedCategories.value = [];
  updateFilters();
};

// Watch for IFC loading state changes
watch(
  () => ifcStore.isLoaded,
  (isLoaded) => {
    if (!isLoaded) {
      // Clear everything when IFC is unloaded
      selectedCategories.value = [];
      categoryLookupStore.clearLookupTable();
    }
  }
);

// Watch for changes in available categories and auto-select all initially
watch(
  () => categoryLookupStore.availableCategoriesList,
  (newCategories) => {
    if (newCategories.length > 0) {
      // Auto-select all categories when they become available
      // But only if we don't have any current selection
      if (selectedCategories.value.length === 0) {
        selectedCategories.value = [...newCategories];
        updateFilters();
      } else {
        // Update to only include categories that still exist
        selectedCategories.value = selectedCategories.value.filter((cat) =>
          newCategories.includes(cat)
        );
        updateFilters();
      }
    }
  },
  { immediate: true }
);

// Watch for position changes and emit to parent
watch(position, (newValue) => {
  emit('update:position', newValue);
});

// Sync with store's active filters
watch(
  () => categoryLookupStore.activeCategoryFiltersList,
  (newFilters) => {
    // Only update if different to avoid infinite loops
    if (JSON.stringify(newFilters.sort()) !== JSON.stringify(selectedCategories.value.sort())) {
      selectedCategories.value = [...newFilters];
    }
  }
);

// Initialize with current active filters on mount
onMounted(() => {
  const activeFilters = categoryLookupStore.activeCategoryFiltersList;
  if (activeFilters.length > 0) {
    selectedCategories.value = [...activeFilters];
  }
});

// Expose properties for parent component
defineExpose({
  display,
  position,
  handleDisplayChange,
});
</script>

<style scoped>
.category-filter-panel {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
  color: #ffffff;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #333;
  background: #252525;
  flex-shrink: 0;
}

.filter-info .stats-text {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.filter-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  background: #1a1a1a;
}

.category-list {
  padding: 0 12px;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #2a2a2a;
  transition: background-color 0.2s ease;
}

.category-item:last-child {
  border-bottom: none;
}

.category-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.category-label {
  margin-left: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  font-size: 13px;
  color: #ffffff;
}

.category-name {
  font-weight: 500;
  color: #ffffff;
  flex: 1;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.category-count {
  color: #888;
  font-size: 11px;
  margin-left: 8px;
  flex-shrink: 0;
}

.no-categories {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #1a1a1a;
}

.no-categories-message {
  text-align: center;
  color: #888;
  font-style: italic;
}

.no-categories-message i {
  display: block;
  font-size: 24px;
  margin-bottom: 8px;
  color: #666;
}

.filter-footer {
  border-top: 1px solid #333;
  padding: 12px;
  background: #252525;
  flex-shrink: 0;
}

.active-filters-label {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.active-filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.active-filter-tag {
  font-size: 10px;
}

/* Custom scrollbar for dark theme */
.filter-content::-webkit-scrollbar {
  width: 6px;
}

.filter-content::-webkit-scrollbar-track {
  background: #2a2a2a;
}

.filter-content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.filter-content::-webkit-scrollbar-thumb:hover {
  background: #777;
}

/* Dark theme button styling */
:deep(.p-button.p-button-secondary) {
  background: #333;
  border: 1px solid #555;
  color: #fff;
}

:deep(.p-button.p-button-secondary:hover) {
  background: #444;
  border-color: #666;
}

/* Dark theme tag styling */
:deep(.p-tag.p-tag-info) {
  background: #667eea;
  color: #fff;
}
</style>

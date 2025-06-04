import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TreeNode as CustomTreeNode } from '@/utils/treeUtils';
import type { TreeNode as PrimeVueTreeNode } from 'primevue/treenode';

// Union type to handle both custom and PrimeVue TreeNode types
type AnyTreeNode = CustomTreeNode | PrimeVueTreeNode;

export interface CategoryLookupEntry {
  localId: number;
  category: string;
  label: string;
}

export const useCategoryLookupStore = defineStore('categoryLookup', () => {
  // The main lookup table: localId -> category
  const categoryLookupMap = ref<Map<number, string>>(new Map());

  // Additional lookup for full entry data: localId -> CategoryLookupEntry
  const fullEntryMap = ref<Map<number, CategoryLookupEntry>>(new Map());

  // Track available categories for filtering
  const availableCategories = ref<Set<string>>(new Set());

  // Active category filters
  const activeCategoryFilters = ref<Set<string>>(new Set());

  // Computed properties
  const categoryCount = computed(() => categoryLookupMap.value.size);
  const availableCategoriesList = computed(() => Array.from(availableCategories.value));
  const activeCategoryFiltersList = computed(() => Array.from(activeCategoryFilters.value));

  /**
   * Extract category from a tree node label
   * Expected format: "Category Name (id: localId)"
   */
  const extractCategoryFromLabel = (label: string): string => {
    const categoryMatch = label.match(/^([^(]+)/);
    return categoryMatch ? categoryMatch[1].trim() : 'Unknown';
  };

  /**
   * Extract localId from tree node key
   */
  const extractLocalIdFromKey = (key: string | number): number => {
    if (typeof key === 'number') return key;
    return parseInt(key.toString(), 10) || 0;
  };

  /**
   * Recursively build lookup table from tree data
   */
  const processTreeNode = (node: AnyTreeNode): void => {
    if (node.key && node.label) {
      const localId = extractLocalIdFromKey(node.key);
      const category = extractCategoryFromLabel(node.label);

      if (localId > 0) {
        // Update main lookup map
        categoryLookupMap.value.set(localId, category);

        // Update full entry map
        const entry: CategoryLookupEntry = {
          localId,
          category,
          label: node.label,
        };
        fullEntryMap.value.set(localId, entry);

        // Track available categories
        availableCategories.value.add(category);
      }
    }

    // Process children recursively
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => processTreeNode(child as AnyTreeNode));
    }
  };

  /**
   * Build lookup table from tree data - accepts both custom and PrimeVue TreeNode types
   */
  const buildLookupTable = (treeData: AnyTreeNode[]): void => {
    // Clear existing data
    clearLookupTable();

    // Process all tree nodes
    treeData.forEach(processTreeNode);

    console.log(`Built category lookup table with ${categoryCount.value} entries`);
    console.log(`Available categories: ${availableCategoriesList.value.join(', ')}`);
  };

  /**
   * Get category for a specific localId
   */
  const getCategoryByLocalId = (localId: number): string | null => {
    return categoryLookupMap.value.get(localId) || null;
  };

  /**
   * Get full entry for a specific localId
   */
  const getEntryByLocalId = (localId: number): CategoryLookupEntry | null => {
    return fullEntryMap.value.get(localId) || null;
  };

  /**
   * Get all localIds for a specific category
   */
  const getLocalIdsByCategory = (category: string): number[] => {
    const localIds: number[] = [];
    categoryLookupMap.value.forEach((cat, localId) => {
      if (cat === category) {
        localIds.push(localId);
      }
    });
    return localIds;
  };

  /**
   * Check if a localId matches active category filters
   * If no filters are active, all items match
   */
  const matchesCategoryFilter = (localId: number): boolean => {
    if (activeCategoryFilters.value.size === 0) {
      return false; // No filters active, nothing matches
    }

    const category = getCategoryByLocalId(localId);
    if (!category) return false;

    return Array.from(activeCategoryFilters.value).some((filter) =>
      category.toLowerCase().includes(filter.toLowerCase())
    );
  };

  /**
   * Set active category filters
   */
  const setCategoryFilters = (categories: string[]): void => {
    activeCategoryFilters.value.clear();
    categories.forEach((category) => {
      if (category.trim()) {
        activeCategoryFilters.value.add(category.trim());
      }
    });
  };

  /**
   * Add a category filter
   */
  const addCategoryFilter = (category: string): void => {
    if (category.trim()) {
      activeCategoryFilters.value.add(category.trim());
    }
  };

  /**
   * Remove a category filter
   */
  const removeCategoryFilter = (category: string): void => {
    activeCategoryFilters.value.delete(category);
  };

  /**
   * Clear all category filters
   */
  const clearCategoryFilters = (): void => {
    activeCategoryFilters.value.clear();
  };

  /**
   * Clear the entire lookup table
   */
  const clearLookupTable = (): void => {
    categoryLookupMap.value.clear();
    fullEntryMap.value.clear();
    availableCategories.value.clear();
  };

  /**
   * Get statistics about the lookup table
   */
  const getStats = () => {
    const categoryStats = new Map<string, number>();
    categoryLookupMap.value.forEach((category) => {
      categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
    });

    return {
      totalEntries: categoryCount.value,
      categoriesCount: availableCategories.value.size,
      categoryBreakdown: Object.fromEntries(categoryStats),
      availableCategories: availableCategoriesList.value,
      activeFilters: activeCategoryFiltersList.value,
    };
  };

  return {
    // State
    categoryLookupMap: categoryLookupMap,
    fullEntryMap: fullEntryMap,
    availableCategories: availableCategories,
    activeCategoryFilters: activeCategoryFilters,

    // Computed
    categoryCount,
    availableCategoriesList,
    activeCategoryFiltersList,

    // Methods
    buildLookupTable,
    getCategoryByLocalId,
    getEntryByLocalId,
    getLocalIdsByCategory,
    matchesCategoryFilter,
    setCategoryFilters,
    addCategoryFilter,
    removeCategoryFilter,
    clearCategoryFilters,
    clearLookupTable,
    getStats,
  };
});

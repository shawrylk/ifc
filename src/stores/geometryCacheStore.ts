import { defineStore } from 'pinia';
import { ref } from 'vue';
import { FragmentsModel } from '@thatopen/fragments';
import {
  ExtractedGeometry,
  extractGeometriesFromLocalId,
  extractGeometriesFromLocalIds,
} from '@/utils/geometryUtils';

interface CacheEntry {
  geometries: ExtractedGeometry[];
  timestamp: number;
}

export const useGeometryCacheStore = defineStore('geometryCacheStore', () => {
  const cache = ref<Map<number, CacheEntry>>(new Map());
  const isInitialized = ref(false);
  const currentModel = ref<FragmentsModel | null>(null);

  // Cache settings
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_CACHE_SIZE = 1000; // Maximum number of cached entries

  /**
   * Initialize the cache with a new model
   */
  const initialize = (model: FragmentsModel) => {
    // Clear existing cache when switching models
    dispose();
    currentModel.value = model;
    isInitialized.value = true;
  };

  /**
   * Get geometries for a single localId from cache or extract them
   */
  const getGeometriesForLocalId = async (localId: number): Promise<ExtractedGeometry[]> => {
    if (!currentModel.value) {
      console.warn('Geometry cache not initialized');
      return [];
    }

    // Check cache first
    const cached = cache.value.get(localId);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < CACHE_EXPIRY_MS) {
        return cached.geometries;
      } else {
        // Remove expired entry
        cache.value.delete(localId);
        // Dispose old geometries
        cached.geometries.forEach(({ geometry }) => geometry.dispose());
      }
    }

    // Extract geometries if not in cache or expired
    const geometries = await extractGeometriesFromLocalId(
      currentModel.value as FragmentsModel,
      localId
    );

    // Store in cache
    if (geometries.length > 0) {
      // Check cache size limit
      if (cache.value.size >= MAX_CACHE_SIZE) {
        cleanupOldEntries();
      }

      cache.value.set(localId, {
        geometries,
        timestamp: Date.now(),
      });
    }

    return geometries;
  };

  /**
   * Get geometries for multiple localIds, leveraging cache
   */
  const getGeometriesForLocalIds = async (
    localIds: number[]
  ): Promise<Map<number, ExtractedGeometry[]>> => {
    const results = new Map<number, ExtractedGeometry[]>();
    const uncachedIds: number[] = [];

    // Check cache for each localId
    for (const localId of localIds) {
      const cached = cache.value.get(localId);
      if (cached) {
        const now = Date.now();
        if (now - cached.timestamp < CACHE_EXPIRY_MS) {
          results.set(localId, cached.geometries);
          continue;
        } else {
          // Remove expired entry
          cache.value.delete(localId);
          // Dispose old geometries
          cached.geometries.forEach(({ geometry }) => geometry.dispose());
        }
      }
      uncachedIds.push(localId);
    }

    // Extract uncached geometries
    if (uncachedIds.length > 0 && currentModel.value) {
      const uncachedResults = await extractGeometriesFromLocalIds(
        currentModel.value as FragmentsModel,
        uncachedIds
      );

      // Add to cache and results
      for (const [localId, geometries] of uncachedResults) {
        // Check cache size limit
        if (cache.value.size >= MAX_CACHE_SIZE) {
          cleanupOldEntries();
        }

        cache.value.set(localId, {
          geometries,
          timestamp: Date.now(),
        });
        results.set(localId, geometries);
      }
    }

    return results;
  };

  /**
   * Preload geometries for localIds (for performance optimization)
   */
  const preloadGeometries = async (localIds: number[]): Promise<void> => {
    await getGeometriesForLocalIds(localIds);
  };

  /**
   * Check if geometries for a localId are cached
   */
  const isCached = (localId: number): boolean => {
    const cached = cache.value.get(localId);
    if (!cached) return false;

    const now = Date.now();
    if (now - cached.timestamp >= CACHE_EXPIRY_MS) {
      // Remove expired entry
      cache.value.delete(localId);
      cached.geometries.forEach(({ geometry }) => geometry.dispose());
      return false;
    }

    return true;
  };

  /**
   * Clean up old cache entries when cache is full
   */
  const cleanupOldEntries = () => {
    const now = Date.now();
    const entriesToRemove: number[] = [];

    // Find expired or oldest entries
    for (const [localId, entry] of cache.value) {
      if (now - entry.timestamp >= CACHE_EXPIRY_MS) {
        entriesToRemove.push(localId);
      }
    }

    // If no expired entries, remove oldest 25% of entries
    if (entriesToRemove.length === 0) {
      const entries = Array.from(cache.value.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const removeCount = Math.floor(entries.length * 0.25);
      entriesToRemove.push(...entries.slice(0, removeCount).map(([localId]) => localId));
    }

    // Remove entries and dispose geometries
    for (const localId of entriesToRemove) {
      const entry = cache.value.get(localId);
      if (entry) {
        entry.geometries.forEach(({ geometry }) => geometry.dispose());
        cache.value.delete(localId);
      }
    }
  };

  /**
   * Clear specific localId from cache
   */
  const clearCacheForLocalId = (localId: number) => {
    const entry = cache.value.get(localId);
    if (entry) {
      entry.geometries.forEach(({ geometry }) => geometry.dispose());
      cache.value.delete(localId);
    }
  };

  /**
   * Clear all cache entries
   */
  const clearCache = () => {
    for (const entry of cache.value.values()) {
      entry.geometries.forEach(({ geometry }) => geometry.dispose());
    }
    cache.value.clear();
  };

  /**
   * Get cache statistics
   */
  const getCacheStats = () => {
    const now = Date.now();
    let expiredCount = 0;

    for (const entry of cache.value.values()) {
      if (now - entry.timestamp >= CACHE_EXPIRY_MS) {
        expiredCount++;
      }
    }

    return {
      totalEntries: cache.value.size,
      expiredEntries: expiredCount,
      validEntries: cache.value.size - expiredCount,
      maxSize: MAX_CACHE_SIZE,
      cacheHitRate: cache.value.size > 0 ? (cache.value.size - expiredCount) / cache.value.size : 0,
    };
  };

  /**
   * Dispose all resources and clear cache
   */
  const dispose = () => {
    clearCache();
    currentModel.value = null;
    isInitialized.value = false;
  };

  return {
    // State
    isInitialized,

    // Methods
    initialize,
    getGeometriesForLocalId,
    getGeometriesForLocalIds,
    preloadGeometries,
    isCached,
    clearCacheForLocalId,
    clearCache,
    getCacheStats,
    dispose,
  };
});

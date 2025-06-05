import * as THREE from 'three';
import { FragmentsModel } from '@thatopen/fragments';

export interface MeshData {
  indices?: Uint16Array;
  positions?: Float32Array;
  normals?: Int16Array;
  transform?: {
    elements?: number[];
  };
}

export interface ExtractedGeometry {
  geometry: THREE.BufferGeometry;
  transform: THREE.Matrix4;
}

/**
 * Extracts BufferGeometry objects from a single localId using FragmentsModel
 */
export const extractGeometriesFromLocalId = async (
  model: FragmentsModel,
  localId: number
): Promise<ExtractedGeometry[]> => {
  const extractedGeometries: ExtractedGeometry[] = [];

  try {
    const geometriesArray = await model.getItemsGeometry([localId]);
    if (!geometriesArray || geometriesArray.length === 0) {
      return extractedGeometries;
    }

    for (const meshDataArray of geometriesArray) {
      for (const meshData of meshDataArray) {
        const extracted = extractGeometryFromMeshData(meshData as MeshData);
        if (extracted) {
          extractedGeometries.push(extracted);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to extract geometries for localId ${localId}:`, error);
  }

  return extractedGeometries;
};

/**
 * Extracts BufferGeometry objects from multiple localIds
 */
export const extractGeometriesFromLocalIds = async (
  model: FragmentsModel,
  localIds: number[]
): Promise<Map<number, ExtractedGeometry[]>> => {
  const results = new Map<number, ExtractedGeometry[]>();

  // Process in parallel for better performance
  const promises = localIds.map(async (localId) => {
    const geometries = await extractGeometriesFromLocalId(model, localId);
    return { localId, geometries };
  });

  const results_array = await Promise.all(promises);

  for (const { localId, geometries } of results_array) {
    if (geometries.length > 0) {
      results.set(localId, geometries);
    }
  }

  return results;
};

/**
 * Converts MeshData to BufferGeometry with transform matrix
 */
export const extractGeometryFromMeshData = (meshData: MeshData): ExtractedGeometry | null => {
  try {
    // Extract geometry data from meshData
    const indices: Uint16Array = meshData.indices || new Uint16Array();
    const positions: Float32Array = meshData.positions || new Float32Array();
    const normals: Int16Array = meshData.normals || new Int16Array();

    const transform = new THREE.Matrix4();
    if (meshData.transform?.elements) {
      transform.fromArray(meshData.transform.elements);
    }

    // Create BufferGeometry from the mesh data
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Int16BufferAttribute(normals, 3));

    return { geometry, transform };
  } catch (error) {
    console.warn('Failed to extract geometry from mesh data:', error);
    return null;
  }
};

/**
 * Creates a mesh from extracted geometry with specified material
 */
export const createMeshFromExtractedGeometry = (
  extractedGeometry: ExtractedGeometry,
  material: THREE.Material
): THREE.Mesh => {
  const mesh = new THREE.Mesh(extractedGeometry.geometry, material);
  mesh.applyMatrix4(extractedGeometry.transform);
  mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  return mesh;
};

/**
 * Merges multiple BufferGeometries with their transforms applied
 */
export const mergeExtractedGeometries = async (
  extractedGeometries: ExtractedGeometry[]
): Promise<THREE.BufferGeometry | null> => {
  if (extractedGeometries.length === 0) return null;

  const geometries: THREE.BufferGeometry[] = [];

  for (const { geometry, transform } of extractedGeometries) {
    const clonedGeometry = geometry.clone();
    clonedGeometry.applyMatrix4(transform);
    geometries.push(clonedGeometry);
  }

  try {
    const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
    const merged = mergeGeometries(geometries);

    // Clean up cloned geometries
    geometries.forEach((geo) => geo.dispose());

    return merged;
  } catch (error) {
    console.error('Failed to merge geometries:', error);
    // Clean up on error
    geometries.forEach((geo) => geo.dispose());
    return null;
  }
};

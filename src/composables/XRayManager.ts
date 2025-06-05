import { FragmentsModels, FragmentsModel } from '@thatopen/fragments';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PlansManager } from './PlansManager';
import { useThree } from '@/stores/threeStore';

interface StoreyWireframe {
  storeyId: number;
  wireframe: THREE.LineSegments;
  originalVisible: boolean;
}

export class XRayManager {
  private _fragmentsModels: FragmentsModels;
  private _model: FragmentsModel | undefined;
  private _plansManager: PlansManager;
  private _storeyWireframes: Map<number, StoreyWireframe> = new Map();
  private _isXRayEnabled = false;

  constructor(fragmentsModels: FragmentsModels, plansManager: PlansManager) {
    this._fragmentsModels = fragmentsModels;
    this._model = this._fragmentsModels.models.list.values().next().value;
    this._plansManager = plansManager;
  }

  async initialize() {
    // Generate plans to get storey information
    const plans = await this._plansManager.generate();

    // Create wireframes for each storey
    for (const plan of plans) {
      await this._createStoreyWireframe(parseInt(plan.id));
    }
  }

  private async _createStoreyWireframe(storeyId: number) {
    if (!this._model) return;

    const storey = this._plansManager.getStorey(storeyId);
    if (!storey) return;

    // Get all children items for this storey
    const children = await this._model.getItemsChildren([storeyId]);

    if (!children || children.length === 0) return;

    // Collect geometries from storey children
    const geometries: THREE.BufferGeometry[] = [];

    // Get all objects that belong to this storey
    for (const childId of children) {
      const geometriesArray = await this._model.getItemsGeometry([childId]);
      if (geometriesArray && geometriesArray.length > 0) {
        for (const meshDataArray of geometriesArray) {
          for (const meshData of meshDataArray) {
            // Extract geometry data from meshData
            const indices: Uint16Array =
              'indices' in meshData ? (meshData.indices as Uint16Array) : new Uint16Array();
            const positions: Float32Array =
              'positions' in meshData ? (meshData.positions as Float32Array) : new Float32Array();
            const normals: Int16Array =
              'normals' in meshData ? (meshData.normals as Int16Array) : new Int16Array();
            const transform: THREE.Matrix4 = new THREE.Matrix4();
            if ('transform' in meshData && 'elements' in meshData.transform) {
              transform.fromArray(meshData.transform.elements as number[]);
            }

            // Create BufferGeometry from the mesh data
            const tempGeometry = new THREE.BufferGeometry();
            tempGeometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
            tempGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            tempGeometry.setAttribute('normal', new THREE.Int16BufferAttribute(normals, 3));

            // Apply the transformation matrix
            tempGeometry.applyMatrix4(transform);

            geometries.push(tempGeometry);
          }
        }
      }
    }

    if (geometries.length === 0) return;

    // Create merged wireframe for this storey
    try {
      const mergedGeometry = mergeGeometries(geometries);
      const edges = new THREE.EdgesGeometry(mergedGeometry, 0.1);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x878787,
        toneMapped: true,
        depthTest: false,
        depthWrite: false,
      });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      wireframe.matrix.copy(this._model.object.matrix);
      wireframe.name = `wireframe_storey_${storeyId}`;
      wireframe.visible = false; // Initially hidden

      // Add wireframe to the model
      this._model.object.add(wireframe);

      // Store wireframe info
      this._storeyWireframes.set(storeyId, {
        storeyId,
        wireframe,
        originalVisible: false,
      });

      // Clean up temporary geometries
      geometries.forEach((geo) => geo.dispose());
      mergedGeometry.dispose();
      edges.dispose();
    } catch (error) {
      console.warn('Failed to create wireframe for storey', storeyId, error);
      // Clean up on error
      geometries.forEach((geo) => geo.dispose());
    }
  }

  toggleXRay(): boolean {
    this._isXRayEnabled = !this._isXRayEnabled;

    // Toggle visibility of all wireframes
    this._storeyWireframes.forEach((storeyWireframe) => {
      if (this._isXRayEnabled) {
        // Show wireframe with X-ray properties
        storeyWireframe.wireframe.visible = true;
        const material = storeyWireframe.wireframe.material as THREE.LineBasicMaterial;
        material.depthTest = false;
        material.depthWrite = false;
        material.needsUpdate = true;
      } else {
        // Hide wireframe
        storeyWireframe.wireframe.visible = false;
      }
    });

    // Force render update
    const { render } = useThree();
    render(true);

    return this._isXRayEnabled;
  }

  updateStoreyWireframeVisibility(storeyId: number | null) {
    if (!this._isXRayEnabled) return;

    this._storeyWireframes.forEach((storeyWireframe, id) => {
      if (storeyId === null) {
        // Show all wireframes when no specific storey is selected
        storeyWireframe.wireframe.visible = true;
      } else {
        // Show only the wireframe for the selected storey
        storeyWireframe.wireframe.visible = id === storeyId;
      }
    });

    // Force render update
    const { render } = useThree();
    render(true);
  }

  dispose() {
    // Remove all wireframes from the scene and dispose their resources
    this._storeyWireframes.forEach((storeyWireframe) => {
      if (storeyWireframe.wireframe.parent) {
        storeyWireframe.wireframe.parent.remove(storeyWireframe.wireframe);
      }
      storeyWireframe.wireframe.geometry.dispose();
      if (storeyWireframe.wireframe.material instanceof THREE.Material) {
        storeyWireframe.wireframe.material.dispose();
      }
    });
    this._storeyWireframes.clear();
    this._isXRayEnabled = false;
  }

  get isEnabled(): boolean {
    return this._isXRayEnabled;
  }

  getStoreyWireframes(): Map<number, StoreyWireframe> {
    return this._storeyWireframes;
  }
}

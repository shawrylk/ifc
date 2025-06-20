<template>
  <!-- This component does not render any DOM elements -->
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useInteractionStore } from '@/stores/interactionStore';
import { useThree } from '@/stores/threeStore';
import { useIFCStore } from '@/stores/ifcStore';

const interactionStore = useInteractionStore();
const threeStore = useThree();
const ifcStore = useIFCStore();

let selectionBoxHelper: THREE.Box3Helper | null = null;
let dimensionLabels: THREE.Sprite[] = [];
let debugMesh: THREE.Mesh | undefined = undefined;

const clearSelectionVisuals = () => {
  if (selectionBoxHelper) {
    threeStore.scene.remove(selectionBoxHelper);
    selectionBoxHelper.geometry.dispose();
    (selectionBoxHelper.material as THREE.Material).dispose();
    selectionBoxHelper = null;
  }
  dimensionLabels.forEach((label) => {
    threeStore.scene.remove(label);
    label.material.map?.dispose();
    label.material.dispose();
    label.geometry.dispose();
  });
  dimensionLabels = [];
  if (debugMesh) {
    threeStore.scene.remove(debugMesh);
    debugMesh = undefined;
  }
};

const createTextSprite = (text: string, position: THREE.Vector3) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  const fontSize = 48;
  context.font = `Bold ${fontSize}px Arial`;
  const textMetrics = context.measureText(text);

  // Add some padding
  const canvasWidth = textMetrics.width + 20;
  const canvasHeight = fontSize + 10;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Redraw font after canvas resize
  context.font = `Bold ${fontSize}px Arial`;
  context.fillStyle = 'rgba(0, 0, 0, 0.3)';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvasWidth / 2, canvasHeight / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    // sizeAttenuation: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.renderOrder = 2;

  // With sizeAttenuation: false, we can set the scale to control the final pixel size on screen.
  const finalScale = 0.005;
  sprite.scale.set(canvasWidth * finalScale, canvasHeight * finalScale, 1.0);

  return sprite;
};

watch(
  () => interactionStore.selectedId,
  async (newId) => {
    clearSelectionVisuals();

    if (newId) {
      debugMesh = ifcStore.getDebugMesh(newId);
      if (debugMesh) {
        threeStore.scene.add(debugMesh);
      }

      const fragmentsModels = ifcStore.getFragmentsModels();
      if (!fragmentsModels) return;

      const model = fragmentsModels.models.list.values().next().value;
      if (!model) return;

      const box = await model.getBoxes([newId]);
      if (!box || !Number.isFinite(box[0].min.x)) return;

      const boundingBox = box[0];

      // Bounding Box Helper
      selectionBoxHelper = new THREE.Box3Helper(boundingBox, new THREE.Color(0xffa500));
      (selectionBoxHelper.material as THREE.Material).depthTest = false;
      (selectionBoxHelper.material as THREE.Material).depthWrite = false;
      selectionBoxHelper.renderOrder = 1;
      threeStore.scene.add(selectionBoxHelper);

      // Dimensions
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      const center = new THREE.Vector3();
      boundingBox.getCenter(center);

      // Create labels for dimensions
      const dims = [
        {
          val: size.x,
          axis: 'x',
          pos: new THREE.Vector3(center.x, boundingBox.min.y, boundingBox.min.z),
        },
        {
          val: size.y,
          axis: 'y',
          pos: new THREE.Vector3(boundingBox.min.x, center.y, boundingBox.min.z),
        },
        {
          val: size.z,
          axis: 'z',
          pos: new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, center.z),
        },
      ];

      dims.forEach((dim) => {
        if (dim.val > 0.01) {
          // Only show dimensions that are not tiny
          const labelText = `${dim.axis.toUpperCase()}: ${dim.val.toFixed(4)}m`;
          const label = createTextSprite(labelText, dim.pos);
          if (label) {
            dimensionLabels.push(label);
            threeStore.scene.add(label);
          }
        }
      });

      // // Display first vertex location
      // const geometryCache = useGeometryCacheStore();
      // if (!geometryCache.isInitialized) {
      //   geometryCache.initialize(model as any);
      // }
      // const extractedGeometries = await geometryCache.getGeometriesForLocalId(newId);
      // if (extractedGeometries.length > 0) {
      //   const firstGeom = extractedGeometries[0];
      //   const positionAttribute = firstGeom.geometry.attributes.position;
      //   if (positionAttribute) {
      //     const vertex = new THREE.Vector3();
      //     vertex.fromBufferAttribute(positionAttribute, 0); // Get first vertex
      //     vertex.applyMatrix4(firstGeom.transform); // Apply transformation

      //     const labelText = `V1: (${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)}, ${vertex.z.toFixed(2)})`;
      //     const label = createTextSprite(labelText, vertex);
      //     if (label) {
      //         dimensionLabels.push(label);
      //         threeStore.scene.add(label);
      //     }
      //   }
      // }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  clearSelectionVisuals();
});
</script>

import { FragmentsModels } from '@thatopen/fragments';
import { useThree } from './threeStore';
import * as FRAGS from '@thatopen/fragments';
import * as THREE from 'three';
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// cannot use pinia store because of thread-safety issues
let fragmentsModels: FragmentsModels | null = null;
const loadIFC = async (file: File) => {
  const { camera, controls, scene } = useThree();

  const arrayBuffer = await file.arrayBuffer();
  const ifcBytes = new Uint8Array(arrayBuffer);

  // load ifc file to fragments
  const serializer = new FRAGS.IfcImporter();
  serializer.wasm = { absolute: true, path: 'https://unpkg.com/web-ifc/' };
  const fragmentBytes = await serializer.process({ bytes: ifcBytes });

  // initialize fragments models
  const workerUrl = 'https://thatopen.github.io/engine_fragment/resources/worker.mjs';
  const fetchedWorker = await fetch(workerUrl);
  const workerText = await fetchedWorker.text();
  const workerFile = new File([new Blob([workerText])], 'worker.mjs', {
    type: 'text/javascript',
  });
  const url = URL.createObjectURL(workerFile);
  const fragments = new FRAGS.FragmentsModels(url);
  // URL.revokeObjectURL(url);
  fragments.baseCoordinates = [0, 0, 0];
  fragments.settings.graphicsQuality = 1;
  controls!.addEventListener('rest', () => fragments.update(true));
  controls!.addEventListener('update', () => fragments.update());

  // load model into scene
  const model = await fragments.load(fragmentBytes, { modelId: file.name });
  scene.add(model.object);

  model.useCamera(camera);

  await fragments.update(true);

  const proceedMaterials = new Set<THREE.Material>();
  const geometries: THREE.BufferGeometry[] = [];
  let unit = 1e-2;
  model.object.children.forEach((child) => {
    child.traverse((child) => {
      // fix z-fighting
      if (child instanceof THREE.Mesh) {
        const array = Array.isArray(child.material) ? child.material : [child.material];
        array.forEach((material) => {
          if (proceedMaterials.has(material)) return;
          material.polygonOffset = true;
          material.polygonOffsetFactor = unit;
          material.polygonOffsetUnits = unit;
          material.toneMapped = true;
          unit = unit * 2;
          proceedMaterials.add(material);
        });
      }

      // collect geometries
      if ('geometry' in child && child.geometry instanceof THREE.BufferGeometry) {
        geometries.push(child.geometry.clone().applyMatrix4(child.matrix));
      }
    });
  });

  // show wireframe
  const mergedGeometry = mergeGeometries(geometries);
  const edges = new THREE.EdgesGeometry(mergedGeometry, 0.1);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x878787, toneMapped: true });
  const wireframe = new THREE.LineSegments(edges, lineMaterial);
  wireframe.matrix.copy(model.object.matrix);
  wireframe.name = 'wireframe';
  model.object.add(wireframe);

  await controls.fitToSphere(model.box.getBoundingSphere(new THREE.Sphere()), true);

  return fragments;
};

export const useIFCStore = defineStore('ifcStore', () => {
  const isLoaded = ref(false);

  const getFragmentsModels = () => fragmentsModels;

  const loadIFCFile = async (file: File) => {
    fragmentsModels = await loadIFC(file);
    isLoaded.value = true;
  };

  const dispose = () => {
    fragmentsModels?.dispose();
    fragmentsModels = null;
    isLoaded.value = false;
  };

  return {
    isLoaded,
    getFragmentsModels,
    loadIFCFile,
    dispose,
  };
});

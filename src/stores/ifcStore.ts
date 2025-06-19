import { FragmentsModels } from '@thatopen/fragments';
import { useThree } from './threeStore';
import * as FRAGS from '@thatopen/fragments';
import * as THREE from 'three';
import { ref, markRaw } from 'vue';
import { defineStore } from 'pinia';
import { IfcAPI, PlacedGeometry, Color } from 'web-ifc';
import {
  BufferAttribute,
  BufferGeometry,
  FrontSide,
  Matrix4,
  Mesh,
  NormalBlending,
  MeshPhongMaterial,
  Color as ThreeColor,
} from 'three';
import {
  IFCBUILDINGSTOREY,
  IFCSPACE,
  IFCWALL,
  IFCWINDOW,
  IFCSLAB,
  IFCROOF,
  IFCCURTAINWALL,
  IFCCOLUMN,
} from 'web-ifc';

let fragmentsModels: FragmentsModels | null = null;
// cannot use pinia store because of thread-safety issues
const loadIFC = async (file: File) => {
  const { mainViewport, scene } = useThree();

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
  const fragments = fragmentsModels ?? markRaw(new FRAGS.FragmentsModels(url));
  // URL.revokeObjectURL(url);
  if (fragmentsModels !== fragments) {
    fragments.baseCoordinates = [0, 0, 0];
    fragments.settings.graphicsQuality = 1;
    [mainViewport?.controls2d, mainViewport?.controls3d].forEach((control) => {
      control?.addEventListener('rest', () => fragments.update(true));
      control?.addEventListener('update', () => fragments.update());
    });
  } else {
    // const model = fragments.models.list.values().next().value;
    // const modelId = model?.modelId;
    // if (modelId) {
    //   fragments.disposeModel(modelId);
    // }
  }

  // load model into scene
  const model = await fragments.load(fragmentBytes, { modelId: file.name });
  scene.add(model.object);

  const camera3d = mainViewport?.controls3d?.camera;
  if (camera3d) {
    model.useCamera(camera3d);
  }

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
  // const mergedGeometry = mergeGeometries(geometries);
  // const edges = new THREE.EdgesGeometry(mergedGeometry, 0.1);
  // const lineMaterial = new THREE.LineBasicMaterial({ color: 0x878787, toneMapped: true });
  // const wireframe = new THREE.LineSegments(edges, lineMaterial);
  // wireframe.matrix.copy(model.object.matrix);
  // wireframe.name = 'wireframe';
  // model.object.add(wireframe);

  const sphere = model.box.getBoundingSphere(new THREE.Sphere());
  const controls3d = mainViewport?.controls3d;
  controls3d?.fitToSphere(sphere, true);

  // Now load lines from ifc file
  await loadIFC2(file);

  return fragments;
};

export const getMeshMatrix = (matrix: number[]) => {
  const mat = new Matrix4();
  mat.fromArray(matrix);
  return mat;
};

export const ifcGeometryToBuffer = (
  color: Color,
  vertexData: Float32Array,
  indexData: Uint32Array
) => {
  const geometry = new BufferGeometry();

  const posFloats = new Float32Array(vertexData.length / 2);
  const normFloats = new Float32Array(vertexData.length / 2);
  const colorFloats = new Float32Array(vertexData.length / 2);

  for (let i = 0; i < vertexData.length; i += 6) {
    posFloats[i / 2 + 0] = vertexData[i + 0];
    posFloats[i / 2 + 1] = vertexData[i + 1];
    posFloats[i / 2 + 2] = vertexData[i + 2];

    normFloats[i / 2 + 0] = vertexData[i + 3];
    normFloats[i / 2 + 1] = vertexData[i + 4];
    normFloats[i / 2 + 2] = vertexData[i + 5];

    colorFloats[i / 2 + 0] = color.x;
    colorFloats[i / 2 + 1] = color.y;
    colorFloats[i / 2 + 2] = color.z;
  }

  geometry.setAttribute('position', new BufferAttribute(posFloats, 3));
  geometry.setAttribute('normal', new BufferAttribute(normFloats, 3));
  geometry.setAttribute('color', new BufferAttribute(colorFloats, 3));
  geometry.setIndex(new BufferAttribute(indexData, 1));
  return geometry;
};

const materials: Record<string, MeshPhongMaterial> = {};

export const getMeshMaterial = (color: Color) => {
  const colID = `${color.x}${color.y}${color.z}${color.w}`;
  if (materials[colID]) {
    return materials[colID];
  }

  const col = new ThreeColor(color.x, color.y, color.z);
  const material = new MeshPhongMaterial({
    side: FrontSide,
    blending: NormalBlending,
    flatShading: true,
    color: col,
  });
  material.vertexColors = true;
  material.transparent = color.w !== 1;
  if (material.transparent) material.opacity = color.w;

  materials[colID] = material;

  return material;
};

export const getBufferGeometry = (
  ifcAPI: IfcAPI,
  modelID: number,
  placedGeometry: PlacedGeometry
) => {
  const geometry = ifcAPI.GetGeometry(modelID, placedGeometry.geometryExpressID);
  const verts = ifcAPI.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
  const indices = ifcAPI.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
  const bufferGeometry = ifcGeometryToBuffer(placedGeometry.color, verts, indices);
  geometry.delete();
  return bufferGeometry;
};

export const getPlacedGeometry = (
  ifcAPI: IfcAPI,
  modelID: number,
  placedGeometry: PlacedGeometry
) => {
  const geometry = getBufferGeometry(ifcAPI, modelID, placedGeometry);
  const material = getMeshMaterial(placedGeometry.color);
  const mesh = new Mesh(geometry, material);
  mesh.matrix = getMeshMatrix(placedGeometry.flatTransformation);
  mesh.geometry.applyMatrix4(mesh.matrix);
  mesh.matrixAutoUpdate = true;
  return mesh;
};

const map = new Map<number, THREE.Mesh>();
const loadIFC2 = async (file: File) => {
  // const {  scene } = useThree();
  const arrayBuffer = await file.arrayBuffer();
  const ifcBytes = new Uint8Array(arrayBuffer);
  const ifcApi = new IfcAPI();
  await ifcApi.Init();
  const modelID = await ifcApi.OpenModel(ifcBytes);
  // const meshes: THREE.Object3D[] = [];
  // const map = new Map<THREE.Material, THREE.BufferGeometry[]>();

  const indicatorGeometry = new THREE.SphereGeometry(0.1, 8, 8); // Small sphere
  const indicatorMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    depthTest: false,
    depthWrite: false,
  }); // Red color
  const mmToM = 0.001;

  await ifcApi.StreamAllMeshes(modelID, (flatMesh) => {
    const expressID = flatMesh.expressID;
    const line = ifcApi.GetLine(modelID, expressID, true);
    switch (line.type) {
      case IFCSLAB:
      case IFCROOF:
      case IFCSPACE:
      case IFCBUILDINGSTOREY: {
        break;
      }
      case IFCCURTAINWALL:
      case IFCWALL:
      case IFCWINDOW:
      case IFCCOLUMN: {
        const coordinates = line.ObjectPlacement.RelativePlacement.Location.Coordinates;
        const solidData =
          line.Representation.Representations[0]?.Items[0]?.MappingSource?.MappedRepresentation
            ?.Items[0];
        const placementRelTo =
          line.ObjectPlacement.PlacementRelTo.RelativePlacement.Location.Coordinates;

        const localPosition = new THREE.Vector3();
        if (coordinates[0].value === 0 && solidData?.Position?.Location?.Coordinates) {
          localPosition.x = solidData.Position.Location.Coordinates[0].value;
          localPosition.y = solidData.Position.Location.Coordinates[1].value;
          localPosition.z = solidData.Position.Location.Coordinates[2].value;
        } else {
          localPosition.x = coordinates[0].value;
          localPosition.y = coordinates[1].value;
          localPosition.z = coordinates[2].value;
        }

        if (placementRelTo) {
          localPosition.x += placementRelTo[0].value;
          localPosition.y += placementRelTo[1].value;
          localPosition.z += placementRelTo[2].value;
        }

        const x = localPosition.x * mmToM;
        const z = -localPosition.y * mmToM;
        const y = localPosition.z * mmToM;

        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(x, y, z);
        // indicator.updateMatrixWorld(true);
        indicator.renderOrder = 2;
        map.set(expressID, indicator);
        // scene.add(indicator);

        break;
      }
    }
    // const placedGeometries = flatMesh.geometries;

    // for (let i = 0; i < placedGeometries.size(); i++) {
    //   const placedGeometry = placedGeometries.get(i);
    //   const mesh = getPlacedGeometry(ifcApi, modelID, placedGeometry);
    //   if (map.has(mesh.material)) {
    //     map.get(mesh.material)!.push(mesh.geometry);
    //   } else {
    //     map.set(mesh.material, [mesh.geometry]);
    //   }
    // }
  });

  // for (const [material, geometries] of map) {
  //   const combinedGeometry = mergeGeometries(geometries);
  //   const mergedMesh = new Mesh(combinedGeometry, material);
  //   // rotateYToZUpward(mergedMesh, Math.PI * 0.5);
  //   // mergedMesh.scale.multiplyScalar(SCALE);
  //   meshes.push(mergedMesh);
  // }
  // scene.add(...meshes);
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

  const getDebugMesh = (expressID: number): THREE.Mesh | undefined => {
    return map.get(expressID);
  };

  return {
    isLoaded,
    getFragmentsModels,
    loadIFCFile,
    getDebugMesh,
    dispose,
  };
});

import * as THREE from 'three';
import { useIFCViewerStore } from '@/stores/ifcViewer';
import { useModelPropertiesStore } from '@/stores/modelProperties';
import CameraControls from 'camera-controls';
import * as FRAGS from '@thatopen/fragments';
import * as OBC from '@thatopen/components';
import { CameraType } from '@/types/three';

const lookAtModel = (model: FRAGS.FragmentsGroup, controls: CameraControls) => {
  const box = new THREE.Box3().setFromObject(model);
  if (!controls) return;

  const offset = 10;
  controls.fitToBox(box, true, {
    cover: true,
    paddingLeft: offset,
    paddingRight: 2 * offset,
    paddingBottom: offset,
    paddingTop: 2 * offset,
  });
  const target = box.getCenter(new THREE.Vector3());
  controls.setTarget(target.x, target.y, target.z);
};

export function useIFCLoader() {
  const store = useIFCViewerStore();
  const propertiesStore = useModelPropertiesStore();

  const loadIFC = async (file: File) => {
    const { world, components } = store;
    if (!world || !components) return;

    try {
      const ifcLoader = components.get(OBC.IfcLoader);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const model = await ifcLoader.load(buffer);
      world.scene.three.add(model);

      // look at model
      lookAtModel(model, world?.camera.controls as CameraControls);

      // get properties
      const propsManager = components.get(OBC.IfcPropertiesManager);
      await propsManager.setData(model);
      propsManager;
      const localProperties = await model.getLocalProperties();
      const propertyTypes = await model.getAllPropertiesTypes();
      const allProperties = [];
      for (const propertyType of propertyTypes) {
        const properties = await model.getAllPropertiesOfType(propertyType);
        allProperties.push(properties);
      }
      console.log(allProperties);
      if (localProperties) {
        propertiesStore.setProperties(localProperties as any);
      }

      world.camera.controls?.fitToBox(model, true, {
        cover: true,
        paddingLeft: 10,
        paddingRight: 2 * 10,
        paddingBottom: 10,
        paddingTop: 2 * 10,
      });
      return model;
    } catch (error) {
      console.error('Error loading IFC file:', error);
      throw error;
    }
  };

  const loadIFCNew = async (file: File) => {
    const { world, components } = store;
    if (!world || !components) return;

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
    // fragments.baseCoordinates = [0, 0, 0];
    fragments.settings.graphicsQuality = 1;
    world.camera.controls?.addEventListener('rest', () => fragments.update(true));
    world.camera.controls?.addEventListener('update', () => fragments.update());

    // load model into scene
    const model = await fragments.load(fragmentBytes, { modelId: 'example' });
    world.scene.three.add(model.object);

    const camera = world.camera.three as CameraType;
    model.useCamera(camera);

    store.fragmentsModels = fragments;
    await fragments.update(true);

    const controls = world.camera.controls as CameraControls;
    await controls.fitToBox(model.box, true, {
      cover: true,
      paddingLeft: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingTop: 10,
    });
    // const center = model.box.getCenter(new THREE.Vector3());
    // await controls.lookInDirectionOf(center.x, center.y, center.z, true);
  };

  return {
    loadIFC,
    loadIFCNew,
  };
}

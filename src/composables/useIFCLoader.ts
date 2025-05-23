import * as THREE from 'three';
import { useIFCViewerStore } from '@/stores/ifcViewer';
import CameraControls from 'camera-controls';
import * as FRAGS from '@thatopen/fragments';
import * as OBC from '@thatopen/components';

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

  const loadIFC = async (file: File) => {
    if (!store.world || !store.components) return;

    try {
      const ifcLoader = store.components.get(OBC.IfcLoader);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const model = await ifcLoader.load(buffer);
      store.world.scene.three.add(model);

      // look at model
      lookAtModel(model, store.world?.camera.controls as CameraControls);
      return model;
    } catch (error) {
      console.error('Error loading IFC file:', error);
      throw error;
    }
  };

  return {
    loadIFC,
  };
}

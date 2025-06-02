import { useThree } from '@/stores/threeStore';
import { FragmentsModel, FragmentsModels, ItemAttribute } from '@thatopen/fragments';
import CameraControls from 'camera-controls';
import { Box3, Sphere, Vector3 } from 'three';

interface BuildingStorey {
  _localId: number;
  model: {
    box: Box3;
  };
}

interface PlanData {
  _localId: ItemAttribute;
  Elevation: ItemAttribute;
  Name: ItemAttribute;
  LongName: ItemAttribute;
  ObjectType: ItemAttribute;
}

export interface Plan {
  id: string;
  name: string;
  elevation: number;
}

export class PlansManager {
  private _fragmentsModels: FragmentsModels;
  private _model: FragmentsModel | undefined;
  private _storeys: BuildingStorey[] = [];

  constructor(fragmentsModels: FragmentsModels) {
    this._fragmentsModels = fragmentsModels;
    this._model = this._fragmentsModels.models.list.values().next().value;
  }

  async generate(): Promise<Plan[]> {
    const storeys = await this._model?.getItemsOfCategory('IFCBUILDINGSTOREY');

    if (!storeys) {
      throw new Error('Floorplans not found!');
    }

    this._storeys.length = 0;
    const plans: Plan[] = [];
    for (const _temp of Object.values(storeys)) {
      const storey = _temp as unknown as BuildingStorey;
      const localId = storey._localId;
      const storeyData = await this._model?.getItemsData([localId]);
      if (!storeyData) continue;
      const data = storeyData[0] as unknown as PlanData;
      if (!data) continue;

      this._storeys.push(storey);
      plans.push({
        id: data._localId.value,
        name: data.LongName.value,
        elevation: data.Elevation.value,
      });
    }

    return plans;
  }

  async goTo(planId: number | null) {
    const threeStore = useThree();
    const { activeControls, renderer, render, clock } = threeStore;
    if (planId) {
      // switch to orthographic camera
      activeControls.disconnect();
      threeStore.activeControls = threeStore.controls2d;
      activeControls.connect(renderer.domElement);
      activeControls.update(clock.getDelta());
      const storey = this._storeys.find((s) => s._localId === planId);
      if (storey) {
        activeControls.dollyToCursor = true;
        activeControls.mouseButtons.wheel = CameraControls.ACTION.DOLLY;
        await activeControls.lookInDirectionOf(0, 0, 1);
        activeControls.setTarget(0, 0, 0);
        // const sphere = storey.model.box.getBoundingSphere(new Sphere());
        // if (sphere) {
        //   activeControls.fitToSphere(sphere, true);
        // }
      }
      console.log(planId);
    } else {
      // switch to perspective camera
      activeControls.disconnect();
      threeStore.activeControls = threeStore.controls3d;
      activeControls.connect(renderer.domElement);
      activeControls.update(clock.getDelta());
      const sphere = this._model?.box.getBoundingSphere(new Sphere());
      if (sphere) {
        activeControls.fitToSphere(sphere, true);
      }
    }

    render(true);
  }
}

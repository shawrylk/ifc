import { useThree } from '@/stores/threeStore';
import { FragmentsModel, FragmentsModels, ItemAttribute } from '@thatopen/fragments';
import { Box3, Sphere } from 'three';
import * as THREE from 'three';
import { Viewport, ViewportMode } from './Viewport';

interface BuildingStorey {
  _localId: number;
  name: string;
  model: {
    object: {
      children: THREE.Object3D[];
    };
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
      storey.name = data.LongName.value;
      const TODO_HARDCODED_UNIT = 1000;
      plans.push({
        id: data._localId.value,
        name: data.LongName.value,
        elevation: Number((data.Elevation.value / TODO_HARDCODED_UNIT).toFixed(2)),
      });
    }

    return plans;
  }

  async goTo(planId: number | null, viewport?: Viewport) {
    const threeStore = useThree();
    const { clock, mainViewport, forceUpdate } = threeStore;
    const view = viewport ?? mainViewport;
    if (planId) {
      view?.switchMode(ViewportMode.TWO_D);
      const controls2d = view?.controls;
      const storey = this._storeys.find((s) => s._localId === planId);
      if (storey) {
        const storeyData = await this._model?.getItemsData([storey._localId]);
        if (storeyData) {
          const items = await this._model?.getItemsByVisibility(true);
          await this._model?.setVisible(items, false);
          const children = await this._model?.getItemsChildren([storey._localId]);
          await this._model?.setVisible(children, true);
          const data = storeyData[0] as unknown as PlanData;
          if (data) {
            const TODO_HARDCODED_UNIT = 1000;
            const elevation = data.Elevation.value / TODO_HARDCODED_UNIT;
            await controls2d?.setLookAt(0, elevation + 5, 0, 0, elevation, 0, false);
          }
        }
        if (controls2d) {
          controls2d.dollyToCursor = true;
          controls2d.update(clock.getDelta());
        }
      }
      console.log(planId);
    } else {
      view?.switchMode(ViewportMode.THREE_D);
      const controls3d = view?.controls;
      const items = await this._model?.getItemsByVisibility(false);
      await this._model?.setVisible(items, true);
      const sphere = this._model?.box.getBoundingSphere(new Sphere());
      if (sphere && controls3d) {
        controls3d.fitToSphere(sphere, false);
        controls3d.update(clock.getDelta());
      }
    }
    forceUpdate(view, this._fragmentsModels);
  }

  async reset(viewport: Viewport | null) {
    const threeStore = useThree();
    const { forceUpdate } = threeStore;
    const items = await this._model?.getItemsByVisibility(false);
    await this._model?.setVisible(items, true);
    forceUpdate(viewport, this._fragmentsModels);
  }

  getStorey(planId: number) {
    return this._storeys.find((s) => s._localId === planId);
  }
}

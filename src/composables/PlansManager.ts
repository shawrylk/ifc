import { useThree } from '@/stores/threeStore';
import { FragmentsModel, FragmentsModels, ItemAttribute } from '@thatopen/fragments';

class BuildingStorey {
  _localId: number = 0;
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
  constructor(fragmentsModels: FragmentsModels) {
    this._fragmentsModels = fragmentsModels;
    this._model = this._fragmentsModels.models.list.values().next().value;
  }

  async generate(): Promise<Plan[]> {
    const storeys = await this._model?.getItemsOfCategory('IFCBUILDINGSTOREY');

    if (!storeys) {
      throw new Error('Floorplans not found!');
    }

    const plans: Plan[] = [];
    for (const _temp of Object.values(storeys)) {
      const storey = _temp as unknown as BuildingStorey;
      const localId = storey._localId;
      const storeyData = await this._model?.getItemsData([localId]);
      if (!storeyData) continue;
      const data = storeyData[0] as unknown as PlanData;
      if (!data) continue;

      plans.push({
        id: data._localId.value,
        name: data.LongName.value,
        elevation: data.Elevation.value,
      });
    }

    return plans;
  }

  goTo(planId: number | null) {
    const { camera } = useThree();
    if (planId) {
      // switch to orthographic camera
      console.log(planId);
    } else {
      // switch to perspective camera
    }
  }
}

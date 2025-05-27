import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';

export interface IFCViewerState {
  components: OBC.Components | null;
  world: OBC.World | null;
  fragmentsModels: FRAGS.FragmentsModels | null;
  isInitialized: boolean;
}

export interface IFCPropertyValue {
  type: string;
  value: any;
}

export interface IFCProperty {
  [key: string]: IFCPropertyValue;
}

export interface IFCProperties {
  [expressId: string]: IFCProperty;
}

export type AttributeValuePairs<T> = {
  [K in keyof T]: T[K] extends { value: infer V } ? V : T[K];
};

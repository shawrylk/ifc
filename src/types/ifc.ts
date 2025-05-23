import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';

export interface IFCViewerState {
  components: OBC.Components | null;
  world: OBC.World | null;
  fragmentsModels: FRAGS.FragmentsModels | null;
  isInitialized: boolean;
}

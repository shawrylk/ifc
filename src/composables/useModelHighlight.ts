import * as THREE from 'three';
import * as OBCF from '@thatopen/components-front';
import type { IFCViewerState } from '@/types/ifc';
import type { FragmentIdMap } from '@thatopen/fragments';

interface ExtendedIFCViewerState extends IFCViewerState {
  currentModel: any | null;
}

export const useModelHighlight = (store: ExtendedIFCViewerState) => {
  let highlighter: OBCF.Highlighter | null = null;
  let outliner: OBCF.Outliner | null = null;

  const setupHighlighting = () => {
    if (!store.components || !store.world) return;

    // Setup highlighter
    highlighter = store.components.get(OBCF.Highlighter);
    highlighter.setup({ world: store.world, hoverColor: new THREE.Color(0x5efff7) });
    highlighter.zoomToSelection = true;

    // Setup outliner
    outliner = store.components.get(OBCF.Outliner);
    outliner.world = store.world;
    outliner.enabled = true;

    // Create highlight style
    outliner.create(
      'default',
      new THREE.MeshBasicMaterial({
        color: 0xbcf124,
        transparent: true,
        opacity: 0.5,
      })
    );

    // Bind highlighter events to outliner
    highlighter.events.select.onHighlight.add((data) => {
      outliner?.clear('default');
      outliner?.add('default', data);
    });

    highlighter.events.select.onClear.add(() => {
      outliner?.clear('default');
    });
  };

  const onSelect = (callback: (data: FragmentIdMap) => void) => {
    if (!highlighter) return;
    highlighter.events.select.onHighlight.add(callback);
  };

  const onDeselect = (callback: () => void) => {
    if (!highlighter) return;
    highlighter.events.select.onClear.add(callback);
  };

  const dispose = () => {
    if (highlighter) {
      highlighter.dispose();
      highlighter = null;
    }
    if (outliner) {
      outliner.dispose();
      outliner = null;
    }
  };

  return {
    setupHighlighting,
    dispose,
    onSelect,
    onDeselect,
  };
};

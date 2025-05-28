import * as THREE from 'three';
import type { FragmentIdMap } from '@thatopen/fragments';
import { useIFCViewerStore } from '@/stores/ifcViewer';
import * as FRAGS from '@thatopen/fragments';
import { CameraType } from '@/types/three';
import { useModelSelection } from './useModelSelection';

type EventHandler = (event: MouseEvent) => void;

// Selection highlight material
const selectionMaterial: FRAGS.MaterialDefinition = {
  color: new THREE.Color('gold'),
  renderedFaces: FRAGS.RenderedFaces.TWO,
  opacity: 1,
  transparent: false,
};

// Hover highlight material (paler and more transparent)
const hoverMaterial: FRAGS.MaterialDefinition = {
  color: new THREE.Color('gold').multiplyScalar(0.7), // Paler color
  renderedFaces: FRAGS.RenderedFaces.TWO,
  opacity: 0.5,
  transparent: true,
};

const highlight = async (
  model: FRAGS.FragmentsModel,
  id: number,
  material: FRAGS.MaterialDefinition
) => {
  if (!id) return;
  await model.highlight([id], material);
};

const resetHighlight = async (model: FRAGS.FragmentsModel, id: number) => {
  if (!id) return;
  await model.resetHighlight([id]);
};

export const useModelHighlight = () => {
  const store = useIFCViewerStore();
  const { onItemSelected, onItemDeselected } = useModelSelection();
  // let highlighter: OBCF.Highlighter | null = null;
  // let outliner: OBCF.Outliner | null = null;

  // Store event handlers for cleanup
  const eventHandlers = new Map<string, { move: EventHandler; click: EventHandler }>();

  const setupHighlighting = () => {
    const { world, components, fragmentsModels } = store;
    if (!components || !world || !fragmentsModels) return;

    const container = world.renderer?.three.domElement;
    const mouse = new THREE.Vector2();

    let localId: number | null = null;
    let hoveredId: number | null = null;

    const handleMouseMove = async (event: MouseEvent, model: FRAGS.FragmentsModel) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;

      const result = await model.raycast({
        camera: world.camera.three as CameraType,
        mouse,
        dom: world.renderer!.three.domElement!,
      });

      // Handle hover effect
      const promises = [];
      if (result) {
        const newHoveredId = result.localId;
        if (newHoveredId !== hoveredId && newHoveredId !== localId) {
          // Reset previous hover
          if (hoveredId) {
            promises.push(resetHighlight(model, hoveredId));
          }
          // Set new hover
          hoveredId = newHoveredId;
          promises.push(highlight(model, hoveredId, hoverMaterial));
        }
      } else if (hoveredId) {
        // Reset hover when mouse is not over any element
        promises.push(resetHighlight(model, hoveredId));
        hoveredId = null;
      }
      promises.push(fragmentsModels.update(true));
      await Promise.all(promises);
    };

    const handleClick = async (
      event: MouseEvent,
      model: FRAGS.FragmentsModel,
      modelName: string
    ) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;

      const result = await model.raycast({
        camera: world.camera.three as CameraType,
        mouse,
        dom: world.renderer!.three.domElement!,
      });

      const promises = [];
      if (result) {
        // Reset previous selection
        if (localId) {
          promises.push(resetHighlight(model, localId));
        }
        // Reset hover if it exists
        if (hoveredId) {
          promises.push(resetHighlight(model, hoveredId));
          hoveredId = null;
        }

        localId = result.localId;
        const data: FragmentIdMap = { [modelName]: new Set([localId]) };
        onItemSelected(data);
        promises.push(highlight(model, localId, selectionMaterial));
      } else {
        // Reset selection
        if (localId) {
          promises.push(resetHighlight(model, localId));
          localId = null;
          onItemDeselected();
        }
      }
      promises.push(fragmentsModels.update(true));
      await Promise.all(promises);
    };

    for (const [modelName, model] of fragmentsModels.models.list) {
      // Create bound event handlers
      const moveHandler = (event: MouseEvent) => handleMouseMove(event, model);
      const clickHandler = (event: MouseEvent) => handleClick(event, model, modelName);

      // Store handlers for cleanup
      eventHandlers.set(modelName, { move: moveHandler, click: clickHandler });

      // Add event listeners
      container?.addEventListener('mousemove', moveHandler);
      container?.addEventListener('click', clickHandler);
    }
  };

  let highlightId: number | null = null;
  const highlightSelectedItem = async (model: FRAGS.FragmentsModel, localId: number) => {
    const { world, components, fragmentsModels } = store;
    if (!components || !world || !fragmentsModels) return;

    const promises = [];
    // Reset previous selection
    if (highlightId) {
      promises.push(resetHighlight(model, highlightId));
    }

    highlightId = localId;
    promises.push(highlight(model, localId, selectionMaterial));
    promises.push(fragmentsModels.update(true));
    await Promise.all(promises);
  };

  const dispose = () => {
    const { world } = store;
    const container = world?.renderer?.three.domElement;

    // Remove all event listeners
    eventHandlers.forEach((handlers) => {
      if (container) {
        container.removeEventListener('mousemove', handlers.move);
        container.removeEventListener('click', handlers.click);
      }
    });

    // Clear the handlers map
    eventHandlers.clear();
  };

  return {
    setupHighlighting,
    highlightSelectedItem,
    dispose,
  };
};

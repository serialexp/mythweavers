import { Accessor } from "solid-js";
import * as PIXI from "pixi.js";
import { PixiContainers } from "./usePixiMap";
import { Fleet, Landmark, Hyperlane } from "../../types/core";
import { getFleetPositionAtTime } from "../../utils/fleetUtils";
import { calculateOptimalPath, PathSegment, formatTravelTime } from "../../utils/maps/pathfinding";

export interface UsePathfindingOptions {
  containers: Accessor<PixiContainers>;
  mapSprite: Accessor<PIXI.Sprite | null>;
  currentStoryTime: Accessor<number>;
  landmarks: Accessor<Landmark[]>;
  hyperlanes: Accessor<Hyperlane[]>;
}

export interface UsePathfindingReturn {
  showPathPreview: (fleet: Fleet, targetX: number, targetY: number) => { travelTime: number; segments: PathSegment[] } | null;
  hidePathPreview: () => void;
  clearPathPreview: () => void;
}

/**
 * Hook to manage pathfinding visualization on the map
 */
export function usePathfinding(
  options: UsePathfindingOptions
): UsePathfindingReturn {
  const { containers, mapSprite, currentStoryTime, landmarks, hyperlanes } = options;

  // Preview graphics for pathfinding
  let previewGraphics: PIXI.Graphics | null = null;
  let previewTextLabel: PIXI.Text | null = null;

  const showPathPreview = (fleet: Fleet, targetX: number, targetY: number) => {
    const pathContainer = containers().paths;
    const labelContainer = containers().label;
    const sprite = mapSprite();

    if (!pathContainer || !labelContainer || !sprite) return null;

    // Get fleet's current position
    const fleetPosition = getFleetPositionAtTime(fleet, currentStoryTime());

    // Calculate optimal path
    const result = calculateOptimalPath(
      fleetPosition.x,
      fleetPosition.y,
      targetX,
      targetY,
      landmarks(),
      hyperlanes(),
      fleet.hyperdriveRating
    );

    // Create or reuse preview graphics
    if (!previewGraphics || previewGraphics.parent !== pathContainer) {
      previewGraphics = new PIXI.Graphics();
      previewGraphics.eventMode = 'none'; // Non-interactive
      pathContainer.addChild(previewGraphics);
    } else {
      previewGraphics.clear();
    }

    // Draw each segment
    for (const segment of result.segments) {
      const startWorldX = segment.startX * sprite.width;
      const startWorldY = segment.startY * sprite.height;
      const endWorldX = segment.endX * sprite.width;
      const endWorldY = segment.endY * sprite.height;

      if (segment.type === 'hyperlane') {
        // Hyperlane segments: bright cyan/blue, slightly thicker
        previewGraphics.moveTo(startWorldX, startWorldY);
        previewGraphics.lineTo(endWorldX, endWorldY);
        previewGraphics.stroke({ width: 3, color: 0x00ffff, alpha: 0.8 });
      } else {
        // Normal space segments: dashed yellow line
        drawDashedLine(
          previewGraphics,
          startWorldX,
          startWorldY,
          endWorldX,
          endWorldY,
          10,
          5,
          0xffff00,
          0.6
        );
      }
    }

    // Create or update text label showing travel time
    if (!previewTextLabel || previewTextLabel.parent !== labelContainer) {
      previewTextLabel = new PIXI.Text('', {
        fontSize: 14,
        fill: 0xffffff,
        stroke: {
          color: 0x000000,
          width: 3,
        },
        fontWeight: 'bold',
        align: 'center',
      });
      labelContainer.addChild(previewTextLabel);
    }

    // Position label at target position
    const travelTimeText = formatTravelTime(result.totalTime);
    previewTextLabel.text = `Travel time: ${travelTimeText}`;
    previewTextLabel.x = targetX * sprite.width;
    previewTextLabel.y = targetY * sprite.height - 30; // Position above target
    previewTextLabel.anchor.set(0.5, 1);
    previewTextLabel.visible = true;

    return {
      travelTime: result.totalTime,
      segments: result.segments
    };
  };

  const hidePathPreview = () => {
    if (previewGraphics) {
      previewGraphics.clear();
    }
    if (previewTextLabel) {
      previewTextLabel.visible = false;
    }
  };

  const clearPathPreview = () => {
    const pathContainer = containers().paths;
    const labelContainer = containers().label;

    if (previewGraphics && pathContainer) {
      pathContainer.removeChild(previewGraphics);
      previewGraphics.destroy();
      previewGraphics = null;
    }

    if (previewTextLabel && labelContainer) {
      labelContainer.removeChild(previewTextLabel);
      previewTextLabel.destroy();
      previewTextLabel = null;
    }
  };

  // Helper function to draw dashed lines
  const drawDashedLine = (
    graphics: PIXI.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number,
    color: number,
    alpha: number
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dashCount = Math.floor(distance / (dashLength + gapLength));
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    for (let i = 0; i < dashCount; i++) {
      const startDist = i * (dashLength + gapLength);
      const endDist = startDist + dashLength;

      const startX = x1 + normalizedDx * startDist;
      const startY = y1 + normalizedDy * startDist;
      const endX = x1 + normalizedDx * endDist;
      const endY = y1 + normalizedDy * endDist;

      graphics.moveTo(startX, startY);
      graphics.lineTo(endX, endY);
      graphics.stroke({ width: 3, color, alpha });
    }

    // Draw remaining segment if any
    const remainingDist = distance - dashCount * (dashLength + gapLength);
    if (remainingDist > 0) {
      const startDist = dashCount * (dashLength + gapLength);
      const startX = x1 + normalizedDx * startDist;
      const startY = y1 + normalizedDy * startDist;
      const endX = x1 + normalizedDx * (startDist + Math.min(remainingDist, dashLength));
      const endY = y1 + normalizedDy * (startDist + Math.min(remainingDist, dashLength));

      graphics.moveTo(startX, startY);
      graphics.lineTo(endX, endY);
      graphics.stroke({ width: 3, color, alpha });
    }
  };

  return {
    showPathPreview,
    hidePathPreview,
    clearPathPreview,
  };
}

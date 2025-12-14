import * as PIXI from "pixi.js";
import { Fleet } from "../../types/core";
import { FleetPosition } from "../fleetUtils";

// Size mapping for fleets (triangle base/height in pixels)
const SIZE_MAP = {
  small: 10,
  medium: 14,
  large: 18,
};

// Extended FleetSprite interface
export interface FleetSprite extends PIXI.Graphics {
  fleetData?: Fleet;
  labelText?: PIXI.Text;
  designationText?: PIXI.Text;
  statusIndicator?: PIXI.Graphics;
}

/**
 * Options for creating fleet sprites
 */
export interface FleetRenderOptions {
  position: FleetPosition;
  parseColorToHex: (color: string) => number;
  onPointerDown?: (fleet: Fleet, e: PIXI.FederatedPointerEvent) => void;
  isSelected?: boolean;
}

/**
 * Create a fleet sprite with all visual elements and interactions
 */
export function createFleetSprite(
  fleet: Fleet,
  options: FleetRenderOptions,
): FleetSprite {
  const sprite = new PIXI.Graphics() as FleetSprite;
  sprite.fleetData = { ...fleet };

  const size = SIZE_MAP[fleet.size || "medium"];
  sprite.clear();

  // Parse color
  const color = fleet.color ? options.parseColorToHex(fleet.color) : 0x00ff00; // Default green

  // Draw fleet marker based on variant
  const variant = fleet.variant || "military";
  const height = size * 1.5;
  const baseWidth = size;

  if (variant === "military") {
    // Military: Triangle with star background (capital/combat fleet)
    // Draw star behind the triangle with white outline and fleet color fill
    const starRadius = size * 0.7;
    const starInnerRadius = size * 0.3;

    // Draw star shape
    const step = Math.PI / 5;
    let rotation = -Math.PI / 2;
    sprite.moveTo(
      Math.cos(rotation) * starRadius,
      Math.sin(rotation) * starRadius,
    );
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? starInnerRadius : starRadius;
      rotation += step;
      sprite.lineTo(Math.cos(rotation) * radius, Math.sin(rotation) * radius);
    }
    sprite.closePath();
    sprite.stroke({ width: 2, color: 0xffffff, alpha: 1 });
    sprite.fill({ color, alpha: 0.6 });

    // Draw triangle pointing up on top
    sprite
      .moveTo(0, -height / 2)
      .lineTo(-baseWidth / 2, height / 2)
      .lineTo(baseWidth / 2, height / 2)
      .closePath()
      .stroke({ width: 2, color: 0xffffff, alpha: 1 })
      .fill({ color });
  } else if (variant === "transport") {
    // Transport: Rectangular/cargo shape
    const rectWidth = size * 1.2;
    const rectHeight = size * 1.0;

    sprite
      .rect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight)
      .stroke({ width: 2, color: 0xffffff, alpha: 1 })
      .fill({ color });

    // Add "cargo lines" detail
    sprite.moveTo(-rectWidth / 2 + 2, -rectHeight / 4);
    sprite.lineTo(rectWidth / 2 - 2, -rectHeight / 4);
    sprite.moveTo(-rectWidth / 2 + 2, rectHeight / 4);
    sprite.lineTo(rectWidth / 2 - 2, rectHeight / 4);
    sprite.stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  } else if (variant === "scout") {
    // Scout: Diamond shape (fast/reconnaissance)
    const diamondSize = size * 1.3;

    sprite
      .moveTo(0, -diamondSize / 2)
      .lineTo(diamondSize / 2, 0)
      .lineTo(0, diamondSize / 2)
      .lineTo(-diamondSize / 2, 0)
      .closePath()
      .stroke({ width: 2, color: 0xffffff, alpha: 1 })
      .fill({ color });
  }

  // Add status indicator (small dot at the bottom)
  const statusIndicator = new PIXI.Graphics();
  const indicatorColor =
    options.position.status === "in_transit" ? 0xffaa00 : 0x00ff00;
  const indicatorSize = 3;

  statusIndicator.circle(0, height / 2 + indicatorSize + 2, indicatorSize);
  statusIndicator.fill({ color: indicatorColor, alpha: 0.8 });
  sprite.addChild(statusIndicator);
  sprite.statusIndicator = statusIndicator;

  // Add selection indicator (blue circle) if selected
  if (options.isSelected) {
    const selectionCircle = new PIXI.Graphics();
    const selectionRadius = size * 1.5;
    selectionCircle.circle(0, 0, selectionRadius);
    selectionCircle.stroke({ width: 2, color: 0x3498db, alpha: 0.8 });
    sprite.addChildAt(selectionCircle, 0); // Add behind the fleet marker
  }

  // Add designation text if fleet has one
  if (fleet.designation) {
    // Always render at 16px for quality, then scale down to desired size
    const baseFontSize = 24;
    const strokeWidth = 2;

    const designationText = new PIXI.Text(fleet.designation, {
      fontSize: baseFontSize,
      fill: 0xffffff,
      stroke: {
        color: 0x000000,
        width: strokeWidth,
      },
      fontWeight: "bold",
      align: "center",
    });

    // Scale down to achieve the desired visual size (small: 6, medium: 8, large: 10)
    const targetSizeMap = { small: 5, medium: 6.5, large: 9 };
    const targetSize = targetSizeMap[fleet.size || "medium"];
    const textScale = targetSize / baseFontSize;

    designationText.scale.set(textScale, textScale);
    designationText.anchor.set(0.5, 0.5);
    designationText.y = height * 0.3; // Position slightly below center, in the wider part of the triangle
    sprite.addChild(designationText);
    sprite.designationText = designationText;
  }

  // Set initial appearance
  sprite.alpha = 0.9;

  // Make interactive
  sprite.eventMode = "static";
  sprite.cursor = "pointer";

  // Add hover effects
  const originalScale = 1;
  const hoverScale = 1.3;

  sprite.on("pointerover", () => {
    sprite.scale.set(hoverScale, hoverScale);
    sprite.alpha = 1;
    if (sprite.labelText) {
      sprite.labelText.visible = true;
    }
  });

  sprite.on("pointerout", () => {
    sprite.scale.set(originalScale, originalScale);
    sprite.alpha = 0.9;
    if (sprite.labelText) {
      sprite.labelText.visible = false;
    }
  });

  // Handle click if callback provided
  if (options.onPointerDown) {
    sprite.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if ("preventDefault" in e) {
        (e as any).preventDefault();
      }
      options.onPointerDown!(fleet, e);
    });
  }

  return sprite;
}

/**
 * Create label text for a fleet
 */
export function createFleetLabelText(fleet: Fleet, size: number): PIXI.Text {
  const labelText = new PIXI.Text(fleet.name, {
    fontSize: 12,
    fill: 0xffffff,
    stroke: {
      color: 0x000000,
      width: 3,
    },
    fontWeight: "bold",
    align: "center",
  });

  labelText.anchor.set(0.5, 1);
  labelText.y = -(size * 1.5) / 2 - 10;
  labelText.visible = false;

  return labelText;
}

/**
 * Position fleet sprite and label on the map
 */
export function positionFleet(
  sprite: FleetSprite,
  position: FleetPosition,
  mapWidth: number,
  mapHeight: number,
): void {
  sprite.x = position.x * mapWidth;
  sprite.y = position.y * mapHeight;

  const size = SIZE_MAP[sprite.fleetData?.size || "medium"];
  if (sprite.labelText) {
    sprite.labelText.x = sprite.x;
    sprite.labelText.y = sprite.y - (size * 1.5) / 2 - 10;
  }
}

/**
 * Update status indicator for a fleet sprite
 */
export function updateFleetStatus(
  sprite: FleetSprite,
  status: "stationed" | "in_transit",
): void {
  if (sprite.statusIndicator) {
    const indicatorColor = status === "in_transit" ? 0xffaa00 : 0x00ff00;
    sprite.statusIndicator.clear();
    sprite.statusIndicator.circle(
      0,
      (SIZE_MAP[sprite.fleetData?.size || "medium"] * 1.5) / 2 + 5,
      3,
    );
    sprite.statusIndicator.fill({ color: indicatorColor, alpha: 0.8 });
  }
}

/**
 * Check if two fleets have different visual properties
 */
export function fleetHasChanged(oldData: Fleet, newData: Fleet): boolean {
  return (
    oldData.name !== newData.name ||
    oldData.description !== newData.description ||
    oldData.designation !== newData.designation ||
    oldData.color !== newData.color ||
    oldData.size !== newData.size ||
    oldData.variant !== newData.variant ||
    oldData.defaultX !== newData.defaultX ||
    oldData.defaultY !== newData.defaultY ||
    oldData.hyperdriveRating !== newData.hyperdriveRating
  );
}

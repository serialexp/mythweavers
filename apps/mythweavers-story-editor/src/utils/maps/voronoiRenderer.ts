import * as PIXI from "pixi.js";
import { Delaunay } from "d3-delaunay";
import { ColoredLandmark } from "./colorUtils";

/**
 * Handle for progressive rendering animation
 */
export interface AnimationHandle {
  id: number | null;
  cancel: () => void;
}

/**
 * Draw standard Voronoi diagram
 */
export function drawStandardVoronoi(
  container: PIXI.Container,
  landmarks: ColoredLandmark[],
  mapWidth: number,
  mapHeight: number
): void {
  if (landmarks.length < 2) return;

  // Create Delaunay triangulation
  const points: [number, number][] = landmarks.map(l => [l.x, l.y] as [number, number]);
  const delaunay = Delaunay.from(points);

  // Create Voronoi diagram with bounds
  const voronoi = delaunay.voronoi([0, 0, mapWidth, mapHeight]);

  // Draw Voronoi cells - create a separate Graphics object for each cell
  for (let i = 0; i < landmarks.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (cell && cell.length > 0) {
      const cellGraphics = new PIXI.Graphics();

      // Build the polygon path
      cellGraphics.poly(cell.flat());

      // Fill with semi-transparent color
      cellGraphics.fill({ color: landmarks[i].color, alpha: 0.2 });

      // For borders, use a lighter color for dark colors to ensure visibility
      const borderColor = landmarks[i].color;
      const isVeryDark = borderColor < 0x333333;

      // Draw border with appropriate color - use white for very dark colors
      cellGraphics.poly(cell.flat());
      cellGraphics.stroke({
        color: isVeryDark ? 0xffffff : borderColor,
        alpha: isVeryDark ? 0.3 : 0.5,
        width: 2
      });

      container.addChild(cellGraphics);
    }
  }
}

/**
 * Draw distance field (metaball) visualization with progressive rendering
 * Returns an animation handle that can be used to cancel the rendering
 */
export function drawDistanceField(
  container: PIXI.Container,
  landmarks: ColoredLandmark[],
  mapWidth: number,
  mapHeight: number
): AnimationHandle {
  let animationId: number | null = null;

  // Calculate average distance to nearest neighbor for adaptive radius
  let avgNearestDistance = 0;
  if (landmarks.length > 1) {
    for (const landmark of landmarks) {
      let minDist = Infinity;
      for (const other of landmarks) {
        if (other === landmark) continue;
        const dx = landmark.x - other.x;
        const dy = landmark.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) minDist = dist;
      }
      avgNearestDistance += minDist;
    }
    avgNearestDistance /= landmarks.length;
  } else if (landmarks.length === 1) {
    // Single point: use a fraction of map size
    avgNearestDistance = Math.min(mapWidth, mapHeight) * 0.3;
  }

  // Set influence radius to 1.5x average nearest neighbor distance
  const influenceRadius = avgNearestDistance * 1.5;

  // Adjust resolution based on density - minimum 3, maximum 30
  const resolution = Math.max(3, Math.min(30, avgNearestDistance / 15));
  const width = Math.ceil(mapWidth / resolution);
  const height = Math.ceil(mapHeight / resolution);

  console.log(`Distance field: ${width}x${height} grid (${width * height} cells), influence radius: ${influenceRadius.toFixed(0)}px, resolution: ${resolution}px`);
  console.log(`Starting distance field render with ${landmarks.length} landmarks`);

  const graphics = new PIXI.Graphics();

  // Progressive rendering state
  let currentRow = 0;
  const frameTimeBudget = 16; // 16ms for 60fps

  const renderChunk = () => {
    const startTime = performance.now();

    // Process rows until we run out of time budget
    while (currentRow < height) {
      const y = currentRow;

      for (let x = 0; x < width; x++) {
        const px = x * resolution + resolution / 2;
        const py = y * resolution + resolution / 2;

        // Calculate influences from all landmarks within 2x radius for color blending
        const influences: { color: number; distance: number; weight: number }[] = [];
        let totalWeight = 0;
        let minDistance = Infinity; // Track closest landmark for opacity

        for (const landmark of landmarks) {
          const dx = px - landmark.x;
          const dy = py - landmark.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Track minimum distance for opacity calculation (check ALL landmarks)
          if (distance < minDistance) {
            minDistance = distance;
          }

          // Only include in color blending if within 2x radius
          if (distance <= influenceRadius * 2) {
            // Single continuous weight formula - closer points always have more influence
            // Higher power = sharper territory boundaries
            const normalizedDist = distance / (influenceRadius * 2);
            const weight = Math.pow(1 - normalizedDist, 6); // Power of 6 for well-defined territories

            if (weight > 0) {
              influences.push({ color: landmark.color, distance, weight });
              totalWeight += weight;
            }
          }
        }

        // Skip if too far from any landmark (beyond 2x radius of closest)
        if (minDistance > influenceRadius * 2) continue;

        // Skip if no influences (can happen when all weights are too small)
        if (influences.length === 0) continue;

        // Blend colors based on weighted influences
        let r = 0, g = 0, b = 0;

        for (const influence of influences) {
          const normalizedWeight = influence.weight / totalWeight;
          const color = influence.color;

          // Extract RGB components
          r += ((color >> 16) & 0xff) * normalizedWeight;
          g += ((color >> 8) & 0xff) * normalizedWeight;
          b += (color & 0xff) * normalizedWeight;
        }

        // Combine RGB back to hex
        const blendedColor = ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b));

        // Simple opacity calculation based on distance to closest point
        let alpha: number;

        if (minDistance <= influenceRadius) {
          // Within influence radius: max opacity
          alpha = 0.5;
        } else if (minDistance <= influenceRadius * 2) {
          // Between 1x and 2x radius: linear falloff to 0
          const fadeDistance = minDistance - influenceRadius;
          const fadeRange = influenceRadius; // From 1x to 2x radius
          alpha = 0.5 * (1 - fadeDistance / fadeRange);
        } else {
          // Beyond 2x radius: invisible
          alpha = 0;
        }

        // Debug: log some samples to see what's happening
        if (x === Math.floor(width/2) && y % 20 === 0) {
          const zone = minDistance <= influenceRadius ? "INNER" :
                      minDistance <= influenceRadius * 2 ? "FADE" : "OUT";
          if (zone === "FADE") {
            console.log(`Row ${y}: zone=${zone}, influences=${influences.length}, totalWeight=${totalWeight.toFixed(3)}, color=#${blendedColor.toString(16).padStart(6, '0')}, r=${r.toFixed(0)}, g=${g.toFixed(0)}, b=${b.toFixed(0)}, alpha=${alpha.toFixed(2)}`);
          }
        }

        if (alpha > 0.01) {
          graphics.rect(px - resolution/2, py - resolution/2, resolution, resolution);
          graphics.fill({ color: blendedColor, alpha });
        }
      }

      currentRow++;

      // Check if we've exceeded our time budget
      const elapsed = performance.now() - startTime;
      if (elapsed > frameTimeBudget && currentRow < height) {
        // Schedule next chunk
        animationId = requestAnimationFrame(renderChunk);
        return;
      }
    }

    // All done - apply blur and add to container
    const blurFilter = new PIXI.BlurFilter({
      strength: Math.max(1, resolution / 5),
      quality: 2
    });

    graphics.filters = [blurFilter];
    container.addChild(graphics);
    animationId = null;

    console.log("Distance field rendering complete");
  };

  // Start progressive rendering
  animationId = requestAnimationFrame(renderChunk);

  // Return handle to cancel animation
  return {
    id: animationId,
    cancel: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  };
}

/**
 * Draw blurred Voronoi diagram
 */
export function drawBlurredVoronoi(
  container: PIXI.Container,
  landmarks: ColoredLandmark[],
  mapWidth: number,
  mapHeight: number
): void {
  if (landmarks.length < 2) return;

  // First draw standard Voronoi
  drawStandardVoronoi(container, landmarks, mapWidth, mapHeight);

  // Apply blur filter to the container
  const blurFilter = new PIXI.BlurFilter({
    strength: 8,
    quality: 4
  });

  container.filters = [blurFilter];
}

/**
 * Cancel any ongoing progressive rendering
 */
export function cancelAnimation(handle: AnimationHandle | null): void {
  if (handle) {
    handle.cancel();
  }
}

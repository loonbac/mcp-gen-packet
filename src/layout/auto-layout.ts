// ── Auto-layout: deterministic grid-based device positioning ──

export interface LayoutDevice {
  name: string;
  x: number;
  y: number;
}

interface AutoLayoutOptions {
  /** Number of columns in the grid (default: 4) */
  columns?: number;
  /** Minimum spacing between devices in pixels (default: 150) */
  spacing?: number;
  /** Starting X position (default: 100) */
  startX?: number;
  /** Starting Y position (default: 100) */
  startY?: number;
}

const DEFAULT_COLUMNS = 4;
const DEFAULT_SPACING = 150;
const DEFAULT_START_X = 100;
const DEFAULT_START_Y = 100;

/**
 * Generates deterministic (x, y) coordinates for devices on a grid.
 * Same input always produces same output.
 *
 * @param deviceNames - Array of device names to layout
 * @param options - Layout configuration options
 * @returns Array of LayoutDevice with name, x, y coordinates
 */
export function autoLayout(
  deviceNames: string[],
  options: AutoLayoutOptions = {},
): LayoutDevice[] {
  if (deviceNames.length === 0) {
    return [];
  }

  const columns = options.columns ?? DEFAULT_COLUMNS;
  const spacing = options.spacing ?? DEFAULT_SPACING;
  const startX = options.startX ?? DEFAULT_START_X;
  const startY = options.startY ?? DEFAULT_START_Y;

  return deviceNames.map((name, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);

    return {
      name,
      x: startX + col * spacing,
      y: startY + row * spacing,
    };
  });
}
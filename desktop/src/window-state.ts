/**
 * Window geometry, kept Electron-free so the clamp rules are testable.
 *
 * Restoring a saved position blindly is how apps end up opening off-screen
 * after a monitor is unplugged. Anything that does not land on a display with
 * a usable corner is discarded and the OS places the window instead.
 */

export type Bounds = { width: number; height: number; x?: number; y?: number };
export type Display = { x: number; y: number; width: number; height: number };

export const MIN_WIDTH = 960;
export const MIN_HEIGHT = 600;

const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
/** How much of the window must be on a display before the position is kept. */
const VISIBLE_EDGE = 120;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parse(value: unknown): (Bounds & { x: number; y: number }) | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (!isFiniteNumber(candidate.width) || !isFiniteNumber(candidate.height)) return null;
  if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) return null;
  return {
    width: candidate.width,
    height: candidate.height,
    x: candidate.x,
    y: candidate.y,
  };
}

export function clampBounds(
  saved: unknown,
  displays: Display[],
  fallback: { width: number; height: number },
): Bounds {
  const bounds = parse(saved);
  if (!bounds) return { ...fallback };

  const width = Math.max(MIN_WIDTH, Math.min(Math.round(bounds.width), MAX_WIDTH));
  const height = Math.max(MIN_HEIGHT, Math.min(Math.round(bounds.height), MAX_HEIGHT));

  const onScreen = displays.some((display) => {
    const overlapX =
      Math.min(bounds.x + width, display.x + display.width) - Math.max(bounds.x, display.x);
    const overlapY =
      Math.min(bounds.y + height, display.y + display.height) - Math.max(bounds.y, display.y);
    return overlapX >= VISIBLE_EDGE && overlapY >= VISIBLE_EDGE;
  });

  if (!onScreen) return { width, height };
  return { width, height, x: Math.round(bounds.x), y: Math.round(bounds.y) };
}

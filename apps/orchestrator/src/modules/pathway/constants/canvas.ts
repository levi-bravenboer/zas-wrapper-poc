export const CANVAS_VIEWPORT = {
  initial: { x: 0, y: 0, zoom: 1 },
  minZoom: 0.4,
  maxZoom: 2,
  fitPadding: 0.18,
  dragThreshold: 3,
} as const

export const ZOOM_SAFE_DIVISOR_FLOOR = 0.05

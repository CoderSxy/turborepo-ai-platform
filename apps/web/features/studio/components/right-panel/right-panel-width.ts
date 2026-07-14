export const RIGHT_PANEL_WIDTH_STORAGE_KEY = "sxy-studio-right-panel-width";
export const RIGHT_PANEL_MIN_WIDTH = 280;
export const RIGHT_PANEL_MAX_WIDTH = 520;
export const RIGHT_PANEL_DEFAULT_WIDTH = 326;

export function clampRightPanelWidth(width: number): number {
  return Math.min(
    RIGHT_PANEL_MAX_WIDTH,
    Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(width)),
  );
}

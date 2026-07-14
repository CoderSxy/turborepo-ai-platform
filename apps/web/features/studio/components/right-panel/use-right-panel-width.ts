"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clampRightPanelWidth,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
} from "./right-panel-width";

function loadStoredWidth(): number {
  if (typeof window === "undefined") {
    return RIGHT_PANEL_DEFAULT_WIDTH;
  }

  try {
    const raw = window.localStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return clampRightPanelWidth(parsed);
    }
  } catch {
    // ignore invalid storage
  }

  return RIGHT_PANEL_DEFAULT_WIDTH;
}

export {
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
} from "./right-panel-width";

export function useRightPanelWidth() {
  const [width, setWidthState] = useState(RIGHT_PANEL_DEFAULT_WIDTH);

  useEffect(() => {
    setWidthState(loadStoredWidth());
  }, []);

  const setWidth = useCallback((nextWidth: number) => {
    setWidthState(clampRightPanelWidth(nextWidth));
  }, []);

  const persistWidth = useCallback((nextWidth: number) => {
    const clamped = clampRightPanelWidth(nextWidth);
    setWidthState(clamped);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        RIGHT_PANEL_WIDTH_STORAGE_KEY,
        String(clamped),
      );
    }
  }, []);

  return { width, setWidth, persistWidth };
}

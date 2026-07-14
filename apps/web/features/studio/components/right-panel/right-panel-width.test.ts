import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampRightPanelWidth,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
} from "./right-panel-width.ts";

describe("clampRightPanelWidth", () => {
  it("clamps below minimum", () => {
    assert.equal(clampRightPanelWidth(100), RIGHT_PANEL_MIN_WIDTH);
  });

  it("clamps above maximum", () => {
    assert.equal(clampRightPanelWidth(900), RIGHT_PANEL_MAX_WIDTH);
  });

  it("rounds fractional widths", () => {
    assert.equal(clampRightPanelWidth(325.6), 326);
  });

  it("keeps values within range", () => {
    assert.equal(clampRightPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH), 326);
    assert.equal(clampRightPanelWidth(400), 400);
  });
});

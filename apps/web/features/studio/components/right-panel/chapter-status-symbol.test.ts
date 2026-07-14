import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getChapterStatusSymbol } from "./chapter-status-symbol.ts";

describe("getChapterStatusSymbol", () => {
  it("returns checkmark for approved chapters", () => {
    assert.equal(getChapterStatusSymbol("approved", true), "✓");
  });

  it("returns hollow circle for planned chapters", () => {
    assert.equal(getChapterStatusSymbol("planned", false), "○");
  });

  it("returns hollow circle when chapter is not generated", () => {
    assert.equal(getChapterStatusSymbol("drafting", false), "○");
  });

  it("returns filled circle for generated in-progress chapters", () => {
    assert.equal(getChapterStatusSymbol("drafting", true), "●");
    assert.equal(getChapterStatusSymbol("ready-for-review", true), "●");
  });
});

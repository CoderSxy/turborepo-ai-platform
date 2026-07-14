import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureExpanded,
  toggleExpanded,
} from "./book-tree-expand.ts";

describe("book-tree-expand", () => {
  it("ensureExpanded adds id without removing others", () => {
    const next = ensureExpanded(new Set(["a"]), "b");
    assert.equal(next.has("a"), true);
    assert.equal(next.has("b"), true);
  });

  it("toggleExpanded removes when present and adds when absent", () => {
    const removed = toggleExpanded(new Set(["a", "b"]), "a");
    assert.equal(removed.has("a"), false);
    assert.equal(removed.has("b"), true);
    const added = toggleExpanded(new Set(["b"]), "a");
    assert.equal(added.has("a"), true);
  });
});

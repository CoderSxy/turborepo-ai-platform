import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDetailTitle } from "./detail-title.ts";

describe("resolveDetailTitle", () => {
  const labelFor = (key: string) => `label:${key}`;

  it("resolves chapter detail title", () => {
    assert.equal(
      resolveDetailTitle({ type: "chapter", chapterId: "c1" }, labelFor),
      "章节详情",
    );
  });

  it("resolves core file title via lookup", () => {
    assert.equal(
      resolveDetailTitle({ type: "core-file", fileKey: "worldNotes" }, labelFor),
      "label:worldNotes",
    );
  });

  it("uses character name as title", () => {
    assert.equal(
      resolveDetailTitle({ type: "character", characterName: "林照" }, labelFor),
      "林照",
    );
  });

  it("resolves outline detail title", () => {
    assert.equal(resolveDetailTitle({ type: "outline" }, labelFor), "卷纲与章节计划");
  });
});

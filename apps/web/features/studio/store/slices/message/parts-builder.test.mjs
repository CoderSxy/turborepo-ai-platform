import assert from "node:assert/strict";
import test from "node:test";

import {
  appendProgressStep,
  buildProgressPart,
  buildResultPart,
  buildTextPart,
  updateTextPartContent,
} from "./parts-builder.ts";

test("buildTextPart returns text part", () => {
  assert.deepEqual(buildTextPart("hello"), { type: "text", content: "hello" });
});

test("buildProgressPart starts with empty steps", () => {
  const part = buildProgressPart("写下一章");
  assert.equal(part.type, "progress");
  assert.equal(part.label, "写下一章");
  assert.deepEqual(part.steps, []);
});

test("appendProgressStep adds step with timestamp", () => {
  const part = buildProgressPart("审稿");
  const next = appendProgressStep(part, "正在分析", 1000);
  assert.equal(next.steps.length, 1);
  assert.equal(next.steps[0]?.message, "正在分析");
  assert.equal(next.steps[0]?.at, 1000);
});

test("updateTextPartContent replaces content", () => {
  const part = buildTextPart("a");
  assert.deepEqual(updateTextPartContent(part, "b"), { type: "text", content: "b" });
});

test("buildResultPart includes title and content", () => {
  assert.deepEqual(buildResultPart("完成", "chapter text"), {
    type: "result",
    title: "完成",
    content: "chapter text",
  });
});

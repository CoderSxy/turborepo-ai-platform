import assert from "node:assert/strict";
import test from "node:test";

import {
  appendProgressStep,
  buildProgressPart,
  buildProgressPartFromMessages,
  buildResultPart,
  buildTextPart,
  completeProgressPart,
  formatTaskElapsedMs,
  inferProgressStatus,
  shouldExpandTaskCard,
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

test("completeProgressPart marks progress completed with summary", () => {
  const part = buildProgressPartFromMessages("写下一章", ["正在创作…"], {
    status: "running",
    startedAt: "2026-01-01T00:00:00.000Z",
  });
  const completed = completeProgressPart(part, {
    summary: "第 3 章已保存",
    completedAt: "2026-01-01T00:00:10.000Z",
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.summary, "第 3 章已保存");
  assert.equal(completed.completedAt, "2026-01-01T00:00:10.000Z");
});

test("inferProgressStatus falls back for legacy progress parts", () => {
  const progress = buildProgressPart("审稿");
  assert.equal(inferProgressStatus(progress, [{ type: "result", title: "审稿", content: "ok" }]), "completed");
  assert.equal(inferProgressStatus({ ...progress, paused: true }, []), "paused");
  assert.equal(inferProgressStatus(progress, [{ type: "error", title: "失败", detail: "x" }]), "error");
  assert.equal(inferProgressStatus(progress, []), "running");
});

test("shouldExpandTaskCard expands running/error/paused only", () => {
  assert.equal(shouldExpandTaskCard("running"), true);
  assert.equal(shouldExpandTaskCard("error"), true);
  assert.equal(shouldExpandTaskCard("paused"), true);
  assert.equal(shouldExpandTaskCard("completed"), false);
});

test("formatTaskElapsedMs renders seconds", () => {
  const elapsed = formatTaskElapsedMs(
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:05.000Z",
    Date.parse("2026-01-01T00:00:05.000Z"),
  );
  assert.equal(elapsed, "5s");
});

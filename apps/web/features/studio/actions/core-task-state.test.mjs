import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeCoreTaskPauseRequest,
  isCoreTaskPauseRequested,
  requestCoreTaskPause,
  resetCoreTaskState,
  shouldKeepPauseFlagAfterPauseRequest,
} from "./core-task-state.ts";
import { buildPausedAssistantMessage } from "../store/slices/message/parts-builder.ts";

test("requestCoreTaskPause keeps flag until consumed by runCoreAction catch", () => {
  resetCoreTaskState();
  requestCoreTaskPause();

  assert.equal(shouldKeepPauseFlagAfterPauseRequest(), true);
  assert.equal(isCoreTaskPauseRequested(), true);
});

test("consumeCoreTaskPauseRequest enters paused branch once", () => {
  resetCoreTaskState();
  requestCoreTaskPause();

  assert.equal(consumeCoreTaskPauseRequest(), true);
  assert.equal(consumeCoreTaskPauseRequest(), false);
  assert.equal(isCoreTaskPauseRequested(), false);
});

test("resetCoreTaskState clears pause flag for cancel path", () => {
  resetCoreTaskState();
  requestCoreTaskPause();

  resetCoreTaskState();

  assert.equal(isCoreTaskPauseRequested(), false);
});

test("buildPausedAssistantMessage marks progress part as paused", () => {
  const message = buildPausedAssistantMessage("assistant-1", "写下一章", ["正在生成"]);

  assert.equal(message.status, "sent");
  assert.equal(message.parts[0]?.type, "progress");
  assert.equal(message.parts[0]?.paused, true);
  assert.match(message.parts[0]?.steps[0]?.message ?? "", /正在生成/);
});

test("buildPausedAssistantMessage does not use error parts", () => {
  const message = buildPausedAssistantMessage("assistant-1", "审稿", ["分析中"]);

  assert.equal(message.parts.some((part) => part.type === "error"), false);
});

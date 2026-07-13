import assert from "node:assert/strict";
import test from "node:test";

import {
  fromStoredMessage,
  isLegacyCoreMarkdown,
  toStoredMessage,
} from "./message-bridge.ts";

test("fromStoredMessage wraps content as single text part", () => {
  const msg = fromStoredMessage({
    id: "m1",
    sessionId: "s1",
    role: "assistant",
    content: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(msg.id, "m1");
  assert.deepEqual(msg.parts, [{ type: "text", content: "hello" }]);
});

test("toStoredMessage flattens text part to content", () => {
  const stored = toStoredMessage(
    {
      id: "m2",
      role: "user",
      parts: [{ type: "text", content: "写下一章" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    "s1",
  );
  assert.equal(stored.content, "写下一章");
  assert.equal(stored.sessionId, "s1");
});

test("isLegacyCoreMarkdown detects old progress format", () => {
  const content = "## 写下一章\n\n- 等待任务开始";
  assert.equal(isLegacyCoreMarkdown(content), true);
  assert.equal(isLegacyCoreMarkdown("plain chat reply"), false);
});

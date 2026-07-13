import assert from "node:assert/strict";
import test from "node:test";

import { getStudioTaskGuard } from "./task-guard.ts";

test("getStudioTaskGuard allows start when idle", () => {
  const guard = getStudioTaskGuard(null);
  assert.equal(guard.canStart, true);
  assert.equal(guard.message, "");
});

test("getStudioTaskGuard blocks when task running", () => {
  const guard = getStudioTaskGuard({
    kind: "chat",
    label: "聊天回复",
    status: "running",
    abortController: new AbortController(),
  });
  assert.equal(guard.canStart, false);
  assert.match(guard.message, /聊天回复/);
});

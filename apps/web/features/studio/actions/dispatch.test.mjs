import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

await register("./node-test-resolve.mjs", import.meta.url);

const { dispatchStudioAction } = await import("./dispatch.ts");

test("dispatch write-chapter calls executeWriteChapter with source", async () => {
  let executed = false;
  const ctx = {
    getState: () => ({
      books: [],
      activeBookId: "",
      activeSessionId: "",
      runningTask: null,
    }),
    settings: {},
    onSettingsChange: () => {},
    notify: (message) => {
      if (message === "请先创建一本书籍。") executed = true;
    },
    trackModelCall: () => {},
    refreshWorkspace: async () => {},
  };

  dispatchStudioAction(ctx, {
    type: "write-chapter",
    source: "quick-action",
  });

  await new Promise((r) => setTimeout(r, 0));
  assert.equal(executed, true);
});

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

await register("./node-test-resolve.mjs", import.meta.url);

const { sendMessage } = await import("./send-message.ts");

function createStoreMock(overrides = {}) {
  const state = {
    activeSessionId: "",
    runningTask: null,
    messagesBySessionId: {},
    books: [],
    activeBookId: "",
    selectedModelValue: "",
    setMessagesForSession(sessionId, messages) {
      state.messagesBySessionId[sessionId] = messages;
    },
    setInput() {},
    startTask() {},
    finishTask() {},
    updateMessage() {},
    ...overrides,
  };

  return state;
}

test("sendMessage without active session notifies and does not write messages", async () => {
  let notified = "";
  const store = createStoreMock();
  const ctx = {
    getState: () => store,
    settings: { providers: [] },
    onSettingsChange: () => {},
    notify: (message) => {
      notified = message;
    },
    trackModelCall: () => {},
    refreshWorkspace: async () => {},
  };

  await sendMessage(ctx, "hello");

  assert.match(notified, /会话/);
  assert.deepEqual(store.messagesBySessionId, {});
});

test("sendMessage ignores empty text", async () => {
  let notified = "";
  const store = createStoreMock({ activeSessionId: "session-1" });
  const ctx = {
    getState: () => store,
    settings: { providers: [] },
    onSettingsChange: () => {},
    notify: (message) => {
      notified = message;
    },
    trackModelCall: () => {},
    refreshWorkspace: async () => {},
  };

  await sendMessage(ctx, "   ");

  assert.equal(notified, "");
  assert.deepEqual(store.messagesBySessionId, {});
});

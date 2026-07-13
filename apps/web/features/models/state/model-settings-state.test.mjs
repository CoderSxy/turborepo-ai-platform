// apps/web/features/models/state/model-settings-state.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LOCAL_MODEL_SETTINGS } from "../../../lib/model-settings.ts";
import {
  buildModelOptions,
  filterProviderGroups,
  mergeModelsIntoProvider,
  mergeProbeIntoProvider,
  normalizeProviderForClear,
  normalizeProviderForSave,
  runProviderProbeFlow,
  testProviderViaProxy,
} from "./model-settings-state.ts";

const connectedProvider = {
  id: "deepseek",
  name: "DeepSeek",
  type: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiFormat: "openai",
  apiKey: "sk-test",
  enabled: true,
};

const disconnectedProvider = {
  id: "anthropic",
  name: "Anthropic",
  type: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  apiFormat: "anthropic",
  apiKey: "",
  enabled: false,
};

const settingsWithBoth = {
  ...DEFAULT_LOCAL_MODEL_SETTINGS,
  providers: [connectedProvider, disconnectedProvider],
};

test("filterProviderGroups returns connectedCount", () => {
  const result = filterProviderGroups(settingsWithBoth, {
    category: "all",
    searchQuery: "",
    connectedOnly: false,
  });
  assert.equal(result.connectedCount, 1);
});

test("filterProviderGroups filters by category china", () => {
  const result = filterProviderGroups(settingsWithBoth, {
    category: "china",
    searchQuery: "",
    connectedOnly: false,
  });
  assert.ok(result.visibleGroups.every((g) => g.category === "china"));
  assert.ok(
    result.visibleGroups.some((g) =>
      g.providers.some((p) => p.id === "deepseek"),
    ),
  );
});

test("filterProviderGroups filters by searchQuery on name", () => {
  const result = filterProviderGroups(settingsWithBoth, {
    category: "all",
    searchQuery: "anthropic",
    connectedOnly: false,
  });
  const allProviders = result.visibleGroups.flatMap((g) => g.providers);
  assert.equal(allProviders.length, 1);
  assert.equal(allProviders[0].id, "anthropic");
});

test("filterProviderGroups filters connectedOnly", () => {
  const result = filterProviderGroups(settingsWithBoth, {
    category: "all",
    searchQuery: "",
    connectedOnly: true,
  });
  const allProviders = result.visibleGroups.flatMap((g) => g.providers);
  assert.equal(allProviders.length, 1);
  assert.equal(allProviders[0].id, "deepseek");
});

test("buildModelOptions merges fetched models and suggestions", () => {
  const options = buildModelOptions(connectedProvider, {
    ok: true,
    status: "success",
    message: "ok",
    models: ["deepseek-chat", "deepseek-reasoner"],
  });
  assert.ok(options.includes("deepseek-chat"));
  assert.ok(options.includes("deepseek-reasoner"));
  // MODEL_SUGGESTIONS for deepseek also included
  assert.ok(options.includes("deepseek-v4-flash"));
});

test("buildModelOptions falls back to availableModels when no modelsResult", () => {
  const provider = {
    ...connectedProvider,
    availableModels: ["custom-model"],
  };
  const options = buildModelOptions(provider, null);
  assert.ok(options.includes("custom-model"));
});

test("normalizeProviderForSave enables when apiKey present", () => {
  const saved = normalizeProviderForSave(disconnectedProvider);
  assert.equal(saved.enabled, false);
  const withKey = normalizeProviderForSave({
    ...disconnectedProvider,
    apiKey: "sk-new",
  });
  assert.equal(withKey.enabled, true);
});

test("normalizeProviderForSave enables ollama without apiKey", () => {
  const ollama = {
    id: "ollama",
    name: "Ollama",
    type: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    apiFormat: "ollama",
    apiKey: "",
    enabled: false,
  };
  const saved = normalizeProviderForSave(ollama);
  assert.equal(saved.enabled, true);
});

test("normalizeProviderForClear clears key and disables", () => {
  const cleared = normalizeProviderForClear(connectedProvider);
  assert.equal(cleared.apiKey, "");
  assert.equal(cleared.enabled, false);
});

test("mergeProbeIntoProvider returns null when probe failed", () => {
  const result = mergeProbeIntoProvider(connectedProvider, {
    ok: false,
    status: "error",
    message: "fail",
  });
  assert.equal(result, null);
});

test("mergeProbeIntoProvider enables and sets availableModels", () => {
  const result = mergeProbeIntoProvider(connectedProvider, {
    ok: true,
    status: "success",
    message: "ok",
    models: ["deepseek-chat"],
  });
  assert.equal(result.enabled, true);
  assert.deepEqual(result.availableModels, ["deepseek-chat"]);
});

test("mergeModelsIntoProvider returns null when models failed", () => {
  const result = mergeModelsIntoProvider(connectedProvider, {
    ok: false,
    status: "error",
    message: "fail",
    models: [],
  });
  assert.equal(result, null);
});

test("mergeModelsIntoProvider sets availableModels", () => {
  const result = mergeModelsIntoProvider(connectedProvider, {
    ok: true,
    status: "success",
    message: "ok",
    models: ["m1", "m2"],
  });
  assert.deepEqual(result.availableModels, ["m1", "m2"]);
});

test("testProviderViaProxy calls /api/model-providers/test", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      json: async () => ({ ok: true, status: "success", message: "ok" }),
    };
  };

  try {
    await testProviderViaProxy(connectedProvider, "deepseek-chat", "hi");
    assert.equal(capturedUrl, "/api/model-providers/test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runProviderProbeFlow merges provider on success and lists models when probe has no models", async () => {
  const testFn = async () => ({
    ok: true,
    status: "success",
    message: "ok",
    models: [],
  });
  const listFn = async () => ({
    ok: true,
    status: "success",
    message: "ok",
    models: ["deepseek-chat"],
  });

  const result = await runProviderProbeFlow(
    connectedProvider,
    ["deepseek-chat"],
    { testFn, listFn },
  );

  assert.equal(result.testResult.ok, true);
  assert.ok(result.updatedProvider);
  assert.equal(result.updatedProvider.enabled, true);
  assert.deepEqual(result.modelsResult?.models, ["deepseek-chat"]);
  assert.deepEqual(result.updatedProvider.availableModels, ["deepseek-chat"]);
});

test("runProviderProbeFlow skips list when probe returns models", async () => {
  let listCalled = false;
  const testFn = async () => ({
    ok: true,
    status: "success",
    message: "ok",
    models: ["from-probe"],
  });
  const listFn = async () => {
    listCalled = true;
    return { ok: true, status: "success", message: "ok", models: [] };
  };

  const result = await runProviderProbeFlow(
    connectedProvider,
    ["deepseek-chat"],
    { testFn, listFn },
  );

  assert.equal(listCalled, false);
  assert.deepEqual(result.updatedProvider?.availableModels, ["from-probe"]);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  exportLocalModelSettings,
  importLocalModelSettings,
  MODEL_ROUTE_PRESETS,
  listProviderModels,
  resolveModelRoute,
  testProviderConnection,
} from "./model-settings.ts";

test("resolveModelRoute uses the explicit local route override", () => {
  const settings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    providers: [
      {
        id: "deepseek",
        name: "DeepSeek",
        type: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiFormat: "openai",
        apiKey: "sk-local",
        enabled: true,
      },
    ],
    routes: [
      {
        routeKey: "novel.writer",
        providerId: "deepseek",
        model: "deepseek-chat",
        temperature: 0.82,
        maxTokens: 6400,
        stream: true,
      },
    ],
  };

  const resolved = resolveModelRoute(settings, "novel.writer");

  assert.equal(resolved.status, "ready");
  assert.equal(resolved.provider.name, "DeepSeek");
  assert.equal(resolved.model, "deepseek-chat");
  assert.equal(resolved.temperature, 0.82);
  assert.equal(resolved.maxTokens, 6400);
  assert.equal(resolved.apiKey, "sk-local");
});

test("resolveModelRoute falls back to global.default when a route is not configured", () => {
  const settings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        type: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiFormat: "openai",
        apiKey: "sk-openai",
        enabled: true,
      },
    ],
    routes: [
      {
        routeKey: "global.default",
        providerId: "openai",
        model: "gpt-4.1",
        temperature: 0.5,
        maxTokens: 3000,
        stream: true,
      },
    ],
  };

  const resolved = resolveModelRoute(settings, "comic.storyboard");

  assert.equal(resolved.status, "ready");
  assert.equal(resolved.route.routeKey, "global.default");
  assert.equal(resolved.requestedRoute.routeKey, "comic.storyboard");
  assert.equal(resolved.model, "gpt-4.1");
  assert.equal(resolved.temperature, 0.5);
});

test("resolveModelRoute reports missing credentials without throwing", () => {
  const settings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    providers: [
      {
        id: "custom",
        name: "Custom Gateway",
        type: "custom",
        baseUrl: "https://gateway.example.com/v1",
        apiFormat: "openai",
        apiKey: "",
        enabled: true,
      },
    ],
    routes: [
      {
        routeKey: "global.default",
        providerId: "custom",
        model: "custom-model",
        temperature: 0.4,
        maxTokens: 2000,
        stream: true,
      },
    ],
  };

  const resolved = resolveModelRoute(settings, "global.default");

  assert.equal(resolved.status, "missing-api-key");
  assert.equal(resolved.provider.name, "Custom Gateway");
});

test("route presets keep InkOS scenarios as platform-level definitions", () => {
  const routeKeys = MODEL_ROUTE_PRESETS.map((route) => route.routeKey);

  assert.ok(routeKeys.includes("novel.writer"));
  assert.ok(routeKeys.includes("novel.reviewer"));
  assert.ok(routeKeys.includes("novel.outliner"));
  assert.ok(routeKeys.includes("image.generator"));
});

test("testProviderConnection reports missing credentials before fetch", async () => {
  const result = await testProviderConnection({
    id: "custom",
    name: "Custom Gateway",
    type: "custom",
    baseUrl: "https://gateway.example.com/v1",
    apiFormat: "openai",
    apiKey: "",
    enabled: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "error");
  assert.match(result.message, /API Key/);
});

test("testProviderConnection ignores stale disabled state when credentials exist", async () => {
  const originalFetch = globalThis.fetch;
  let didFetch = false;

  globalThis.fetch = async () => {
    didFetch = true;

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "ok" } }],
      }),
      { status: 200 },
    );
  };

  try {
    const result = await testProviderConnection({
      id: "deepseek",
      name: "DeepSeek",
      type: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiFormat: "openai",
      apiKey: "sk-test",
      enabled: false,
    });

    assert.equal(didFetch, true);
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("testProviderConnection omits temperature for OpenAI-compatible provider probes", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;

  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "ok" } }],
      }),
      { status: 200 },
    );
  };

  try {
    const result = await testProviderConnection(
      {
        id: "moonshot",
        name: "Moonshot",
        type: "custom",
        baseUrl: "https://api.moonshot.cn/v1",
        apiFormat: "openai",
        apiKey: "sk-test",
        enabled: true,
      },
      "kimi-k2.5",
    );

    assert.equal(result.ok, true);
    assert.equal("temperature" in requestBody, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listProviderModels ignores stale disabled state when credentials exist", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ id: "deepseek-v4-flash" }],
      }),
      { status: 200 },
    );

  try {
    const result = await listProviderModels({
      id: "deepseek",
      name: "DeepSeek",
      type: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiFormat: "openai",
      apiKey: "sk-test",
      enabled: false,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.models, ["deepseek-v4-flash"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listProviderModels parses OpenAI-compatible model responses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://gateway.example.com/v1/models");
    assert.equal(init.headers.Authorization, "Bearer sk-test");

    return new Response(
      JSON.stringify({
        data: [{ id: "model-b" }, { id: "model-a" }],
      }),
      { status: 200 },
    );
  };

  try {
    const result = await listProviderModels({
      id: "custom",
      name: "Custom Gateway",
      type: "custom",
      baseUrl: "https://gateway.example.com/v1",
      apiFormat: "openai",
      apiKey: "sk-test",
      enabled: true,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.models, ["model-a", "model-b"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exportLocalModelSettings is deterministic for the same settings", () => {
  const firstExport = exportLocalModelSettings(DEFAULT_LOCAL_MODEL_SETTINGS);
  const secondExport = exportLocalModelSettings(DEFAULT_LOCAL_MODEL_SETTINGS);
  const parsedExport = JSON.parse(firstExport);

  assert.equal(firstExport, secondExport);
  assert.equal(parsedExport.updatedAt, DEFAULT_LOCAL_MODEL_SETTINGS.updatedAt);
});

test("importLocalModelSettings merges newly added provider templates", () => {
  const legacySettings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    providers: DEFAULT_LOCAL_MODEL_SETTINGS.providers.filter(
      (provider) => provider.id !== "kimi-coding-plan",
    ),
  };

  const imported = importLocalModelSettings(JSON.stringify(legacySettings));
  const providerIds = imported.providers.map((provider) => provider.id);

  assert.ok(providerIds.includes("kimi-coding-plan"));
});

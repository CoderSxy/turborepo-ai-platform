import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  exportLocalModelSettings,
  importLocalModelSettings,
  MODEL_ROUTE_PRESETS,
  appendModelCallLog,
  formatModelPickerValue,
  getDefaultChatModelSelection,
  listProviderModels,
  parseModelPickerValue,
  resolveModelRoute,
  resolveModelRouteForCoreAction,
  resolveReadyModelBinding,
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

test("volcengine Coding Plan uses InkOS anthropic messages endpoint", async () => {
  const provider = DEFAULT_LOCAL_MODEL_SETTINGS.providers.find(
    (item) => item.id === "volcengine-coding-plan",
  );

  assert.ok(provider);
  assert.equal(provider.baseUrl, "https://ark.cn-beijing.volces.com/api/coding");
  assert.equal(provider.apiFormat, "anthropic");

  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody;
  let requestHeaders;

  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url);
    requestBody = JSON.parse(init.body);
    requestHeaders = init.headers;

    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: "ok" }],
      }),
      { status: 200 },
    );
  };

  try {
    const result = await testProviderConnection({
      ...provider,
      apiKey: "sk-test",
      enabled: true,
    });

    assert.equal(result.ok, true);
    assert.equal(
      requestedUrl,
      "https://ark.cn-beijing.volces.com/api/coding/messages",
    );
    assert.equal(requestBody.model, "doubao-seed-2.0-code");
    assert.equal(requestBody.max_tokens, 128);
    assert.equal(requestHeaders["anthropic-version"], "2023-06-01");
    assert.equal(requestHeaders["x-api-key"], "sk-test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("testProviderConnection falls back to another provider model after 404", async () => {
  const provider = DEFAULT_LOCAL_MODEL_SETTINGS.providers.find(
    (item) => item.id === "volcengine-coding-plan",
  );
  const originalFetch = globalThis.fetch;
  const requestedModels = [];

  assert.ok(provider);

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requestedModels.push(body.model);

    if (body.model === "doubao-seed-2.0-code") {
      return new Response("", { status: 404 });
    }

    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: "ok" }],
      }),
      { status: 200 },
    );
  };

  try {
    const result = await testProviderConnection(
      {
        ...provider,
        apiKey: "sk-test",
        availableModels: ["doubao-seed-2.0-pro"],
        enabled: true,
      },
      "doubao-seed-2.0-code",
    );

    assert.equal(result.ok, true);
    assert.match(result.message, /doubao-seed-2\.0-pro/);
    assert.deepEqual(requestedModels, [
      "doubao-seed-2.0-code",
      "doubao-seed-2.0-pro",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CodingPlan providers use InkOS anthropic endpoints", () => {
  const expectedProviders = new Map([
    ["kimi-coding-plan", "https://api.moonshot.cn/anthropic"],
    ["kimi-code", "https://api.kimi.com/coding"],
    ["minimax-coding-plan", "https://api.minimaxi.com/anthropic"],
    ["bailian-coding-plan", "https://dashscope.aliyuncs.com/apps/anthropic"],
    ["glm-coding-plan", "https://api.z.ai/api/anthropic"],
    ["volcengine-coding-plan", "https://ark.cn-beijing.volces.com/api/coding"],
    ["opencode-coding-plan", "https://opencode.ai/api/anthropic"],
    [
      "iflytek-astron-coding-plan",
      "https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic",
    ],
  ]);

  for (const [providerId, baseUrl] of expectedProviders) {
    const provider = DEFAULT_LOCAL_MODEL_SETTINGS.providers.find(
      (item) => item.id === providerId,
    );

    assert.ok(provider, `${providerId} should exist`);
    assert.equal(provider.apiFormat, "anthropic", providerId);
    assert.equal(provider.baseUrl, baseUrl, providerId);
  }
});

test("listProviderModels can use provider-specific modelsBaseUrl", async () => {
  const provider = DEFAULT_LOCAL_MODEL_SETTINGS.providers.find(
    (item) => item.id === "kimi-code",
  );
  const originalFetch = globalThis.fetch;

  assert.ok(provider);

  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.kimi.com/coding/v1/models");
    assert.equal(init.headers.Authorization, "Bearer sk-test");
    assert.equal(init.headers["anthropic-version"], undefined);
    assert.equal(init.headers["x-api-key"], undefined);

    return new Response(
      JSON.stringify({
        data: [{ id: "kimi-for-coding" }],
      }),
      { status: 200 },
    );
  };

  try {
    const result = await listProviderModels({
      ...provider,
      apiKey: "sk-test",
      enabled: true,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.models, ["kimi-for-coding"]);
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

test("importLocalModelSettings migrates stale Volcengine Coding Plan endpoint", () => {
  const legacySettings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    providers: DEFAULT_LOCAL_MODEL_SETTINGS.providers.map((provider) =>
      provider.id === "volcengine-coding-plan"
        ? {
            ...provider,
            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
            apiFormat: "openai",
            apiKey: "sk-volc",
            enabled: true,
          }
        : provider,
    ),
  };

  const imported = importLocalModelSettings(JSON.stringify(legacySettings));
  const provider = imported.providers.find(
    (item) => item.id === "volcengine-coding-plan",
  );

  assert.ok(provider);
  assert.equal(provider.apiKey, "sk-volc");
  assert.equal(provider.baseUrl, "https://ark.cn-beijing.volces.com/api/coding");
  assert.equal(provider.apiFormat, "anthropic");
});

test("importLocalModelSettings migrates stale CodingPlan endpoints", () => {
  const legacySettings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    providers: DEFAULT_LOCAL_MODEL_SETTINGS.providers.map((provider) =>
      provider.id === "kimi-code"
        ? {
            ...provider,
            baseUrl: "https://api.moonshot.cn/v1",
            modelsBaseUrl: undefined,
            apiFormat: "openai",
            apiKey: "sk-kimi-code",
            availableModels: ["moonshot-v1-32k"],
            enabled: true,
          }
        : provider,
    ),
  };

  const imported = importLocalModelSettings(JSON.stringify(legacySettings));
  const provider = imported.providers.find((item) => item.id === "kimi-code");

  assert.ok(provider);
  assert.equal(provider.apiKey, "sk-kimi-code");
  assert.equal(provider.baseUrl, "https://api.kimi.com/coding");
  assert.equal(provider.modelsBaseUrl, "https://api.kimi.com/coding/v1");
  assert.equal(provider.apiFormat, "anthropic");
  assert.equal(provider.availableModels, undefined);
});

test("resolveModelRouteForCoreAction maps write-chapter to novel.writer", () => {
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

  const resolved = resolveModelRouteForCoreAction(settings, "write-chapter");

  assert.equal(resolved.status, "ready");
  assert.equal(resolved.route.routeKey, "novel.writer");
  assert.equal(resolved.model, "deepseek-chat");
});

test("resolveReadyModelBinding returns route metadata for ready routes", () => {
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
        routeKey: "novel.reviewer",
        providerId: "openai",
        model: "gpt-4.1",
        temperature: 0.28,
        maxTokens: 4800,
        stream: true,
      },
    ],
  };

  const binding = resolveReadyModelBinding(
    resolveModelRoute(settings, "novel.reviewer"),
  );

  assert.ok(!("error" in binding));
  assert.equal(binding.routeKey, "novel.reviewer");
  assert.equal(binding.model, "gpt-4.1");
  assert.equal(binding.temperature, 0.28);
});

test("appendModelCallLog keeps recent models and trims call logs", () => {
  const settings = {
    ...DEFAULT_LOCAL_MODEL_SETTINGS,
    recentModels: [],
    callLogs: [],
  };

  const next = appendModelCallLog(settings, {
    routeKey: "novel.writer",
    label: "写下一章",
    providerId: "deepseek",
    providerName: "DeepSeek",
    model: "deepseek-chat",
    status: "success",
    startedAt: "2026-07-04T09:00:00.000Z",
    endedAt: "2026-07-04T09:00:05.000Z",
    latencyMs: 5000,
  });

  assert.equal(next.recentModels.length, 1);
  assert.equal(next.recentModels[0]?.model, "deepseek-chat");
  assert.equal(next.callLogs.length, 1);
  assert.equal(next.callLogs[0]?.label, "写下一章");
});

test("formatModelPickerValue and parseModelPickerValue round-trip", () => {
  const value = formatModelPickerValue("deepseek", "deepseek-chat");
  const parsed = parseModelPickerValue(value);

  assert.deepEqual(parsed, {
    providerId: "deepseek",
    model: "deepseek-chat",
  });
});

test("getDefaultChatModelSelection prefers global.default route", () => {
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
        temperature: 0.6,
        maxTokens: 4000,
        stream: true,
      },
    ],
  };

  assert.equal(getDefaultChatModelSelection(settings), "openai::gpt-4.1");
});

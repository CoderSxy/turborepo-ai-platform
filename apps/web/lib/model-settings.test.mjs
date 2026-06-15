import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  MODEL_ROUTE_PRESETS,
  resolveModelRoute,
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

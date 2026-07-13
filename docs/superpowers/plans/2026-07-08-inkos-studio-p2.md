# InkOS Studio P2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 P2 模型配置模块边界：将 `page.tsx` 中 ~200 行 provider 过滤/probe/save 逻辑迁入 `features/models/state/` + Page 组件，`page.tsx` 只挂载 `<ModelSettingsPage />`。

**Architecture:** 仿 InkOS `ServiceListPage` / `ServiceDetailPage` + `service-detail-state.ts` 分层。`model-settings-state.ts` 放纯函数与 async 流程编排；两个 hook 管 React 状态；`ModelSettingsPage` 内路由 list/detail。`lib/model-settings.ts` 零改动。

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, node:test (`--experimental-strip-types`)

**Spec:** `docs/superpowers/specs/2026-07-08-inkos-studio-p2-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/features/models/state/model-settings-state.ts` | Create | 过滤分组、modelOptions、save/clear/probe 纯函数 + proxy + 流程编排 |
| `apps/web/features/models/state/model-settings-state.test.mjs` | Create | state 模块单元测试 |
| `apps/web/features/models/state/use-model-settings-list.ts` | Create | 列表页 React 状态 hook |
| `apps/web/features/models/state/use-provider-detail.ts` | Create | 详情页 React 状态 hook |
| `apps/web/features/models/components/ModelSettingsPage.tsx` | Create | list/detail 路由编排 |
| `apps/web/features/models/components/ProviderDetailPage.tsx` | Create | 详情页 hook + ProviderDetail 组合 |
| `apps/web/app/page.tsx` | Modify | 移除模型配置逻辑，挂载 ModelSettingsPage |
| `INKOS_STUDIO_ALIGNMENT_TODO.md` | Modify | P2 三项勾选 |
| `apps/web/lib/model-settings.ts` | **不修改** | — |

---

## Verification Commands (run after every task)

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test \
  apps/web/lib/model-settings.test.mjs \
  apps/web/features/models/state/model-settings-state.test.mjs \
  apps/web/lib/provider-stream-parser.test.mjs
```

---

## Task 1: `model-settings-state.ts` — 纯函数（TDD）

**Files:**
- Create: `apps/web/features/models/state/model-settings-state.ts`
- Create: `apps/web/features/models/state/model-settings-state.test.mjs`

- [ ] **Step 1: Write failing tests for pure functions**

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/features/models/state/model-settings-state.test.mjs
```

Expected: FAIL — module `./model-settings-state.ts` not found

- [ ] **Step 3: Implement pure functions**

```typescript
// apps/web/features/models/state/model-settings-state.ts
import {
  MODEL_SUGGESTIONS,
  type LocalModelProvider,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ProviderModelsResult,
} from "../../../lib/model-settings";
import {
  PROVIDER_GROUPS,
  isProviderConnected,
  type ProviderCategory,
} from "./model-page-types";

export type ProviderGroupWithProviders = (typeof PROVIDER_GROUPS)[number] & {
  providers: LocalModelProvider[];
};

export function filterProviderGroups(
  settings: LocalModelSettings,
  filters: {
    category: ProviderCategory;
    searchQuery: string;
    connectedOnly: boolean;
  },
): {
  activeGroups: ProviderGroupWithProviders[];
  visibleGroups: ProviderGroupWithProviders[];
  connectedCount: number;
} {
  const connectedCount = settings.providers.filter(isProviderConnected).length;

  const activeGroups = PROVIDER_GROUPS.map((group) => ({
    ...group,
    providers: settings.providers.filter((provider) =>
      group.providerIds.includes(provider.id),
    ),
  })).filter((group) => group.providers.length > 0);

  const normalizedQuery = filters.searchQuery.trim().toLowerCase();

  const visibleGroups = activeGroups
    .filter(
      (group) =>
        filters.category === "all" || group.category === filters.category,
    )
    .map((group) => ({
      ...group,
      providers: group.providers.filter((provider) => {
        const matchesSearch =
          !normalizedQuery ||
          provider.name.toLowerCase().includes(normalizedQuery) ||
          provider.baseUrl.toLowerCase().includes(normalizedQuery);
        const matchesConnected =
          !filters.connectedOnly || isProviderConnected(provider);
        return matchesSearch && matchesConnected;
      }),
    }))
    .filter((group) => group.providers.length > 0);

  return { activeGroups, visibleGroups, connectedCount };
}

export function buildModelOptions(
  provider: LocalModelProvider,
  modelsResult?: ProviderModelsResult | null,
): string[] {
  const fetchedModels = modelsResult?.ok
    ? modelsResult.models
    : (provider.availableModels ?? []);
  const suggestedModels = MODEL_SUGGESTIONS[provider.id] ?? [];
  return Array.from(new Set([...fetchedModels, ...suggestedModels]));
}

export function normalizeProviderForSave(
  provider: LocalModelProvider,
): LocalModelProvider {
  return {
    ...provider,
    enabled: Boolean(provider.apiKey) || provider.apiFormat === "ollama",
  };
}

export function normalizeProviderForClear(
  provider: LocalModelProvider,
): LocalModelProvider {
  return {
    ...provider,
    apiKey: "",
    enabled: false,
  };
}

export function mergeProbeIntoProvider(
  provider: LocalModelProvider,
  testResult: ModelConnectionTestResult,
): LocalModelProvider | null {
  if (!testResult.ok) {
    return null;
  }

  const returnedModels = testResult.models ?? [];

  return {
    ...provider,
    enabled: true,
    ...(returnedModels.length > 0
      ? { availableModels: returnedModels }
      : {}),
  };
}

export function mergeModelsIntoProvider(
  provider: LocalModelProvider,
  modelsResult: ProviderModelsResult,
): LocalModelProvider | null {
  if (!modelsResult.ok || modelsResult.models.length === 0) {
    return null;
  }

  return {
    ...provider,
    availableModels: modelsResult.models,
  };
}
```

- [ ] **Step 4: Run tests to verify pure function tests pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/features/models/state/model-settings-state.test.mjs
```

Expected: 12 tests PASS (proxy tests not yet added)

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/models/state/model-settings-state.ts apps/web/features/models/state/model-settings-state.test.mjs
git commit -m "$(cat <<'EOF'
feat(models): add model-settings-state pure functions with tests

Extract provider filtering, modelOptions merge, and save/clear/probe
normalization from page.tsx into a testable state module.
EOF
)"
```

---

## Task 2: `model-settings-state.ts` — proxy 与流程编排（TDD）

**Files:**
- Modify: `apps/web/features/models/state/model-settings-state.ts`
- Modify: `apps/web/features/models/state/model-settings-state.test.mjs`

- [ ] **Step 1: Add failing tests for proxy and flow functions**

Append to `model-settings-state.test.mjs`:

```javascript
import {
  listProviderModelsViaProxy,
  runProviderProbeFlow,
  testProviderViaProxy,
} from "./model-settings-state.ts";

test("testProviderViaProxy calls /api/model-providers/test", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = async (url, init) => {
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
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/features/models/state/model-settings-state.test.mjs
```

Expected: FAIL — `testProviderViaProxy is not exported`

- [ ] **Step 3: Implement proxy and flow functions**

Append to `model-settings-state.ts`:

```typescript
const DEFAULT_PROBE_PROMPT = "用一句中文回复：模型连接正常。";

export async function testProviderViaProxy(
  provider: LocalModelProvider,
  model?: string,
  prompt = DEFAULT_PROBE_PROMPT,
): Promise<ModelConnectionTestResult> {
  const response = await fetch("/api/model-providers/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, prompt }),
  });
  return response.json() as Promise<ModelConnectionTestResult>;
}

export async function listProviderModelsViaProxy(
  provider: LocalModelProvider,
): Promise<ProviderModelsResult> {
  const response = await fetch("/api/model-providers/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  return response.json() as Promise<ProviderModelsResult>;
}

export async function runProviderModelsFlow(
  provider: LocalModelProvider,
  deps?: { listFn?: typeof listProviderModelsViaProxy },
): Promise<{
  modelsResult: ProviderModelsResult;
  updatedProvider?: LocalModelProvider;
}> {
  const listFn = deps?.listFn ?? listProviderModelsViaProxy;
  const modelsResult = await listFn(provider);
  const merged = mergeModelsIntoProvider(provider, modelsResult);

  return {
    modelsResult,
    ...(merged ? { updatedProvider: merged } : {}),
  };
}

export async function runProviderProbeFlow(
  provider: LocalModelProvider,
  modelOptions: string[],
  deps?: {
    testFn?: typeof testProviderViaProxy;
    listFn?: typeof listProviderModelsViaProxy;
  },
): Promise<{
  testResult: ModelConnectionTestResult;
  updatedProvider?: LocalModelProvider;
  modelsResult?: ProviderModelsResult;
}> {
  const testFn = deps?.testFn ?? testProviderViaProxy;
  const listFn = deps?.listFn ?? listProviderModelsViaProxy;

  const testResult = await testFn(provider, modelOptions[0], DEFAULT_PROBE_PROMPT);

  if (!testResult.ok) {
    return { testResult };
  }

  const probedProvider = mergeProbeIntoProvider(provider, testResult);
  if (!probedProvider) {
    return { testResult };
  }

  const returnedModels = testResult.models ?? [];

  if (returnedModels.length > 0) {
    return { testResult, updatedProvider: probedProvider };
  }

  const modelsResult = await listFn(probedProvider);
  const merged = mergeModelsIntoProvider(probedProvider, modelsResult);

  return {
    testResult,
    modelsResult,
    updatedProvider: merged ?? probedProvider,
  };
}

export function buildSaveSuccessResult(): ModelConnectionTestResult {
  return {
    ok: true,
    status: "success",
    message: "配置已保存到当前浏览器本地。",
  };
}
```

- [ ] **Step 4: Run all state tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/features/models/state/model-settings-state.test.mjs
```

Expected: 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/models/state/model-settings-state.ts apps/web/features/models/state/model-settings-state.test.mjs
git commit -m "$(cat <<'EOF'
feat(models): add provider probe proxy and flow orchestration

Align with InkOS service-detail-state: async probe/save flows live
in state module, injectable for testing.
EOF
)"
```

---

## Task 3: `use-model-settings-list.ts` hook

**Files:**
- Create: `apps/web/features/models/state/use-model-settings-list.ts`

- [ ] **Step 1: Create hook**

```typescript
// apps/web/features/models/state/use-model-settings-list.ts
"use client";

import { useMemo, useState } from "react";
import type { LocalModelSettings } from "../../../lib/model-settings";
import { filterProviderGroups } from "./model-settings-state";
import type { ProviderCategory } from "./model-page-types";

export function useModelSettingsList(settings: LocalModelSettings) {
  const [category, setCategory] = useState<ProviderCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );

  const { visibleGroups, connectedCount } = useMemo(
    () =>
      filterProviderGroups(settings, {
        category,
        searchQuery,
        connectedOnly,
      }),
    [settings, category, searchQuery, connectedOnly],
  );

  function openProvider(providerId: string) {
    setSelectedProviderId(providerId);
  }

  function backToList() {
    setSelectedProviderId(null);
  }

  return {
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    connectedOnly,
    setConnectedOnly,
    selectedProviderId,
    visibleGroups,
    connectedCount,
    openProvider,
    backToList,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/models/state/use-model-settings-list.ts
git commit -m "$(cat <<'EOF'
feat(models): add useModelSettingsList hook for provider list page
EOF
)"
```

---

## Task 4: `use-provider-detail.ts` hook

**Files:**
- Create: `apps/web/features/models/state/use-provider-detail.ts`

- [ ] **Step 1: Create hook**

```typescript
// apps/web/features/models/state/use-provider-detail.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  upsertProvider,
  type LocalModelProvider,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ProviderModelsResult,
} from "../../../lib/model-settings";
import {
  buildModelOptions,
  buildSaveSuccessResult,
  normalizeProviderForClear,
  normalizeProviderForSave,
  runProviderProbeFlow,
} from "./model-settings-state";

export function useProviderDetail(
  settings: LocalModelSettings,
  providerId: string,
  onSettingsChange: (settings: LocalModelSettings) => void,
) {
  const [testResult, setTestResult] =
    useState<ModelConnectionTestResult | null>(null);
  const [modelsResult, setModelsResult] = useState<ProviderModelsResult | null>(
    null,
  );
  const [temperature, setTemperature] = useState(0.7);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const selectedProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === providerId) ??
      null,
    [settings.providers, providerId],
  );

  const modelOptions = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }
    return buildModelOptions(selectedProvider, modelsResult);
  }, [modelsResult, selectedProvider]);

  const handleProviderChange = useCallback(
    (nextProvider: LocalModelProvider) => {
      onSettingsChange(upsertProvider(settings, nextProvider));
    },
    [onSettingsChange, settings],
  );

  const runProviderTest = useCallback(async () => {
    if (!selectedProvider) {
      return;
    }

    setIsTesting(true);

    try {
      const result = await runProviderProbeFlow(
        selectedProvider,
        modelOptions,
      );
      setTestResult(result.testResult);

      if (result.modelsResult) {
        setModelsResult(result.modelsResult);
      } else if (result.testResult.ok && (result.testResult.models ?? []).length > 0) {
        setModelsResult(null);
      }

      if (result.updatedProvider) {
        handleProviderChange(result.updatedProvider);
      }
    } finally {
      setIsTesting(false);
      setIsLoadingModels(false);
    }
  }, [handleProviderChange, modelOptions, selectedProvider]);

  const save = useCallback(() => {
    if (!selectedProvider) {
      return;
    }
    handleProviderChange(normalizeProviderForSave(selectedProvider));
    setTestResult(buildSaveSuccessResult());
  }, [handleProviderChange, selectedProvider]);

  const clear = useCallback(() => {
    if (!selectedProvider) {
      return;
    }
    handleProviderChange(normalizeProviderForClear(selectedProvider));
    setTestResult(null);
    setModelsResult(null);
  }, [handleProviderChange, selectedProvider]);

  return {
    selectedProvider,
    modelOptions,
    testResult,
    modelsResult,
    temperature,
    streamEnabled,
    showApiKey,
    advancedOpen,
    isTesting,
    isLoadingModels,
    setTemperature,
    setStreamEnabled,
    setShowApiKey,
    setAdvancedOpen,
    handleProviderChange,
    runProviderTest,
    save,
    clear,
  };
}
```

- [ ] **Step 2: Run typecheck + lint**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/models/state/use-provider-detail.ts
git commit -m "$(cat <<'EOF'
feat(models): add useProviderDetail hook for provider detail page
EOF
)"
```

---

## Task 5: `ModelSettingsPage.tsx` + `ProviderDetailPage.tsx`

**Files:**
- Create: `apps/web/features/models/components/ModelSettingsPage.tsx`
- Create: `apps/web/features/models/components/ProviderDetailPage.tsx`

- [ ] **Step 1: Create ProviderDetailPage**

```tsx
// apps/web/features/models/components/ProviderDetailPage.tsx
"use client";

import { useEffect } from "react";
import type { LocalModelSettings } from "../../../lib/model-settings";
import { useProviderDetail } from "../state/use-provider-detail";
import { ProviderDetail } from "./ProviderDetail";

export function ProviderDetailPage({
  settings,
  providerId,
  onSettingsChange,
  onBack,
}: {
  settings: LocalModelSettings;
  providerId: string;
  onSettingsChange: (settings: LocalModelSettings) => void;
  onBack: () => void;
}) {
  const detail = useProviderDetail(settings, providerId, onSettingsChange);

  useEffect(() => {
    if (!detail.selectedProvider) {
      onBack();
    }
  }, [detail.selectedProvider, onBack]);

  if (!detail.selectedProvider) {
    return null;
  }

  return (
    <ProviderDetail
      provider={detail.selectedProvider}
      modelOptions={detail.modelOptions}
      modelsResult={detail.modelsResult}
      testResult={detail.testResult}
      temperature={detail.temperature}
      streamEnabled={detail.streamEnabled}
      showApiKey={detail.showApiKey}
      advancedOpen={detail.advancedOpen}
      isTesting={detail.isTesting}
      isLoadingModels={detail.isLoadingModels}
      onBack={onBack}
      onProviderChange={detail.handleProviderChange}
      onTemperatureChange={detail.setTemperature}
      onStreamEnabledChange={detail.setStreamEnabled}
      onShowApiKeyToggle={() => detail.setShowApiKey((show) => !show)}
      onAdvancedToggle={() => detail.setAdvancedOpen((open) => !open)}
      onRunProviderTest={() => void detail.runProviderTest()}
      onSave={detail.save}
      onClearConfig={detail.clear}
    />
  );
}
```

- [ ] **Step 2: Create ModelSettingsPage**

```tsx
// apps/web/features/models/components/ModelSettingsPage.tsx
"use client";

import { DEFAULT_LOCAL_MODEL_SETTINGS } from "../../../lib/model-settings";
import type { LocalModelSettings } from "../../../lib/model-settings";
import { useModelSettingsList } from "../state/use-model-settings-list";
import { ModelSettingsHome } from "./ModelSettingsHome";
import { ProviderDetailPage } from "./ProviderDetailPage";

export function ModelSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
}) {
  const list = useModelSettingsList(settings);

  if (list.selectedProviderId) {
    return (
      <ProviderDetailPage
        settings={settings}
        providerId={list.selectedProviderId}
        onSettingsChange={onSettingsChange}
        onBack={list.backToList}
      />
    );
  }

  return (
    <ModelSettingsHome
      settings={settings}
      category={list.category}
      searchQuery={list.searchQuery}
      connectedOnly={list.connectedOnly}
      connectedCount={list.connectedCount}
      visibleGroups={list.visibleGroups}
      onCategoryChange={list.setCategory}
      onSearchQueryChange={list.setSearchQuery}
      onConnectedOnlyChange={list.setConnectedOnly}
      onOpenProvider={list.openProvider}
      onRestorePreset={() => onSettingsChange(DEFAULT_LOCAL_MODEL_SETTINGS)}
      onSettingsChange={onSettingsChange}
    />
  );
}
```

- [ ] **Step 3: Run typecheck + lint**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/models/components/ModelSettingsPage.tsx apps/web/features/models/components/ProviderDetailPage.tsx
git commit -m "$(cat <<'EOF'
feat(models): add ModelSettingsPage and ProviderDetailPage orchestrators
EOF
)"
```

---

## Task 6: Slim down `page.tsx`

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace page.tsx with slim version**

```tsx
// apps/web/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  loadLocalModelSettings,
  saveLocalModelSettings,
  type LocalModelSettings,
} from "../lib/model-settings";
import { AppShell } from "../components/shell/AppShell";
import { HomeDashboard } from "../components/shell/HomeDashboard";
import type { AppPage } from "../components/shell/shell-types";
import { ModelSettingsPage } from "../features/models/components/ModelSettingsPage";
import { NovelStudio } from "../features/studio/components/NovelStudio";

export default function Home() {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [settings, setSettings] = useState<LocalModelSettings>(
    DEFAULT_LOCAL_MODEL_SETTINGS,
  );

  useEffect(() => {
    setSettings(loadLocalModelSettings());
  }, []);

  useEffect(() => {
    saveLocalModelSettings(settings);
  }, [settings]);

  function updateSettings(nextSettings: LocalModelSettings) {
    setSettings(nextSettings);
  }

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "home" ? (
        <HomeDashboard settings={settings} />
      ) : null}
      {activePage === "novel" ? (
        <NovelStudio
          settings={settings}
          onManageModels={() => setActivePage("models")}
          onSettingsChange={updateSettings}
        />
      ) : null}
      {activePage === "models" ? (
        <ModelSettingsPage
          settings={settings}
          onSettingsChange={updateSettings}
        />
      ) : null}
    </AppShell>
  );
}
```

- [ ] **Step 2: Run full verification**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test \
  apps/web/lib/model-settings.test.mjs \
  apps/web/features/models/state/model-settings-state.test.mjs \
  apps/web/lib/provider-stream-parser.test.mjs
```

Expected: all PASS; `page.tsx` ~55 lines

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "$(cat <<'EOF'
refactor(models): move model settings orchestration out of page.tsx

page.tsx now only handles top-level routing and shared settings
persistence; models page logic lives in features/models/.
EOF
)"
```

---

## Task 7: Update TODO checklist

**Files:**
- Modify: `INKOS_STUDIO_ALIGNMENT_TODO.md`

- [ ] **Step 1: Mark P2 items complete**

In `INKOS_STUDIO_ALIGNMENT_TODO.md` section P2, change:

```markdown
- [ ] 把 provider 过滤、分组、测试连接、拉模型等逻辑拆成 `features/models/state/model-settings-state.ts` 或 hook。
- [ ] 对齐 InkOS 的 `ServiceListPage.tsx`、`ServiceDetailPage.tsx`、`service-detail-state.ts` 思路：UI 负责表单和展示，探测、保存、删除、回填放到 state/helper。
- [ ] 模型配置页面保持平台级公共模块，不要重新塞回小说模块内部。
```

To:

```markdown
- [x] 把 provider 过滤、分组、测试连接、拉模型等逻辑拆成 `features/models/state/model-settings-state.ts` 或 hook。
- [x] 对齐 InkOS 的 `ServiceListPage.tsx`、`ServiceDetailPage.tsx`、`service-detail-state.ts` 思路：UI 负责表单和展示，探测、保存、删除、回填放到 state/helper。
- [x] 模型配置页面保持平台级公共模块，不要重新塞回小说模块内部。
```

- [ ] **Step 2: Commit**

```bash
git add INKOS_STUDIO_ALIGNMENT_TODO.md
git commit -m "$(cat <<'EOF'
docs: mark InkOS Studio alignment P2 as complete
EOF
)"
```

---

## Manual Smoke Test

After all tasks, verify in browser:

1. 打开「模型配置」→ 看到服务商列表，category 过滤和搜索正常
2. 点击 DeepSeek → 进入详情页，填写 Key → 测试连接 → 模型列表出现
3. 保存 → 显示成功 banner；返回列表 → DeepSeek 显示已连接
4. 切换到「AI小说创作」→ 再切回「模型配置」→ 列表状态正常（详情页不残留）
5. `page.tsx` 无模型配置 inline 逻辑

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| provider 过滤/分组/测试/拉模型 → state + hooks | Task 1–4 |
| UI/state 分离对齐 InkOS | Task 1–5 |
| 模型配置保持平台级公共模块 | Task 6（不引入 studio 依赖） |
| page.tsx 只挂载 ModelSettingsPage | Task 6 |
| lib/model-settings.ts 零改动 | File Map |
| model-settings-state.test.mjs | Task 1–2 |
| 行为零变更 | Task 6 smoke test |

No placeholders. Type names consistent across tasks.

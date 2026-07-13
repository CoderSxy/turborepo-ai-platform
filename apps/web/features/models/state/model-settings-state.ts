// apps/web/features/models/state/model-settings-state.ts
import {
  MODEL_SUGGESTIONS,
  type LocalModelProvider,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ProviderModelsResult,
} from "#lib/model-settings";
import {
  PROVIDER_GROUPS,
  isProviderConnected,
  type ProviderCategory,
} from "#models/model-page-types";

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

  const testResult = await testFn(
    provider,
    modelOptions[0],
    DEFAULT_PROBE_PROMPT,
  );

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

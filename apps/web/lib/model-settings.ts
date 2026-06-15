export type ModelProviderType =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "ollama"
  | "custom";

export type ModelApiFormat = "openai" | "anthropic" | "gemini" | "ollama";

export type ModelCapability =
  | "chat"
  | "vision"
  | "image"
  | "video"
  | "embedding"
  | "rerank";

export type LocalModelProvider = {
  id: string;
  name: string;
  type: ModelProviderType;
  baseUrl: string;
  apiFormat: ModelApiFormat;
  apiKey: string;
  apiKeyEnv?: string;
  enabled: boolean;
};

export type LocalModelRoute = {
  routeKey: string;
  providerId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
};

export type ModelRoutePreset = {
  routeKey: string;
  label: string;
  description: string;
  capability: ModelCapability;
  defaultTemperature: number;
  defaultMaxTokens: number;
  usedBy: string[];
};

export type LocalModelSettings = {
  version: 1;
  providers: LocalModelProvider[];
  routes: LocalModelRoute[];
  updatedAt: string;
};

export type ResolvedModelRoute =
  | {
      status: "ready";
      requestedRoute: ModelRoutePreset;
      route: LocalModelRoute;
      provider: LocalModelProvider;
      model: string;
      baseUrl: string;
      apiFormat: ModelApiFormat;
      apiKey: string;
      temperature: number;
      maxTokens: number;
      stream: boolean;
    }
  | {
      status:
        | "missing-route"
        | "missing-provider"
        | "provider-disabled"
        | "missing-api-key";
      requestedRoute: ModelRoutePreset | null;
      route: LocalModelRoute | null;
      provider: LocalModelProvider | null;
      message: string;
    };

export type ModelConnectionTestResult = {
  ok: boolean;
  status: "success" | "error" | "unsupported";
  message: string;
  latencyMs?: number;
  sample?: string;
};

export const MODEL_SETTINGS_STORAGE_KEY = "sxy.ai.model-settings.v1";

export const MODEL_ROUTE_PRESETS: ModelRoutePreset[] = [
  {
    routeKey: "global.default",
    label: "全局默认模型",
    description: "没有单独配置业务场景时使用的兜底模型。",
    capability: "chat",
    defaultTemperature: 0.6,
    defaultMaxTokens: 4000,
    usedBy: ["平台默认", "未配置业务场景"],
  },
  {
    routeKey: "novel.writer",
    label: "小说生成模型",
    description: "InkOS Writer Agent 使用，负责正文续写和章节生成。",
    capability: "chat",
    defaultTemperature: 0.82,
    defaultMaxTokens: 6400,
    usedBy: ["InkOS Writer Agent"],
  },
  {
    routeKey: "novel.reviewer",
    label: "小说审稿模型",
    description: "InkOS Auditor Agent 使用，负责逻辑、节奏和设定审稿。",
    capability: "chat",
    defaultTemperature: 0.28,
    defaultMaxTokens: 4800,
    usedBy: ["InkOS Auditor Agent"],
  },
  {
    routeKey: "novel.outliner",
    label: "大纲模型",
    description: "InkOS Planner Agent 使用，负责世界观、卷纲和章节结构。",
    capability: "chat",
    defaultTemperature: 0.65,
    defaultMaxTokens: 5200,
    usedBy: ["InkOS Planner Agent"],
  },
  {
    routeKey: "novel.character",
    label: "角色设定模型",
    description: "负责角色卡、人物关系和成长线生成。",
    capability: "chat",
    defaultTemperature: 0.7,
    defaultMaxTokens: 4200,
    usedBy: ["角色设定", "InkOS"],
  },
  {
    routeKey: "comic.storyboard",
    label: "漫画分镜模型",
    description: "负责将剧情拆成镜头、画面描述和对白节奏。",
    capability: "vision",
    defaultTemperature: 0.55,
    defaultMaxTokens: 3600,
    usedBy: ["漫画分镜"],
  },
  {
    routeKey: "image.generator",
    label: "图片生成模型",
    description: "负责封面、角色图、场景图和视觉资产生成。",
    capability: "image",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    usedBy: ["图片生成"],
  },
  {
    routeKey: "video.generator",
    label: "视频生成模型",
    description: "负责短视频、预告片和动态素材生成。",
    capability: "video",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    usedBy: ["视频生成"],
  },
  {
    routeKey: "social.xiaohongshu",
    label: "小红书文案模型",
    description: "负责标题、种草文案和发布说明。",
    capability: "chat",
    defaultTemperature: 0.75,
    defaultMaxTokens: 2400,
    usedBy: ["小红书文案"],
  },
];

export const DEFAULT_MODEL_ROUTE_PRESET = MODEL_ROUTE_PRESETS[0]!;

export const PROVIDER_TEMPLATES: LocalModelProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "OPENAI_API_KEY",
    enabled: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    type: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    enabled: true,
  },
  {
    id: "ollama",
    name: "Ollama 本地模型",
    type: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    apiFormat: "ollama",
    apiKey: "",
    enabled: true,
  },
  {
    id: "custom-openai-compatible",
    name: "自定义 OpenAI Compatible",
    type: "custom",
    baseUrl: "https://api.example.com/v1",
    apiFormat: "openai",
    apiKey: "",
    enabled: false,
  },
];

export const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  ollama: ["llama3.1", "qwen2.5", "mistral", "gemma2"],
  "custom-openai-compatible": ["qwen-plus", "moonshot-v1-8k", "yi-large"],
};

export const DEFAULT_LOCAL_MODEL_SETTINGS: LocalModelSettings = {
  version: 1,
  providers: PROVIDER_TEMPLATES,
  routes: [
    {
      routeKey: "global.default",
      providerId: "deepseek",
      model: "deepseek-chat",
      temperature: 0.6,
      maxTokens: 4000,
      stream: true,
    },
    {
      routeKey: "novel.writer",
      providerId: "deepseek",
      model: "deepseek-chat",
      temperature: 0.82,
      maxTokens: 6400,
      stream: true,
    },
    {
      routeKey: "novel.reviewer",
      providerId: "openai",
      model: "gpt-4.1",
      temperature: 0.28,
      maxTokens: 4800,
      stream: true,
    },
    {
      routeKey: "novel.outliner",
      providerId: "deepseek",
      model: "deepseek-reasoner",
      temperature: 0.65,
      maxTokens: 5200,
      stream: true,
    },
  ],
  updatedAt: new Date(0).toISOString(),
};

export function createProviderId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${slug || "provider"}-${Date.now().toString(36)}`;
}

export function getRoutePreset(routeKey: string) {
  return MODEL_ROUTE_PRESETS.find((route) => route.routeKey === routeKey);
}

export function getRouteConfig(settings: LocalModelSettings, routeKey: string) {
  return settings.routes.find((route) => route.routeKey === routeKey) ?? null;
}

export function upsertRouteConfig(
  settings: LocalModelSettings,
  nextRoute: LocalModelRoute,
): LocalModelSettings {
  const routeExists = settings.routes.some(
    (route) => route.routeKey === nextRoute.routeKey,
  );

  return touchSettings({
    ...settings,
    routes: routeExists
      ? settings.routes.map((route) =>
          route.routeKey === nextRoute.routeKey ? nextRoute : route,
        )
      : [...settings.routes, nextRoute],
  });
}

export function upsertProvider(
  settings: LocalModelSettings,
  nextProvider: LocalModelProvider,
): LocalModelSettings {
  const providerExists = settings.providers.some(
    (provider) => provider.id === nextProvider.id,
  );

  return touchSettings({
    ...settings,
    providers: providerExists
      ? settings.providers.map((provider) =>
          provider.id === nextProvider.id ? nextProvider : provider,
        )
      : [...settings.providers, nextProvider],
  });
}

export function resolveModelRoute(
  settings: LocalModelSettings,
  routeKey: string,
): ResolvedModelRoute {
  const requestedRoute = getRoutePreset(routeKey) ?? null;
  const route =
    getRouteConfig(settings, routeKey) ??
    getRouteConfig(settings, "global.default");

  if (!route) {
    return {
      status: "missing-route",
      requestedRoute,
      route: null,
      provider: null,
      message: "当前业务场景没有配置模型，也没有全局默认模型。",
    };
  }

  const provider =
    settings.providers.find((item) => item.id === route.providerId) ?? null;

  if (!provider) {
    return {
      status: "missing-provider",
      requestedRoute,
      route,
      provider: null,
      message: "模型路由绑定的供应商不存在。",
    };
  }

  if (!provider.enabled) {
    return {
      status: "provider-disabled",
      requestedRoute,
      route,
      provider,
      message: "模型路由绑定的供应商已停用。",
    };
  }

  if (!provider.apiKey && provider.apiFormat !== "ollama") {
    return {
      status: "missing-api-key",
      requestedRoute,
      route,
      provider,
      message: "供应商缺少 API Key。API Key 只保存在当前浏览器本地。",
    };
  }

  return {
    status: "ready",
    requestedRoute: requestedRoute ?? DEFAULT_MODEL_ROUTE_PRESET,
    route,
    provider,
    model: route.model,
    baseUrl: provider.baseUrl,
    apiFormat: provider.apiFormat,
    apiKey: provider.apiKey,
    temperature: route.temperature,
    maxTokens: route.maxTokens,
    stream: route.stream,
  };
}

export function maskSecret(value: string) {
  if (!value) {
    return "未填写";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function loadLocalModelSettings(): LocalModelSettings {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_MODEL_SETTINGS;
  }

  const raw = window.localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);

  if (!raw) {
    return touchSettings(DEFAULT_LOCAL_MODEL_SETTINGS);
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return touchSettings(DEFAULT_LOCAL_MODEL_SETTINGS);
  }
}

export function saveLocalModelSettings(settings: LocalModelSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    MODEL_SETTINGS_STORAGE_KEY,
    JSON.stringify(touchSettings(settings)),
  );
}

export function exportLocalModelSettings(settings: LocalModelSettings) {
  return JSON.stringify(touchSettings(settings), null, 2);
}

export function importLocalModelSettings(raw: string): LocalModelSettings {
  return normalizeSettings(JSON.parse(raw));
}

export async function testModelConnection(
  resolved: ResolvedModelRoute,
  prompt = "用一句中文回复：模型连接正常。",
): Promise<ModelConnectionTestResult> {
  if (resolved.status !== "ready") {
    return {
      ok: false,
      status: "error",
      message: resolved.message,
    };
  }

  if (resolved.apiFormat === "anthropic" || resolved.apiFormat === "gemini") {
    return {
      ok: false,
      status: "unsupported",
      message: "当前版本先支持 OpenAI-compatible 与 Ollama 的浏览器本地测试。",
    };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(getTestEndpoint(resolved), {
      method: "POST",
      headers: getTestHeaders(resolved),
      body: JSON.stringify(getTestBody(resolved, prompt)),
    });
    const text = await response.text();
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      return {
        ok: false,
        status: "error",
        message: `HTTP ${response.status}: ${text.slice(0, 180)}`,
        latencyMs,
      };
    }

    return {
      ok: true,
      status: "success",
      message: "连接成功，模型返回正常。",
      latencyMs,
      sample: extractSampleText(text, resolved.apiFormat),
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message:
        error instanceof Error
          ? `${error.message}。如果是浏览器 CORS 限制，后续可改为服务端代理测试。`
          : "测试请求失败。",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}

function normalizeSettings(value: unknown): LocalModelSettings {
  const settings = value as Partial<LocalModelSettings>;

  return touchSettings({
    version: 1,
    providers: Array.isArray(settings.providers)
      ? settings.providers.map(normalizeProvider)
      : DEFAULT_LOCAL_MODEL_SETTINGS.providers,
    routes: Array.isArray(settings.routes)
      ? settings.routes.map(normalizeRoute)
      : DEFAULT_LOCAL_MODEL_SETTINGS.routes,
    updatedAt:
      typeof settings.updatedAt === "string"
        ? settings.updatedAt
        : new Date().toISOString(),
  });
}

function normalizeProvider(provider: LocalModelProvider): LocalModelProvider {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiFormat: provider.apiFormat,
    apiKey: provider.apiKey ?? "",
    apiKeyEnv: provider.apiKeyEnv,
    enabled: Boolean(provider.enabled),
  };
}

function normalizeRoute(route: LocalModelRoute): LocalModelRoute {
  const preset = getRoutePreset(route.routeKey);

  return {
    routeKey: route.routeKey,
    providerId: route.providerId,
    model: route.model,
    temperature: Number(route.temperature ?? preset?.defaultTemperature ?? 0.6),
    maxTokens: Number(route.maxTokens ?? preset?.defaultMaxTokens ?? 4000),
    stream: Boolean(route.stream),
  };
}

function touchSettings(settings: LocalModelSettings): LocalModelSettings {
  return {
    ...settings,
    providers: settings.providers.map((provider) => ({ ...provider })),
    routes: settings.routes.map((route) => ({ ...route })),
    updatedAt: new Date().toISOString(),
  };
}

function getTestEndpoint(resolved: Extract<ResolvedModelRoute, { status: "ready" }>) {
  const baseUrl = resolved.baseUrl.replace(/\/$/, "");

  if (resolved.apiFormat === "ollama") {
    return `${baseUrl}/api/chat`;
  }

  return `${baseUrl}/chat/completions`;
}

function getTestHeaders(
  resolved: Extract<ResolvedModelRoute, { status: "ready" }>,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (resolved.apiFormat !== "ollama") {
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }

  return headers;
}

function getTestBody(
  resolved: Extract<ResolvedModelRoute, { status: "ready" }>,
  prompt: string,
) {
  if (resolved.apiFormat === "ollama") {
    return {
      model: resolved.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: {
        temperature: resolved.temperature,
        num_predict: Math.min(resolved.maxTokens, 1024),
      },
    };
  }

  return {
    model: resolved.model,
    messages: [{ role: "user", content: prompt }],
    temperature: resolved.temperature,
    max_tokens: Math.min(resolved.maxTokens, 1024),
    stream: false,
  };
}

function extractSampleText(raw: string, apiFormat: ModelApiFormat) {
  try {
    const json = JSON.parse(raw);

    if (apiFormat === "ollama") {
      return json.message?.content ?? raw.slice(0, 180);
    }

    return json.choices?.[0]?.message?.content ?? raw.slice(0, 180);
  } catch {
    return raw.slice(0, 180);
  }
}

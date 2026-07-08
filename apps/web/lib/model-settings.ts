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
  modelsBaseUrl?: string;
  apiFormat: ModelApiFormat;
  apiKey: string;
  apiKeyEnv?: string;
  enabled: boolean;
  availableModels?: string[];
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
  recentModels: RecentModelUsage[];
  callLogs: ModelCallLog[];
  updatedAt: string;
};

export type RecentModelUsage = {
  providerId: string;
  model: string;
  routeKey: string;
  usedAt: string;
};

export type ModelCallLog = {
  id: string;
  routeKey: string;
  label: string;
  providerId: string;
  providerName: string;
  model: string;
  status: "success" | "error" | "cancelled";
  latencyMs?: number;
  startedAt: string;
  endedAt: string;
  errorMessage?: string;
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
  models?: string[];
  selectedModel?: string;
  modelsSource?: "api" | "fallback";
};

export type ProviderModelsResult = {
  ok: boolean;
  status: "success" | "error" | "unsupported";
  message: string;
  models: string[];
  latencyMs?: number;
};

export type ProviderChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ProviderChatResult = {
  ok: boolean;
  status: "success" | "error" | "unsupported";
  message: string;
  content?: string;
  latencyMs?: number;
};

export type ProviderChatStreamResult =
  | {
      ok: true;
      response: Response;
      apiFormat: ModelApiFormat;
      startedAt: number;
    }
  | ProviderChatResult;

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

export const NOVEL_MODEL_ROUTE_KEYS = [
  "global.default",
  "novel.writer",
  "novel.reviewer",
  "novel.outliner",
  "novel.character",
] as const;

export const INKOS_CORE_ACTION_ROUTE_KEYS: Record<string, string> = {
  "write-chapter": "novel.writer",
  review: "novel.reviewer",
  "revise-chapter": "novel.writer",
  outline: "novel.outliner",
  settings: "novel.character",
  radar: "global.default",
  diagnostics: "novel.reviewer",
};

export const INKOS_CORE_ACTION_LABELS: Record<string, string> = {
  "write-chapter": "写下一章",
  review: "审稿",
  "revise-chapter": "修订本章",
  outline: "生成大纲",
  settings: "整理设定",
  radar: "市场雷达",
  diagnostics: "环境诊断",
  chat: "聊天回复",
};

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
    id: "google-gemini",
    name: "Google Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "GEMINI_API_KEY",
    enabled: false,
  },
  {
    id: "moonshot",
    name: "Moonshot",
    type: "custom",
    baseUrl: "https://api.moonshot.cn/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "MOONSHOT_API_KEY",
    enabled: false,
  },
  {
    id: "minimax",
    name: "MiniMax",
    type: "custom",
    baseUrl: "https://api.minimaxi.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "MINIMAX_API_KEY",
    enabled: false,
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    type: "custom",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "ZHIPU_API_KEY",
    enabled: false,
  },
  {
    id: "bailian",
    name: "阿里百炼",
    type: "custom",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "BAILIAN_API_KEY",
    enabled: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    type: "custom",
    baseUrl: "https://openrouter.ai/api/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "OPENROUTER_API_KEY",
    enabled: false,
  },
  {
    id: "kkaiapi",
    name: "kkaiapi",
    type: "custom",
    baseUrl: "https://api.kkaiapi.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "KKAIAPI_API_KEY",
    enabled: false,
  },
  {
    id: "new-api",
    name: "New API (中转网关)",
    type: "custom",
    baseUrl: "https://your-new-api.example.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "NEW_API_KEY",
    enabled: false,
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    type: "custom",
    baseUrl: "https://api.siliconflow.cn/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "SILICONFLOW_API_KEY",
    enabled: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    enabled: false,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    type: "custom",
    baseUrl: "https://api.mistral.ai/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "MISTRAL_API_KEY",
    enabled: false,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    type: "custom",
    baseUrl: "https://api.x.ai/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "XAI_API_KEY",
    enabled: false,
  },
  {
    id: "volcengine",
    name: "火山引擎 (豆包)",
    type: "custom",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "VOLCENGINE_API_KEY",
    enabled: false,
  },
  {
    id: "hunyuan",
    name: "腾讯混元",
    type: "custom",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "HUNYUAN_API_KEY",
    enabled: false,
  },
  {
    id: "baichuan",
    name: "百川智能",
    type: "custom",
    baseUrl: "https://api.baichuan-ai.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "BAICHUAN_API_KEY",
    enabled: false,
  },
  {
    id: "stepfun",
    name: "阶跃星辰",
    type: "custom",
    baseUrl: "https://api.stepfun.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "STEPFUN_API_KEY",
    enabled: false,
  },
  {
    id: "qianfan",
    name: "文心一言 (千帆)",
    type: "custom",
    baseUrl: "https://qianfan.baidubce.com/v2",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "QIANFAN_API_KEY",
    enabled: false,
  },
  {
    id: "spark",
    name: "讯飞星火",
    type: "custom",
    baseUrl: "https://spark-api-open.xf-yun.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "SPARK_API_KEY",
    enabled: false,
  },
  {
    id: "sensechat",
    name: "商汤日日新",
    type: "custom",
    baseUrl: "https://api.sensenova.cn/compatible-mode/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "SENSECHAT_API_KEY",
    enabled: false,
  },
  {
    id: "tencent-lkeap",
    name: "腾讯云 (lkeap)",
    type: "custom",
    baseUrl: "https://api.lkeap.cloud.tencent.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "TENCENT_LKEAP_API_KEY",
    enabled: false,
  },
  {
    id: "mimo",
    name: "小米 MiMo",
    type: "custom",
    baseUrl: "https://api.mimo.mi.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "MIMO_API_KEY",
    enabled: false,
  },
  {
    id: "longcat",
    name: "美团 LongCat",
    type: "custom",
    baseUrl: "https://api.longcat.chat/openai/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "LONGCAT_API_KEY",
    enabled: false,
  },
  {
    id: "internlm",
    name: "书生浦语 (InternLM)",
    type: "custom",
    baseUrl: "https://internlm-chat.intern-ai.org.cn/puyu/api/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "INTERNLM_API_KEY",
    enabled: false,
  },
  {
    id: "lingyi",
    name: "零一万物 (01.AI)",
    type: "custom",
    baseUrl: "https://api.lingyiwanwu.com/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "LINGYI_API_KEY",
    enabled: false,
  },
  {
    id: "ai360",
    name: "360 智脑",
    type: "custom",
    baseUrl: "https://api.360.cn/v1",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "AI360_API_KEY",
    enabled: false,
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
    id: "github-copilot",
    name: "GitHub Copilot",
    type: "custom",
    baseUrl: "https://api.githubcopilot.com",
    apiFormat: "openai",
    apiKey: "",
    apiKeyEnv: "GITHUB_COPILOT_TOKEN",
    enabled: false,
  },
  {
    id: "kimi-coding-plan",
    name: "Kimi Coding Plan",
    type: "custom",
    baseUrl: "https://api.moonshot.cn/anthropic",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "KIMI_CODING_PLAN_KEY",
    enabled: false,
  },
  {
    id: "kimi-code",
    name: "Kimi Code",
    type: "custom",
    baseUrl: "https://api.kimi.com/coding",
    modelsBaseUrl: "https://api.kimi.com/coding/v1",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "KIMI_CODE_KEY",
    enabled: false,
  },
  {
    id: "minimax-coding-plan",
    name: "MiniMax Coding Plan",
    type: "custom",
    baseUrl: "https://api.minimaxi.com/anthropic",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "MINIMAX_CODING_PLAN_KEY",
    enabled: false,
  },
  {
    id: "bailian-coding-plan",
    name: "百炼 Coding Plan",
    type: "custom",
    baseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "BAILIAN_CODING_PLAN_KEY",
    enabled: false,
  },
  {
    id: "glm-coding-plan",
    name: "GLM Coding Plan",
    type: "custom",
    baseUrl: "https://api.z.ai/api/anthropic",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "GLM_CODING_PLAN_KEY",
    enabled: false,
  },
  {
    id: "volcengine-coding-plan",
    name: "火山 Coding Plan",
    type: "custom",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "VOLCENGINE_CODING_PLAN_KEY",
    enabled: false,
  },
  {
    id: "opencode-coding-plan",
    name: "OpenCode Coding Plan",
    type: "custom",
    baseUrl: "https://opencode.ai/api/anthropic",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "OPENCODE_CODING_PLAN_KEY",
    enabled: false,
  },
  {
    id: "iflytek-astron-coding-plan",
    name: "讯飞星辰 Astron Coding Plan",
    type: "custom",
    baseUrl: "https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic",
    modelsBaseUrl: "https://maas-coding-api.cn-huabei-1.xf-yun.com/v2",
    apiFormat: "anthropic",
    apiKey: "",
    apiKeyEnv: "ASTRON_CODING_PLAN_KEY",
    enabled: false,
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
  kkaiapi: ["gpt-4.1", "claude-sonnet-4", "gemini-2.5-pro"],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
  deepseek: [
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "deepseek-chat",
    "deepseek-reasoner",
  ],
  "google-gemini": ["gemini-2.5-pro", "gemini-2.5-flash"],
  anthropic: ["claude-sonnet-4", "claude-opus-4.1", "claude-haiku-3.5"],
  mistral: ["mistral-large-latest", "ministral-8b-latest"],
  xai: ["grok-4", "grok-3-mini"],
  moonshot: ["kimi-k2.6", "kimi-k2.5", "kimi-k2-thinking"],
  minimax: [
    "MiniMax-M2.7",
    "MiniMax-M2.7-highspeed",
    "MiniMax-M2.5",
    "MiniMax-M2.5-highspeed",
    "M2-her",
    "MiniMax-M2.1",
    "MiniMax-M2.1-highspeed",
    "MiniMax-M2",
    "MiniMax-M2-Stable",
    "MiniMax-M1",
    "MiniMax-Text-01",
  ],
  zhipu: ["glm-4.6", "glm-4-air", "glm-4-flash"],
  bailian: ["qwen-plus", "qwen-max", "qwen-turbo"],
  siliconflow: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen3-235B-A22B"],
  "new-api": ["gpt-4.1", "deepseek-chat", "qwen-plus"],
  openrouter: ["openai/gpt-4.1", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro"],
  volcengine: [
    "doubao-seed-2.0-lite",
    "doubao-seed-2.0-pro",
    "doubao-seed-2.0-mini",
    "doubao-seed-2.0-code",
    "doubao-seed-1.8",
    "doubao-seed-code",
    "glm-4-7",
    "deepseek-v3.2",
    "deepseek-v3.1",
    "kimi-k2-thinking",
    "kimi-k2",
    "doubao-seed-1.6-vision",
    "doubao-seed-1.6-thinking",
    "doubao-seed-1.6",
    "doubao-seed-1.6-lite",
    "doubao-seed-1.6-flash",
    "doubao-1.5-ui-tars",
    "doubao-1.5-thinking-vision-pro",
    "doubao-1.5-thinking-pro",
    "doubao-1.5-thinking-pro-m",
    "deepseek-r1",
    "deepseek-v3",
    "doubao-1.5-pro-32k",
    "doubao-1.5-pro-256k",
    "doubao-1.5-lite-32k",
    "doubao-1.5-vision-pro-32k",
    "doubao-1.5-vision-pro",
    "doubao-1.5-vision-lite",
    "doubao-lite-32k",
    "doubao-pro-32k",
  ],
  hunyuan: ["hunyuan-turbos-latest", "hunyuan-large"],
  baichuan: ["Baichuan4-Turbo", "Baichuan3-Turbo"],
  stepfun: ["step-2-mini", "step-1-8k"],
  qianfan: ["ernie-4.0-turbo-8k", "ernie-speed-8k"],
  spark: ["x1", "4.0Ultra"],
  sensechat: ["SenseChat-5", "SenseChat-Turbo"],
  "tencent-lkeap": ["deepseek-v3", "deepseek-r1"],
  mimo: ["MiMo-VL-7B", "MiMo-7B"],
  longcat: ["longcat-flash-chat", "longcat-pro-chat"],
  internlm: ["internlm3-latest", "internlm2.5-latest"],
  lingyi: ["yi-large", "yi-medium"],
  ai360: ["360gpt2-pro", "360gpt-turbo"],
  ollama: ["llama3.1", "qwen2.5", "mistral", "gemma2"],
  "github-copilot": ["gpt-4.1", "claude-sonnet-4"],
  "kimi-coding-plan": ["kimi-k2.5", "kimi-k2-thinking"],
  "kimi-code": ["kimi-for-coding"],
  "minimax-coding-plan": [
    "MiniMax-M2.7",
    "MiniMax-M2.7-highspeed",
    "MiniMax-M2.5",
    "MiniMax-M2.5-highspeed",
    "MiniMax-M2.1",
    "MiniMax-M2",
  ],
  "bailian-coding-plan": [
    "qwen-max",
    "qwen3.5-plus",
    "qwen3-coder-plus",
    "qwen3-max-2026-01-23",
    "qwen3-coder-next",
    "glm-5",
    "glm-4.7",
    "kimi-k2.5",
    "MiniMax-M2.5",
  ],
  "glm-coding-plan": [
    "glm-5.1",
    "GLM-5.1",
    "GLM-5",
    "GLM-5-Turbo",
    "GLM-4.7",
    "GLM-4.6",
    "GLM-4.5",
    "GLM-4.5-Air",
  ],
  "volcengine-coding-plan": [
    "doubao-seed-2.0-code",
    "doubao-seed-2.0-pro",
    "doubao-seed-2.0-lite",
    "doubao-seed-code",
    "minimax-m2.5",
    "glm-4.7",
    "deepseek-v3.2",
    "kimi-k2.5",
  ],
  "opencode-coding-plan": [
    "glm-5.1",
    "glm-5",
    "kimi-k2.5",
    "mimo-v2-omni",
    "qwen3.6-plus",
    "minimax-m2.5",
    "minimax-m2.7",
    "mimo-v2-pro",
    "qwen3.5-plus",
  ],
  "iflytek-astron-coding-plan": ["astron-code-latest"],
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
    {
      routeKey: "novel.character",
      providerId: "deepseek",
      model: "deepseek-chat",
      temperature: 0.7,
      maxTokens: 4200,
      stream: true,
    },
  ],
  recentModels: [],
  callLogs: [],
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

export function resolveRouteKeyForCoreAction(action: string): string {
  return INKOS_CORE_ACTION_ROUTE_KEYS[action] ?? "global.default";
}

export function resolveModelRouteForCoreAction(
  settings: LocalModelSettings,
  action: string,
): ResolvedModelRoute {
  return resolveModelRoute(settings, resolveRouteKeyForCoreAction(action));
}

export function formatModelPickerValue(providerId: string, model: string): string {
  return `${providerId}::${model}`;
}

export function parseModelPickerValue(value: string): {
  providerId: string;
  model: string;
} | null {
  const parts = value.split("::");
  if (parts.length < 2) {
    return null;
  }

  const providerId = parts[0]?.trim();
  const model = parts.slice(1).join("::").trim();

  if (!providerId || !model) {
    return null;
  }

  return { providerId, model };
}

export function getDefaultWritingModelSelection(
  settings: LocalModelSettings,
): string | null {
  const resolved = resolveModelRoute(settings, "novel.writer");
  if (resolved.status !== "ready") {
    return null;
  }

  return formatModelPickerValue(resolved.provider.id, resolved.model);
}

export function getDefaultChatModelSelection(
  settings: LocalModelSettings,
): string | null {
  const resolved = resolveModelRoute(settings, "global.default");
  if (resolved.status !== "ready") {
    return null;
  }

  return formatModelPickerValue(resolved.provider.id, resolved.model);
}

export function buildModelRouteSummary(
  settings: LocalModelSettings,
  routeKey: string,
): string {
  const resolved = resolveModelRoute(settings, routeKey);
  if (resolved.status !== "ready") {
    return resolved.message;
  }

  return `${resolved.provider.name} · ${resolved.model}`;
}

export function appendModelCallLog(
  settings: LocalModelSettings,
  input: {
    routeKey: string;
    label: string;
    providerId: string;
    providerName: string;
    model: string;
    status: ModelCallLog["status"];
    latencyMs?: number;
    startedAt: string;
    endedAt: string;
    errorMessage?: string;
  },
): LocalModelSettings {
  const entry: ModelCallLog = {
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
  };
  const recentEntry: RecentModelUsage = {
    providerId: input.providerId,
    model: input.model,
    routeKey: input.routeKey,
    usedAt: input.endedAt,
  };
  const recentModels = [
    recentEntry,
    ...(settings.recentModels ?? []).filter(
      (item) =>
        !(item.providerId === recentEntry.providerId && item.model === recentEntry.model),
    ),
  ].slice(0, 8);

  return touchSettings({
    ...settings,
    recentModels,
    callLogs: [entry, ...(settings.callLogs ?? [])].slice(0, 50),
  });
}

export type ModelCallStats = {
  total: number;
  success: number;
  error: number;
  cancelled: number;
  avgLatencyMs: number | null;
  successRate: number | null;
};

export function buildModelCallStats(
  callLogs: ModelCallLog[] | undefined,
): ModelCallStats {
  const logs = callLogs ?? [];
  const total = logs.length;
  const success = logs.filter((entry) => entry.status === "success").length;
  const error = logs.filter((entry) => entry.status === "error").length;
  const cancelled = logs.filter((entry) => entry.status === "cancelled").length;
  const latencies = logs
    .map((entry) => entry.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(
          latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
        )
      : null;
  const successRate =
    total > 0 ? Math.round((success / total) * 100) : null;

  return {
    total,
    success,
    error,
    cancelled,
    avgLatencyMs,
    successRate,
  };
}

export function upsertRecentModelSelection(
  settings: LocalModelSettings,
  providerId: string,
  model: string,
  routeKey = "chat.override",
): LocalModelSettings {
  const recentEntry: RecentModelUsage = {
    providerId,
    model,
    routeKey,
    usedAt: new Date().toISOString(),
  };
  const recentModels = [
    recentEntry,
    ...(settings.recentModels ?? []).filter(
      (item) => !(item.providerId === providerId && item.model === model),
    ),
  ].slice(0, 8);

  return touchSettings({
    ...settings,
    recentModels,
  });
}

export function resolveReadyModelBinding(
  resolved: ResolvedModelRoute,
):
  | {
      provider: LocalModelProvider;
      model: string;
      temperature: number;
      maxTokens: number;
      routeKey: string;
    }
  | { error: string } {
  if (resolved.status !== "ready") {
    return { error: resolved.message };
  }

  return {
    provider: resolved.provider,
    model: resolved.model,
    temperature: resolved.temperature,
    maxTokens: resolved.maxTokens,
    routeKey: resolved.route.routeKey,
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
  return JSON.stringify(settings, null, 2);
}

export function importLocalModelSettings(raw: string): LocalModelSettings {
  return normalizeSettings(JSON.parse(raw));
}

export function normalizeLocalModelProvider(
  provider: LocalModelProvider,
): LocalModelProvider {
  return normalizeProvider(provider);
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

  if (resolved.apiFormat === "gemini") {
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

export async function testProviderConnection(
  provider: LocalModelProvider,
  model?: string,
  prompt = "用一句中文回复：模型连接正常。",
): Promise<ModelConnectionTestResult> {
  const validation = validateProviderForRequest(provider);

  if (validation) {
    return validation;
  }

  if (provider.apiFormat === "gemini") {
    return {
      ok: false,
      status: "unsupported",
      message: "当前版本先支持 OpenAI-compatible 与 Ollama 的浏览器本地测试。",
    };
  }

  const modelCandidates = getProviderTestModelCandidates(provider, model);
  const startedAt = getNow();
  let lastError: ModelConnectionTestResult | null = null;

  for (const modelName of modelCandidates) {
    const endpoint = getProviderTestEndpoint(provider);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: getProviderHeaders(provider),
        body: JSON.stringify(getProviderTestBody(provider, modelName, prompt)),
      });
      const text = await response.text();

      if (!response.ok) {
        lastError = {
          ok: false,
          status: "error",
          message: formatProviderHttpError({
            status: response.status,
            text,
            endpoint,
            model: modelName,
            apiFormat: provider.apiFormat,
          }),
        };
        if (response.status === 401 || response.status === 403) {
          break;
        }
        continue;
      }

      return {
        ok: true,
        status: "success",
        message:
          modelName === modelCandidates[0]
            ? "Key 可用，模型返回正常。"
            : `Key 可用，已自动切换到可用模型 ${modelName}。`,
        latencyMs: Math.round(getNow() - startedAt),
        sample: extractSampleText(text, provider.apiFormat),
      };
    } catch (error) {
      lastError = {
        ok: false,
        status: "error",
        message:
          error instanceof Error
            ? `${error.message}。如果是浏览器 CORS 限制，后续可改为服务端代理测试。`
            : "测试请求失败。",
      };
    }
  }

  return {
    ...(lastError ?? {
      ok: false,
      status: "error",
      message: "没有可测试的模型。",
    }),
    latencyMs: Math.round(getNow() - startedAt),
  };
}

function formatProviderHttpError(args: {
  status: number;
  text: string;
  endpoint: string;
  model: string;
  apiFormat: ModelApiFormat;
}) {
  const detail = args.text.trim();
  const suffix = `请求地址：${args.endpoint}；模型：${args.model}；协议：${args.apiFormat}`;

  if (!detail) {
    return `HTTP ${args.status}: 上游没有返回错误正文。${suffix}`;
  }

  return `HTTP ${args.status}: ${detail.slice(0, 180)}。${suffix}`;
}

export async function listProviderModels(
  provider: LocalModelProvider,
): Promise<ProviderModelsResult> {
  const validation = validateProviderForModels(provider);

  if (validation) {
    return validation;
  }

  const startedAt = getNow();

  try {
    const response = await fetch(getProviderModelsEndpoint(provider), {
      method: "GET",
      headers: getProviderModelsHeaders(provider),
    });
    const text = await response.text();
    const latencyMs = Math.round(getNow() - startedAt);

    if (!response.ok) {
      return {
        ok: false,
        status: "error",
        message: `HTTP ${response.status}: ${text.slice(0, 180)}`,
        models: [],
        latencyMs,
      };
    }

    const models = parseProviderModels(text, provider.apiFormat);

    return {
      ok: true,
      status: "success",
      message: models.length
        ? `获取到 ${models.length} 个模型。`
        : "请求成功，但没有发现可用模型。",
      models,
      latencyMs,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message:
        error instanceof Error
          ? `${error.message}。如果是浏览器 CORS 限制，后续可改为服务端代理获取模型列表。`
          : "获取模型列表失败。",
      models: [],
      latencyMs: Math.round(getNow() - startedAt),
    };
  }
}

export async function sendProviderChatMessage(args: {
  provider: LocalModelProvider;
  model: string;
  messages: ProviderChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}): Promise<ProviderChatResult> {
  const validation = validateProviderForRequest(args.provider);

  if (validation) {
    return validation;
  }

  if (args.provider.apiFormat === "gemini") {
    return {
      ok: false,
      status: "unsupported",
      message: "当前版本先支持 OpenAI-compatible、Anthropic-compatible 与 Ollama 对话。",
    };
  }

  const model = args.model.trim();

  if (!model) {
    return {
      ok: false,
      status: "error",
      message: "请先选择一个模型。",
    };
  }

  const startedAt = getNow();
  const endpoint = getProviderTestEndpoint(args.provider);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: getProviderHeaders(args.provider),
      body: JSON.stringify(
        getProviderChatBody({
          provider: args.provider,
          model,
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          maxTokens: args.maxTokens ?? 2400,
          stream: false,
        }),
      ),
    });
    const text = await response.text();
    const latencyMs = Math.round(getNow() - startedAt);

    if (!response.ok) {
      return {
        ok: false,
        status: "error",
        message: formatProviderHttpError({
          status: response.status,
          text,
          endpoint,
          model,
          apiFormat: args.provider.apiFormat,
        }),
        latencyMs,
      };
    }

    const content = extractSampleText(text, args.provider.apiFormat).trim();

    if (!content) {
      return {
        ok: false,
        status: "error",
        message: "模型返回为空。",
        latencyMs,
      };
    }

    return {
      ok: true,
      status: "success",
      message: "模型回复成功。",
      content,
      latencyMs,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "模型对话请求失败。",
      latencyMs: Math.round(getNow() - startedAt),
    };
  }
}

export async function createProviderChatStream(args: {
  provider: LocalModelProvider;
  model: string;
  messages: ProviderChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<ProviderChatStreamResult> {
  const validation = validateProviderForRequest(args.provider);

  if (validation) {
    return validation;
  }

  if (args.provider.apiFormat === "gemini") {
    return {
      ok: false,
      status: "unsupported",
      message: "当前版本先支持 OpenAI-compatible、Anthropic-compatible 与 Ollama 对话。",
    };
  }

  const model = args.model.trim();

  if (!model) {
    return {
      ok: false,
      status: "error",
      message: "请先选择一个模型。",
    };
  }

  const startedAt = getNow();
  const endpoint = getProviderTestEndpoint(args.provider);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: getProviderHeaders(args.provider),
      body: JSON.stringify(
        getProviderChatBody({
          provider: args.provider,
          model,
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          maxTokens: args.maxTokens ?? 2400,
          stream: true,
        }),
      ),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();

      return {
        ok: false,
        status: "error",
        message: formatProviderHttpError({
          status: response.status,
          text,
          endpoint,
          model,
          apiFormat: args.provider.apiFormat,
        }),
        latencyMs: Math.round(getNow() - startedAt),
      };
    }

    return {
      ok: true,
      response,
      apiFormat: args.provider.apiFormat,
      startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "模型流式对话请求失败。",
      latencyMs: Math.round(getNow() - startedAt),
    };
  }
}

function normalizeSettings(value: unknown): LocalModelSettings {
  const settings = value as Partial<LocalModelSettings>;

  return touchSettings({
    version: 1,
    providers: Array.isArray(settings.providers)
      ? mergeProviderTemplates(settings.providers.map(normalizeProvider))
      : DEFAULT_LOCAL_MODEL_SETTINGS.providers,
    routes: Array.isArray(settings.routes)
      ? settings.routes.map(normalizeRoute)
      : DEFAULT_LOCAL_MODEL_SETTINGS.routes,
    recentModels: Array.isArray(settings.recentModels)
      ? settings.recentModels
          .filter(
            (item) =>
              typeof item?.providerId === "string" &&
              typeof item?.model === "string" &&
              typeof item?.routeKey === "string" &&
              typeof item?.usedAt === "string",
          )
          .slice(0, 8)
      : [],
    callLogs: Array.isArray(settings.callLogs)
      ? settings.callLogs
          .filter(
            (item) =>
              typeof item?.id === "string" &&
              typeof item?.routeKey === "string" &&
              typeof item?.label === "string" &&
              typeof item?.providerId === "string" &&
              typeof item?.providerName === "string" &&
              typeof item?.model === "string" &&
              typeof item?.status === "string" &&
              typeof item?.startedAt === "string" &&
              typeof item?.endedAt === "string",
          )
          .slice(0, 50)
      : [],
    updatedAt:
      typeof settings.updatedAt === "string"
        ? settings.updatedAt
        : new Date().toISOString(),
  });
}

function mergeProviderTemplates(
  providers: LocalModelProvider[],
): LocalModelProvider[] {
  const existingProviderIds = new Set(providers.map((provider) => provider.id));
  const missingTemplates = PROVIDER_TEMPLATES.filter(
    (provider) => !existingProviderIds.has(provider.id),
  );

  return [...providers, ...missingTemplates.map((provider) => ({ ...provider }))];
}

const TEMPLATE_LOCKED_ENDPOINT_PROVIDER_IDS = new Set([
  "minimax",
  "kimi-coding-plan",
  "kimi-code",
  "minimax-coding-plan",
  "bailian-coding-plan",
  "glm-coding-plan",
  "volcengine-coding-plan",
  "opencode-coding-plan",
  "iflytek-astron-coding-plan",
]);

function normalizeProvider(provider: LocalModelProvider): LocalModelProvider {
  const template = PROVIDER_TEMPLATES.find((item) => item.id === provider.id);
  const shouldUseTemplateEndpoint =
    template !== undefined &&
    TEMPLATE_LOCKED_ENDPOINT_PROVIDER_IDS.has(provider.id) &&
    (provider.baseUrl !== template.baseUrl ||
      provider.modelsBaseUrl !== template.modelsBaseUrl ||
      provider.apiFormat !== template.apiFormat);
  const endpointTemplate = shouldUseTemplateEndpoint ? template : null;
  const normalizedModels = Array.isArray(provider.availableModels)
    ? Array.from(
        new Set(
          provider.availableModels
            .filter((model) => typeof model === "string")
            .map((model) => model.trim())
            .filter(Boolean),
        ),
      )
    : undefined;

  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseUrl: endpointTemplate ? endpointTemplate.baseUrl : provider.baseUrl,
    modelsBaseUrl: endpointTemplate
      ? endpointTemplate.modelsBaseUrl
      : provider.modelsBaseUrl,
    apiFormat: endpointTemplate ? endpointTemplate.apiFormat : provider.apiFormat,
    apiKey: provider.apiKey ?? "",
    apiKeyEnv: provider.apiKeyEnv,
    enabled: Boolean(provider.enabled),
    availableModels: shouldUseTemplateEndpoint ? undefined : normalizedModels,
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
    recentModels: [...(settings.recentModels ?? [])],
    callLogs: [...(settings.callLogs ?? [])],
    updatedAt: new Date().toISOString(),
  };
}

function getTestEndpoint(resolved: Extract<ResolvedModelRoute, { status: "ready" }>) {
  const baseUrl = resolved.baseUrl.replace(/\/$/, "");

  if (resolved.apiFormat === "ollama") {
    return `${baseUrl}/api/chat`;
  }

  if (resolved.apiFormat === "anthropic") {
    return `${baseUrl}/messages`;
  }

  return `${baseUrl}/chat/completions`;
}

function validateProviderForRequest(
  provider: LocalModelProvider,
): ModelConnectionTestResult | null {
  if (!provider.baseUrl.trim()) {
    return {
      ok: false,
      status: "error",
      message: "请先填写 Base URL。",
    };
  }

  if (!provider.apiKey.trim() && provider.apiFormat !== "ollama") {
    return {
      ok: false,
      status: "error",
      message: "供应商缺少 API Key。API Key 只保存在当前浏览器本地。",
    };
  }

  return null;
}

function validateProviderForModels(
  provider: LocalModelProvider,
): ProviderModelsResult | null {
  if (provider.apiFormat === "gemini") {
    return {
      ok: false,
      status: "unsupported",
      message: "当前版本先支持 OpenAI-compatible 与 Ollama 的模型列表获取。",
      models: [],
    };
  }

  const validation = validateProviderForRequest(provider);

  if (!validation) {
    return null;
  }

  return {
    ok: false,
    status: validation.status,
    message: validation.message,
    models: [],
  };
}

function getProviderTestEndpoint(provider: LocalModelProvider) {
  const baseUrl = provider.baseUrl.replace(/\/$/, "");

  if (provider.apiFormat === "ollama") {
    return `${baseUrl}/api/chat`;
  }

  if (provider.apiFormat === "anthropic") {
    return `${baseUrl}/messages`;
  }

  return `${baseUrl}/chat/completions`;
}

function getProviderModelsEndpoint(provider: LocalModelProvider) {
  const baseUrl = (provider.modelsBaseUrl || provider.baseUrl).replace(/\/$/, "");

  if (provider.apiFormat === "ollama") {
    return `${baseUrl}/api/tags`;
  }

  return `${baseUrl}/models`;
}

function getProviderHeaders(provider: LocalModelProvider) {
  const apiKey = provider.apiKey.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider.apiFormat === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  if (provider.apiFormat !== "ollama") {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function getProviderModelsHeaders(provider: LocalModelProvider) {
  const apiKey = provider.apiKey.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider.apiFormat !== "ollama") {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function getProviderTestBody(
  provider: LocalModelProvider,
  model: string,
  prompt: string,
) {
  if (provider.apiFormat === "ollama") {
    return {
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 128,
      },
    };
  }

  if (provider.apiFormat === "anthropic") {
    return {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 128,
      temperature: 0.7,
      stream: false,
    };
  }

  return {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 128,
    stream: false,
  };
}

function getProviderChatBody(args: {
  provider: LocalModelProvider;
  model: string;
  messages: ProviderChatMessage[];
  temperature: number;
  maxTokens: number;
  stream: boolean;
}) {
  if (args.provider.apiFormat === "ollama") {
    return {
      model: args.model,
      messages: args.messages,
      stream: args.stream,
      options: {
        temperature: args.temperature,
        num_predict: args.maxTokens,
      },
    };
  }

  if (args.provider.apiFormat === "anthropic") {
    const system = args.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n")
      .trim();

    return {
      model: args.model,
      messages: args.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ...(system ? { system } : {}),
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      stream: args.stream,
    };
  }

  return {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature,
    max_tokens: args.maxTokens,
    stream: args.stream,
  };
}

function getDefaultProviderModel(provider: LocalModelProvider) {
  return MODEL_SUGGESTIONS[provider.id]?.[0] ?? "gpt-4.1-mini";
}

function getProviderTestModelCandidates(
  provider: LocalModelProvider,
  preferredModel?: string,
) {
  return Array.from(
    new Set(
      [
        preferredModel?.trim(),
        ...(provider.availableModels ?? []),
        ...(MODEL_SUGGESTIONS[provider.id] ?? []),
        getDefaultProviderModel(provider),
      ].filter((model): model is string => Boolean(model)),
    ),
  );
}

function parseProviderModels(raw: string, apiFormat: ModelApiFormat): string[] {
  const json = JSON.parse(raw);
  const models: unknown[] =
    apiFormat === "ollama"
      ? (json.models ?? []).map((model: { name?: string }) => model.name)
      : (json.data ?? []).map((model: { id?: string }) => model.id);
  const normalizedModels = models
    .filter((model): model is string => typeof model === "string")
    .map((model) => model.trim())
    .filter(Boolean);

  return Array.from(new Set<string>(normalizedModels)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function getNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function getTestHeaders(
  resolved: Extract<ResolvedModelRoute, { status: "ready" }>,
) {
  const apiKey = resolved.apiKey.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (resolved.apiFormat === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (resolved.apiFormat !== "ollama") {
    headers.Authorization = `Bearer ${apiKey}`;
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

  if (resolved.apiFormat === "anthropic") {
    return {
      model: resolved.model,
      messages: [{ role: "user", content: prompt }],
      temperature: resolved.temperature,
      max_tokens: Math.min(resolved.maxTokens, 1024),
      stream: false,
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

    if (apiFormat === "anthropic") {
      const firstText = Array.isArray(json.content)
        ? json.content.find((part: { type?: string; text?: string }) =>
            part?.type === "text" && typeof part.text === "string",
          )?.text
        : undefined;

      return firstText ?? raw.slice(0, 180);
    }

    return json.choices?.[0]?.message?.content ?? raw.slice(0, 180);
  } catch {
    return raw.slice(0, 180);
  }
}

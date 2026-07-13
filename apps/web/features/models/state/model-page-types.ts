export { isProviderConnected } from "#lib/model-settings";

export type ProviderCategory =
  | "all"
  | "aggregator"
  | "overseas"
  | "china"
  | "local"
  | "coding"
  | "custom";

export const PROVIDER_GROUPS: Array<{
  category: Exclude<ProviderCategory, "all">;
  label: string;
  description: string;
  providerIds: string[];
}> = [
  {
    category: "aggregator",
    label: "聚合 API",
    description: "聚合国内外主流模型，适合用一个 API Key 接入多模型的场景。",
    providerIds: ["kkaiapi", "openrouter", "new-api", "siliconflow"],
  },
  {
    category: "overseas",
    label: "海外原厂",
    description: "海外模型原厂服务商。",
    providerIds: ["anthropic", "openai", "google-gemini", "mistral", "xai"],
  },
  {
    category: "china",
    label: "国产原厂",
    description: "国内模型原厂服务商。",
    providerIds: [
      "deepseek",
      "minimax",
      "moonshot",
      "zhipu",
      "bailian",
      "volcengine",
      "hunyuan",
      "baichuan",
      "stepfun",
      "qianfan",
      "spark",
      "sensechat",
      "tencent-lkeap",
      "mimo",
      "longcat",
      "internlm",
      "lingyi",
      "ai360",
    ],
  },
  {
    category: "local",
    label: "本地 / 订阅",
    description: "本地模型或本机订阅服务。",
    providerIds: ["ollama", "github-copilot"],
  },
  {
    category: "coding",
    label: "CodingPlan",
    description: "面向代码生成、计划和工程代理的模型服务。",
    providerIds: [
      "kimi-coding-plan",
      "kimi-code",
      "minimax-coding-plan",
      "bailian-coding-plan",
      "glm-coding-plan",
      "volcengine-coding-plan",
      "opencode-coding-plan",
      "iflytek-astron-coding-plan",
    ],
  },
  {
    category: "custom",
    label: "自定义服务",
    description: "OpenAI-compatible 自定义网关。",
    providerIds: ["custom-openai-compatible"],
  },
];

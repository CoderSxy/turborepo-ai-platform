import { NextResponse } from "next/server";

import {
  listProviderModels,
  MODEL_SUGGESTIONS,
  normalizeLocalModelProvider,
  testProviderConnection,
  type LocalModelProvider,
} from "../../../../lib/model-settings";

type ProviderTestRequest = {
  provider?: LocalModelProvider;
  model?: string;
  prompt?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProviderTestRequest;

    if (!body.provider) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          message: "缺少模型服务商配置。",
        },
        { status: 400 },
      );
    }

    const provider = normalizeLocalModelProvider(body.provider);
    const modelsResult = await listProviderModels(provider);

    if (modelsResult.ok && modelsResult.models.length > 0) {
      return NextResponse.json({
        ok: true,
        status: "success",
        message: `连接成功，获取到 ${modelsResult.models.length} 个模型。`,
        latencyMs: modelsResult.latencyMs,
        models: modelsResult.models,
        selectedModel: body.model || modelsResult.models[0],
        modelsSource: "api",
      });
    }

    const staticModels = getTrustedStaticModels(provider);

    if (staticModels.length > 0 && !isAuthFailure(modelsResult.message)) {
      return NextResponse.json({
        ok: true,
        status: "success",
        message: `连接成功，已使用内置模型清单 ${staticModels.length} 个模型。`,
        latencyMs: modelsResult.latencyMs,
        models: staticModels,
        selectedModel: body.model || staticModels[0],
        modelsSource: "fallback",
      });
    }

    const result = await testProviderConnection(
      provider,
      body.model,
      body.prompt,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message:
          error instanceof Error ? error.message : "模型连接测试代理请求失败。",
      },
      { status: 500 },
    );
  }
}

function getTrustedStaticModels(provider: LocalModelProvider) {
  if (!provider.id.endsWith("-coding-plan") && provider.id !== "kimi-code") {
    return [];
  }

  return MODEL_SUGGESTIONS[provider.id] ?? [];
}

function isAuthFailure(message: string) {
  return /HTTP\s+(401|403)\b/.test(message);
}

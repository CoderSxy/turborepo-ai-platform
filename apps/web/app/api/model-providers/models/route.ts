import { NextResponse } from "next/server";

import {
  listProviderModels,
  normalizeLocalModelProvider,
  type LocalModelProvider,
} from "../../../../lib/model-settings";

type ProviderModelsRequest = {
  provider?: LocalModelProvider;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProviderModelsRequest;

    if (!body.provider) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          message: "缺少模型服务商配置。",
          models: [],
        },
        { status: 400 },
      );
    }

    const result = await listProviderModels(
      normalizeLocalModelProvider(body.provider),
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message:
          error instanceof Error ? error.message : "获取模型列表代理请求失败。",
        models: [],
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import {
  createProviderChatStream,
  normalizeLocalModelProvider,
  sendProviderChatMessage,
  type LocalModelProvider,
  type ProviderChatMessage,
} from "../../../lib/model-settings";
import { normalizeProviderTextStream } from "../../../lib/provider-stream-parser";

type NovelChatRequest = {
  provider?: LocalModelProvider;
  model?: string;
  messages?: ProviderChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NovelChatRequest;

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

    if (!body.model) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          message: "请先选择模型。",
        },
        { status: 400 },
      );
    }

    const messages = Array.isArray(body.messages)
      ? body.messages.filter(
          (message) =>
            typeof message?.content === "string" &&
            ["user", "assistant", "system"].includes(message.role),
        )
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          message: "请输入对话内容。",
        },
        { status: 400 },
      );
    }

    const provider = normalizeLocalModelProvider(body.provider);

    if (body.stream) {
      const streamResult = await createProviderChatStream({
        provider,
        model: body.model,
        messages,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
      });

      if (!("response" in streamResult)) {
        return NextResponse.json(streamResult, { status: 400 });
      }

      return new Response(
        normalizeProviderTextStream(
          streamResult.response.body,
          streamResult.apiFormat,
        ),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        },
      );
    }

    const result = await sendProviderChatMessage({
      provider,
      model: body.model,
      messages,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      stream: false,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "小说对话请求失败。",
      },
      { status: 500 },
    );
  }
}

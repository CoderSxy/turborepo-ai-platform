import { NextResponse } from "next/server";
import {
  type InkosCoreAction,
  type InkosNovelProject,
  type InkosProjectAssetsPatch,
} from "@repo/inkos-adapter";
import { runInkosCoreAction } from "@repo/inkos-adapter/server";

import {
  normalizeLocalModelProvider,
  type LocalModelProvider,
} from "../../../../lib/model-settings";

type InkosActionRequest = {
  action?: InkosCoreAction;
  provider?: LocalModelProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  project?: InkosNovelProject;
  assets?: InkosProjectAssetsPatch;
  instruction?: string;
  stream?: boolean;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

const SUPPORTED_INKOS_ACTIONS = new Set<InkosCoreAction>([
  "outline",
  "settings",
  "write-chapter",
  "revise-chapter",
  "review",
  "radar",
  "diagnostics",
]);

const ACTION_TEMPERATURE: Record<InkosCoreAction, number> = {
  outline: 0.7,
  settings: 0.55,
  "write-chapter": 0.78,
  "revise-chapter": 0.45,
  review: 0.25,
  radar: 0.6,
  diagnostics: 0.25,
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InkosActionRequest;

    if (!body.action || !SUPPORTED_INKOS_ACTIONS.has(body.action)) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          message: "暂不支持这个 InkOS 动作。",
        },
        { status: 400 },
      );
    }

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

    if (!body.project) {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          message: "请先创建一本书籍。",
        },
        { status: 400 },
      );
    }

    const provider = normalizeLocalModelProvider(body.provider);
    const coreInput = {
      action: body.action,
      project: body.project,
      assets: body.assets,
      instruction: body.instruction,
      recentMessages: body.recentMessages,
      model: {
        providerId: provider.id,
        providerName: provider.name,
        apiFormat: provider.apiFormat,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: body.model,
        temperature:
          typeof body.temperature === "number"
            ? body.temperature
            : ACTION_TEMPERATURE[body.action],
        stream: false,
      },
    };

    if (body.stream) {
      return new Response(createInkosActionProgressStream(coreInput), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const result = await runInkosCoreAction(coreInput);

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message:
          error instanceof Error ? error.message : "InkOS Core 请求失败。",
      },
      { status: 500 },
    );
  }
}

function createInkosActionProgressStream(
  input: Parameters<typeof runInkosCoreAction>[0],
) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        emit({
          type: "progress",
          stage: "start",
          message: "任务开始，正在准备 InkOS Core 请求。",
        });
        emit({
          type: "progress",
          stage: "assets",
          message: "正在读取书籍资产和最近会话上下文。",
        });
        emit({
          type: "progress",
          stage: "agent",
          message: getAgentProgressMessage(input.action),
        });

        const result = await runInkosCoreAction(input);

        emit({
          type: "progress",
          stage: "result",
          message: "InkOS Core 已返回结果，准备写回本地数据。",
        });
        emit({
          type: "result",
          result,
        });
      } catch (error) {
        emit({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "InkOS Core 流式任务失败。",
        });
      } finally {
        controller.close();
      }
    },
  });
}

function getAgentProgressMessage(action: InkosCoreAction) {
  if (action === "write-chapter") {
    return "正在调用 WriterAgent 生成下一章。";
  }

  if (action === "review") {
    return "正在调用 ContinuityAuditor 审稿。";
  }

  if (action === "revise-chapter") {
    return "正在调用 ReviserAgent 修订当前章节。";
  }

  if (action === "radar") {
    return "正在调用 RadarAgent 扫描市场方向。";
  }

  if (action === "diagnostics") {
    return "正在调用 StateValidatorAgent 运行环境诊断。";
  }

  return "正在调用 ArchitectAgent 处理书籍规划。";
}

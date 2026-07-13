import type { InkosCoreAction, InkosNovelProject } from "@repo/inkos-adapter";
import type { LocalModelProvider } from "../../../lib/model-settings";
import type { NovelProjectAssets, NovelRecoverableErrorNotice } from "../../../lib/novel-store";
import type {
  InkosActionResponse,
  InkosActionStreamEvent,
  NovelChatMessage,
  NovelChatResponse,
} from "../state/studio-types";

export function parseInkosActionStreamEvent(line: string): InkosActionStreamEvent | null {
  const trimmed = line.trim();

  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed) as InkosActionStreamEvent;

    if (
      event.type === "progress" ||
      event.type === "result" ||
      event.type === "error"
    ) {
      return event;
    }
  } catch {
    return null;
  }

  return null;
}

export function formatCoreProgressContent(
  label: string,
  progressMessages: string[],
  options?: { paused?: boolean },
) {
  const progress =
    progressMessages.length > 0
      ? progressMessages.map((message) => `- ${message}`).join("\n")
      : "- 等待任务开始";

  return [
    `## ${label}${options?.paused ? "（已暂停）" : ""}`,
    progress,
    options?.paused ? "- 任务已暂停，可从任务日志继续执行。" : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatCoreFinalContent(
  label: string,
  progressMessages: string[],
  result: InkosActionResponse,
) {
  const progress = [...progressMessages, "任务完成。"]
    .map((message) => `- ${message}`)
    .join("\n");

  return [
    `## ${label}`,
    `### 执行进度\n${progress}`,
    result.content || result.message,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatCoreErrorContent(
  label: string,
  notice: NovelRecoverableErrorNotice,
) {
  return [
    `## ${label}${notice.category === "cancelled" ? "已取消" : "失败"}`,
    `### 原因\n${notice.detail}`,
    `### 恢复建议\n${notice.recoveryAction}`,
  ].join("\n\n");
}

export function formatCoreTaskErrorMessage(notice: NovelRecoverableErrorNotice) {
  return [
    `${notice.title}：${notice.detail}`,
    `恢复建议：${notice.recoveryAction}`,
  ].join("\n");
}

export async function streamNovelChat(
  provider: LocalModelProvider,
  model: string,
  messages: NovelChatMessage[],
  project: InkosNovelProject,
  onDelta: (content: string) => void,
  signal?: AbortSignal,
  options?: {
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  const response = await fetch("/api/novel-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider,
      model,
      temperature: options?.temperature ?? 0.8,
      maxTokens: options?.maxTokens ?? 3200,
      stream: true,
      messages: [
        {
          role: "system",
          content: [
            "你是 InkOS 小说创作助手，负责帮助用户推进长篇小说创作。",
            `当前书名：${project.title}`,
            `题材：${project.genre}`,
            "请用中文回答，优先给出可直接用于创作的内容；如果用户要求写章节，请输出正文或清晰章节草稿。",
            "回复可以使用 Markdown，但不要输出无意义的代码围栏。",
          ].join("\n"),
        },
        ...messages.slice(-10).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const result = (await response.json().catch(() => null)) as
      | NovelChatResponse
      | null;

    throw new Error(result?.message || "模型流式请求失败。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    content += chunk;
    onDelta(content);
  }

  const tail = decoder.decode();

  if (tail) {
    content += tail;
    onDelta(content);
  }

  return content;
}

export async function streamInkosCoreAction(
  action: InkosCoreAction,
  provider: LocalModelProvider,
  model: string,
  project: InkosNovelProject,
  assets: NovelProjectAssets,
  messages: NovelChatMessage[],
  onEvent: (event: InkosActionStreamEvent) => void,
  instruction?: string,
  signal?: AbortSignal,
  options?: {
    temperature?: number;
    maxTokens?: number;
  },
): Promise<InkosActionResponse> {
  const response = await fetch("/api/inkos/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      provider,
      model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      project,
      assets: {
        outline: assets.outline,
        worldNotes: assets.worldNotes,
        characters: assets.characters,
        settings: assets.settings,
        marketRadars: assets.marketRadars,
        diagnostics: assets.diagnostics,
      },
      instruction,
      stream: true,
      recentMessages: messages.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const result = (await response.json().catch(() => null)) as
      | InkosActionResponse
      | { message?: string }
      | null;

    throw new Error(result?.message || "InkOS Core 流式请求失败。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: InkosActionResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseInkosActionStreamEvent(line);

      if (!event) continue;

      onEvent(event);

      if (event.type === "result") {
        finalResult = event.result;
      }

      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }

  const tail = decoder.decode();
  const finalLine = `${buffer}${tail}`.trim();

  if (finalLine) {
    const event = parseInkosActionStreamEvent(finalLine);

    if (event) {
      onEvent(event);

      if (event.type === "result") {
        finalResult = event.result;
      }

      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }

  if (!finalResult) {
    throw new Error("InkOS Core 没有返回最终结果。");
  }

  return finalResult;
}

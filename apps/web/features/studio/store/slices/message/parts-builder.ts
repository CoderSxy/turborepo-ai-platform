import type { StudioMessage, StudioMessagePart } from "../../types";

export function buildTextPart(content: string): StudioMessagePart {
  return { type: "text", content };
}

export function buildProgressPart(
  label: string,
  options?: { paused?: boolean },
): Extract<StudioMessagePart, { type: "progress" }> {
  return { type: "progress", label, steps: [], paused: options?.paused };
}

export function appendProgressStep(
  part: Extract<StudioMessagePart, { type: "progress" }>,
  message: string,
  at: number,
): Extract<StudioMessagePart, { type: "progress" }> {
  return { ...part, steps: [...part.steps, { message, at }] };
}

export function updateTextPartContent(
  part: Extract<StudioMessagePart, { type: "text" }>,
  content: string,
): Extract<StudioMessagePart, { type: "text" }> {
  return { ...part, content };
}

export function buildResultPart(
  title: string,
  content: string,
): Extract<StudioMessagePart, { type: "result" }> {
  return { type: "result", title, content };
}

export function buildErrorPart(
  title: string,
  detail: string,
  recovery?: string,
): Extract<StudioMessagePart, { type: "error" }> {
  return { type: "error", title, detail, recovery };
}

export function flattenPartsToContent(parts: StudioMessagePart[]): string {
  return parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.content;
        case "result":
          return [part.title, part.content].filter(Boolean).join("\n\n");
        case "error":
          return [
            `## ${part.title}`,
            `### 原因\n${part.detail}`,
            part.recovery ? `### 恢复建议\n${part.recovery}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
        case "progress":
          return [
            `## ${part.label}${part.paused ? "（已暂停）" : ""}`,
            part.steps.length > 0
              ? part.steps.map((step) => `- ${step.message}`).join("\n")
              : "- 等待任务开始",
          ].join("\n\n");
        case "tool":
          return `[${part.label}] ${part.status}${part.detail ? `: ${part.detail}` : ""}`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export function isLegacyCoreMarkdown(content: string): boolean {
  return /^##\s+.+/m.test(content) && content.includes("- ");
}

function buildProgressParts(
  label: string,
  progressMessages: string[],
  options?: { paused?: boolean },
): StudioMessagePart[] {
  let progressPart = buildProgressPart(label, { paused: options?.paused });
  for (const message of progressMessages) {
    progressPart = appendProgressStep(progressPart, message, Date.now());
  }
  return [progressPart];
}

export function buildPausedAssistantMessage(
  assistantMessageId: string,
  label: string,
  pausedProgress: string[],
): StudioMessage {
  return {
    id: assistantMessageId,
    role: "assistant",
    status: "sent",
    parts: buildProgressParts(label, pausedProgress, { paused: true }),
    createdAt: new Date().toISOString(),
  };
}

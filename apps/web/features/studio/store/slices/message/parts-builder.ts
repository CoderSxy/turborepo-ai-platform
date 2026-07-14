import type {
  ProgressPartStatus,
  StudioMessage,
  StudioMessagePart,
} from "../../types";
import type { WriteChapterPipelineTimelineView } from "../../pipeline-timeline-types";

export function buildTextPart(content: string): StudioMessagePart {
  return { type: "text", content };
}

export type BuildProgressPartOptions = {
  paused?: boolean;
  status?: ProgressPartStatus;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  pipelineTimeline?: WriteChapterPipelineTimelineView;
};

export function buildProgressPart(
  label: string,
  options?: BuildProgressPartOptions,
): Extract<StudioMessagePart, { type: "progress" }> {
  return {
    type: "progress",
    label,
    steps: [],
    paused: options?.paused,
    status: options?.status,
    startedAt: options?.startedAt,
    completedAt: options?.completedAt,
    summary: options?.summary,
    pipelineTimeline: options?.pipelineTimeline,
  };
}

export function appendProgressStep(
  part: Extract<StudioMessagePart, { type: "progress" }>,
  message: string,
  at: number,
): Extract<StudioMessagePart, { type: "progress" }> {
  return { ...part, steps: [...part.steps, { message, at }] };
}

export function buildProgressPartFromMessages(
  label: string,
  progressMessages: string[],
  options?: BuildProgressPartOptions,
): Extract<StudioMessagePart, { type: "progress" }> {
  let progressPart = buildProgressPart(label, options);
  for (const message of progressMessages) {
    progressPart = appendProgressStep(progressPart, message, Date.now());
  }
  return progressPart;
}

export function completeProgressPart(
  part: Extract<StudioMessagePart, { type: "progress" }>,
  options?: {
    summary?: string;
    completedAt?: string;
    status?: Extract<ProgressPartStatus, "completed" | "error" | "paused">;
  },
): Extract<StudioMessagePart, { type: "progress" }> {
  const lastStep = part.steps.at(-1)?.message;
  return {
    ...part,
    paused: options?.status === "paused" ? true : part.paused,
    status: options?.status ?? "completed",
    completedAt: options?.completedAt ?? new Date().toISOString(),
    summary: options?.summary ?? lastStep ?? part.summary,
  };
}

export function inferProgressStatus(
  part: Extract<StudioMessagePart, { type: "progress" }>,
  siblingParts: StudioMessagePart[],
): ProgressPartStatus {
  if (part.status) {
    return part.status;
  }
  if (part.paused) {
    return "paused";
  }
  if (siblingParts.some((item) => item.type === "error")) {
    return "error";
  }
  if (siblingParts.some((item) => item.type === "result")) {
    return "completed";
  }
  return "running";
}

export function shouldExpandTaskCard(status: ProgressPartStatus): boolean {
  return status === "running" || status === "error" || status === "paused";
}

export function formatTaskElapsedMs(
  startedAt: string | undefined,
  completedAt: string | undefined,
  nowMs: number,
): string | null {
  if (!startedAt) {
    return null;
  }
  const endMs = completedAt ? Date.parse(completedAt) : nowMs;
  const elapsedMs = Math.max(0, endMs - Date.parse(startedAt));
  if (elapsedMs < 1000) {
    return "<1s";
  }
  const seconds = Math.round(elapsedMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function isMeaningfulToolPart(
  part: Extract<StudioMessagePart, { type: "tool" }>,
): boolean {
  if (part.detail?.trim()) {
    return true;
  }
  return ["保存章节", "生成审稿报告", "章节已保存"].some((label) =>
    part.label.includes(label),
  );
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
            part.summary ? part.summary : "",
            part.steps.length > 0
              ? part.steps.map((step) => `- ${step.message}`).join("\n")
              : "- 等待任务开始",
          ]
            .filter(Boolean)
            .join("\n\n");
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

export function buildPausedAssistantMessage(
  assistantMessageId: string,
  label: string,
  pausedProgress: string[],
  options?: { startedAt?: string },
): StudioMessage {
  return {
    id: assistantMessageId,
    role: "assistant",
    status: "sent",
    parts: [
      completeProgressPart(
        buildProgressPartFromMessages(label, pausedProgress, {
          paused: true,
          status: "paused",
          startedAt: options?.startedAt,
        }),
        { status: "paused", summary: "任务已暂停，可从任务日志继续。" },
      ),
    ],
    createdAt: new Date().toISOString(),
  };
}

export function buildFinalAssistantParts(
  label: string,
  progressMessages: string[],
  resultContent: string,
  options?: { startedAt?: string; summary?: string },
): StudioMessagePart[] {
  const completedProgress = completeProgressPart(
    buildProgressPartFromMessages(label, progressMessages, {
      status: "running",
      startedAt: options?.startedAt,
    }),
    {
      status: "completed",
      summary: options?.summary ?? progressMessages.at(-1) ?? "任务完成。",
    },
  );

  return [completedProgress, buildResultPart(label, resultContent)];
}

export function buildWriteChapterFinalAssistantParts(input: {
  label: string;
  progressMessages: string[];
  resultContent: string;
  startedAt: string;
  completionSummary: string;
  pipelineTimeline: WriteChapterPipelineTimelineView;
  attentionReason?: string;
  terminal: "completed" | "completed_with_attention";
}): StudioMessagePart[] {
  const summary =
    input.terminal === "completed_with_attention"
      ? input.attentionReason || input.completionSummary
      : input.completionSummary;

  const completedProgress = completeProgressPart(
    buildProgressPartFromMessages(input.label, input.progressMessages, {
      status: "running",
      startedAt: input.startedAt,
      pipelineTimeline: input.pipelineTimeline,
    }),
    {
      status: "completed",
      summary,
    },
  );

  return [completedProgress, buildResultPart(input.label, input.resultContent)];
}

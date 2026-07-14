import { countNovelWords } from "#lib/novel-store";
import type {
  ChapterAudit,
  WriteChapterPipelineTerminalStatus,
} from "../types";
import type { WriteChapterPipelineCheckpointState } from "#lib/novel-store";
import type {
  ChapterAuditDimensionKey,
  WriteChapterPipelineTimelineAuditIssue,
  WriteChapterPipelineTimelineView,
} from "../../store/pipeline-timeline-types";

export type {
  WriteChapterPipelineTimelineAuditIssue,
  WriteChapterPipelineTimelineView,
} from "../../store/pipeline-timeline-types";

export const CHAPTER_AUDIT_DIMENSION_LABELS: Record<
  ChapterAuditDimensionKey,
  string
> = {
  continuity: "连续性",
  character: "角色一致性",
  plot: "剧情推进",
  style: "文风",
  pacing: "节奏",
  foreshadowing: "伏笔",
  length: "字数",
};

export function collectChapterAuditIssues(
  audit: ChapterAudit | null,
): WriteChapterPipelineTimelineAuditIssue[] {
  if (!audit) {
    return [];
  }

  const issues: WriteChapterPipelineTimelineAuditIssue[] = [];

  for (const dimension of audit.dimensions) {
    for (const issue of dimension.issues) {
      issues.push({
        severity: issue.severity,
        evidence: issue.evidence,
        suggestion: issue.suggestion,
        dimensionKey: dimension.key,
        dimensionLabel: CHAPTER_AUDIT_DIMENSION_LABELS[dimension.key],
      });
    }
  }

  return issues;
}

export function resolveReAuditOutcome(input: {
  checkpoint: WriteChapterPipelineCheckpointState;
  terminal?: WriteChapterPipelineTerminalStatus;
  attentionReason?: string;
}): WriteChapterPipelineTimelineView["reAuditOutcome"] {
  if (input.checkpoint.revisionAttempts <= 0) {
    return "skipped";
  }

  if (
    input.terminal === "completed_with_attention" ||
    input.attentionReason
  ) {
    return "attention";
  }

  if (input.terminal === "completed") {
    return "passed";
  }

  return undefined;
}

export function buildWriteChapterPipelineTimelineView(input: {
  checkpoint: WriteChapterPipelineCheckpointState;
  audit?: ChapterAudit | null;
  auditParseFailed?: boolean;
  draftContent?: string;
  contextSummary?: string;
  syncStatus?: "applied" | "skipped" | "needs-attention";
  terminal?: WriteChapterPipelineTerminalStatus;
  attentionReason?: string;
}): WriteChapterPipelineTimelineView {
  const audit = input.audit ?? null;
  const draftWordCount = input.draftContent
    ? countNovelWords(input.draftContent)
    : undefined;

  return {
    contextSummary: input.contextSummary,
    draftWordCount,
    auditTotalScore: audit?.totalScore,
    auditDimensions: audit?.dimensions.map((dimension) => ({
      key: dimension.key,
      label: CHAPTER_AUDIT_DIMENSION_LABELS[dimension.key],
      score: dimension.score,
    })),
    auditIssues: collectChapterAuditIssues(audit),
    auditParseFailed: input.auditParseFailed,
    revisionCount: input.checkpoint.revisionAttempts,
    reAuditOutcome: resolveReAuditOutcome({
      checkpoint: input.checkpoint,
      terminal: input.terminal,
      attentionReason: input.attentionReason,
    }),
    syncStatus: input.syncStatus,
    terminalStage: input.terminal,
    attentionReason: input.attentionReason ?? input.checkpoint.attentionReason,
  };
}

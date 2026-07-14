export type ChapterAuditDimensionKey =
  | "continuity"
  | "character"
  | "plot"
  | "style"
  | "pacing"
  | "foreshadowing"
  | "length";

export type WriteChapterPipelineTimelineAuditIssue = {
  severity: "info" | "warning" | "critical";
  evidence: string;
  suggestion: string;
  dimensionKey: ChapterAuditDimensionKey;
  dimensionLabel: string;
};

export type WriteChapterPipelineTimelineView = {
  contextSummary?: string;
  draftWordCount?: number;
  auditTotalScore?: number;
  auditDimensions?: Array<{
    key: ChapterAuditDimensionKey;
    label: string;
    score: number;
  }>;
  auditIssues?: WriteChapterPipelineTimelineAuditIssue[];
  auditParseFailed?: boolean;
  revisionCount: number;
  reAuditOutcome?: "passed" | "attention" | "skipped";
  syncStatus?: "applied" | "skipped" | "needs-attention";
  terminalStage?: "completed" | "completed_with_attention" | "failed" | "cancelled";
  attentionReason?: string;
};

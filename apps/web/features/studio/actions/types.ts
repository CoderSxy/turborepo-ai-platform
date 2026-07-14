import type { LocalModelSettings, ModelCallLog } from "../../../lib/model-settings";
import type {
  NovelChapterWriteTarget,
  NovelContextSelection,
  StoredNovelChapter,
  StoredNovelTask,
  WriteChapterPipelineCheckpointState,
  WriteChapterPipelineStage,
} from "../../../lib/novel-store";
import type { ReadyModelBinding } from "../state/studio-types";
import type { StudioStore } from "../store/types";

export type StudioActionSource =
  | "composer"
  | "quick-action"
  | "chapter-panel"
  | "advanced"
  | "retry"
  | "batch";

export type StudioAction =
  | { type: "send-message"; text: string; source?: StudioActionSource }
  | {
      type: "write-chapter";
      source?: StudioActionSource;
      target?: NovelChapterWriteTarget;
      contextSelection?: NovelContextSelection;
    }
  | { type: "review"; source?: StudioActionSource }
  | {
      type: "revise-chapter";
      selectedIssueIds?: string[];
      source?: StudioActionSource;
    }
  | { type: "abort-task" };

export type StudioActionContext = {
  getState: () => StudioStore;
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
  notify: (message: string, tone: "success" | "warning" | "error") => void;
  trackModelCall: (
    binding: ReadyModelBinding,
    label: string,
    status: ModelCallLog["status"],
    startedAt: string,
    endedAt: string,
    options?: { latencyMs?: number; errorMessage?: string },
  ) => void;
  refreshWorkspace: () => Promise<void>;
};

export type RunCoreActionOptions = {
  targetChapter?: NovelChapterWriteTarget;
  targetStoredChapter?: StoredNovelChapter;
  selectedIssueIds?: string[];
  existingTaskId?: string;
  resumeTask?: StoredNovelTask;
  labelOverride?: string;
  contextSelectionOverride?: NovelContextSelection;
};

export type WriteChapterPipelineTerminalStatus = Extract<
  WriteChapterPipelineStage,
  "completed" | "completed_with_attention" | "failed" | "cancelled"
>;

export type {
  WriteChapterPipelineCheckpointState,
  WriteChapterPipelineStage,
  WriteChapterPipelineStageTimelineEntry,
} from "../../../lib/novel-store";

export type ChapterAuditDimensionKey =
  | "continuity"
  | "character"
  | "plot"
  | "style"
  | "pacing"
  | "foreshadowing"
  | "length";

export type ChapterAuditIssueSeverity = "info" | "warning" | "critical";

export type ChapterAuditIssue = {
  severity: ChapterAuditIssueSeverity;
  evidence: string;
  suggestion: string;
};

export type ChapterAuditDimension = {
  key: ChapterAuditDimensionKey;
  score: number;
  issues: ChapterAuditIssue[];
};

export type ChapterAudit = {
  totalScore: number;
  dimensions: ChapterAuditDimension[];
};

export type ChapterAuditParseResult =
  | { ok: true; audit: ChapterAudit }
  | { ok: false; error: string };

export type WriteChapterPipelineConfig = {
  minTotalScore: number;
  minDimensionScore: number;
  maxRevisionAttempts: number;
};

export type WriteChapterDraftVersion = {
  id: string;
  content: string;
  source: "draft" | "revision";
  createdAt: string;
};

export type WriteChapterPipelineStageUpdate = {
  stage: WriteChapterPipelineStage;
  detail?: string;
  checkpoint: WriteChapterPipelineCheckpointState;
  progressMessage?: string;
};

export type WriteChapterPipelineContext = {
  bookId: string;
  project: import("@repo/inkos-adapter").InkosNovelProject;
  assets: import("../../../lib/novel-store").NovelProjectAssets;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  intent?: string;
  taskId: string;
};

export type WriteChapterPipelineAdapters = {
  planChapter: (context: WriteChapterPipelineContext) => Promise<string>;
  draftChapter: (
    context: WriteChapterPipelineContext & { intent: string },
  ) => Promise<string>;
  auditChapter: (
    context: WriteChapterPipelineContext & { content: string; attempt: number },
  ) => Promise<string>;
  reviseChapter: (
    context: WriteChapterPipelineContext & {
      content: string;
      audit: ChapterAudit | null;
      auditRaw: string;
    },
  ) => Promise<string>;
};

export type WriteChapterPipelineInput = {
  book: import("../../../lib/novel-store").StoredNovelBook;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  task: StoredNovelTask;
  sessionId: string;
  assistantMessageId: string;
  label: string;
  startedAt: string;
  contextSelection?: NovelContextSelection;
  userInstruction?: string;
  config?: Partial<WriteChapterPipelineConfig>;
  adapters: WriteChapterPipelineAdapters;
  signal?: AbortSignal;
  onStageChange?: (update: WriteChapterPipelineStageUpdate) => void;
  now?: () => string;
};

export type WriteChapterPipelineSuccessArtifacts = {
  terminal: "completed" | "completed_with_attention";
  taskStatus: "success" | "completed_with_attention";
  commitInput: import("../../../lib/novel-store").CommitWriteChapterResultInput;
  checkpoint: WriteChapterPipelineCheckpointState;
  progressMessages: string[];
  selectedVersion: WriteChapterDraftVersion;
  audit: ChapterAudit | null;
  auditRaw: string;
  attentionReason?: string;
};

export type WriteChapterPipelineFailureArtifacts = {
  terminal: "failed" | "cancelled";
  checkpoint: WriteChapterPipelineCheckpointState;
  progressMessages: string[];
  errorMessage: string;
};

export type WriteChapterPipelineResult =
  | WriteChapterPipelineSuccessArtifacts
  | WriteChapterPipelineFailureArtifacts;

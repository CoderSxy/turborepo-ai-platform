import type {
  InkosChapter,
  InkosChapterStatus,
  InkosNovelProject,
} from "@repo/inkos-adapter";

const DB_NAME = "sxy-creative-studio";
const DB_VERSION = 5;
const BOOKS_STORE = "books";
const SESSIONS_STORE = "sessions";
const MESSAGES_STORE = "messages";
const CHAPTERS_STORE = "chapters";
const CHAPTER_VERSIONS_STORE = "chapterVersions";
const TASKS_STORE = "tasks";

export type NovelGenreProfile = {
  id: string;
  name: string;
  source: "project" | "builtin" | "imported";
  language: "zh" | "en";
  chapterTypes: string;
  fatigueWords: string;
  pacingRule: string;
  analysis?: NovelGenreAnalysis;
};

export type NovelGenreAnalysis = {
  summary: string;
  audienceHook: string;
  conflictPattern: string;
  riskPoints: string[];
  recommendedPacing: string;
  analyzedAt: string;
};

export type NovelStyleAnalysis = {
  averageSentenceLength: number;
  vocabularyDiversity: number;
  paragraphDensity: "低" | "中" | "高";
  emotionalTone: string;
  tags: string[];
  styleConstraints: string;
  analyzedAt: string;
};

export type NovelStyleSample = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  analysis?: NovelStyleAnalysis;
};

export type NovelImportedMaterial = {
  id: string;
  title: string;
  type: "chapters" | "canon" | "fanfic";
  content: string;
  createdAt: string;
  parsedChapterCount?: number;
  extractedAssetCount?: number;
  status?: "raw" | "processed";
};

export type NovelProjectStrategy = {
  summary: string;
  platformHints: string[];
  riskAlerts: string[];
  updatedAt: string;
};

export type NovelImportedChapter = {
  number: number;
  title: string;
  content: string;
  summary: string;
  wordCount: number;
};

export type NovelImportAssetHints = {
  characters: string[];
  foreshadowing: string[];
  worldIncrements: string[];
};

export type NovelProjectAssets = {
  outline: string;
  outlineNodes: NovelOutlineNode[];
  worldNotes: string;
  characters: string;
  settings: string;
  knowledgeAssets: NovelKnowledgeAsset[];
  pendingAssetDeltas: NovelPendingAssetDelta[];
  contextSelection: NovelContextSelection;
  genres: NovelGenreProfile[];
  styleSamples: NovelStyleSample[];
  importedMaterials: NovelImportedMaterial[];
  marketRadars: Array<{
    id: string;
    platform: string;
    genre: string;
    concept: string;
    score: string;
    createdAt: string;
  }>;
  diagnostics: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
    createdAt: string;
  }>;
  projectStrategy?: NovelProjectStrategy;
  publicationEvents?: NovelPublicationEvent[];
  assetChangeEvents?: NovelAssetChangeEvent[];
  pendingMigration: NovelPendingMigrationV2;
};

export type NovelPendingMigrationV2 = {
  schemaVersion: 2;
  appliedSyncIds: string[];
  legacyAppliedChapters: number[];
  skippedPendingIds: string[];
  migratedAt?: string;
  retrySchemaVersion?: number;
  /** @deprecated Task 1 bridge; removed in Task 2 */
  appliedChapters?: number[];
};

type RawPendingMigrationInput = {
  schemaVersion?: number;
  appliedChapters?: number[];
  appliedSyncIds?: string[];
  legacyAppliedChapters?: number[];
  skippedPendingIds?: string[];
  migratedAt?: string;
  retrySchemaVersion?: number;
  [key: string]: unknown;
};

const PENDING_MIGRATION_KNOWN_KEYS = new Set([
  "schemaVersion",
  "appliedSyncIds",
  "legacyAppliedChapters",
  "skippedPendingIds",
  "migratedAt",
  "retrySchemaVersion",
  "appliedChapters",
]);

export function normalizePendingMigration(raw: unknown): NovelPendingMigrationV2 {
  const defaults: NovelPendingMigrationV2 = {
    schemaVersion: 2,
    appliedSyncIds: [],
    legacyAppliedChapters: [],
    skippedPendingIds: [],
  };

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const input = raw as RawPendingMigrationInput;
  const residual: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!PENDING_MIGRATION_KNOWN_KEYS.has(key)) {
      residual[key] = value;
    }
  }

  const schemaVersion =
    typeof input.schemaVersion === "number" ? input.schemaVersion : 1;

  const appliedChapters = Array.isArray(input.appliedChapters)
    ? input.appliedChapters.filter((n): n is number => typeof n === "number")
    : undefined;

  const legacyFromInput = Array.isArray(input.legacyAppliedChapters)
    ? input.legacyAppliedChapters.filter((n): n is number => typeof n === "number")
    : [];

  const appliedSyncIds = Array.isArray(input.appliedSyncIds)
    ? input.appliedSyncIds.filter((s): s is string => typeof s === "string")
    : [];

  const skippedPendingIds = Array.isArray(input.skippedPendingIds)
    ? input.skippedPendingIds.filter((s): s is string => typeof s === "string")
    : [];

  const legacyAppliedChapters =
    schemaVersion < 2 && appliedChapters && appliedChapters.length > 0
      ? appliedChapters
      : legacyFromInput;

  return {
    ...residual,
    schemaVersion: 2,
    appliedSyncIds,
    legacyAppliedChapters,
    skippedPendingIds,
    ...(typeof input.migratedAt === "string" ? { migratedAt: input.migratedAt } : {}),
    ...(typeof input.retrySchemaVersion === "number"
      ? { retrySchemaVersion: input.retrySchemaVersion }
      : {}),
    ...(appliedChapters !== undefined ? { appliedChapters } : {}),
  };
}

export type NovelAssetConflictSeverity = "error" | "warning" | "info";

export type NovelAssetConflict = {
  id: string;
  severity: NovelAssetConflictSeverity;
  code: string;
  title: string;
  detail: string;
  assetIds?: string[];
  chapterNumbers?: number[];
};

export type NovelAssetConflictReport = {
  errorCount: number;
  warningCount: number;
  issues: NovelAssetConflict[];
  summary: string;
};

export type NovelAssetConflictFixResult = {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  applied: Array<{ issueId: string; label: string }>;
  skipped: Array<{ issueId: string; reason: string }>;
  summary: string;
};

export type NovelAssetChangeEvent = {
  id: string;
  action: "create" | "update" | "merge" | "resolve" | "delete";
  category?: NovelKnowledgeAssetCategory;
  assetId?: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type NovelCharacterStateTimelineEntry = {
  id: string;
  characterName: string;
  content: string;
  chapterNumber?: number;
  chapterTitle?: string;
  source:
    | "chapter-delta"
    | "pending-delta"
    | "asset"
    | "tracking-text"
    | "change-event";
  updatedAt: string;
};

export type NovelCharacterStateTimelineGroup = {
  name: string;
  assetId?: string;
  status?: NovelKnowledgeAsset["status"];
  entries: NovelCharacterStateTimelineEntry[];
  latestContent: string;
  latestUpdatedAt: string;
};

export type NovelCharacterStateTimeline = {
  characters: NovelCharacterStateTimelineGroup[];
  summary: string;
};

export type NovelCharacterRelationEdgeKind =
  | "ally"
  | "enemy"
  | "family"
  | "romance"
  | "mentor"
  | "coappearance"
  | "other";

export type NovelCharacterRelationNode = {
  id: string;
  label: string;
  assetId?: string;
  status?: NovelKnowledgeAsset["status"];
  degree: number;
};

export type NovelCharacterRelationEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  kind: NovelCharacterRelationEdgeKind;
  source: "explicit" | "coappearance" | "matrix";
  weight: number;
};

export type NovelCharacterRelationGraph = {
  nodes: NovelCharacterRelationNode[];
  edges: NovelCharacterRelationEdge[];
  summary: string;
};

export type NovelPlatformId =
  | "generic"
  | "qidian"
  | "fanqie"
  | "zongheng"
  | "jjwxc"
  | "feilu";

export type NovelPublicationEvent = {
  id: string;
  chapterNumber?: number;
  chapterTitle?: string;
  platform?: NovelPlatformId;
  action: "marked-ready" | "marked-published" | "exported";
  note?: string;
  createdAt: string;
};

export type NovelPublishValidationSeverity = "error" | "warning" | "info";

export type NovelPublishValidationIssue = {
  id: string;
  severity: NovelPublishValidationSeverity;
  chapterNumber?: number;
  code: string;
  title: string;
  detail: string;
};

export type NovelPublishValidationReport = {
  platform: NovelPlatformId;
  canPublish: boolean;
  errorCount: number;
  warningCount: number;
  issues: NovelPublishValidationIssue[];
  summary: string;
};

export type NovelDocxParagraphStyle =
  | "title"
  | "subtitle"
  | "chapter-heading"
  | "body";

export type NovelDocxParagraph = {
  style: NovelDocxParagraphStyle;
  text: string;
};

export type StoredNovelTaskCheckpoint = {
  progressMessages: string[];
  savedAt: string;
  assistantMessageId?: string;
};

export type NovelOutlineNode = {
  id: string;
  volume: string;
  chapterNumber: number;
  title: string;
  goal: string;
  conflict: string;
  characters: string;
  information: string;
  foreshadowing: string;
  targetWords: number;
  status: InkosChapterStatus;
  updatedAt: string;
};

export type NovelKnowledgeAssetCategory =
  | "world"
  | "character"
  | "foreshadowing"
  | "location"
  | "faction"
  | "item"
  | "term";

export type NovelKnowledgeAssetMatchPreview = {
  action: "merge" | "create" | "resolve";
  score: number;
  label: string;
  matchedAsset?: NovelKnowledgeAsset;
};

export type NovelPendingAssetDeltaMatchReport = {
  newForeshadowing: Array<{
    text: string;
    preview: NovelKnowledgeAssetMatchPreview;
  }>;
  resolvedForeshadowing: Array<{
    text: string;
    preview: NovelKnowledgeAssetMatchPreview;
  }>;
  summary: string;
};

export type NovelKnowledgeAsset = {
  id: string;
  category: NovelKnowledgeAssetCategory;
  title: string;
  content: string;
  status: "active" | "draft" | "resolved";
  tags: string[];
  updatedAt: string;
};

export type NovelChapterAssetDelta = {
  chapterNumber: number;
  chapterTitle: string;
  summary: string;
  characterStates: Array<{
    title: string;
    content: string;
  }>;
  newForeshadowing: string[];
  resolvedForeshadowing: string[];
  worldIncrements: string[];
};

export type NovelPendingAssetDelta = NovelChapterAssetDelta & {
  id: string;
  createdAt: string;
};

export type NovelContextSelection = {
  includeOutline: boolean;
  includePreviousSummary: boolean;
  includeWorld: boolean;
  includeCharacters: boolean;
  includeForeshadowing: boolean;
  includeReviewIssues: boolean;
  targetWords?: number;
  viewpoint: string;
  pacing: string;
  highlights: string;
  bannedWords?: string;
  styleConstraints?: string;
  thrillPoints?: string;
};

export type StoredNovelBook = {
  id: string;
  title: string;
  genre: string;
  premise: string;
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  archived: boolean;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredNovelSession = {
  id: string;
  bookId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredNovelMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "sent" | "error";
};

export type StoredNovelChapter = {
  id: string;
  bookId: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  status: InkosChapterStatus;
  wordCount: number;
  reviewNotes: string;
  reviews: NovelChapterReview[];
  activeReviewId?: string;
  publicationStatus?: NovelChapterPublicationStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type NovelChapterPublicationStatus = "draft" | "ready" | "published";

export type NovelChapterReviewVerdict = "approved" | "needs-revision";
export type NovelChapterReviewIssueSeverity = "info" | "warning" | "error";

export type NovelChapterReviewIssue = {
  id: string;
  severity: NovelChapterReviewIssueSeverity;
  type?: "plot" | "character" | "style" | "continuity" | "pacing" | "logic" | "other";
  title: string;
  detail: string;
  excerpt?: string;
  suggestion?: string;
  paragraphHint?: string;
  versionId?: string;
  resolved: boolean;
  selectedForRevision?: boolean;
  resolvedByVersionId?: string;
};

export type NovelChapterReview = {
  id: string;
  verdict: NovelChapterReviewVerdict;
  score?: number;
  summary: string;
  issues: NovelChapterReviewIssue[];
  createdAt: string;
};

export type NovelChapterReviewIssueView = NovelChapterReviewIssue & {
  reviewId: string;
  reviewCreatedAt: string;
  isCurrentReview: boolean;
  statusLabel: "已解决" | "未解决";
  originLabel: "本轮新增" | "历史问题";
};

export type NovelReviewIssueFilter =
  | "all"
  | "open"
  | "resolved"
  | "current"
  | "history"
  | "diff";

export type NovelReviewIssueParagraphLocation = {
  index: number;
  paragraph: string;
};

export type StoredNovelChapterVersionSource =
  | "generation"
  | "manual-edit"
  | "review"
  | "revision"
  | "status-change"
  | "restore";

export type StoredNovelChapterVersion = {
  id: string;
  chapterId: string;
  bookId: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  status: InkosChapterStatus;
  wordCount: number;
  reviewNotes: string;
  reviews: NovelChapterReview[];
  reviewId?: string;
  revisedFromReviewId?: string;
  source: StoredNovelChapterVersionSource;
  note?: string;
  createdAt: string;
};

export type NovelChapterVersionDiff = {
  changed: boolean;
  wordDelta: number;
  addedLines: string[];
  removedLines: string[];
  unchangedLines: string[];
};

export type NovelChapterDraftMeta = {
  wordCount: number;
  paragraphCount: number;
  hasSummary: boolean;
};

export type NovelEditorSearchMatch = {
  start: number;
  end: number;
};

export type NovelEditorSearchState = {
  query: string;
  count: number;
  activeIndex: number;
  matches: NovelEditorSearchMatch[];
};

export type NovelChapterParagraphNavigationItem = {
  index: number;
  start: number;
  end: number;
  wordCount: number;
  preview: string;
  text: string;
};

export type NovelChapterParagraphNavigation = {
  wordCount: number;
  targetWords: number;
  targetPercent: number;
  paragraphs: NovelChapterParagraphNavigationItem[];
};

export type NovelReviewIssueHighlight = {
  key: string;
  paragraphIndex: number;
  paragraph: string;
  issue: NovelChapterReviewIssueView;
};

export type NovelReviewIssueParagraphMark = {
  paragraphIndex: number;
  paragraph: string;
  start: number;
  end: number;
  issues: NovelChapterReviewIssueView[];
  highestSeverity: NovelChapterReviewIssueSeverity;
};

export type NovelCompareDiffMarker = {
  id: string;
  side: "previous" | "next";
  lineIndex: number;
  text: string;
  state: "added" | "removed";
  relatedIssues: NovelChapterReviewIssueView[];
};

export type NovelCompareLineRestoreResult = {
  content: string;
  paragraphIndex: number | null;
  mode: "replace-paragraph" | "replace-selection" | "append";
};

export type NovelChapterCompareLine = {
  text: string;
  state: "added" | "removed" | "unchanged";
};

export type NovelChapterVersionCompareView = {
  changed: boolean;
  wordDelta: number;
  addedCount: number;
  removedCount: number;
  previousLines: NovelChapterCompareLine[];
  nextLines: NovelChapterCompareLine[];
};

export type NovelChapterProgress = {
  generatedChapters: number;
  approvedChapters: number;
  readyForReviewChapters: number;
  draftChapters: number;
  plannedChapters: number;
  totalChapters: number;
  generatedPercent: number;
  approvedPercent: number;
};

export type NovelChapterListItem = {
  key: string;
  number: number;
  title: string;
  status: InkosChapterStatus;
  focus: string;
  targetWords: number;
  generated: boolean;
  wordCount: number;
  updatedAt: string;
  summary: string;
  reviewNotes: string;
  chapter?: StoredNovelChapter;
};

export type NovelChapterWriteTarget = {
  number: number;
  title: string;
  focus: string;
  targetWords: number;
  reason: "planned" | "append";
};

export type NovelBatchQueueAction =
  | "write-chapter"
  | "review"
  | "revise-chapter";

export type NovelBatchQueueItem = {
  id: string;
  action: NovelBatchQueueAction;
  label: string;
  number: number;
  title: string;
  target?: NovelChapterWriteTarget;
  chapter?: StoredNovelChapter;
};

export type NovelWorkspaceSnapshot = {
  books: StoredNovelBook[];
  sessionsByBookId: Record<string, StoredNovelSession[]>;
  messagesBySessionId: Record<string, StoredNovelMessage[]>;
  chaptersByBookId: Record<string, StoredNovelChapter[]>;
  chapterVersionsByChapterId: Record<string, StoredNovelChapterVersion[]>;
  tasksByBookId: Record<string, StoredNovelTask[]>;
};

export type StoredNovelTaskStatus =
  | "queued"
  | "paused"
  | "running"
  | "success"
  | "error"
  | "cancelled"
  | "skipped";

export type StoredNovelTaskLog = {
  id: string;
  message: string;
  createdAt: string;
};

export type StoredNovelTask = {
  id: string;
  bookId: string;
  sessionId: string;
  action: string;
  label: string;
  status: StoredNovelTaskStatus;
  logs: StoredNovelTaskLog[];
  errorMessage?: string;
  targetChapterId?: string;
  targetChapterNumber?: number;
  targetChapterTitle?: string;
  startedAt: string;
  endedAt?: string;
  checkpoint?: StoredNovelTaskCheckpoint;
};

export type NovelRecoverableErrorNotice = {
  category:
    | "auth"
    | "rate-limit"
    | "timeout"
    | "network"
    | "cancelled"
    | "validation"
    | "unknown";
  title: string;
  detail: string;
  recoveryAction: string;
  canRetry: boolean;
};

export type NovelBatchQueueReport = {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  skipped: number;
  markdown: string;
};

export type NovelWorkspaceBackupPayload = {
  version: 1;
  exportedAt: string;
  app: "sxy-creative-studio";
  modelSettings: {
    providers: Array<{
      id: string;
      name: string;
      hasApiKey: boolean;
      models: string[];
    }>;
  };
  books: StoredNovelBook[];
  sessions: StoredNovelSession[];
  messages: StoredNovelMessage[];
  chapters: StoredNovelChapter[];
  chapterVersions: StoredNovelChapterVersion[];
  tasks: StoredNovelTask[];
};

export const NOVEL_CLOUD_SYNC_STORAGE_KEY = "sxy.novel-cloud-sync.v1";
export const NOVEL_CLOUD_SYNC_WEBDAV_STORAGE_KEY =
  "sxy.novel-cloud-sync-webdav.v1";

export type NovelCloudSyncWebDavSettings = {
  url: string;
  remotePath: string;
  username: string;
  password: string;
};

export type NovelCloudSyncState = {
  deviceId: string;
  deviceLabel: string;
  lastExportedAt?: string;
  lastImportedAt?: string;
  lastMergeAt?: string;
  lastRemoteFingerprint?: string;
  lastWebDavUploadAt?: string;
  lastWebDavDownloadAt?: string;
};

export type NovelCloudSyncPackage = NovelWorkspaceBackupPayload & {
  syncVersion: 1;
  deviceId: string;
  deviceLabel: string;
  fingerprint: string;
};

export type NovelWorkspaceMergeConflict = {
  id: string;
  entityType: "book" | "session" | "message" | "chapter" | "chapterVersion" | "task";
  entityId: string;
  label: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  resolution: "local" | "remote";
};

export type NovelWorkspaceMergeReport = {
  autoMerged: number;
  conflicts: NovelWorkspaceMergeConflict[];
  merged: NovelWorkspaceBackupPayload;
  summary: string;
};

export type CreateStoredNovelBookInput = {
  title: string;
  genre: string;
  premise: string;
  project: InkosNovelProject;
  assets?: NovelProjectAssets;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "sent" | "error";
  }>;
};

export function sortStoredNovelBooks(
  books: StoredNovelBook[],
): StoredNovelBook[] {
  return [...books].sort(
    (left, right) => left.sortIndex - right.sortIndex ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function sortStoredNovelSessions(
  sessions: StoredNovelSession[],
): StoredNovelSession[] {
  return [...sessions].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function sortStoredNovelMessages(
  messages: StoredNovelMessage[],
): StoredNovelMessage[] {
  return [...messages].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function sortStoredNovelChapters(
  chapters: StoredNovelChapter[],
): StoredNovelChapter[] {
  return [...chapters].sort(
    (left, right) =>
      left.number - right.number ||
      new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime(),
  );
}

export function sortStoredNovelChapterVersions(
  versions: StoredNovelChapterVersion[],
): StoredNovelChapterVersion[] {
  return [...versions].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
      right.id.localeCompare(left.id),
  );
}

export function deriveNovelChapterProgress(
  chapters: StoredNovelChapter[],
  targetChapters = 120,
): NovelChapterProgress {
  const generatedChapters = chapters.filter((chapter) =>
    chapter.content.trim().length > 0 && chapter.status !== "planned"
  ).length;
  const approvedChapters = chapters.filter(
    (chapter) => chapter.status === "approved",
  ).length;
  const readyForReviewChapters = chapters.filter(
    (chapter) => chapter.status === "ready-for-review",
  ).length;
  const draftChapters = chapters.filter(
    (chapter) => chapter.status === "drafting",
  ).length;
  const plannedChapters = Math.max(0, targetChapters - generatedChapters);
  const totalChapters = Math.max(1, targetChapters);

  return {
    generatedChapters,
    approvedChapters,
    readyForReviewChapters,
    draftChapters,
    plannedChapters,
    totalChapters: targetChapters,
    generatedPercent: Math.min(
      100,
      Math.round((generatedChapters / totalChapters) * 100),
    ),
    approvedPercent: Math.min(
      100,
      Math.round((approvedChapters / totalChapters) * 100),
    ),
  };
}

export function parseNovelReviewNotes(
  reviewNotes: string,
  createdAt = new Date().toISOString(),
): NovelChapterReview {
  const scoreMatch =
    reviewNotes.match(/评分[：:\s]*(\d{1,3})/) ??
    reviewNotes.match(/score[：:\s]*(\d{1,3})/i);
  const score = scoreMatch?.[1]
    ? Math.min(100, Math.max(0, Number(scoreMatch[1])))
    : undefined;
  const verdict: NovelChapterReviewVerdict =
    deriveNovelReviewStatus(reviewNotes) === "approved" &&
    !/(不通过|需要修改|需修改|needs revision|revise)/i.test(reviewNotes)
      ? "approved"
      : "needs-revision";
  const lines = reviewNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const issueLines = lines.filter((line) =>
    /(^[-*]\s*)?(严重|警告|建议|问题|风险|warning|error|issue|risk)/i.test(line),
  );
  const issues = issueLines.map((line, index) => {
    const cleaned = line.replace(/^[-*]\s*/, "");
    const severity = /严重|error|不通过|阻断/i.test(cleaned)
      ? "error"
      : /警告|warning|风险/i.test(cleaned)
        ? "warning"
        : "info";
    const detail = cleaned.replace(/^(严重|警告|建议|问题|风险|error|warning|issue|risk)[：:\s-]*/i, "");
    const title = detail.split(/[。；;,.，]/)[0]?.trim() || detail || "审稿问题";
    const type = inferNovelReviewIssueType(cleaned);
    const excerpt =
      cleaned.match(/(?:原文|片段)[：:]\s*([^。；;\n]+)/)?.[1]?.trim() ??
      cleaned.match(/[“"]([^”"]{4,80})[”"]/)?.[1]?.trim();
    const suggestion =
      cleaned.match(/(?:建议|修改建议)[：:]\s*(.+)$/)?.[1]?.trim() ??
      (/(建议|可改|需要|应当)/.test(cleaned) ? detail : undefined);
    const paragraphHint =
      cleaned.match(/(?:第\s*\d+\s*段|倒数第\s*\d+\s*段|开头|结尾)/)?.[0] ??
      undefined;

    return {
      id: `issue-${index + 1}`,
      severity,
      type,
      title,
      detail,
      excerpt,
      suggestion,
      paragraphHint,
      resolved: false,
    } satisfies NovelChapterReviewIssue;
  });
  const summary =
    lines.find((line) => /^(总体|总结|summary)[：:]/i.test(line)) ??
    lines.find((line) => !issueLines.includes(line) && !/评分|审稿结论/.test(line)) ??
    reviewNotes.slice(0, 180);

  return {
    id: createNovelReviewId(createdAt),
    verdict,
    ...(score === undefined ? {} : { score }),
    summary: summary.replace(/^(总体|总结|summary)[：:\s]*/i, ""),
    issues,
    createdAt,
  };
}

function inferNovelReviewIssueType(
  text: string,
): NonNullable<NovelChapterReviewIssue["type"]> {
  if (/人物|角色|动机|情绪|人设/.test(text)) return "character";
  if (/情节|剧情|冲突|事件|伏笔/.test(text)) return "plot";
  if (/节奏|拖沓|过快|留存/.test(text)) return "pacing";
  if (/设定|前后|连续|矛盾|时间线/.test(text)) return "continuity";
  if (/逻辑|因果|合理/.test(text)) return "logic";
  if (/文风|表达|句式|词汇|比喻|描写/.test(text)) return "style";
  return "other";
}

export function reconcileNovelReviewHistory(
  existingReviews: NovelChapterReview[],
  nextReview: NovelChapterReview,
): NovelChapterReview[] {
  const nextIssueText = nextReview.issues
    .map((issue) => `${issue.title} ${issue.detail}`)
    .join("\n")
    .toLowerCase();
  const shouldResolveAll = nextReview.verdict === "approved";
  const reconciledExisting = existingReviews
    .filter((review) => review.id !== nextReview.id)
    .map((review) => ({
      ...review,
      issues: review.issues.map((issue) => {
        const issueNeedle = issue.title || issue.detail.slice(0, 16);
        const stillMentioned =
          issueNeedle.length > 0 &&
          nextIssueText.includes(issueNeedle.toLowerCase());

        return {
          ...issue,
          resolved: issue.resolved || shouldResolveAll || !stillMentioned,
        };
      }),
    }));

  return [nextReview, ...reconciledExisting];
}

export function buildNovelReviewIssueViews(
  reviews: NovelChapterReview[],
  activeReviewId?: string,
): NovelChapterReviewIssueView[] {
  const activeId = activeReviewId ?? reviews[0]?.id;

  return reviews
    .flatMap((review) =>
      review.issues.map((issue) => {
        const isCurrentReview = review.id === activeId;
        const resolved = issue.resolved || review.verdict === "approved";

        return {
          ...issue,
          resolved,
          reviewId: review.id,
          reviewCreatedAt: review.createdAt,
          isCurrentReview,
          statusLabel: resolved ? "已解决" : "未解决",
          originLabel: isCurrentReview ? "本轮新增" : "历史问题",
        } satisfies NovelChapterReviewIssueView;
      }),
    )
    .sort((left, right) => {
      if (left.isCurrentReview !== right.isCurrentReview) {
        return left.isCurrentReview ? -1 : 1;
      }
      if (left.resolved !== right.resolved) {
        return left.resolved ? 1 : -1;
      }

      return (
        new Date(right.reviewCreatedAt).getTime() -
          new Date(left.reviewCreatedAt).getTime() ||
        right.id.localeCompare(left.id)
      );
    });
}

export function buildNovelReviewIssueKey(
  issue: Pick<NovelChapterReviewIssueView, "reviewId" | "id">,
): string {
  return `${issue.reviewId}:${issue.id}`;
}

export function buildNovelReviewIssueKeysForDiffMarkers(
  markers: NovelCompareDiffMarker[],
): Set<string> {
  return new Set(
    markers.flatMap((marker) =>
      marker.relatedIssues.map((issue) => buildNovelReviewIssueKey(issue)),
    ),
  );
}

export function findNovelCompareDiffMarkerForReviewIssue(
  issue: Pick<NovelChapterReviewIssueView, "reviewId" | "id">,
  markers: NovelCompareDiffMarker[],
): NovelCompareDiffMarker | null {
  const issueKey = buildNovelReviewIssueKey(issue);

  return (
    markers.find((marker) =>
      marker.relatedIssues.some(
        (related) => buildNovelReviewIssueKey(related) === issueKey,
      ),
    ) ?? null
  );
}

export function filterNovelReviewIssueViews(
  issues: NovelChapterReviewIssueView[],
  filter: NovelReviewIssueFilter,
  options?: {
    diffIssueKeys?: Set<string>;
  },
): NovelChapterReviewIssueView[] {
  if (filter === "open") return issues.filter((issue) => !issue.resolved);
  if (filter === "resolved") return issues.filter((issue) => issue.resolved);
  if (filter === "current") {
    return issues.filter((issue) => issue.isCurrentReview);
  }
  if (filter === "history") {
    return issues.filter((issue) => !issue.isCurrentReview);
  }
  if (filter === "diff") {
    const diffIssueKeys = options?.diffIssueKeys;
    if (!diffIssueKeys || diffIssueKeys.size === 0) {
      return [];
    }

    return issues.filter((issue) =>
      diffIssueKeys.has(buildNovelReviewIssueKey(issue)),
    );
  }
  return issues;
}

export function findNovelReviewIssueParagraph(
  content: string,
  issue: Pick<
    NovelChapterReviewIssueView,
    "excerpt" | "detail" | "title" | "paragraphHint"
  >,
): NovelReviewIssueParagraphLocation | null {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const needles = [
    issue.excerpt,
    issue.paragraphHint,
    issue.title,
    ...issue.detail
      .split(/[，。；;,.、\s]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4),
  ].filter(Boolean) as string[];

  for (const needle of needles) {
    const normalizedNeedle = needle.toLowerCase();
    const index = paragraphs.findIndex((paragraph) =>
      paragraph.toLowerCase().includes(normalizedNeedle),
    );

    if (index >= 0) {
      return { index, paragraph: paragraphs[index]! };
    }
  }

  return null;
}

export function buildNovelReviewExportMarkdown(input: {
  bookTitle: string;
  chapter: StoredNovelChapter;
}): string {
  const activeReview =
    input.chapter.reviews.find(
      (review) => review.id === input.chapter.activeReviewId,
    ) ?? input.chapter.reviews[0];
  const issues = buildNovelReviewIssueViews(
    input.chapter.reviews,
    input.chapter.activeReviewId,
  );

  return [
    `# ${input.bookTitle} 审稿报告`,
    "",
    `章节：第 ${input.chapter.number} 章《${input.chapter.title}》`,
    `状态：${input.chapter.status}`,
    `字数：${input.chapter.wordCount}`,
    `更新时间：${input.chapter.updatedAt}`,
    "",
    "## 摘要",
    input.chapter.summary || "暂无章节摘要。",
    "",
    "## 审稿结论",
    activeReview
      ? [
          `结论：${activeReview.verdict === "approved" ? "通过" : "需要修订"}`,
          activeReview.score === undefined ? "" : `评分：${activeReview.score}`,
          `审稿时间：${activeReview.createdAt}`,
          "",
          activeReview.summary || "暂无审稿摘要。",
        ]
          .filter(Boolean)
          .join("\n")
      : "暂无结构化审稿记录。",
    "",
    "## 结构化问题",
    issues.length > 0
      ? issues
          .map((issue, index) =>
            [
              `### ${index + 1}. ${issue.title}`,
              `状态：${issue.statusLabel} / ${issue.originLabel}`,
              `级别：${issue.severity}`,
              issue.type ? `类型：${issue.type}` : "",
              `问题：${issue.detail}`,
              issue.excerpt ? `原文片段：${issue.excerpt}` : "",
              issue.suggestion ? `修改建议：${issue.suggestion}` : "",
              issue.paragraphHint ? `段落提示：${issue.paragraphHint}` : "",
              issue.resolvedByVersionId
                ? `修复版本：${issue.resolvedByVersionId}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")
      : "暂无结构化问题。",
    "",
    "## 原始审稿记录",
    input.chapter.reviewNotes || "暂无原始审稿记录。",
  ].join("\n");
}

export function buildNovelReviewIssueHighlights(
  content: string,
  issues: NovelChapterReviewIssueView[],
): NovelReviewIssueHighlight[] {
  return issues.flatMap((issue) => {
    const location = findNovelReviewIssueParagraph(content, issue);

    if (!location) {
      return [];
    }

    return [{
      key: `${issue.reviewId}:${issue.id}`,
      paragraphIndex: location.index,
      paragraph: location.paragraph,
      issue,
    }];
  });
}

function reviewIssueSeverityRank(
  severity: NovelChapterReviewIssueSeverity,
): number {
  if (severity === "error") return 3;
  if (severity === "warning") return 2;
  return 1;
}

export function buildNovelReviewIssueParagraphMarks(
  content: string,
  issues: NovelChapterReviewIssueView[],
): NovelReviewIssueParagraphMark[] {
  const navigation = buildNovelChapterParagraphNavigation(content);
  const marks = new Map<number, NovelReviewIssueParagraphMark>();

  for (const issue of issues) {
    const location = findNovelReviewIssueParagraph(content, issue);
    if (!location) {
      continue;
    }

    const paragraph = navigation.paragraphs[location.index];
    if (!paragraph) {
      continue;
    }

    const existing = marks.get(location.index);
    if (existing) {
      existing.issues.push(issue);
      if (
        reviewIssueSeverityRank(issue.severity) >
        reviewIssueSeverityRank(existing.highestSeverity)
      ) {
        existing.highestSeverity = issue.severity;
      }
      continue;
    }

    marks.set(location.index, {
      paragraphIndex: location.index,
      paragraph: paragraph.text,
      start: paragraph.start,
      end: paragraph.end,
      issues: [issue],
      highestSeverity: issue.severity,
    });
  }

  return [...marks.values()].sort(
    (left, right) => left.paragraphIndex - right.paragraphIndex,
  );
}

export function findNovelReviewIssuesForDiffLine(
  lineText: string,
  issues: NovelChapterReviewIssueView[],
): NovelChapterReviewIssueView[] {
  const normalizedLine = normalizeNovelAssetText(lineText);
  if (!normalizedLine) {
    return [];
  }

  return issues.filter((issue) => {
    const needles = [issue.excerpt, issue.title, issue.detail].filter(Boolean) as string[];

    return needles.some((needle) => {
      const normalizedNeedle = normalizeNovelAssetText(needle);
      return (
        normalizedNeedle.length >= 4 &&
        (normalizedLine.includes(normalizedNeedle) ||
          normalizedNeedle.includes(normalizedLine))
      );
    });
  });
}

export function buildNovelCompareDiffMarkers(
  compareView: NovelChapterVersionCompareView,
  issues: NovelChapterReviewIssueView[] = [],
): NovelCompareDiffMarker[] {
  const markers: NovelCompareDiffMarker[] = [];

  compareView.previousLines.forEach((line, lineIndex) => {
    if (line.state === "unchanged") {
      return;
    }

    markers.push({
      id: `previous-${lineIndex}`,
      side: "previous",
      lineIndex,
      text: line.text,
      state: "removed",
      relatedIssues: findNovelReviewIssuesForDiffLine(line.text, issues),
    });
  });

  compareView.nextLines.forEach((line, lineIndex) => {
    if (line.state === "unchanged") {
      return;
    }

    markers.push({
      id: `next-${lineIndex}`,
      side: "next",
      lineIndex,
      text: line.text,
      state: "added",
      relatedIssues: findNovelReviewIssuesForDiffLine(line.text, issues),
    });
  });

  return markers;
}

export function filterNovelCompareDiffMarkers(
  markers: NovelCompareDiffMarker[],
  query: string,
): NovelCompareDiffMarker[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return markers;
  }

  return markers.filter((marker) =>
    marker.text.toLowerCase().includes(normalizedQuery),
  );
}

export function restoreNovelCompareLineInContent(
  content: string,
  lineText: string,
  options?: {
    paragraphIndex?: number;
    selectionStart?: number;
    selectionEnd?: number;
  },
): NovelCompareLineRestoreResult {
  const trimmed = lineText.trim();
  if (!trimmed) {
    return { content, paragraphIndex: null, mode: "append" };
  }

  const navigation = buildNovelChapterParagraphNavigation(content);

  if (
    options?.paragraphIndex !== undefined &&
    options.paragraphIndex >= 0 &&
    navigation.paragraphs[options.paragraphIndex]
  ) {
    const paragraph = navigation.paragraphs[options.paragraphIndex]!;

    return {
      content:
        content.slice(0, paragraph.start) +
        trimmed +
        content.slice(paragraph.end),
      paragraphIndex: options.paragraphIndex,
      mode: "replace-paragraph",
    };
  }

  if (
    options?.selectionStart !== undefined &&
    options?.selectionEnd !== undefined &&
    options.selectionStart !== options.selectionEnd
  ) {
    return {
      content:
        content.slice(0, options.selectionStart) +
        trimmed +
        content.slice(options.selectionEnd),
      paragraphIndex: null,
      mode: "replace-selection",
    };
  }

  const selectionStart = options?.selectionStart ?? 0;
  const paragraph = navigation.paragraphs.find(
    (item) => selectionStart >= item.start && selectionStart <= item.end,
  );

  if (paragraph) {
    return {
      content:
        content.slice(0, paragraph.start) +
        trimmed +
        content.slice(paragraph.end),
      paragraphIndex: paragraph.index,
      mode: "replace-paragraph",
    };
  }

  return {
    content: content.trim() ? `${content}\n\n${trimmed}` : trimmed,
    paragraphIndex: null,
    mode: "append",
  };
}

export function buildNovelStyleConstraintsFromAssets(
  assets: Pick<NovelProjectAssets, "genres" | "styleSamples" | "contextSelection" | "projectStrategy">,
  project: Pick<InkosNovelProject, "genre">,
): string {
  const parts: string[] = [];
  const genres = assets.genres ?? [];
  const genreProfile =
    genres.find((genre) => genre.name === project.genre) ?? genres[0];

  if (genreProfile?.fatigueWords?.trim()) {
    parts.push(`避免疲劳词：${genreProfile.fatigueWords.trim()}`);
  }
  if (genreProfile?.pacingRule?.trim()) {
    parts.push(`题材节奏规则：${genreProfile.pacingRule.trim()}`);
  }
  if (genreProfile?.chapterTypes?.trim()) {
    parts.push(`章节类型偏好：${genreProfile.chapterTypes.trim()}`);
  }

  const styleSample = assets.styleSamples?.[0];
  if (styleSample?.content?.trim()) {
    parts.push(
      `文风参考（${styleSample.title}）：${styleSample.content.trim().slice(0, 240)}`,
    );
  }

  if (styleSample?.analysis?.styleConstraints?.trim()) {
    parts.push(styleSample.analysis.styleConstraints.trim());
  }

  if (assets.contextSelection?.styleConstraints?.trim()) {
    parts.push(assets.contextSelection.styleConstraints.trim());
  }

  if (assets.projectStrategy?.summary?.trim()) {
    parts.push(`市场策略：${assets.projectStrategy.summary.trim()}`);
  }

  return parts.join("\n");
}

const IMPORTED_CHAPTER_HEADER_PATTERN =
  /^(?:第\s*[0-9零一二三四五六七八九十百千两]+\s*章[^\n]*|Chapter\s+\d+[^\n]*|#{1,3}\s*(?:第\s*)?[0-9零一二三四五六七八九十百千两]+[^\n]*)$/i;

function parseImportedChapterNumber(title: string, fallback: number): number {
  const digitMatch = title.match(/第\s*(\d+)\s*章|Chapter\s+(\d+)|#+\s*(?:第\s*)?(\d+)/i);
  if (digitMatch) {
    return Number(digitMatch[1] || digitMatch[2] || digitMatch[3] || fallback);
  }

  const chineseMatch = title.match(/第\s*([零一二三四五六七八九十百千两]+)\s*章/);
  if (!chineseMatch?.[1]) {
    return fallback;
  }

  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const raw = chineseMatch[1];
  if (raw.length === 1) {
    return map[raw] ?? fallback;
  }
  if (raw.startsWith("十")) {
    return 10 + (map[raw.slice(1)] ?? 0);
  }
  if (raw.endsWith("十")) {
    return (map[raw.slice(0, -1)] ?? 0) * 10;
  }

  return fallback;
}

function cleanImportedChapterTitle(title: string, number: number): string {
  const withoutPrefix = title
    .replace(/^#{1,3}\s*/, "")
    .replace(/^第\s*[0-9零一二三四五六七八九十百千两]+\s*章[：:\s-]*/i, "")
    .replace(/^Chapter\s+\d+[：:\s-]*/i, "")
    .trim();

  return withoutPrefix || `第 ${number} 章`;
}

export function splitImportedNovelChapters(content: string): NovelImportedChapter[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && IMPORTED_CHAPTER_HEADER_PATTERN.test(trimmed)) {
      if (current && current.lines.join("\n").trim()) {
        sections.push(current);
      }
      current = { title: trimmed, lines: [] };
      continue;
    }

    if (!current) {
      current = { title: "第 1 章", lines: [] };
    }
    current.lines.push(line);
  }

  if (current && current.lines.join("\n").trim()) {
    sections.push(current);
  }

  const source =
    sections.length > 0
      ? sections
      : [{ title: "第 1 章", lines: lines.filter((line) => line.trim()) }];

  return source.map((section, index) => {
    const number = parseImportedChapterNumber(section.title, index + 1);
    const chapterContent = section.lines.join("\n").trim();
    const title = cleanImportedChapterTitle(section.title, number);

    return {
      number,
      title,
      content: chapterContent,
      summary: buildFallbackNovelChapterSummary(chapterContent),
      wordCount: countNovelWords(chapterContent),
    };
  });
}

export function extractImportedNovelAssetHints(
  content: string,
): NovelImportAssetHints {
  const characters = new Set<string>();
  const foreshadowing = new Set<string>();
  const worldIncrements = new Set<string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 4) {
      continue;
    }

    if (/^(角色|人物|主角|配角|姓名)[:：]/.test(trimmed)) {
      characters.add(trimmed.replace(/^[^:：]+[:：]\s*/, "").slice(0, 120));
    }

    if (/^(世界|设定|背景|地点|势力|组织)[:：]/.test(trimmed)) {
      worldIncrements.add(trimmed.replace(/^[^:：]+[:：]\s*/, "").slice(0, 160));
    }

    if (/伏笔|悬念|钩子|埋线|未解|谜/.test(trimmed)) {
      foreshadowing.add(trimmed.slice(0, 160));
    }

    const nameMatch = trimmed.match(/^([\u4e00-\u9fa5]{2,4})(?:[，,：:]|是|在|说|看)/);
    if (nameMatch?.[1]) {
      characters.add(nameMatch[1]);
    }
  }

  return {
    characters: [...characters].slice(0, 12),
    foreshadowing: [...foreshadowing].slice(0, 10),
    worldIncrements: [...worldIncrements].slice(0, 10),
  };
}

function applyImportedAssetHintsToAssets(
  assets: NovelProjectAssets,
  hints: NovelImportAssetHints,
  sourceLabel: string,
): NovelProjectAssets {
  const now = new Date().toISOString();
  let nextAssets = { ...assets };

  hints.characters.forEach((item, index) => {
    nextAssets = {
      ...nextAssets,
      knowledgeAssets: upsertNovelKnowledgeAsset(nextAssets.knowledgeAssets ?? [], {
        category: "character",
        title: `导入角色·${item.slice(0, 18) || index + 1}`,
        content: `${sourceLabel}：${item}`,
        status: "active",
        tags: ["导入", "角色"],
        updatedAt: now,
      }),
    };
  });

  hints.foreshadowing.forEach((item, index) => {
    nextAssets = {
      ...nextAssets,
      knowledgeAssets: upsertNovelKnowledgeAsset(nextAssets.knowledgeAssets ?? [], {
        category: "foreshadowing",
        title: `导入伏笔·${item.slice(0, 18) || index + 1}`,
        content: `${sourceLabel}：${item}`,
        status: "draft",
        tags: ["导入", "伏笔"],
        updatedAt: now,
      }),
    };
  });

  hints.worldIncrements.forEach((item, index) => {
    nextAssets = {
      ...nextAssets,
      knowledgeAssets: upsertNovelKnowledgeAsset(nextAssets.knowledgeAssets ?? [], {
        category: "world",
        title: `导入设定·${item.slice(0, 18) || index + 1}`,
        content: `${sourceLabel}：${item}`,
        status: "active",
        tags: ["导入", "世界观"],
        updatedAt: now,
      }),
    };
  });

  if (hints.worldIncrements.length > 0) {
    nextAssets.worldNotes = mergeNovelLongText(
      nextAssets.worldNotes,
      hints.worldIncrements.map((item) => `${sourceLabel}：${item}`),
      "导入世界观",
    );
  }

  if (hints.characters.length > 0) {
    nextAssets.characters = mergeNovelLongText(
      nextAssets.characters,
      hints.characters.map((item) => `${sourceLabel}：${item}`),
      "导入角色",
    );
  }

  return nextAssets;
}

export function processImportedNovelMaterial(input: {
  title: string;
  content: string;
  type: NovelImportedMaterial["type"];
  project: InkosNovelProject;
  assets: NovelProjectAssets;
}): {
  material: NovelImportedMaterial;
  chapters: NovelImportedChapter[];
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  extractedAssetCount: number;
} {
  const trimmedContent = input.content.trim();
  const materialId = `import-${Date.now()}`;
  const sourceLabel = input.title.trim() || `${input.project.title} 导入素材`;
  let nextAssets = { ...input.assets };
  let nextProject = { ...input.project };
  let chapters: NovelImportedChapter[] = [];
  let extractedAssetCount = 0;

  if (input.type === "chapters") {
    chapters = splitImportedNovelChapters(trimmedContent);
    const hints = extractImportedNovelAssetHints(trimmedContent);
    extractedAssetCount =
      hints.characters.length + hints.foreshadowing.length + hints.worldIncrements.length;
    nextAssets = applyImportedAssetHintsToAssets(nextAssets, hints, sourceLabel);
    nextAssets.outline = chapters
      .map(
        (chapter) =>
          `${chapter.number}. ${chapter.title}：${chapter.summary || "导入章节"}`,
      )
      .join("\n");
    nextAssets.outlineNodes = chapters.map((chapter) => ({
      id: `outline-${chapter.number}`,
      volume: `第 ${Math.max(1, Math.ceil(chapter.number / 20))} 卷`,
      chapterNumber: chapter.number,
      title: chapter.title,
      goal: chapter.summary || "导入章节，等待补充计划。",
      conflict: "",
      characters: hints.characters.slice(0, 3).join("、"),
      information: chapter.summary || "",
      foreshadowing: hints.foreshadowing.slice(0, 2).join("；"),
      targetWords: input.project.chapterWordCount ?? 3000,
      status: "approved" as const,
      updatedAt: new Date().toISOString(),
    }));
    nextProject = syncNovelProjectFromOutlineNodes(
      { ...nextProject, currentStage: "chapter-plan" },
      nextAssets.outlineNodes,
    );
  } else if (input.type === "canon") {
    nextAssets.worldNotes = mergeNovelLongText(
      nextAssets.worldNotes,
      [trimmedContent],
      sourceLabel,
    );
    const hints = extractImportedNovelAssetHints(trimmedContent);
    extractedAssetCount =
      hints.characters.length + hints.foreshadowing.length + hints.worldIncrements.length;
    nextAssets = applyImportedAssetHintsToAssets(nextAssets, hints, sourceLabel);
  } else {
    nextAssets.settings = mergeNovelLongText(
      nextAssets.settings,
      [trimmedContent],
      sourceLabel,
    );
    const hints = extractImportedNovelAssetHints(trimmedContent);
    extractedAssetCount =
      hints.characters.length + hints.foreshadowing.length + hints.worldIncrements.length;
    nextAssets = applyImportedAssetHintsToAssets(nextAssets, hints, sourceLabel);
  }

  const material: NovelImportedMaterial = {
    id: materialId,
    title: sourceLabel,
    type: input.type,
    content: trimmedContent,
    createdAt: new Date().toISOString(),
    parsedChapterCount: chapters.length,
    extractedAssetCount,
    status: "processed",
  };

  return {
    material,
    chapters,
    assets: {
      ...nextAssets,
      importedMaterials: [material, ...nextAssets.importedMaterials],
    },
    project: nextProject,
    extractedAssetCount,
  };
}

export function analyzeNovelStyleSample(content: string): NovelStyleAnalysis {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const sentences = normalized
    .split(/[。！？!?…]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const averageSentenceLength =
    sentences.length > 0
      ? Math.round(
          sentences.reduce((sum, sentence) => sum + sentence.length, 0) /
            sentences.length,
        )
      : 0;
  const compactText = normalized.replace(/\s/g, "");
  const uniqueChars = new Set(compactText).size;
  const vocabularyDiversity =
    compactText.length > 0
      ? Math.min(98, Math.round((uniqueChars / compactText.length) * 100))
      : 0;
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphDensity: NovelStyleAnalysis["paragraphDensity"] =
    paragraphs.length <= 3 ? "低" : paragraphs.length <= 8 ? "中" : "高";
  const coldWords = (normalized.match(/冷|雨|暗|静|沉默|阴影|压迫/g) ?? []).length;
  const warmWords = (normalized.match(/暖|笑|光|热|喜|明亮/g) ?? []).length;
  const emotionalTone =
    coldWords > warmWords * 1.5
      ? "克制冷调"
      : warmWords > coldWords * 1.5
        ? "偏暖情绪"
        : "平衡克制";

  const tags: string[] = [];
  if (averageSentenceLength <= 15) tags.push("短句");
  if (averageSentenceLength >= 28) tags.push("长句");
  if (/悬疑|谜|裂缝|档案|阴影|追踪|案件/.test(normalized)) tags.push("悬疑钩子");
  if (/雨|街|城|灯|楼|巷|窗/.test(normalized)) tags.push("现实细节");
  if (coldWords >= 2) tags.push("冷色调");
  if (/内心|心里|压迫|沉默|克制/.test(normalized)) tags.push("人物内压");

  const styleConstraints = [
    averageSentenceLength <= 15
      ? "优先使用短句，避免冗长解释。"
      : averageSentenceLength >= 28
        ? "允许稍长句，但需保持信息密度。"
        : "句长适中，注意节奏起伏。",
    tags.includes("悬疑钩子") ? "每段保留疑问或信息缺口。" : "",
    tags.includes("冷色调") ? "减少直白情绪词，用环境细节承载情绪。" : "",
    tags.includes("人物内压") ? "人物心理以动作和细节外化，不要直接说明情绪。" : "",
    `词汇多样性 ${vocabularyDiversity}%，段落密度${paragraphDensity}。`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    averageSentenceLength,
    vocabularyDiversity,
    paragraphDensity,
    emotionalTone,
    tags,
    styleConstraints,
    analyzedAt: new Date().toISOString(),
  };
}

export function applyNovelStyleAnalysisToAssets(
  assets: NovelProjectAssets,
  sampleId: string,
  analysis: NovelStyleAnalysis,
): NovelProjectAssets {
  const styleSamples = assets.styleSamples.map((sample) =>
    sample.id === sampleId ? { ...sample, analysis } : sample,
  );

  return {
    ...assets,
    styleSamples,
    contextSelection: {
      ...assets.contextSelection,
      styleConstraints: analysis.styleConstraints,
    },
  };
}

export function analyzeNovelGenreProfile(
  genre: NovelGenreProfile,
  project: Pick<InkosNovelProject, "title" | "premise" | "genre">,
): NovelGenreAnalysis {
  const fatigueWords = genre.fatigueWords
    .split(/[,，、/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const premiseSnippet = project.premise.trim().slice(0, 80);

  return {
    summary: [
      `${genre.name} 题材适合 ${genre.chapterTypes || "强钩子开篇、线索推进、反转揭露"}。`,
      premiseSnippet
        ? `与《${project.title}》的核心设定「${premiseSnippet}」方向一致。`
        : "",
    ]
      .filter(Boolean)
      .join(""),
    audienceHook: genre.chapterTypes || "开局钩子, 线索推进, 情绪反转",
    conflictPattern: premiseSnippet.includes("冲突")
      ? "围绕核心冲突持续加压，并在章节尾部制造新变量。"
      : "主角目标 vs 环境阻力，章节内至少一次决策或代价。",
    riskPoints: fatigueWords.map((word) => `避免过度使用「${word}」`),
    recommendedPacing:
      genre.pacingRule || "每 1800-2500 字出现一次信息增量或冲突升级。",
    analyzedAt: new Date().toISOString(),
  };
}

export function applyNovelGenreAnalysisToAssets(
  assets: NovelProjectAssets,
  genreId: string,
  analysis: NovelGenreAnalysis,
): NovelProjectAssets {
  const now = new Date().toISOString();
  const targetGenre =
    assets.genres.find((genre) => genre.id === genreId) ?? assets.genres[0];
  let nextAssets: NovelProjectAssets = {
    ...assets,
    genres: assets.genres.map((genre) =>
      genre.id === genreId ? { ...genre, analysis } : genre,
    ),
    contextSelection: {
      ...assets.contextSelection,
      pacing: analysis.recommendedPacing,
      bannedWords: targetGenre?.fatigueWords ?? assets.contextSelection.bannedWords,
    },
    settings: mergeNovelLongText(
      assets.settings,
      [
        `题材分析：${analysis.summary}`,
        `受众钩子：${analysis.audienceHook}`,
        `冲突模式：${analysis.conflictPattern}`,
      ],
      "题材分析",
    ),
  };

  nextAssets = {
    ...nextAssets,
    knowledgeAssets: upsertNovelKnowledgeAsset(nextAssets.knowledgeAssets ?? [], {
      category: "term",
      title: `${targetGenre?.name ?? "项目题材"} · 题材策略`,
      content: [
        analysis.summary,
        `受众钩子：${analysis.audienceHook}`,
        `冲突模式：${analysis.conflictPattern}`,
        analysis.riskPoints.length > 0
          ? `风险词：${analysis.riskPoints.join("；")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      status: "active",
      tags: ["题材", "策略"],
      updatedAt: now,
    }),
  };

  return nextAssets;
}

export function buildNovelProjectStrategyFromRadars(
  radars: NovelProjectAssets["marketRadars"],
  project: Pick<InkosNovelProject, "title" | "genre">,
): NovelProjectStrategy {
  const latest = radars.slice(0, 6);

  return {
    summary:
      latest.length > 0
        ? latest
            .map(
              (item) =>
                `${item.platform}/${item.genre}：${item.concept.split("\n")[0]?.trim() || item.concept}`,
            )
            .join("；")
        : `《${project.title}》暂无市场扫描结果，建议先运行市场雷达。`,
    platformHints: latest.map(
      (item) => `${item.platform} · ${item.score} · ${item.genre}`,
    ),
    riskAlerts: latest
      .filter((item) => {
        const score = Number.parseInt(item.score, 10);
        return Number.isFinite(score) && score < 65;
      })
      .map((item) => item.concept.split("\n")[0]?.trim() || item.concept),
    updatedAt: new Date().toISOString(),
  };
}

export function applyNovelMarketRadarToAssets(
  assets: NovelProjectAssets,
  radars: NovelProjectAssets["marketRadars"],
  project: Pick<InkosNovelProject, "title" | "genre">,
): NovelProjectAssets {
  const strategy = buildNovelProjectStrategyFromRadars(radars, project);
  const now = new Date().toISOString();

  return {
    ...assets,
    marketRadars: radars,
    projectStrategy: strategy,
    settings: mergeNovelLongText(
      assets.settings,
      [
        `市场策略摘要：${strategy.summary}`,
        strategy.platformHints.length > 0
          ? `平台提示：${strategy.platformHints.join(" / ")}`
          : "",
        strategy.riskAlerts.length > 0
          ? `风险提示：${strategy.riskAlerts.join("；")}`
          : "",
      ].filter(Boolean),
      "市场雷达",
    ),
    knowledgeAssets: upsertNovelKnowledgeAsset(assets.knowledgeAssets ?? [], {
      category: "term",
      title: "市场策略",
      content: [
        strategy.summary,
        strategy.platformHints.length > 0
          ? `平台提示：${strategy.platformHints.join("\n")}`
          : "",
        strategy.riskAlerts.length > 0
          ? `风险提示：${strategy.riskAlerts.join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      status: "active",
      tags: ["市场雷达", "策略"],
      updatedAt: now,
    }),
  };
}

export function buildNovelLocalEnvironmentDiagnostics(input: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters: StoredNovelChapter[];
}): NovelProjectAssets["diagnostics"] {
  const now = new Date().toISOString();
  const plannedChapters = input.project.chapters.length;
  const plannedWithFocus = input.project.chapters.filter(
    (chapter) =>
      chapter.focus.trim() &&
      chapter.focus !== "等待补充章节计划。" &&
      !chapter.focus.startsWith("导入章节"),
  ).length;
  const openReviewIssues = input.chapters.flatMap((chapter) =>
    (chapter.reviews ?? []).flatMap((review) =>
      review.issues.filter((issue) => !issue.resolved),
    ),
  ).length;
  const foreshadowingAssets = (input.assets.knowledgeAssets ?? []).filter(
    (asset) => asset.category === "foreshadowing" && asset.status !== "resolved",
  );
  const staleForeshadowing = foreshadowingAssets.filter(
    (asset) =>
      !asset.tags.includes("回收伏笔") &&
      !asset.content.includes("回收") &&
      asset.status === "draft",
  ).length;
  const hasWorldAsset = Boolean(
    input.assets.worldNotes?.trim() ||
      input.assets.knowledgeAssets.some((asset) => asset.category === "world"),
  );
  const hasCharacterAsset = Boolean(
    input.assets.characters?.trim() ||
      input.assets.knowledgeAssets.some((asset) => asset.category === "character"),
  );

  const checks = [
    {
      label: "世界观资产",
      ok: hasWorldAsset,
      detail: hasWorldAsset
        ? "已检测到世界观文本或设定资产。"
        : "缺少世界观资产，建议先补充 worldNotes 或设定资产。",
    },
    {
      label: "角色资产",
      ok: hasCharacterAsset,
      detail: hasCharacterAsset
        ? "已检测到角色文本或角色资产。"
        : "缺少角色资产，写作时容易出现人物前后不一致。",
    },
    {
      label: "章节计划完整性",
      ok: plannedChapters > 0 && plannedWithFocus / plannedChapters >= 0.6,
      detail:
        plannedChapters > 0
          ? `${plannedWithFocus}/${plannedChapters} 章具备有效计划。`
          : "尚未建立章节计划。",
    },
    {
      label: "审稿遗留问题",
      ok: openReviewIssues <= 5,
      detail:
        openReviewIssues > 0
          ? `当前有 ${openReviewIssues} 个未解决审稿问题${openReviewIssues > 5 ? "，建议优先修订" : ""}。`
          : "暂无未解决审稿问题。",
    },
    {
      label: "伏笔回收风险",
      ok: staleForeshadowing <= 3,
      detail:
        foreshadowingAssets.length > 0
          ? `${foreshadowingAssets.length} 条活跃伏笔，其中 ${staleForeshadowing} 条仍停留在草稿/未回收状态。`
          : "暂无活跃伏笔资产。",
    },
    {
      label: "市场策略",
      ok: Boolean(input.assets.projectStrategy?.summary?.trim()),
      detail: input.assets.projectStrategy?.summary
        ? "已存在市场策略摘要，可继续用雷达更新。"
        : "尚未生成市场策略，建议运行市场雷达。",
    },
  ];
  const conflictReport = buildNovelAssetConflictReport({
    project: input.project,
    assets: input.assets,
  });

  checks.push({
    label: "设定冲突",
    ok: conflictReport.errorCount === 0 && conflictReport.warningCount <= 2,
    detail: conflictReport.summary,
  });

  return checks.map((check, index) => ({
    id: `local-diagnostic-${Date.now()}-${index}`,
    label: check.label,
    ok: check.ok,
    detail: check.detail,
    createdAt: now,
  }));
}

export function mergeNovelDiagnostics(
  incoming: NovelProjectAssets["diagnostics"],
  existing: NovelProjectAssets["diagnostics"] = [],
  limit = 24,
): NovelProjectAssets["diagnostics"] {
  const seen = new Set<string>();
  const merged: NovelProjectAssets["diagnostics"] = [];

  for (const item of [...incoming, ...existing]) {
    const key = `${item.label}:${item.detail}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

export function appendNovelAssetChangeEvent(
  assets: NovelProjectAssets,
  event: Omit<NovelAssetChangeEvent, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): NovelProjectAssets {
  const entry: NovelAssetChangeEvent = {
    id: event.id ?? `asset-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: event.createdAt ?? new Date().toISOString(),
    ...event,
  };

  return {
    ...assets,
    assetChangeEvents: [entry, ...(assets.assetChangeEvents ?? [])].slice(0, 100),
  };
}

export function buildNovelAssetConflictReport(input: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
}): NovelAssetConflictReport {
  const issues: NovelAssetConflict[] = [];
  const knowledgeAssets = input.assets.knowledgeAssets ?? [];
  const seenDuplicatePairs = new Set<string>();

  knowledgeAssets.forEach((left, leftIndex) => {
    knowledgeAssets.slice(leftIndex + 1).forEach((right) => {
      const score = scoreNovelKnowledgeAssetMatch(left, {
        category: right.category,
        title: right.title,
        content: right.content,
        status: right.status,
        tags: right.tags,
        updatedAt: right.updatedAt,
      });

      if (score < 0.85) {
        return;
      }

      const pairKey = [left.id, right.id].sort().join(":");
      if (seenDuplicatePairs.has(pairKey)) {
        return;
      }

      seenDuplicatePairs.add(pairKey);

      if (
        left.category === "foreshadowing" &&
        right.category === "foreshadowing" &&
        left.status !== right.status &&
        (left.status === "resolved" || right.status === "resolved")
      ) {
        issues.push({
          id: `resolved-dup-${pairKey}`,
          severity: "warning",
          code: "foreshadowing-status-mismatch",
          title: "伏笔状态不一致",
          detail: `「${left.title}」(${left.status}) 与「${right.title}」(${right.status}) 高度相似，建议合并。`,
          assetIds: [left.id, right.id],
        });
        return;
      }

      issues.push({
        id: `duplicate-${pairKey}`,
        severity: left.category === "character" ? "warning" : "info",
        code: "duplicate-asset",
        title: `疑似重复${getNovelKnowledgeAssetCategoryLabel(left.category)}`,
        detail: `「${left.title}」与「${right.title}」相似度 ${Math.round(score * 100)}%。`,
        assetIds: [left.id, right.id],
      });
    });
  });

  const foreshadowingPool = buildNovelForeshadowingPoolSummary(input.assets);
  foreshadowingPool.stale.forEach((asset) => {
    issues.push({
      id: `stale-foreshadowing-${asset.id}`,
      severity: "warning",
      code: "stale-foreshadowing",
      title: "伏笔遗忘风险",
      detail: `「${asset.title}」长期未更新且尚未回收，建议推进或标记 resolved。`,
      assetIds: [asset.id],
    });
  });

  (input.assets.outlineNodes ?? []).forEach((node) => {
    const foreshadowing = node.foreshadowing.trim();
    if (foreshadowing.length < 4) {
      return;
    }

    const matched = knowledgeAssets.some(
      (asset) =>
        asset.category === "foreshadowing" &&
        scoreNovelKnowledgeAssetMatch(asset, {
          category: "foreshadowing",
          title: foreshadowing,
          content: foreshadowing,
          status: asset.status,
          tags: asset.tags,
          updatedAt: asset.updatedAt,
        }) >= 0.45,
    );

    if (!matched) {
      issues.push({
        id: `outline-drift-${node.id}`,
        severity: "info",
        code: "outline-foreshadowing-drift",
        title: `第 ${node.chapterNumber} 章大纲伏笔未入库`,
        detail: foreshadowing,
        chapterNumbers: [node.chapterNumber],
      });
    }
  });

  const characterGroups = new Map<string, NovelKnowledgeAsset[]>();
  knowledgeAssets
    .filter((asset) => asset.category === "character")
    .forEach((asset) => {
      const key = normalizeNovelAssetText(asset.title);
      characterGroups.set(key, [...(characterGroups.get(key) ?? []), asset]);
    });

  characterGroups.forEach((group, key) => {
    if (!key || group.length <= 1) {
      return;
    }

    issues.push({
      id: `character-title-collision-${key}`,
      severity: "warning",
      code: "character-title-collision",
      title: "角色标题重复",
      detail: `检测到 ${group.length} 条标题为「${group[0]?.title}」的角色资产，建议合并状态追踪。`,
      assetIds: group.map((asset) => asset.id),
    });
  });

  const generatedChapterNumbers = new Set(
    input.project.chapters
      .filter((chapter) => chapter.status !== "planned")
      .map((chapter) => chapter.number),
  );
  (input.assets.outlineNodes ?? []).forEach((node) => {
    if (
      generatedChapterNumbers.has(node.chapterNumber) &&
      node.status === "planned"
    ) {
      issues.push({
        id: `outline-status-${node.id}`,
        severity: "info",
        code: "outline-status-drift",
        title: `第 ${node.chapterNumber} 章大纲状态未同步`,
        detail: "章节已生成，但大纲节点仍标记为 planned。",
        chapterNumbers: [node.chapterNumber],
      });
    }
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const summary =
    issues.length === 0
      ? "未发现设定冲突。"
      : errorCount > 0
        ? `发现 ${errorCount} 个错误、${warningCount} 个警告的设定冲突。`
        : `发现 ${warningCount} 个警告、${issues.length - warningCount} 条提示。`;

  return {
    errorCount,
    warningCount,
    issues,
    summary,
  };
}

export function isNovelAssetConflictAutoFixable(code: string): boolean {
  return [
    "character-title-collision",
    "duplicate-asset",
    "foreshadowing-status-mismatch",
    "outline-foreshadowing-drift",
    "outline-status-drift",
  ].includes(code);
}

function mergeNovelKnowledgeAssetsByIds(
  assets: NovelKnowledgeAsset[],
  keepId: string,
  mergeIds: string[],
): NovelKnowledgeAsset[] {
  const removeIds = new Set(mergeIds.filter((id) => id !== keepId));
  const group = assets.filter(
    (asset) => asset.id === keepId || removeIds.has(asset.id),
  );
  const keep = assets.find((asset) => asset.id === keepId);

  if (!keep || group.length <= 1) {
    return assets;
  }

  const merged: NovelKnowledgeAsset = {
    ...keep,
    content: group
      .map((asset) => asset.content)
      .filter(Boolean)
      .filter((content, index, list) => list.indexOf(content) === index)
      .join("\n\n"),
    tags: Array.from(new Set(group.flatMap((asset) => asset.tags))),
    status: group.some((asset) => asset.status === "resolved")
      ? "resolved"
      : group.some((asset) => asset.status === "draft")
        ? "draft"
        : keep.status,
    updatedAt: new Date().toISOString(),
  };

  return [
    merged,
    ...assets.filter(
      (asset) => asset.id !== keepId && !removeIds.has(asset.id),
    ),
  ];
}

export function applyNovelAssetConflictFixes(input: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters?: StoredNovelChapter[];
  issueIds?: string[];
}): NovelAssetConflictFixResult {
  const report = buildNovelAssetConflictReport(input);
  const issueFilter = input.issueIds ? new Set(input.issueIds) : null;
  let assets = input.assets;
  const project = input.project;
  const applied: NovelAssetConflictFixResult["applied"] = [];
  const skipped: NovelAssetConflictFixResult["skipped"] = [];
  const mergedAssetIds = new Set<string>();
  let outlineSynced = false;

  for (const issue of report.issues) {
    if (issueFilter && !issueFilter.has(issue.id)) {
      continue;
    }

    if (!isNovelAssetConflictAutoFixable(issue.code)) {
      skipped.push({
        issueId: issue.id,
        reason: "需人工处理。",
      });
      continue;
    }

    if (
      issue.code === "character-title-collision" ||
      issue.code === "duplicate-asset" ||
      issue.code === "foreshadowing-status-mismatch"
    ) {
      const ids = (issue.assetIds ?? []).filter((id) => !mergedAssetIds.has(id));

      if (ids.length < 2) {
        skipped.push({
          issueId: issue.id,
          reason: "相关资产已被其他修复合并。",
        });
        continue;
      }

      const keepId = ids[0]!;
      assets = appendNovelAssetChangeEvent(
        {
          ...assets,
          knowledgeAssets: mergeNovelKnowledgeAssetsByIds(
            assets.knowledgeAssets ?? [],
            keepId,
            ids.slice(1),
          ),
        },
        {
          action: "merge",
          category: assets.knowledgeAssets?.find((item) => item.id === keepId)
            ?.category,
          assetId: keepId,
          label: "冲突修复：合并重复资产",
          detail: issue.title,
        },
      );
      ids.slice(1).forEach((id) => mergedAssetIds.add(id));
      applied.push({ issueId: issue.id, label: issue.title });
      continue;
    }

    if (issue.code === "outline-foreshadowing-drift") {
      const nodeId = issue.id.replace(/^outline-drift-/, "");
      const node = assets.outlineNodes.find((item) => item.id === nodeId);

      if (!node || !node.foreshadowing.trim()) {
        skipped.push({
          issueId: issue.id,
          reason: "找不到对应大纲节点。",
        });
        continue;
      }

      assets = applyNovelChapterAssetDelta(assets, {
        chapterNumber: node.chapterNumber,
        chapterTitle: node.title,
        summary: node.goal,
        characterStates: [],
        newForeshadowing: [node.foreshadowing.trim()],
        resolvedForeshadowing: [],
        worldIncrements: [],
      });
      applied.push({ issueId: issue.id, label: issue.title });
      continue;
    }

    if (issue.code === "outline-status-drift") {
      if (input.chapters && !outlineSynced) {
        assets = {
          ...assets,
          outlineNodes: syncNovelOutlineNodesFromChapters(
            assets.outlineNodes,
            input.chapters,
            project,
          ),
        };
        outlineSynced = true;
        applied.push({
          issueId: issue.id,
          label: "同步大纲节点状态",
        });
      } else {
        const nodeId = issue.id.replace(/^outline-status-/, "");
        const node = assets.outlineNodes.find((item) => item.id === nodeId);
        const chapter = project.chapters.find(
          (item) => item.number === node?.chapterNumber,
        );

        if (!node || !chapter || chapter.status === "planned") {
          skipped.push({
            issueId: issue.id,
            reason: "无法从章节计划推断目标状态。",
          });
          continue;
        }

        assets = {
          ...assets,
          outlineNodes: assets.outlineNodes.map((item) =>
            item.id === nodeId
              ? {
                  ...item,
                  status: chapter.status,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        };
        applied.push({ issueId: issue.id, label: issue.title });
      }
    }
  }

  const summary =
    applied.length > 0
      ? `已自动修复 ${applied.length} 项${skipped.length > 0 ? `，跳过 ${skipped.length} 项` : ""}。`
      : skipped.length > 0
        ? `没有可自动修复项，跳过 ${skipped.length} 项。`
        : "没有需要处理的冲突。";

  return {
    project,
    assets,
    applied,
    skipped,
    summary,
  };
}

function getNovelKnowledgeAssetCategoryLabel(
  category: NovelKnowledgeAssetCategory,
): string {
  switch (category) {
    case "world":
      return "世界观";
    case "character":
      return "角色";
    case "foreshadowing":
      return "伏笔";
    case "location":
      return "地点";
    case "faction":
      return "势力";
    case "item":
      return "物品";
    case "term":
      return "术语";
    default:
      return "资产";
  }
}

function buildNovelAssetChangeEventsForDelta(
  beforeAssets: NovelKnowledgeAsset[],
  afterAssets: NovelKnowledgeAsset[],
  delta: NovelChapterAssetDelta,
): NovelAssetChangeEvent[] {
  const now = new Date().toISOString();
  const events: NovelAssetChangeEvent[] = [];
  const chapterLabel = `第 ${delta.chapterNumber} 章《${delta.chapterTitle}》`;

  afterAssets.forEach((asset) => {
    const previous = beforeAssets.find((item) => item.id === asset.id);
    if (!previous) {
      events.push({
        id: `asset-change-${asset.id}-create`,
        action: "create",
        category: asset.category,
        assetId: asset.id,
        label: `${chapterLabel} 新建${getNovelKnowledgeAssetCategoryLabel(asset.category)}`,
        detail: asset.title,
        createdAt: now,
      });
      return;
    }

    if (
      previous.content !== asset.content ||
      previous.status !== asset.status ||
      previous.title !== asset.title
    ) {
      events.push({
        id: `asset-change-${asset.id}-update-${Date.now()}`,
        action:
          previous.status !== "resolved" && asset.status === "resolved"
            ? "resolve"
            : previous.content.includes(asset.content)
              ? "merge"
              : "update",
        category: asset.category,
        assetId: asset.id,
        label: `${chapterLabel} 更新${getNovelKnowledgeAssetCategoryLabel(asset.category)}`,
        detail: asset.title,
        createdAt: now,
      });
    }
  });

  if (events.length === 0 && hasNovelChapterAssetDeltaContent(delta)) {
    events.push({
      id: `asset-change-delta-${delta.chapterNumber}`,
      action: "update",
      label: `${chapterLabel} 资产沉淀`,
      detail: "章节资产增量已写入设定库。",
      createdAt: now,
    });
  }

  return events;
}

export function buildNovelBookExportMarkdown(input: {
  title: string;
  genre?: string;
  premise?: string;
  chapters: StoredNovelChapter[];
}): string {
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0
  );

  return [
    `# ${input.title}`,
    "",
    input.genre ? `题材：${input.genre}` : "",
    input.premise ? `简介：${input.premise}` : "",
    "",
    ...chapters.map((chapter) =>
      [
        `## 第 ${chapter.number} 章 ${chapter.title}`,
        "",
        `状态：${chapter.status}`,
        `发布状态：${chapter.publicationStatus ?? "draft"}`,
        `字数：${chapter.wordCount}`,
        chapter.summary ? `摘要：${chapter.summary}` : "",
        "",
        chapter.content,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ]
    .filter((line, index, lines) =>
      line !== "" || lines[index - 1] !== "" || lines[index + 1] !== ""
    )
    .join("\n");
}

export function buildNovelBookExportText(input: {
  title: string;
  chapters: StoredNovelChapter[];
}): string {
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0
  );

  return [
    input.title,
    "",
    ...chapters.map((chapter) =>
      [`第 ${chapter.number} 章 ${chapter.title}`, "", chapter.content].join("\n"),
    ),
  ].join("\n\n");
}

export function buildNovelChapterExportBundle(
  chapters: StoredNovelChapter[],
): Array<{ filename: string; content: string; type: "markdown" | "text" }> {
  return sortStoredNovelChapters(chapters)
    .filter((chapter) => chapter.content.trim().length > 0)
    .map((chapter) => ({
      filename: `第${chapter.number}章-${sanitizeNovelExportFilename(chapter.title)}.md`,
      content: [
        `# 第 ${chapter.number} 章 ${chapter.title}`,
        "",
        chapter.summary ? `> ${chapter.summary}` : "",
        "",
        chapter.content,
      ]
        .filter(Boolean)
        .join("\n"),
      type: "markdown" as const,
    }));
}

export function buildNovelVolumeExportBundle(input: {
  title: string;
  chapters: StoredNovelChapter[];
  outlineNodes?: NovelOutlineNode[];
}): Array<{ filename: string; content: string; type: "markdown" }> {
  const volumeByChapter = new Map(
    (input.outlineNodes ?? []).map((node) => [
      node.chapterNumber,
      node.volume || `第 ${Math.max(1, Math.ceil(node.chapterNumber / 20))} 卷`,
    ]),
  );
  const groups = sortStoredNovelChapters(input.chapters)
    .filter((chapter) => chapter.content.trim().length > 0)
    .reduce<Record<string, StoredNovelChapter[]>>((result, chapter) => {
      const volume =
        volumeByChapter.get(chapter.number) ??
        `第 ${Math.max(1, Math.ceil(chapter.number / 20))} 卷`;
      result[volume] = [...(result[volume] ?? []), chapter];
      return result;
    }, {});

  return Object.entries(groups).map(([volume, chapters]) => ({
    filename: `${sanitizeNovelExportFilename(volume)}.md`,
    content: [
      `# ${input.title} / ${volume}`,
      "",
      ...chapters.map((chapter) =>
        [`## 第 ${chapter.number} 章 ${chapter.title}`, "", chapter.content].join(
          "\n",
        ),
      ),
    ].join("\n\n"),
    type: "markdown" as const,
  }));
}

export function buildNovelPublishValidationReport(input: {
  title: string;
  platform: NovelPlatformId;
  chapters: StoredNovelChapter[];
  project?: Pick<InkosNovelProject, "premise" | "genre">;
}): NovelPublishValidationReport {
  const issues: NovelPublishValidationIssue[] = [];
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0,
  );
  const profile = getNovelPlatformProfile(input.platform);

  if (!input.title.trim()) {
    issues.push({
      id: "missing-title",
      severity: "error",
      code: "missing-title",
      title: "缺少书名",
      detail: "导出前请先设置书籍标题。",
    });
  }

  if (!input.project?.premise?.trim()) {
    issues.push({
      id: "missing-premise",
      severity: "warning",
      code: "missing-premise",
      title: "缺少作品简介",
      detail: "建议在书籍设定中补充简介，便于平台发布。",
    });
  }

  if (chapters.length === 0) {
    issues.push({
      id: "no-chapters",
      severity: "error",
      code: "no-chapters",
      title: "没有可发布章节",
      detail: "至少需要一章带正文的章节才能导出或发布。",
    });
  }

  chapters.forEach((chapter) => {
    if (!chapter.title.trim()) {
      issues.push({
        id: `chapter-title-${chapter.number}`,
        severity: "error",
        chapterNumber: chapter.number,
        code: "missing-chapter-title",
        title: `第 ${chapter.number} 章缺少标题`,
        detail: "章节标题不能为空。",
      });
    }

    if (chapter.title.trim().length > profile.maxTitleLength) {
      issues.push({
        id: `chapter-title-length-${chapter.number}`,
        severity: "warning",
        chapterNumber: chapter.number,
        code: "chapter-title-too-long",
        title: `第 ${chapter.number} 章标题偏长`,
        detail: `当前 ${chapter.title.trim().length} 字，${profile.label}建议不超过 ${profile.maxTitleLength} 字。`,
      });
    }

    if (chapter.wordCount < profile.minWords) {
      issues.push({
        id: `chapter-words-${chapter.number}`,
        severity: input.platform === "generic" ? "info" : "warning",
        chapterNumber: chapter.number,
        code: "chapter-too-short",
        title: `第 ${chapter.number} 章字数偏少`,
        detail: `当前 ${chapter.wordCount} 字，建议至少 ${profile.minWords} 字。`,
      });
    }

    if (chapter.status !== "approved") {
      issues.push({
        id: `chapter-status-${chapter.number}`,
        severity: "warning",
        chapterNumber: chapter.number,
        code: "chapter-not-approved",
        title: `第 ${chapter.number} 章尚未定稿`,
        detail: `当前状态：${chapter.status}，发布前建议先完成审稿并定稿。`,
      });
    }

    const unresolvedIssues = countUnresolvedNovelReviewIssues(chapter);
    if (unresolvedIssues > 0) {
      issues.push({
        id: `chapter-review-${chapter.number}`,
        severity: "error",
        chapterNumber: chapter.number,
        code: "unresolved-review-issues",
        title: `第 ${chapter.number} 章仍有未解决审稿问题`,
        detail: `还有 ${unresolvedIssues} 条未解决审稿问题，建议先修订后再发布。`,
      });
    }

    if (
      (chapter.publicationStatus ?? "draft") === "draft" &&
      input.platform !== "generic"
    ) {
      issues.push({
        id: `chapter-publish-status-${chapter.number}`,
        severity: "info",
        chapterNumber: chapter.number,
        code: "chapter-not-marked-ready",
        title: `第 ${chapter.number} 章尚未标记待发布`,
        detail: "可在章节编辑器中将发布状态设为「待发布」或「已发布」。",
      });
    }
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const summary =
    errorCount > 0
      ? `${profile.label}发布校验未通过：${errorCount} 个错误，${warningCount} 个警告。`
      : warningCount > 0
        ? `${profile.label}发布校验通过，但有 ${warningCount} 个警告。`
        : `${profile.label}发布校验通过，共 ${chapters.length} 章可发布。`;

  return {
    platform: input.platform,
    canPublish: errorCount === 0,
    errorCount,
    warningCount,
    issues,
    summary,
  };
}

function countUnresolvedNovelReviewIssues(chapter: StoredNovelChapter): number {
  const review =
    chapter.reviews?.find((item) => item.id === chapter.activeReviewId) ??
    chapter.reviews?.[0];

  if (!review) {
    return 0;
  }

  return review.issues.filter((issue) => !issue.resolved).length;
}

export function buildNovelPlatformExportText(input: {
  title: string;
  platform: NovelPlatformId;
  chapters: StoredNovelChapter[];
  genre?: string;
  premise?: string;
}): string {
  const profile = getNovelPlatformProfile(input.platform);
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0,
  );

  return [
    `作品名：${input.title}`,
    input.genre ? `题材：${input.genre}` : "",
    input.premise ? `简介：${input.premise}` : "",
    `导出格式：${profile.exportLabel}`,
    `章节数：${chapters.length}`,
    "",
    ...chapters.map((chapter) =>
      [
        buildNovelPlatformChapterHeading(input.platform, chapter),
        input.platform === "jjwxc" && chapter.summary
          ? `摘要：${chapter.summary}`
          : "",
        "",
        chapter.content.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildNovelPlatformChapterHeading(
  platform: NovelPlatformId,
  chapter: Pick<StoredNovelChapter, "number" | "title" | "wordCount">,
): string {
  switch (platform) {
    case "fanqie":
    case "feilu":
      return `第${chapter.number}章 ${chapter.title}`;
    case "jjwxc":
      return `${chapter.title}`;
    default:
      return `第 ${chapter.number} 章 ${chapter.title}`;
  }
}

export function buildNovelPlatformExportBundle(input: {
  title: string;
  platform: NovelPlatformId;
  chapters: StoredNovelChapter[];
}): Array<{ filename: string; content: string; type: "text" }> {
  return sortStoredNovelChapters(input.chapters)
    .filter((chapter) => chapter.content.trim().length > 0)
    .map((chapter) => ({
      filename: `${sanitizeNovelExportFilename(
        buildNovelPlatformChapterHeading(input.platform, chapter),
      )}.txt`,
      content: [
        buildNovelPlatformChapterHeading(input.platform, chapter),
        "",
        chapter.content.trim(),
      ].join("\n"),
      type: "text" as const,
    }));
}

export function buildNovelPublishManifest(input: {
  title: string;
  genre?: string;
  premise?: string;
  platform: NovelPlatformId;
  chapters: StoredNovelChapter[];
  validation?: NovelPublishValidationReport;
}): string {
  const profile = getNovelPlatformProfile(input.platform);
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0,
  );
  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  return [
    `# ${input.title} 发布清单`,
    "",
    `- 平台：${profile.label}`,
    `- 题材：${input.genre || "未填写"}`,
    `- 简介：${input.premise || "未填写"}`,
    `- 章节数：${chapters.length}`,
    `- 总字数：${totalWords}`,
    input.validation
      ? `- 校验：${input.validation.summary}`
      : "",
    "",
    "## 章节列表",
    "",
    "| 章 | 标题 | 字数 | 章节状态 | 发布状态 |",
    "| --- | --- | ---: | --- | --- |",
    ...chapters.map(
      (chapter) =>
        `| ${chapter.number} | ${chapter.title} | ${chapter.wordCount} | ${chapter.status} | ${chapter.publicationStatus ?? "draft"} |`,
    ),
    "",
    "## 待处理项",
    "",
    ...(input.validation?.issues.length
      ? input.validation.issues.map(
          (issue) =>
            `- [${issue.severity}] ${issue.title}${issue.chapterNumber ? `（第 ${issue.chapterNumber} 章）` : ""}：${issue.detail}`,
        )
      : ["- 无"]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildNovelBookExportJson(input: {
  title: string;
  genre?: string;
  premise?: string;
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters: StoredNovelChapter[];
}): string {
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0,
  );

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      title: input.title,
      genre: input.genre,
      premise: input.premise,
      project: input.project,
      assets: input.assets,
      chapters,
      stats: {
        chapterCount: chapters.length,
        totalWords: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
      },
    },
    null,
    2,
  );
}

export function getNovelPlatformProfile(platform: NovelPlatformId): {
  label: string;
  exportLabel: string;
  minWords: number;
  maxTitleLength: number;
} {
  switch (platform) {
    case "qidian":
      return {
        label: "起点",
        exportLabel: "起点格式",
        minWords: 1500,
        maxTitleLength: 40,
      };
    case "fanqie":
      return {
        label: "番茄",
        exportLabel: "番茄格式",
        minWords: 800,
        maxTitleLength: 30,
      };
    case "zongheng":
      return {
        label: "纵横",
        exportLabel: "纵横格式",
        minWords: 1400,
        maxTitleLength: 35,
      };
    case "jjwxc":
      return {
        label: "晋江",
        exportLabel: "晋江格式",
        minWords: 1000,
        maxTitleLength: 20,
      };
    case "feilu":
      return {
        label: "飞卢",
        exportLabel: "飞卢格式",
        minWords: 900,
        maxTitleLength: 35,
      };
    default:
      return {
        label: "通用",
        exportLabel: "通用格式",
        minWords: 500,
        maxTitleLength: 40,
      };
  }
}

export function appendNovelPublicationEvent(
  assets: NovelProjectAssets,
  event: Omit<NovelPublicationEvent, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): NovelProjectAssets {
  const entry: NovelPublicationEvent = {
    id: event.id ?? `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: event.createdAt ?? new Date().toISOString(),
    ...event,
  };

  return {
    ...assets,
    publicationEvents: [entry, ...(assets.publicationEvents ?? [])].slice(0, 100),
  };
}

export function buildNovelPublicationTimeline(
  assets: Pick<NovelProjectAssets, "publicationEvents">,
  chapters: StoredNovelChapter[],
): Array<{
  id: string;
  label: string;
  detail: string;
  createdAt: string;
}> {
  const chapterEvents = sortStoredNovelChapters(chapters)
    .filter((chapter) => chapter.publishedAt)
    .map((chapter) => ({
      id: `chapter-published-${chapter.id}`,
      label: `第 ${chapter.number} 章《${chapter.title}》已发布`,
      detail: chapter.publishedAt ?? "",
      createdAt: chapter.publishedAt ?? chapter.updatedAt,
    }));
  const assetEvents = (assets.publicationEvents ?? []).map((event) => ({
    id: event.id,
    label:
      event.action === "exported"
        ? `导出${event.platform ? ` · ${event.platform}` : ""}`
        : event.action === "marked-ready"
          ? `标记待发布${event.chapterNumber ? ` · 第 ${event.chapterNumber} 章` : ""}`
          : `标记已发布${event.chapterNumber ? ` · 第 ${event.chapterNumber} 章` : ""}`,
    detail: event.note ?? event.chapterTitle ?? "",
    createdAt: event.createdAt,
  }));

  return [...assetEvents, ...chapterEvents].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function buildNovelPublicationTimelineMarkdown(input: {
  title: string;
  assets: Pick<NovelProjectAssets, "publicationEvents">;
  chapters: StoredNovelChapter[];
}): string {
  const timeline = buildNovelPublicationTimeline(input.assets, input.chapters);

  return [
    `# ${input.title} 发布记录`,
    "",
    `导出时间：${new Date().toISOString()}`,
    `记录数：${timeline.length}`,
    "",
    ...timeline.map(
      (entry) =>
        `- ${entry.createdAt} · ${entry.label}${entry.detail ? `（${entry.detail}）` : ""}`,
    ),
  ].join("\n");
}

export function buildNovelDocxDocumentModel(input: {
  title: string;
  genre?: string;
  premise?: string;
  chapters: StoredNovelChapter[];
}): NovelDocxParagraph[] {
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0,
  );
  const paragraphs: NovelDocxParagraph[] = [
    { style: "title", text: input.title.trim() || "未命名作品" },
  ];

  if (input.genre?.trim()) {
    paragraphs.push({ style: "subtitle", text: `题材：${input.genre.trim()}` });
  }

  if (input.premise?.trim()) {
    paragraphs.push({ style: "subtitle", text: input.premise.trim() });
  }

  chapters.forEach((chapter) => {
    paragraphs.push({
      style: "chapter-heading",
      text: `第 ${chapter.number} 章 ${chapter.title}`,
    });

    if (chapter.summary.trim()) {
      paragraphs.push({ style: "subtitle", text: chapter.summary.trim() });
    }

    chapter.content
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .forEach((paragraph) => {
        paragraphs.push({ style: "body", text: paragraph.replace(/\n/g, " ") });
      });
  });

  return paragraphs;
}

export function buildNovelCreationLogExportMarkdown(input: {
  bookTitle: string;
  tasks: StoredNovelTask[];
}): string {
  const tasks = [...input.tasks].sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );

  return [
    `# ${input.bookTitle} 创作日志`,
    "",
    `导出时间：${new Date().toISOString()}`,
    `任务数：${tasks.length}`,
    "",
    ...tasks.map((task) =>
      [
        `## ${task.label}`,
        "",
        `状态：${task.status}`,
        `动作：${task.action}`,
        `开始：${task.startedAt}`,
        task.endedAt ? `结束：${task.endedAt}` : "",
        task.targetChapterNumber
          ? `章节：第 ${task.targetChapterNumber} 章 ${task.targetChapterTitle ?? ""}`
          : "",
        task.errorMessage ? `错误：${task.errorMessage}` : "",
        "",
        "### 日志",
        task.logs.length > 0
          ? task.logs
              .map((log) => `- ${log.createdAt} ${log.message}`)
              .join("\n")
          : "暂无日志。",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
}

export function applyNovelReviewIssueSuggestionToContent(
  content: string,
  issue: NovelChapterReviewIssueView,
): {
  applied: boolean;
  content: string;
  paragraphIndex: number;
  reason?: string;
} {
  const suggestion = issue.suggestion?.trim();

  if (!suggestion) {
    return {
      applied: false,
      content,
      paragraphIndex: -1,
      reason: "这个问题没有可应用的修改建议。",
    };
  }

  const location = findNovelReviewIssueParagraph(content, issue);

  if (!location) {
    return {
      applied: false,
      content,
      paragraphIndex: -1,
      reason: "没有定位到可替换段落。",
    };
  }

  const paragraphs = content.replace(/\r\n/g, "\n").split(/\n{2,}/);
  let matchedIndex = -1;
  let seenContentParagraph = -1;
  const nextParagraphs = paragraphs.map((paragraph) => {
    if (!paragraph.trim()) return paragraph;
    seenContentParagraph += 1;
    if (seenContentParagraph === location.index) {
      matchedIndex = seenContentParagraph;
      return suggestion;
    }
    return paragraph;
  });

  if (matchedIndex < 0) {
    return {
      applied: false,
      content,
      paragraphIndex: -1,
      reason: "定位结果已过期。",
    };
  }

  return {
    applied: true,
    content: nextParagraphs.join("\n\n"),
    paragraphIndex: matchedIndex,
  };
}

export function buildNovelWorkspaceBackupPayload(
  snapshot: NovelWorkspaceSnapshot,
  modelSettings?: {
    providers?: Array<{
      id: string;
      name: string;
      apiKey?: string;
      models?: string[];
    }>;
  },
): NovelWorkspaceBackupPayload {
  const sessions = Object.values(snapshot.sessionsByBookId).flat();
  const messages = Object.values(snapshot.messagesBySessionId).flat();
  const chapters = Object.values(snapshot.chaptersByBookId).flat();
  const chapterVersions = Object.values(
    snapshot.chapterVersionsByChapterId,
  ).flat();
  const tasks = Object.values(snapshot.tasksByBookId).flat();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "sxy-creative-studio",
    modelSettings: {
      providers: (modelSettings?.providers ?? []).map((provider) => ({
        id: provider.id,
        name: provider.name,
        hasApiKey: Boolean(provider.apiKey),
        models: provider.models ?? [],
      })),
    },
    books: snapshot.books,
    sessions,
    messages,
    chapters,
    chapterVersions,
    tasks,
  };
}

export function parseNovelWorkspaceBackupPayload(
  raw: string,
): NovelWorkspaceBackupPayload {
  const payload = JSON.parse(raw) as Partial<NovelWorkspaceBackupPayload>;

  if (payload.version !== 1 || payload.app !== "sxy-creative-studio") {
    throw new Error("备份文件格式不正确。");
  }

  const requiredArrays = [
    payload.books,
    payload.sessions,
    payload.messages,
    payload.chapters,
    payload.chapterVersions,
    payload.tasks,
  ];

  if (requiredArrays.some((items) => !Array.isArray(items))) {
    throw new Error("备份文件数据不完整。");
  }

  return {
    version: 1,
    exportedAt: payload.exportedAt ?? new Date().toISOString(),
    app: "sxy-creative-studio",
    modelSettings: {
      providers: Array.isArray(payload.modelSettings?.providers)
        ? payload.modelSettings.providers.map((provider) => ({
            id: String(provider.id),
            name: String(provider.name),
            hasApiKey: Boolean(provider.hasApiKey),
            models: Array.isArray(provider.models)
              ? provider.models.map(String)
              : [],
          }))
        : [],
    },
    books: payload.books!.map(normalizeStoredNovelBook),
    sessions: payload.sessions!.map(normalizeStoredNovelSession),
    messages: payload.messages!,
    chapters: payload.chapters!.map(normalizeStoredNovelChapter),
    chapterVersions: payload.chapterVersions!.map(
      normalizeStoredNovelChapterVersion,
    ),
    tasks: payload.tasks!,
  };
}

export function computeNovelWorkspaceFingerprint(
  payload: Pick<
    NovelWorkspaceBackupPayload,
    | "books"
    | "sessions"
    | "messages"
    | "chapters"
    | "chapterVersions"
    | "tasks"
  >,
): string {
  const parts = [
    ...payload.books.map((book) => `book:${book.id}:${book.updatedAt}`),
    ...payload.sessions.map(
      (session) => `session:${session.id}:${session.updatedAt}`,
    ),
    ...payload.messages.map(
      (message) => `message:${message.id}:${message.createdAt}`,
    ),
    ...payload.chapters.map(
      (chapter) => `chapter:${chapter.id}:${chapter.updatedAt}`,
    ),
    ...payload.chapterVersions.map(
      (version) => `version:${version.id}:${version.createdAt}`,
    ),
    ...payload.tasks.map(
      (task) => `task:${task.id}:${task.endedAt ?? task.startedAt}`,
    ),
  ].sort();

  return parts.join("|");
}

export function createDefaultNovelCloudSyncState(): NovelCloudSyncState {
  return {
    deviceId: `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deviceLabel:
      typeof navigator !== "undefined"
        ? navigator.platform || "本地设备"
        : "本地设备",
  };
}

export function loadNovelCloudSyncState(): NovelCloudSyncState {
  if (typeof localStorage === "undefined") {
    return createDefaultNovelCloudSyncState();
  }

  try {
    const raw = localStorage.getItem(NOVEL_CLOUD_SYNC_STORAGE_KEY);

    if (!raw) {
      return createDefaultNovelCloudSyncState();
    }

    const parsed = JSON.parse(raw) as Partial<NovelCloudSyncState>;

    if (!parsed.deviceId) {
      return createDefaultNovelCloudSyncState();
    }

    return {
      deviceId: parsed.deviceId,
      deviceLabel: parsed.deviceLabel ?? "本地设备",
      lastExportedAt: parsed.lastExportedAt,
      lastImportedAt: parsed.lastImportedAt,
      lastMergeAt: parsed.lastMergeAt,
      lastRemoteFingerprint: parsed.lastRemoteFingerprint,
      lastWebDavUploadAt: parsed.lastWebDavUploadAt,
      lastWebDavDownloadAt: parsed.lastWebDavDownloadAt,
    };
  } catch {
    return createDefaultNovelCloudSyncState();
  }
}

export function createDefaultNovelCloudSyncWebDavSettings(): NovelCloudSyncWebDavSettings {
  return {
    url: "",
    remotePath: "sxy-cloud-sync.json",
    username: "",
    password: "",
  };
}

export function loadNovelCloudSyncWebDavSettings(): NovelCloudSyncWebDavSettings {
  if (typeof localStorage === "undefined") {
    return createDefaultNovelCloudSyncWebDavSettings();
  }

  try {
    const raw = localStorage.getItem(NOVEL_CLOUD_SYNC_WEBDAV_STORAGE_KEY);

    if (!raw) {
      return createDefaultNovelCloudSyncWebDavSettings();
    }

    const parsed = JSON.parse(raw) as Partial<NovelCloudSyncWebDavSettings>;

    return {
      url: parsed.url ?? "",
      remotePath: parsed.remotePath ?? "sxy-cloud-sync.json",
      username: parsed.username ?? "",
      password: parsed.password ?? "",
    };
  } catch {
    return createDefaultNovelCloudSyncWebDavSettings();
  }
}

export function saveNovelCloudSyncWebDavSettings(
  settings: NovelCloudSyncWebDavSettings,
): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(
    NOVEL_CLOUD_SYNC_WEBDAV_STORAGE_KEY,
    JSON.stringify(settings),
  );
}

export function saveNovelCloudSyncState(state: NovelCloudSyncState): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(NOVEL_CLOUD_SYNC_STORAGE_KEY, JSON.stringify(state));
}

export function buildNovelCloudSyncPackage(
  snapshot: NovelWorkspaceSnapshot,
  input: {
    deviceId: string;
    deviceLabel: string;
    modelSettings?: Parameters<typeof buildNovelWorkspaceBackupPayload>[1];
  },
): NovelCloudSyncPackage {
  const base = buildNovelWorkspaceBackupPayload(snapshot, input.modelSettings);

  return {
    ...base,
    syncVersion: 1,
    deviceId: input.deviceId,
    deviceLabel: input.deviceLabel,
    fingerprint: computeNovelWorkspaceFingerprint(base),
  };
}

export function parseNovelCloudSyncPackage(raw: string): NovelCloudSyncPackage {
  const parsed = JSON.parse(raw) as Partial<NovelCloudSyncPackage>;
  const base = parseNovelWorkspaceBackupPayload(raw);

  if (parsed.syncVersion !== 1 || !parsed.deviceId || !parsed.fingerprint) {
    throw new Error("同步文件格式不正确。");
  }

  return {
    ...base,
    syncVersion: 1,
    deviceId: String(parsed.deviceId),
    deviceLabel: String(parsed.deviceLabel ?? "未知设备"),
    fingerprint: String(parsed.fingerprint),
  };
}

type NovelWorkspaceMergeEntityType =
  NovelWorkspaceMergeConflict["entityType"];

function mergeNovelWorkspaceEntityGroup<T extends { id: string }>(input: {
  entityType: NovelWorkspaceMergeEntityType;
  localItems: T[];
  remoteItems: T[];
  getTimestamp: (item: T) => string;
  getLabel: (item: T) => string;
  resolutions?: Record<string, "local" | "remote">;
}): {
  items: T[];
  conflicts: NovelWorkspaceMergeConflict[];
  autoMerged: number;
} {
  const localMap = new Map(input.localItems.map((item) => [item.id, item]));
  const remoteMap = new Map(input.remoteItems.map((item) => [item.id, item]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const items: T[] = [];
  const conflicts: NovelWorkspaceMergeConflict[] = [];
  let autoMerged = 0;

  allIds.forEach((entityId) => {
    const localItem = localMap.get(entityId);
    const remoteItem = remoteMap.get(entityId);

    if (localItem && !remoteItem) {
      items.push(localItem);
      return;
    }

    if (!localItem && remoteItem) {
      items.push(remoteItem);
      autoMerged += 1;
      return;
    }

    if (!localItem || !remoteItem) {
      return;
    }

    const localUpdatedAt = input.getTimestamp(localItem);
    const remoteUpdatedAt = input.getTimestamp(remoteItem);
    const sameSnapshot =
      localUpdatedAt === remoteUpdatedAt ||
      JSON.stringify(localItem) === JSON.stringify(remoteItem);

    if (sameSnapshot) {
      items.push(localItem);
      return;
    }

    const localNewer =
      Date.parse(localUpdatedAt) >= Date.parse(remoteUpdatedAt);
    const resolution =
      input.resolutions?.[entityId] ?? (localNewer ? "local" : "remote");

    conflicts.push({
      id: `${input.entityType}-${entityId}`,
      entityType: input.entityType,
      entityId,
      label: input.getLabel(localItem),
      localUpdatedAt,
      remoteUpdatedAt,
      resolution,
    });
    autoMerged += 1;
    items.push(resolution === "local" ? localItem : remoteItem);
  });

  return { items, conflicts, autoMerged };
}

export function mergeNovelWorkspacePayloads(
  local: NovelWorkspaceBackupPayload,
  remote: NovelWorkspaceBackupPayload,
  resolutions?: Record<string, "local" | "remote">,
): NovelWorkspaceMergeReport {
  const books = mergeNovelWorkspaceEntityGroup({
    entityType: "book",
    localItems: local.books,
    remoteItems: remote.books,
    getTimestamp: (item) => item.updatedAt,
    getLabel: (item) => item.title,
    resolutions,
  });
  const sessions = mergeNovelWorkspaceEntityGroup({
    entityType: "session",
    localItems: local.sessions,
    remoteItems: remote.sessions,
    getTimestamp: (item) => item.updatedAt,
    getLabel: (item) => item.title,
    resolutions,
  });
  const messages = mergeNovelWorkspaceEntityGroup({
    entityType: "message",
    localItems: local.messages,
    remoteItems: remote.messages,
    getTimestamp: (item) => item.createdAt,
    getLabel: (item) => `${item.role} · ${item.content.slice(0, 24)}`,
    resolutions,
  });
  const chapters = mergeNovelWorkspaceEntityGroup({
    entityType: "chapter",
    localItems: local.chapters,
    remoteItems: remote.chapters,
    getTimestamp: (item) => item.updatedAt,
    getLabel: (item) => `第 ${item.number} 章 ${item.title}`,
    resolutions,
  });
  const chapterVersions = mergeNovelWorkspaceEntityGroup({
    entityType: "chapterVersion",
    localItems: local.chapterVersions,
    remoteItems: remote.chapterVersions,
    getTimestamp: (item) => item.createdAt,
    getLabel: (item) => `版本 ${item.number} · ${item.title}`,
    resolutions,
  });
  const tasks = mergeNovelWorkspaceEntityGroup({
    entityType: "task",
    localItems: local.tasks,
    remoteItems: remote.tasks,
    getTimestamp: (item) => item.endedAt ?? item.startedAt,
    getLabel: (item) => item.label,
    resolutions,
  });
  const autoMerged =
    books.autoMerged +
    sessions.autoMerged +
    messages.autoMerged +
    chapters.autoMerged +
    chapterVersions.autoMerged +
    tasks.autoMerged;
  const conflicts = [
    ...books.conflicts,
    ...sessions.conflicts,
    ...messages.conflicts,
    ...chapters.conflicts,
    ...chapterVersions.conflicts,
    ...tasks.conflicts,
  ];
  const merged: NovelWorkspaceBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "sxy-creative-studio",
    modelSettings: local.modelSettings,
    books: books.items,
    sessions: sessions.items,
    messages: messages.items,
    chapters: chapters.items,
    chapterVersions: chapterVersions.items,
    tasks: tasks.items,
  };
  const summary =
    conflicts.length > 0
      ? `合并完成：自动合并 ${autoMerged} 项，${conflicts.length} 项存在版本冲突（默认保留较新版本）。`
      : `合并完成：自动合并 ${autoMerged} 项，未发现冲突。`;

  return {
    autoMerged,
    conflicts,
    merged,
    summary,
  };
}

export async function importNovelWorkspaceMerge(
  payload: NovelWorkspaceBackupPayload,
): Promise<void> {
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [
        BOOKS_STORE,
        SESSIONS_STORE,
        MESSAGES_STORE,
        CHAPTERS_STORE,
        CHAPTER_VERSIONS_STORE,
        TASKS_STORE,
      ],
      "readwrite",
    );

    payload.books.forEach((book) => {
      transaction.objectStore(BOOKS_STORE).put(book);
    });
    payload.sessions.forEach((session) => {
      transaction.objectStore(SESSIONS_STORE).put(session);
    });
    payload.messages.forEach((message) => {
      transaction.objectStore(MESSAGES_STORE).put(message);
    });
    payload.chapters.forEach((chapter) => {
      transaction.objectStore(CHAPTERS_STORE).put(chapter);
    });
    payload.chapterVersions.forEach((version) => {
      transaction.objectStore(CHAPTER_VERSIONS_STORE).put(version);
    });
    payload.tasks.forEach((task) => {
      transaction.objectStore(TASKS_STORE).put(task);
    });

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function exportNovelCloudSyncPackage(
  input: {
    deviceId: string;
    deviceLabel: string;
    modelSettings?: Parameters<typeof buildNovelWorkspaceBackupPayload>[1];
  },
): Promise<NovelCloudSyncPackage> {
  const snapshot = await loadNovelWorkspace();

  return buildNovelCloudSyncPackage(snapshot, input);
}

export function recoverInterruptedNovelTasks(
  tasks: StoredNovelTask[],
): StoredNovelTask[] {
  return tasks.map((task) => {
    if (task.status !== "running") {
      return task;
    }

    const now = new Date().toISOString();
    const message = "页面刷新或异常中断，任务已标记为可重试。";

    return {
      ...task,
      status: "error",
      errorMessage: "页面刷新或异常中断，任务没有完成，可以点击重试。",
      endedAt: task.endedAt ?? now,
      logs: [
        ...task.logs,
        {
          id: `log-recovered-${Date.now()}-${task.logs.length + 1}`,
          message,
          createdAt: now,
        },
      ],
    };
  });
}

export function buildNovelRecoverableErrorNotice(
  error: unknown,
): NovelRecoverableErrorNotice {
  const isAbortError =
    error instanceof DOMException && error.name === "AbortError";
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "InkOS Core 执行失败，请检查模型配置。";
  const normalized = detail.toLowerCase();

  if (isAbortError || normalized.includes("abort")) {
    return {
      category: "cancelled",
      title: "任务已取消",
      detail: "本次 Agent 调用已被取消，未写入新的生成结果。",
      recoveryAction: "需要继续时，请重新发起同一个任务。",
      canRetry: false,
    };
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("apikey") ||
    normalized.includes("unauthorized") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return {
      category: "auth",
      title: "模型授权失败",
      detail,
      recoveryAction: "检查当前模型服务商的 API Key、Base URL 和启用状态，然后点击重试任务。",
      canRetry: true,
    };
  }

  if (
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("quota")
  ) {
    return {
      category: "rate-limit",
      title: "模型调用被限流",
      detail,
      recoveryAction: "稍后重试，或临时切换到其他可用模型后重试任务。",
      canRetry: true,
    };
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("超时")
  ) {
    return {
      category: "timeout",
      title: "模型响应超时",
      detail,
      recoveryAction: "可以直接重试；如果反复超时，建议缩短上下文或切换更稳定的模型。",
      canRetry: true,
    };
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("econn") ||
    normalized.includes("enotfound")
  ) {
    return {
      category: "network",
      title: "网络或服务连接失败",
      detail,
      recoveryAction: "确认本地网络、代理和模型服务地址可访问，然后点击重试任务。",
      canRetry: true,
    };
  }

  if (
    normalized.includes("请先") ||
    normalized.includes("不存在") ||
    normalized.includes("无法执行")
  ) {
    return {
      category: "validation",
      title: "任务前置条件未满足",
      detail,
      recoveryAction: "按提示补齐章节、会话或书籍状态后，再重新执行任务。",
      canRetry: true,
    };
  }

  return {
    category: "unknown",
    title: "Agent 调用失败",
    detail,
    recoveryAction: "可以先点击重试任务；如果再次失败，请检查模型配置和任务日志中的最近进度。",
    canRetry: true,
  };
}

export function syncNovelProjectChapterPlan(
  project: InkosNovelProject,
  chapter: {
    number: number;
    title: string;
    summary?: string;
    status: InkosChapterStatus;
    wordCount?: number;
  },
): InkosNovelProject {
  const existing = project.chapters.find((item) => item.number === chapter.number);
  const nextChapter: InkosChapter = {
    number: chapter.number,
    title: chapter.title || existing?.title || `第 ${chapter.number} 章`,
    status: chapter.status,
    targetWords:
      chapter.wordCount && chapter.wordCount > 0
        ? chapter.wordCount
        : existing?.targetWords ?? project.chapterWordCount ?? 3000,
    focus: chapter.summary || existing?.focus || "等待补充章节摘要。",
  };
  const chapters = existing
    ? project.chapters.map((item) =>
        item.number === chapter.number ? nextChapter : item,
      )
    : [...project.chapters, nextChapter];

  return {
    ...project,
    chapters: chapters.sort((left, right) => left.number - right.number),
    currentStage:
      project.currentStage === "foundation" || project.currentStage === "outline"
        ? "chapter-plan"
        : project.currentStage,
  };
}

export function buildDefaultNovelContextSelection(
  project: Pick<InkosNovelProject, "chapterWordCount">,
): NovelContextSelection {
  return {
    includeOutline: true,
    includePreviousSummary: true,
    includeWorld: true,
    includeCharacters: true,
    includeForeshadowing: true,
    includeReviewIssues: true,
    targetWords: project.chapterWordCount ?? 3000,
    viewpoint: "第三人称有限视角",
    pacing: "每章至少推进一个冲突或信息增量。",
    highlights: "",
    bannedWords: "",
    styleConstraints: "",
    thrillPoints: "",
  };
}

export function buildNovelOutlineNodesFromProject(
  project: Pick<InkosNovelProject, "chapters" | "chapterWordCount">,
): NovelOutlineNode[] {
  const now = new Date().toISOString();

  return [...(project.chapters ?? [])]
    .sort((left, right) => left.number - right.number)
    .map((chapter) => ({
      id: `outline-${chapter.number}`,
      volume: `第 ${Math.max(1, Math.ceil(chapter.number / 20))} 卷`,
      chapterNumber: chapter.number,
      title: chapter.title || `第 ${chapter.number} 章`,
      goal: chapter.focus || "推进主线。",
      conflict: "",
      characters: "",
      information: chapter.focus || "",
      foreshadowing: "",
      targetWords: chapter.targetWords ?? project.chapterWordCount ?? 3000,
      status: chapter.status,
      updatedAt: now,
    }));
}

export function syncNovelProjectFromOutlineNodes(
  project: InkosNovelProject,
  outlineNodes: NovelOutlineNode[],
): InkosNovelProject {
  const chapters = [...outlineNodes]
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
    .map((node) => ({
      number: node.chapterNumber,
      title: node.title || `第 ${node.chapterNumber} 章`,
      status: node.status,
      targetWords: node.targetWords || project.chapterWordCount || 3000,
      focus: [
        node.goal ? `目标：${node.goal}` : "",
        node.conflict ? `冲突：${node.conflict}` : "",
        node.characters ? `角色：${node.characters}` : "",
        node.information ? `信息增量：${node.information}` : "",
        node.foreshadowing ? `伏笔：${node.foreshadowing}` : "",
      ]
        .filter(Boolean)
        .join("；") || "等待补充章节计划。",
    }));

  return {
    ...project,
    chapters,
    currentStage: "chapter-plan",
  };
}

export type NovelOutlineVolumeGroup = {
  volume: string;
  nodes: NovelOutlineNode[];
};

export type NovelOutlineSyncDriftReport = {
  hasDrift: boolean;
  outlineCount: number;
  projectChapterCount: number;
  missingInOutline: number[];
  missingInProject: number[];
  statusMismatches: Array<{
    chapterNumber: number;
    outlineStatus: InkosChapterStatus;
    projectStatus: InkosChapterStatus;
  }>;
  message: string;
};

export function groupNovelOutlineNodesByVolume(
  outlineNodes: NovelOutlineNode[],
): NovelOutlineVolumeGroup[] {
  const sorted = [...outlineNodes].sort(
    (left, right) => left.chapterNumber - right.chapterNumber,
  );
  const groups = new Map<string, NovelOutlineNode[]>();

  for (const node of sorted) {
    const volume = node.volume.trim() || "未分卷";
    const bucket = groups.get(volume) ?? [];
    bucket.push(node);
    groups.set(volume, bucket);
  }

  return Array.from(groups.entries()).map(([volume, nodes]) => ({
    volume,
    nodes,
  }));
}

export function renumberNovelOutlineNodes(
  outlineNodes: NovelOutlineNode[],
): NovelOutlineNode[] {
  return renumberNovelOutlineNodesInOrder(
    [...outlineNodes].sort(
      (left, right) => left.chapterNumber - right.chapterNumber,
    ),
  );
}

function renumberNovelOutlineNodesInOrder(
  outlineNodes: NovelOutlineNode[],
): NovelOutlineNode[] {
  const now = new Date().toISOString();

  return outlineNodes.map((node, index) => ({
    ...node,
    chapterNumber: index + 1,
    updatedAt: now,
  }));
}

export function moveNovelOutlineNode(
  outlineNodes: NovelOutlineNode[],
  nodeId: string,
  direction: "up" | "down",
): NovelOutlineNode[] {
  const sorted = [...outlineNodes].sort(
    (left, right) => left.chapterNumber - right.chapterNumber,
  );
  const index = sorted.findIndex((node) => node.id === nodeId);

  if (index < 0) {
    return outlineNodes;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= sorted.length) {
    return outlineNodes;
  }

  const next = [...sorted];
  const current = next[index];
  const swap = next[targetIndex];

  if (!current || !swap) {
    return outlineNodes;
  }

  next[index] = swap;
  next[targetIndex] = current;

  return renumberNovelOutlineNodesInOrder(next);
}

export function reorderNovelOutlineNodes(
  outlineNodes: NovelOutlineNode[],
  fromIndex: number,
  toIndex: number,
): NovelOutlineNode[] {
  const sorted = [...outlineNodes].sort(
    (left, right) => left.chapterNumber - right.chapterNumber,
  );

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sorted.length ||
    toIndex >= sorted.length ||
    fromIndex === toIndex
  ) {
    return outlineNodes;
  }

  const next = [...sorted];
  const [moved] = next.splice(fromIndex, 1);

  if (!moved) {
    return outlineNodes;
  }

  next.splice(toIndex, 0, moved);
  return renumberNovelOutlineNodesInOrder(next);
}

const OUTLINE_TEXT_CHAPTER_PATTERN =
  /^(?:#{1,3}\s*)?(?:第\s*(\d+)\s*章|chapter\s*(\d+)|(\d+)[.、:：)]\s*)(.*)$/i;

const OUTLINE_TEXT_VOLUME_PATTERN =
  /^(?:#{1,3}\s*)?(?:第\s*([^\s卷]+)\s*卷|volume\s*([^\s]+))(.*)$/i;

export function buildNovelOutlineNodesFromOutlineText(
  text: string,
  options?: {
    startChapter?: number;
    defaultTargetWords?: number;
    defaultVolume?: string;
  },
): NovelOutlineNode[] {
  const now = new Date().toISOString();
  const defaultTargetWords = options?.defaultTargetWords ?? 3000;
  let currentVolume = options?.defaultVolume ?? "第一卷";
  let chapterNumber = options?.startChapter ?? 1;
  const nodes: NovelOutlineNode[] = [];

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const volumeMatch = line.match(OUTLINE_TEXT_VOLUME_PATTERN);

    if (volumeMatch) {
      const volumeLabel = volumeMatch[1] ?? volumeMatch[2] ?? "一";
      currentVolume = `第 ${volumeLabel} 卷`;
      continue;
    }

    const chapterMatch = line.match(OUTLINE_TEXT_CHAPTER_PATTERN);

    if (!chapterMatch) {
      continue;
    }

    const parsedNumber = Number(
      chapterMatch[1] ?? chapterMatch[2] ?? chapterMatch[3],
    );
    const remainder = (chapterMatch[4] ?? "").trim();
    const [titlePart, ...goalParts] = remainder.split(/[:：]/);
    const title = titlePart?.trim() || `第 ${parsedNumber || chapterNumber} 章`;
    const goal = goalParts.join("：").trim();

    nodes.push({
      id: `outline-import-${Date.now()}-${chapterNumber}`,
      volume: currentVolume,
      chapterNumber: Number.isFinite(parsedNumber) ? parsedNumber : chapterNumber,
      title,
      goal: goal || "推进主线并制造新的悬念。",
      conflict: "",
      characters: "",
      information: goal || "",
      foreshadowing: "",
      targetWords: defaultTargetWords,
      status: "planned",
      updatedAt: now,
    });
    chapterNumber = Number.isFinite(parsedNumber) ? parsedNumber + 1 : chapterNumber + 1;
  }

  return renumberNovelOutlineNodes(nodes);
}

export function syncNovelOutlineNodesFromChapters(
  outlineNodes: NovelOutlineNode[],
  chapters: StoredNovelChapter[],
  project: Pick<InkosNovelProject, "chapterWordCount">,
): NovelOutlineNode[] {
  const now = new Date().toISOString();
  const chapterByNumber = new Map(
    sortStoredNovelChapters(chapters).map((chapter) => [chapter.number, chapter]),
  );
  const existingNumbers = new Set(outlineNodes.map((node) => node.chapterNumber));
  const synced = outlineNodes.map((node) => {
    const chapter = chapterByNumber.get(node.chapterNumber);

    if (!chapter) {
      return node;
    }

    return {
      ...node,
      title: chapter.title || node.title,
      status: chapter.status,
      updatedAt: now,
    };
  });

  const appended = sortStoredNovelChapters(chapters)
    .filter((chapter) => !existingNumbers.has(chapter.number))
    .map((chapter) => ({
      id: `outline-${chapter.id}`,
      volume: `第 ${Math.max(1, Math.ceil(chapter.number / 20))} 卷`,
      chapterNumber: chapter.number,
      title: chapter.title || `第 ${chapter.number} 章`,
      goal: chapter.summary || "推进主线。",
      conflict: "",
      characters: "",
      information: chapter.summary || "",
      foreshadowing: "",
      targetWords: project.chapterWordCount ?? 3000,
      status: chapter.status,
      updatedAt: now,
    }));

  return renumberNovelOutlineNodes([...synced, ...appended]);
}

export function buildNovelOutlineSyncDriftReport(
  project: Pick<InkosNovelProject, "chapters">,
  outlineNodes: NovelOutlineNode[],
): NovelOutlineSyncDriftReport {
  const outlineByNumber = new Map(
    outlineNodes.map((node) => [node.chapterNumber, node]),
  );
  const projectChapters = [...(project.chapters ?? [])].sort(
    (left, right) => left.number - right.number,
  );
  const projectNumbers = new Set(projectChapters.map((chapter) => chapter.number));
  const outlineNumbers = new Set(outlineNodes.map((node) => node.chapterNumber));
  const missingInOutline = projectChapters
    .map((chapter) => chapter.number)
    .filter((number) => !outlineNumbers.has(number));
  const missingInProject = [...outlineNumbers]
    .filter((number) => !projectNumbers.has(number))
    .sort((left, right) => left - right);
  const statusMismatches = projectChapters.flatMap((chapter) => {
    const node = outlineByNumber.get(chapter.number);

    if (!node || node.status === chapter.status) {
      return [];
    }

    return [
      {
        chapterNumber: chapter.number,
        outlineStatus: node.status,
        projectStatus: chapter.status,
      },
    ];
  });
  const hasDrift =
    missingInOutline.length > 0 ||
    missingInProject.length > 0 ||
    statusMismatches.length > 0 ||
    outlineNodes.length !== projectChapters.length;
  const parts = [
    hasDrift ? "章节计划与项目 chapters 存在差异。" : "章节计划与项目 chapters 一致。",
    missingInOutline.length > 0
      ? `${missingInOutline.length} 章已生成但未在大纲中。`
      : "",
    missingInProject.length > 0
      ? `${missingInProject.length} 章仅存在于大纲。`
      : "",
    statusMismatches.length > 0
      ? `${statusMismatches.length} 章状态不一致。`
      : "",
  ].filter(Boolean);

  return {
    hasDrift,
    outlineCount: outlineNodes.length,
    projectChapterCount: projectChapters.length,
    missingInOutline,
    missingInProject,
    statusMismatches,
    message: parts.join(" "),
  };
}

export const NOVEL_FORESHADOWING_STATUS_LABELS: Record<
  NovelKnowledgeAsset["status"],
  string
> = {
  active: "已埋设",
  draft: "推进中",
  resolved: "已回收",
};

export function buildNovelForeshadowingPoolSummary(
  assets: Pick<NovelProjectAssets, "knowledgeAssets">,
): {
  planted: NovelKnowledgeAsset[];
  progressing: NovelKnowledgeAsset[];
  resolved: NovelKnowledgeAsset[];
  stale: NovelKnowledgeAsset[];
} {
  const foreshadowing = (assets.knowledgeAssets ?? []).filter(
    (asset) => asset.category === "foreshadowing",
  );
  const now = Date.now();
  const staleThresholdMs = 1000 * 60 * 60 * 24 * 30;

  return {
    planted: foreshadowing.filter((asset) => asset.status === "active"),
    progressing: foreshadowing.filter((asset) => asset.status === "draft"),
    resolved: foreshadowing.filter((asset) => asset.status === "resolved"),
    stale: foreshadowing.filter((asset) => {
      if (asset.status === "resolved") {
        return false;
      }

      const updatedAt = Date.parse(asset.updatedAt);

      return Number.isFinite(updatedAt) && now - updatedAt > staleThresholdMs;
    }),
  };
}

export const NOVEL_CHARACTER_RELATION_KIND_LABELS: Record<
  NovelCharacterRelationEdgeKind,
  string
> = {
  ally: "同盟",
  enemy: "对立",
  family: "亲族",
  romance: "情感",
  mentor: "师徒",
  coappearance: "同场",
  other: "关联",
};

function slugNovelCharacterId(name: string): string {
  return `character-${name.trim().replace(/\s+/g, "-")}`;
}

function parseNovelCharacterTrackingLines(content: string): Array<{
  characterName: string;
  content: string;
  chapterNumber?: number;
  chapterTitle?: string;
}> {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const entries: Array<{
    characterName: string;
    content: string;
    chapterNumber?: number;
    chapterTitle?: string;
  }> = [];
  let currentChapterNumber: number | undefined;
  let currentChapterTitle: string | undefined;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line || line.startsWith("##")) {
      return;
    }

    const chapterMatch = line.match(/^第\s*(\d+)\s*章[《「](.+?)[》」]/);

    if (chapterMatch) {
      currentChapterNumber = Number(chapterMatch[1]);
      currentChapterTitle = chapterMatch[2]?.trim();
      return;
    }

    const normalized = line.replace(/^[-*]\s*/, "").trim();
    const splitIndex = normalized.search(/[：:]/);

    if (splitIndex <= 0) {
      return;
    }

    const characterName = normalized.slice(0, splitIndex).trim();
    const stateContent = normalized.slice(splitIndex + 1).trim();

    if (!characterName || !stateContent || isEmptyNovelAssetMarker(stateContent)) {
      return;
    }

    entries.push({
      characterName,
      content: stateContent,
      chapterNumber: currentChapterNumber,
      chapterTitle: currentChapterTitle,
    });
  });

  return entries;
}

function collectNovelCharacterNames(input: {
  assets: NovelProjectAssets;
  project?: InkosNovelProject;
}): string[] {
  const names = new Set<string>();

  (input.assets.knowledgeAssets ?? [])
    .filter((asset) => asset.category === "character")
    .forEach((asset) => {
      if (asset.title.trim()) {
        names.add(asset.title.trim());
      }
    });

  parseNovelCharacterTrackingLines(input.assets.characters).forEach((entry) => {
    names.add(entry.characterName);
  });

  (input.assets.pendingAssetDeltas ?? []).forEach((delta) => {
    delta.characterStates.forEach((state) => {
      if (state.title.trim()) {
        names.add(state.title.trim());
      }
    });
  });

  if (input.project?.protagonist?.trim()) {
    names.add(input.project.protagonist.trim());
  }

  input.assets.outlineNodes.forEach((node) => {
    node.characters
      .split(/[、，,/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((name) => names.add(name));
  });

  return [...names].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function buildNovelCharacterStateTimeline(input: {
  assets: NovelProjectAssets;
  project?: InkosNovelProject;
}): NovelCharacterStateTimeline {
  const characterAssets = (input.assets.knowledgeAssets ?? []).filter(
    (asset) => asset.category === "character",
  );
  const entriesByName = new Map<string, NovelCharacterStateTimelineEntry[]>();

  function pushEntry(
    characterName: string,
    entry: Omit<NovelCharacterStateTimelineEntry, "id" | "characterName">,
  ) {
    const normalizedName = characterName.trim();

    if (!normalizedName) {
      return;
    }

    const list = entriesByName.get(normalizedName) ?? [];
    list.push({
      id: `${slugNovelCharacterId(normalizedName)}-${list.length}-${entry.source}`,
      characterName: normalizedName,
      ...entry,
    });
    entriesByName.set(normalizedName, list);
  }

  characterAssets.forEach((asset) => {
    pushEntry(asset.title, {
      content: asset.content.trim() || "暂无状态描述。",
      source: "asset",
      updatedAt: asset.updatedAt,
    });
  });

  parseNovelCharacterTrackingLines(input.assets.characters).forEach(
    (entry, index) => {
      pushEntry(entry.characterName, {
        content: entry.content,
        chapterNumber: entry.chapterNumber,
        chapterTitle: entry.chapterTitle,
        source: "tracking-text",
        updatedAt: new Date(
          Date.parse("2026-01-01T00:00:00.000Z") + index,
        ).toISOString(),
      });
    },
  );

  (input.assets.pendingAssetDeltas ?? []).forEach((delta) => {
    delta.characterStates.forEach((state, index) => {
      pushEntry(state.title, {
        content: state.content,
        chapterNumber: delta.chapterNumber,
        chapterTitle: delta.chapterTitle,
        source: "pending-delta",
        updatedAt: delta.createdAt || new Date(Date.now() + index).toISOString(),
      });
    });
  });

  (input.assets.assetChangeEvents ?? [])
    .filter((event) => event.category === "character")
    .forEach((event, index) => {
      const matchedAsset = characterAssets.find(
        (asset) => asset.id === event.assetId || event.detail.includes(asset.title),
      );
      const characterName =
        matchedAsset?.title ??
        event.detail.match(/[「『](.+?)[」』]/)?.[1] ??
        event.label.replace(/^.*[:：]/, "").trim();

      if (!characterName) {
        return;
      }

      pushEntry(characterName, {
        content: event.detail,
        source: "change-event",
        updatedAt: event.createdAt || new Date(Date.now() + index).toISOString(),
      });
    });

  collectNovelCharacterNames(input).forEach((name) => {
    if (!entriesByName.has(name)) {
      entriesByName.set(name, []);
    }
  });

  const characters = [...entriesByName.entries()]
    .map(([name, entries]) => {
      const sortedEntries = [...entries].sort((left, right) => {
        const chapterDelta =
          (left.chapterNumber ?? Number.MAX_SAFE_INTEGER) -
          (right.chapterNumber ?? Number.MAX_SAFE_INTEGER);

        if (chapterDelta !== 0) {
          return chapterDelta;
        }

        return (
          new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
        );
      });
      const asset = characterAssets.find((item) => item.title === name);
      const latest = sortedEntries.at(-1);

      return {
        name,
        assetId: asset?.id,
        status: asset?.status,
        entries: sortedEntries,
        latestContent: latest?.content ?? asset?.content ?? "暂无状态记录。",
        latestUpdatedAt:
          latest?.updatedAt ?? asset?.updatedAt ?? new Date(0).toISOString(),
      };
    })
    .sort(
      (left, right) =>
        new Date(right.latestUpdatedAt).getTime() -
          new Date(left.latestUpdatedAt).getTime() ||
        left.name.localeCompare(right.name, "zh-CN"),
    );

  const trackedCount = characters.filter((item) => item.entries.length > 0).length;
  const summary =
    trackedCount === 0
      ? "暂无角色状态追踪记录。写章沉淀或手动维护角色资产后会自动生成时间线。"
      : `共追踪 ${characters.length} 名角色，其中 ${trackedCount} 名有状态变化记录。`;

  return {
    characters,
    summary,
  };
}

function detectNovelCharacterRelationKind(
  text: string,
): { kind: NovelCharacterRelationEdgeKind; label: string } {
  if (/恋人|情侣|爱慕|暗恋|喜欢|情感/.test(text)) {
    return { kind: "romance", label: "情感" };
  }

  if (/师徒|师父|徒弟|传授/.test(text)) {
    return { kind: "mentor", label: "师徒" };
  }

  if (/父|母|子|女|兄|弟|姐|妹|家族|血缘|亲属/.test(text)) {
    return { kind: "family", label: "亲族" };
  }

  if (/敌|对手|对立|仇|宿敌|追杀/.test(text)) {
    return { kind: "enemy", label: "对立" };
  }

  if (/友|盟友|搭档|同伴|同盟|合作|同事/.test(text)) {
    return { kind: "ally", label: "同盟" };
  }

  return { kind: "other", label: "关联" };
}

function extractNovelExplicitCharacterRelations(input: {
  sourceName: string;
  content: string;
  knownNames: string[];
}): Array<{
  targetName: string;
  label: string;
  kind: NovelCharacterRelationEdgeKind;
}> {
  const relations: Array<{
    targetName: string;
    label: string;
    kind: NovelCharacterRelationEdgeKind;
  }> = [];

  input.knownNames.forEach((targetName) => {
    if (targetName === input.sourceName) {
      return;
    }

    if (!input.content.includes(targetName)) {
      return;
    }

    const contextStart = Math.max(0, input.content.indexOf(targetName) - 12);
    const contextEnd = Math.min(
      input.content.length,
      input.content.indexOf(targetName) + targetName.length + 12,
    );
    const context = input.content.slice(contextStart, contextEnd);
    const detected = detectNovelCharacterRelationKind(context);

    relations.push({
      targetName,
      label: detected.label,
      kind: detected.kind,
    });
  });

  return relations;
}

export function buildNovelCharacterRelationGraph(input: {
  assets: NovelProjectAssets;
  project?: InkosNovelProject;
}): NovelCharacterRelationGraph {
  const names = collectNovelCharacterNames(input);
  const characterAssets = (input.assets.knowledgeAssets ?? []).filter(
    (asset) => asset.category === "character",
  );
  const edgeMap = new Map<string, NovelCharacterRelationEdge>();

  function upsertEdge(
    sourceName: string,
    targetName: string,
    edge: Omit<NovelCharacterRelationEdge, "id" | "sourceId" | "targetId">,
  ) {
    if (sourceName === targetName) {
      return;
    }

    const sourceId = slugNovelCharacterId(sourceName);
    const targetId = slugNovelCharacterId(targetName);
    const pairKey = [sourceId, targetId].sort().join("|");
    const existing = edgeMap.get(pairKey);

    if (!existing || edge.weight > existing.weight) {
      edgeMap.set(pairKey, {
        id: `relation-${pairKey}`,
        sourceId,
        targetId,
        ...edge,
      });
    }
  }

  characterAssets.forEach((asset) => {
    extractNovelExplicitCharacterRelations({
      sourceName: asset.title,
      content: asset.content,
      knownNames: names,
    }).forEach((relation) => {
      upsertEdge(asset.title, relation.targetName, {
        label: relation.label,
        kind: relation.kind,
        source: "explicit",
        weight: 3,
      });
    });
  });

  input.assets.outlineNodes.forEach((node) => {
    const chapterCharacters = node.characters
      .split(/[、，,/|]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (let leftIndex = 0; leftIndex < chapterCharacters.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < chapterCharacters.length;
        rightIndex += 1
      ) {
        const left = chapterCharacters[leftIndex]!;
        const right = chapterCharacters[rightIndex]!;
        upsertEdge(left, right, {
          label: `第 ${node.chapterNumber} 章同场`,
          kind: "coappearance",
          source: "coappearance",
          weight: 1,
        });
      }
    }
  });

  parseNovelCharacterTrackingLines(input.assets.characters).forEach((entry) => {
    names.forEach((targetName) => {
      if (targetName === entry.characterName || !entry.content.includes(targetName)) {
        return;
      }

      const detected = detectNovelCharacterRelationKind(entry.content);
      upsertEdge(entry.characterName, targetName, {
        label: detected.label,
        kind: detected.kind,
        source: "matrix",
        weight: 2,
      });
    });
  });

  const nodes: NovelCharacterRelationNode[] = names.map((name) => {
    const asset = characterAssets.find((item) => item.title === name);
    const nodeId = slugNovelCharacterId(name);
    const degree = [...edgeMap.values()].filter(
      (edge) => edge.sourceId === nodeId || edge.targetId === nodeId,
    ).length;

    return {
      id: nodeId,
      label: name,
      assetId: asset?.id,
      status: asset?.status,
      degree,
    };
  });

  const edges = [...edgeMap.values()].sort(
    (left, right) => right.weight - left.weight || left.label.localeCompare(right.label),
  );
  const summary =
    nodes.length === 0
      ? "暂无可视化角色。请先添加角色资产或在大纲中标注出场角色。"
      : edges.length === 0
        ? `已识别 ${nodes.length} 名角色，尚未推断出关系边。可在角色卡中写明与其他角色的关系。`
        : `已识别 ${nodes.length} 名角色、${edges.length} 条关系（含大纲同场与角色卡显式描述）。`;

  return {
    nodes,
    edges,
    summary,
  };
}

export function filterNovelKnowledgeAssets(
  assets: Pick<NovelProjectAssets, "knowledgeAssets">,
  category?: NovelKnowledgeAssetCategory | "all",
): NovelKnowledgeAsset[] {
  const items = assets.knowledgeAssets ?? [];

  if (!category || category === "all") {
    return items;
  }

  return items.filter((asset) => asset.category === category);
}

export function buildNovelKnowledgeSummary(
  assets: Pick<NovelProjectAssets, "knowledgeAssets">,
  categories?: NovelKnowledgeAssetCategory[],
): string {
  const selected = (assets.knowledgeAssets ?? []).filter(
    (asset) => !categories || categories.includes(asset.category),
  );

  return selected
    .map((asset) => {
      const tags = asset.tags.length > 0 ? ` #${asset.tags.join(" #")}` : "";

      return `- [${asset.category}/${asset.status}] ${asset.title}${tags}：${asset.content}`;
    })
    .join("\n");
}

export function buildNovelChapterAssetDelta(input: {
  chapterNumber: number;
  chapterTitle: string;
  content: string;
  existingSummary?: string;
}): NovelChapterAssetDelta {
  const normalizedContent = input.content.replace(/\r\n/g, "\n").trim();
  const summary =
    extractNovelSection(normalizedContent, "章节摘要")
      .split(/\n##\s+/)[0]
      ?.trim() ||
    input.existingSummary?.trim() ||
    buildFallbackNovelChapterSummary(normalizedContent);
  const assetSection = extractNovelSection(normalizedContent, "资产增量");

  return {
    chapterNumber: input.chapterNumber,
    chapterTitle: input.chapterTitle,
    summary,
    characterStates: parseNovelCharacterStates(
      extractNovelSubsection(assetSection, "角色状态"),
    ),
    newForeshadowing: parseNovelBulletLines(
      extractNovelSubsection(assetSection, "新增伏笔"),
    ),
    resolvedForeshadowing: parseNovelBulletLines(
      extractNovelSubsection(assetSection, "回收伏笔"),
    ),
    worldIncrements: parseNovelBulletLines(
      extractNovelSubsection(assetSection, "世界观增量"),
    ),
  };
}

export function applyNovelChapterAssetDelta(
  assets: NovelProjectAssets,
  delta: NovelChapterAssetDelta,
): NovelProjectAssets {
  const now = new Date().toISOString();
  const chapterTag = `第${delta.chapterNumber}章`;
  const chapterLine = `第 ${delta.chapterNumber} 章《${delta.chapterTitle}》`;
  const beforeKnowledgeAssets = assets.knowledgeAssets ?? [];
  let nextKnowledgeAssets = beforeKnowledgeAssets;

  delta.characterStates.forEach((state) => {
    nextKnowledgeAssets = upsertNovelKnowledgeAsset(nextKnowledgeAssets, {
      category: "character",
      title: state.title,
      content: `${chapterLine}：${state.content}`,
      status: "active",
      tags: ["角色状态", chapterTag],
      updatedAt: now,
    });
  });

  delta.newForeshadowing.forEach((item, index) => {
    nextKnowledgeAssets = upsertNovelKnowledgeAsset(nextKnowledgeAssets, {
      category: "foreshadowing",
      title: createNovelAssetTitle("新增伏笔", delta.chapterNumber, item, index),
      content: `${chapterLine}埋设：${item}`,
      status: "draft",
      tags: ["新增伏笔", chapterTag],
      updatedAt: now,
    });
  });

  delta.resolvedForeshadowing.forEach((item, index) => {
    const matchIndex = matchNovelKnowledgeAssetIndex(nextKnowledgeAssets, {
      category: "foreshadowing",
      title: extractNovelForeshadowingCoreLabel(item),
      content: item,
      status: "resolved",
      tags: ["回收伏笔", chapterTag],
      updatedAt: now,
    });

    if (matchIndex >= 0) {
      nextKnowledgeAssets = nextKnowledgeAssets.map((asset, assetIndex) =>
        assetIndex === matchIndex
          ? {
              ...asset,
              status: "resolved",
              content: asset.content.includes(item)
                ? asset.content
                : [asset.content, `${chapterLine}回收：${item}`]
                    .filter(Boolean)
                    .join("\n\n"),
              tags: Array.from(
                new Set([...asset.tags, "回收伏笔", chapterTag]),
              ),
              updatedAt: now,
            }
          : asset,
      );
      return;
    }

    nextKnowledgeAssets = upsertNovelKnowledgeAsset(nextKnowledgeAssets, {
      category: "foreshadowing",
      title: createNovelAssetTitle("回收伏笔", delta.chapterNumber, item, index),
      content: `${chapterLine}回收：${item}`,
      status: "resolved",
      tags: ["回收伏笔", chapterTag],
      updatedAt: now,
    });
  });

  delta.worldIncrements.forEach((item, index) => {
    nextKnowledgeAssets = upsertNovelKnowledgeAsset(nextKnowledgeAssets, {
      category: "world",
      title: createNovelAssetTitle("世界观增量", delta.chapterNumber, item, index),
      content: `${chapterLine}：${item}`,
      status: "active",
      tags: ["世界观", chapterTag],
      updatedAt: now,
    });
  });

  const worldNotes = mergeNovelLongText(
    assets.worldNotes,
    delta.worldIncrements.map((item) => `${chapterLine}：${item}`),
    "章节世界观增量",
  );
  const characters = mergeNovelLongText(
    assets.characters,
    delta.characterStates.map((state) => `${state.title}：${state.content}`),
    "角色状态追踪",
  );
  const changeEvents = buildNovelAssetChangeEventsForDelta(
    beforeKnowledgeAssets,
    nextKnowledgeAssets,
    delta,
  );

  return {
    ...assets,
    worldNotes,
    characters,
    knowledgeAssets: nextKnowledgeAssets,
    assetChangeEvents: [...changeEvents, ...(assets.assetChangeEvents ?? [])].slice(
      0,
      100,
    ),
  };
}

export function queueNovelPendingAssetDelta(
  assets: NovelProjectAssets,
  delta: NovelChapterAssetDelta,
): NovelProjectAssets {
  if (!hasNovelChapterAssetDeltaContent(delta)) {
    return assets;
  }

  const pending: NovelPendingAssetDelta = {
    ...delta,
    id: `pending-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  return {
    ...assets,
    pendingAssetDeltas: [pending, ...(assets.pendingAssetDeltas ?? [])],
  };
}

export function applyNovelPendingAssetDelta(
  assets: NovelProjectAssets,
  pendingId: string,
): NovelProjectAssets {
  const pending = (assets.pendingAssetDeltas ?? []).find(
    (item) => item.id === pendingId,
  );

  if (!pending) {
    return assets;
  }

  const nextAssets = applyNovelChapterAssetDelta(assets, pending);

  return {
    ...nextAssets,
    pendingAssetDeltas: (assets.pendingAssetDeltas ?? []).filter(
      (item) => item.id !== pendingId,
    ),
  };
}

export function updateNovelPendingAssetDelta(
  assets: NovelProjectAssets,
  pendingId: string,
  updates: Partial<NovelChapterAssetDelta>,
): NovelProjectAssets {
  const pendingAssetDeltas = assets.pendingAssetDeltas ?? [];

  if (!pendingAssetDeltas.some((item) => item.id === pendingId)) {
    return assets;
  }

  return {
    ...assets,
    pendingAssetDeltas: pendingAssetDeltas.map((item) =>
      item.id === pendingId ? { ...item, ...updates } : item,
    ),
  };
}

export function dismissNovelPendingAssetDelta(
  assets: NovelProjectAssets,
  pendingId: string,
): NovelProjectAssets {
  const pendingAssetDeltas = assets.pendingAssetDeltas ?? [];

  if (!pendingAssetDeltas.some((item) => item.id === pendingId)) {
    return assets;
  }

  return {
    ...assets,
    pendingAssetDeltas: pendingAssetDeltas.filter((item) => item.id !== pendingId),
  };
}

export function normalizeNovelProjectAssets(
  project: InkosNovelProject,
  assets?: Partial<NovelProjectAssets>,
): NovelProjectAssets {
  const defaultAssets = createDefaultNovelAssets(project);

  return {
    ...defaultAssets,
    ...assets,
    outlineNodes:
      assets?.outlineNodes?.length
        ? assets.outlineNodes
        : defaultAssets.outlineNodes,
    knowledgeAssets:
      assets?.knowledgeAssets?.length
        ? assets.knowledgeAssets
        : defaultAssets.knowledgeAssets,
    pendingAssetDeltas: assets?.pendingAssetDeltas ?? [],
    contextSelection: {
      ...defaultAssets.contextSelection,
      ...assets?.contextSelection,
    },
    genres: assets?.genres ?? defaultAssets.genres,
    styleSamples: assets?.styleSamples ?? defaultAssets.styleSamples,
    importedMaterials: assets?.importedMaterials ?? [],
    marketRadars: assets?.marketRadars ?? [],
    diagnostics: assets?.diagnostics ?? [],
    publicationEvents: assets?.publicationEvents ?? [],
    assetChangeEvents: assets?.assetChangeEvents ?? [],
    projectStrategy: assets?.projectStrategy,
    pendingMigration: normalizePendingMigration(
      assets?.pendingMigration ?? defaultAssets.pendingMigration,
    ),
  };
}

export function getNovelTaskGuard(input: {
  isSending: boolean;
  isRunningCoreAction: boolean;
}): {
  canStart: boolean;
  message: string;
} {
  if (input.isRunningCoreAction) {
    return {
      canStart: false,
      message: "已有 InkOS 任务正在执行，可以先取消当前任务。",
    };
  }

  if (input.isSending) {
    return {
      canStart: false,
      message: "已有聊天消息正在发送，请稍后再开始新任务。",
    };
  }

  return { canStart: true, message: "" };
}

export function buildNovelChapterVersionDiff(
  previousVersion: Pick<StoredNovelChapterVersion, "content" | "wordCount">,
  nextVersion: Pick<StoredNovelChapterVersion, "content" | "wordCount">,
): NovelChapterVersionDiff {
  const previousLines = normalizeDiffLines(previousVersion.content);
  const nextLines = normalizeDiffLines(nextVersion.content);
  const previousCounts = countLineOccurrences(previousLines);
  const nextCounts = countLineOccurrences(nextLines);
  const previousRemainder = new Map(previousCounts);
  const nextRemainder = new Map(nextCounts);
  const addedLines = nextLines.filter((line) => {
    const remaining = previousRemainder.get(line) ?? 0;
    if (remaining > 0) {
      previousRemainder.set(line, remaining - 1);
      return false;
    }
    return true;
  });
  const removedLines = previousLines.filter((line) => {
    const remaining = nextRemainder.get(line) ?? 0;
    if (remaining > 0) {
      nextRemainder.set(line, remaining - 1);
      return false;
    }
    return true;
  });
  const unchangedLines = nextLines.filter((line) => previousCounts.has(line));

  return {
    changed: addedLines.length > 0 || removedLines.length > 0,
    wordDelta: nextVersion.wordCount - previousVersion.wordCount,
    addedLines,
    removedLines,
    unchangedLines,
  };
}

export function buildNovelChapterVersionCompareView(
  previousVersion: Pick<StoredNovelChapterVersion, "content" | "wordCount">,
  nextVersion: Pick<StoredNovelChapterVersion, "content" | "wordCount">,
): NovelChapterVersionCompareView {
  const diff = buildNovelChapterVersionDiff(previousVersion, nextVersion);
  const addedSet = countLineOccurrences(diff.addedLines);
  const removedSet = countLineOccurrences(diff.removedLines);
  const previousLines = normalizeDiffLines(previousVersion.content).map((text) => {
    const remaining = removedSet.get(text) ?? 0;

    if (remaining > 0) {
      removedSet.set(text, remaining - 1);
      return { text, state: "removed" as const };
    }

    return { text, state: "unchanged" as const };
  });
  const nextLines = normalizeDiffLines(nextVersion.content).map((text) => {
    const remaining = addedSet.get(text) ?? 0;

    if (remaining > 0) {
      addedSet.set(text, remaining - 1);
      return { text, state: "added" as const };
    }

    return { text, state: "unchanged" as const };
  });

  return {
    changed: diff.changed,
    wordDelta: diff.wordDelta,
    addedCount: diff.addedLines.length,
    removedCount: diff.removedLines.length,
    previousLines,
    nextLines,
  };
}

export function buildNovelChapterDraftMeta(
  content: string,
  summary: string,
): NovelChapterDraftMeta {
  return {
    wordCount: countNovelWords(content),
    paragraphCount: content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean).length,
    hasSummary: summary.trim().length > 0,
  };
}

export function buildNovelChapterParagraphNavigation(
  content: string,
  targetWords = 0,
): NovelChapterParagraphNavigation {
  const normalized = content.replace(/\r\n/g, "\n");
  const paragraphs: NovelChapterParagraphNavigationItem[] = [];
  const paragraphPattern = /\S[\s\S]*?(?=\n{2,}|$)/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(normalized))) {
    const rawText = match[0] ?? "";
    const text = rawText.trim();

    if (!text) {
      continue;
    }

    paragraphs.push({
      index: paragraphs.length,
      start: match.index,
      end: match.index + rawText.length,
      wordCount: countNovelWords(text),
      preview: text.length > 48 ? `${text.slice(0, 48)}...` : text,
      text,
    });
  }

  const wordCount = countNovelWords(normalized);
  const safeTargetWords = Math.max(0, Math.round(targetWords || 0));

  return {
    wordCount,
    targetWords: safeTargetWords,
    targetPercent:
      safeTargetWords > 0
        ? Math.min(100, Math.round((wordCount / safeTargetWords) * 100))
        : 0,
    paragraphs,
  };
}

export function buildNovelEditorSearchState(
  content: string,
  query: string,
  requestedIndex = 0,
): NovelEditorSearchState {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return { query: "", count: 0, activeIndex: -1, matches: [] };
  }

  const matches: NovelEditorSearchMatch[] = [];
  let cursor = 0;

  while (cursor <= content.length) {
    const start = content.indexOf(normalizedQuery, cursor);
    if (start < 0) break;
    matches.push({ start, end: start + normalizedQuery.length });
    cursor = start + Math.max(1, normalizedQuery.length);
  }

  return {
    query: normalizedQuery,
    count: matches.length,
    activeIndex:
      matches.length > 0
        ? Math.min(Math.max(0, requestedIndex), matches.length - 1)
        : -1,
    matches,
  };
}

export function replaceNovelEditorSearchMatches(
  content: string,
  query: string,
  replacement: string,
  mode: "current" | "all",
  activeIndex = 0,
): string {
  const state = buildNovelEditorSearchState(content, query, activeIndex);

  if (state.count === 0) {
    return content;
  }

  if (mode === "all") {
    return content.split(state.query).join(replacement);
  }

  const match = state.matches[state.activeIndex];
  if (!match) return content;

  return `${content.slice(0, match.start)}${replacement}${content.slice(match.end)}`;
}

export function mergeNovelChapterPlan(
  project: Pick<InkosNovelProject, "chapters" | "chapterWordCount">,
  chapters: StoredNovelChapter[],
): NovelChapterListItem[] {
  const sortedChapters = sortStoredNovelChapters(chapters);
  const generatedByNumber = new Map(
    sortedChapters.map((chapter) => [chapter.number, chapter]),
  );
  const plannedByNumber = new Map(
    [...(project.chapters ?? [])]
      .sort((left, right) => left.number - right.number)
      .map((chapter) => [chapter.number, chapter]),
  );
  const numbers = [...new Set([
    ...plannedByNumber.keys(),
    ...generatedByNumber.keys(),
  ])].sort((left, right) => left - right);

  return numbers.map((number) => {
    const planned = plannedByNumber.get(number);
    const generated = generatedByNumber.get(number);

    if (generated) {
      return {
        key: generated.id,
        number,
        title: generated.title || planned?.title || `第 ${number} 章`,
        status: generated.status,
        focus: planned?.focus || generated.summary,
        targetWords:
          planned?.targetWords ?? project.chapterWordCount ?? generated.wordCount,
        generated: true,
        wordCount: generated.wordCount,
        updatedAt: generated.updatedAt,
        summary: generated.summary,
        reviewNotes: generated.reviewNotes,
        chapter: generated,
      };
    }

    return {
      key: `plan-${number}`,
      number,
      title: planned?.title || `第 ${number} 章`,
      status: planned?.status ?? "planned",
      focus: planned?.focus ?? "等待补充章节计划。",
      targetWords: planned?.targetWords ?? project.chapterWordCount ?? 3000,
      generated: false,
      wordCount: 0,
      updatedAt: "",
      summary: "",
      reviewNotes: "",
    };
  });
}

export function buildNovelBatchQueueItems(
  rows: NovelChapterListItem[],
  action: NovelBatchQueueAction,
): NovelBatchQueueItem[] {
  return rows
    .filter((row) => {
      if (action === "write-chapter") {
        return !row.generated;
      }

      if (action === "review") {
        return Boolean(row.chapter) && row.status !== "approved";
      }

      return Boolean(
        row.chapter &&
          (row.chapter.reviews ?? []).some((review) =>
            review.issues.some((issue) => !issue.resolved),
          ),
      );
    })
    .map((row) => ({
      id: `${action}-${row.key}`,
      action,
      label:
        action === "write-chapter"
          ? `生成第 ${row.number} 章`
          : action === "review"
            ? `审稿第 ${row.number} 章`
            : `修订第 ${row.number} 章`,
      number: row.number,
      title: row.title,
      target:
        action === "write-chapter"
          ? {
              number: row.number,
              title: row.title,
              focus: row.focus,
              targetWords: row.targetWords,
              reason: row.generated ? "append" : "planned",
            }
          : undefined,
      chapter: row.chapter,
    }));
}

export function moveNovelBatchQueueItem(
  items: NovelBatchQueueItem[],
  itemId: string,
  direction: "up" | "down",
): NovelBatchQueueItem[] {
  const nextItems = [...items];
  const index = nextItems.findIndex((item) => item.id === itemId);

  if (index < 0) {
    return nextItems;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= nextItems.length) {
    return nextItems;
  }

  const [item] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, item!);
  return nextItems;
}

export function skipNovelBatchQueueItem(
  items: NovelBatchQueueItem[],
  itemId: string,
): NovelBatchQueueItem[] {
  return items.filter((item) => item.id !== itemId);
}

export function buildNovelBatchQueueReport(
  tasks: StoredNovelTask[],
): NovelBatchQueueReport {
  const success = tasks.filter((task) => task.status === "success").length;
  const skipped = tasks.filter((task) => task.status === "skipped").length;
  const cancelled = tasks.filter((task) => task.status === "cancelled").length;
  const failed = tasks.filter((task) => task.status === "error").length;
  const running = tasks.filter((task) => task.status === "running").length;
  const queued = tasks.filter((task) =>
    task.status === "queued" || task.status === "paused"
  ).length;
  const lines = [
    "# 批量任务完成报告",
    "",
    `总任务：${tasks.length}`,
    `完成：${success}`,
    `失败：${failed}`,
    `跳过：${skipped}`,
    `取消：${cancelled}`,
    queued || running ? `未完成：${queued + running}` : "",
    "",
    "## 明细",
    ...tasks.map((task, index) => {
      const statusLabel =
        task.status === "success"
          ? "完成"
          : task.status === "skipped"
            ? "跳过"
            : task.status === "cancelled"
              ? "取消"
              : task.status === "error"
                ? "失败"
                : task.status === "paused"
                  ? "暂停"
                  : task.status === "running"
                    ? "执行中"
                    : "排队中";
      const reason =
        task.errorMessage && (task.status === "error" || task.status === "cancelled")
          ? ` - ${task.errorMessage}`
          : "";

      return `${index + 1}. ${task.label}：${statusLabel}${reason}`;
    }),
  ].filter(Boolean);

  return {
    total: tasks.length,
    success,
    failed,
    cancelled,
    skipped,
    markdown: lines.join("\n"),
  };
}

export function selectNextNovelChapterTarget(
  project: Pick<InkosNovelProject, "chapters" | "chapterWordCount">,
  chapters: StoredNovelChapter[],
): NovelChapterWriteTarget {
  const generatedNumbers = new Set(chapters.map((chapter) => chapter.number));
  const planned = [...(project.chapters ?? [])]
    .sort((left, right) => left.number - right.number)
    .find((chapter) => !generatedNumbers.has(chapter.number));

  if (planned) {
    return toNovelChapterWriteTarget(planned, project.chapterWordCount, "planned");
  }

  const nextNumber =
    Math.max(
      0,
      ...chapters.map((chapter) => chapter.number),
      ...(project.chapters ?? []).map((chapter) => chapter.number),
    ) + 1;

  return {
    number: nextNumber,
    title: `第 ${nextNumber} 章`,
    focus: "延续上一章冲突，推进主线并制造新的悬念。",
    targetWords: project.chapterWordCount ?? 3000,
    reason: "append",
  };
}

export function buildNovelWriteChapterInstruction(input: {
  project: Pick<
    InkosNovelProject,
    "title" | "genre" | "premise" | "world" | "protagonist" | "chapters" | "chapterWordCount"
  >;
  assets: Pick<
    NovelProjectAssets,
    | "outline"
    | "outlineNodes"
    | "worldNotes"
    | "characters"
    | "settings"
    | "knowledgeAssets"
    | "contextSelection"
    | "genres"
    | "styleSamples"
  >;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  userInstruction?: string;
  contextSelectionOverride?: NovelContextSelection;
}): string {
  const selection =
    input.contextSelectionOverride ??
    input.assets.contextSelection ??
    buildDefaultNovelContextSelection(input.project);
  const derivedStyleConstraints = buildNovelStyleConstraintsFromAssets(
    input.assets,
    input.project,
  );
  const sortedChapters = sortStoredNovelChapters(input.chapters);
  const previousChapter = [...sortedChapters]
    .reverse()
    .find((chapter) => chapter.number < input.target.number);
  const recentSummaries = sortedChapters
    .filter((chapter) => chapter.number < input.target.number)
    .slice(-3)
    .map((chapter) => `- 第 ${chapter.number} 章《${chapter.title}》：${chapter.summary || "暂无摘要"}`)
    .join("\n");
  const plan = input.project.chapters.find(
    (chapter) => chapter.number === input.target.number,
  );
  const latestChapter = sortedChapters.at(-1);
  const reviewWarning =
    latestChapter &&
    latestChapter.status !== "approved" &&
    latestChapter.number < input.target.number
      ? `上一章状态：${latestChapter.status}，尚未完全定稿。生成时保持连续性，但避免过度依赖未确认细节。`
      : "";
  const previousExcerpt = previousChapter
    ? previousChapter.content.slice(0, 900)
    : "暂无上一章正文。";
  const targetOutlineNode = (input.assets.outlineNodes ?? []).find(
    (node) => node.chapterNumber === input.target.number,
  );
  const selectedKnowledge = buildNovelKnowledgeSummary(input.assets);
  const foreshadowingSummary = buildNovelKnowledgeSummary(input.assets, [
    "foreshadowing",
  ]);
  const unresolvedReviewIssues = sortedChapters
    .flatMap((chapter) =>
      (chapter.reviews ?? []).flatMap((review) =>
        review.issues
          .filter((issue) => !issue.resolved)
          .map(
            (issue) =>
              `- 第 ${chapter.number} 章《${chapter.title}》：${issue.title} / ${issue.detail}`,
          ),
      ),
    )
    .slice(0, 8)
    .join("\n");

  return [
    "请按以下上下文生成小说章节。",
    `目标章号：${input.target.number}`,
    `目标标题：${input.target.title}`,
    `目标字数：${selection.targetWords || input.target.targetWords}`,
    `视角要求：${selection.viewpoint || "第三人称有限视角"}`,
    `节奏要求：${selection.pacing || "保持章节冲突推进。"}`,
    selection.highlights?.trim()
      ? `本章高亮要求：${selection.highlights.trim()}`
      : "",
    selection.thrillPoints?.trim()
      ? `读者爽点 / 悬疑点：${selection.thrillPoints.trim()}`
      : "",
    selection.bannedWords?.trim()
      ? `禁用词 / 避免表达：${selection.bannedWords.trim()}`
      : "",
    derivedStyleConstraints || selection.styleConstraints?.trim()
      ? `风格约束：${[derivedStyleConstraints, selection.styleConstraints?.trim()]
          .filter(Boolean)
          .join("\n")}`
      : "",
    `章节计划：${input.target.focus}`,
    targetOutlineNode && selection.includeOutline
      ? [
          "## 结构化章节计划",
          `卷：${targetOutlineNode.volume}`,
          `目标：${targetOutlineNode.goal}`,
          `冲突：${targetOutlineNode.conflict || "暂无"}`,
          `出场角色：${targetOutlineNode.characters || "暂无"}`,
          `信息增量：${targetOutlineNode.information || "暂无"}`,
          `伏笔：${targetOutlineNode.foreshadowing || "暂无"}`,
        ].join("\n")
      : "",
    plan ? `计划状态：${plan.status}` : "",
    input.userInstruction?.trim()
      ? `用户补充要求：${input.userInstruction.trim()}`
      : "",
    reviewWarning,
    "## 书籍基础",
    `书名：${input.project.title}`,
    `题材：${input.project.genre}`,
    `核心设定：${input.project.premise}`,
    selection.includeWorld
      ? `世界观：${input.assets.worldNotes || input.project.world}`
      : "",
    selection.includeCharacters
      ? `角色：${input.assets.characters || input.project.protagonist}`
      : "",
    "## 大纲",
    selection.includeOutline ? input.assets.outline || "暂无大纲。" : "本次未带入完整大纲。",
    "## 当前设定",
    input.assets.settings || "暂无设定。",
    selectedKnowledge ? `## 设定资产\n${selectedKnowledge}` : "",
    selection.includeForeshadowing && foreshadowingSummary
      ? `## 伏笔池\n${foreshadowingSummary}`
      : "",
    selection.includeReviewIssues && unresolvedReviewIssues
      ? `## 待规避的审稿遗留问题\n${unresolvedReviewIssues}`
      : "",
    "## 最近章节摘要",
    recentSummaries || "暂无已生成章节摘要。",
    previousChapter && selection.includePreviousSummary
      ? `上一章摘要：${previousChapter.summary || "暂无摘要"}`
      : "上一章摘要：暂无。",
    `上一章正文片段：${previousExcerpt}`,
    "## 输出要求",
    [
      "直接输出本章正文，不要覆盖既有章节，不要生成其他章节。",
      "正文之后追加以下结构，便于系统自动沉淀设定资产：",
      "## 章节摘要",
      "用 2-4 句概括本章关键事件、情绪变化和结尾钩子。",
      "## 资产增量",
      "### 角色状态",
      "- 角色名：本章结束时的位置、关系、目标、伤势或心理变化",
      "### 新增伏笔",
      "- 本章新埋下但尚未兑现的信息、物件、承诺或疑问",
      "### 回收伏笔",
      "- 本章已经兑现、解释或反转的既有伏笔",
      "### 世界观增量",
      "- 本章新增的规则、地点、组织、历史、技术或社会信息",
      "没有内容的小节写“无”。",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildNovelReviseChapterInstruction(input: {
  project: Pick<
    InkosNovelProject,
    "title" | "genre" | "premise" | "world" | "protagonist" | "chapters" | "chapterWordCount"
  >;
  assets: Pick<NovelProjectAssets, "outline" | "worldNotes" | "characters" | "settings">;
  chapter: StoredNovelChapter;
  selectedIssueIds?: string[];
  userInstruction?: string;
}): string {
  const selectedIssues = buildSelectedNovelReviewIssues(
    input.chapter,
    input.selectedIssueIds ?? [],
  );
  return [
    "请根据审稿意见修订当前章节，输出完整修订后正文。",
    `修订目标：第 ${input.chapter.number} 章《${input.chapter.title}》`,
    `目标字数：${input.project.chapterWordCount ?? input.chapter.wordCount}`,
    input.userInstruction?.trim()
      ? `用户补充要求：${input.userInstruction.trim()}`
      : "",
    "## 书籍基础",
    `书名：${input.project.title}`,
    `题材：${input.project.genre}`,
    `核心设定：${input.project.premise}`,
    `世界观：${input.assets.worldNotes || input.project.world}`,
    `角色：${input.assets.characters || input.project.protagonist}`,
    "## 大纲",
    input.assets.outline || "暂无大纲。",
    "## 当前设定",
    input.assets.settings || "暂无设定。",
    "## 章节摘要",
    input.chapter.summary || "暂无摘要。",
    "## 审稿意见",
    selectedIssues.length > 0
      ? [
          "只修复以下选中的审稿问题，未选中的问题不要主动扩写或重构：",
          ...selectedIssues.map(
            (issue, index) =>
              `${index + 1}. [${issue.severity}/${issue.type ?? "other"}] ${issue.title}\n原文片段：${issue.excerpt || "未定位"}\n问题详情：${issue.detail}\n修改建议：${issue.suggestion || "按问题详情修复"}\n段落提示：${issue.paragraphHint || "自行定位"}`,
          ),
        ].join("\n")
      : `审稿意见：${input.chapter.reviewNotes || "请做一次基础润色和连贯性修订。"}`,
    "## 原章节正文",
    `原章节正文：\n${input.chapter.content}`,
    "## 输出要求",
    "只输出修订后的完整章节正文；不要输出解释、审稿报告或额外章节。必须保留原章节核心事件和人物动机。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildSelectedNovelReviewIssues(
  chapter: Pick<StoredNovelChapter, "reviews" | "activeReviewId">,
  selectedIssueIds: string[],
): NovelChapterReviewIssueView[] {
  if (selectedIssueIds.length === 0) {
    return [];
  }

  const selected = new Set(selectedIssueIds);

  return buildNovelReviewIssueViews(chapter.reviews ?? [], chapter.activeReviewId)
    .filter((issue) => selected.has(`${issue.reviewId}:${issue.id}`) || selected.has(issue.id))
    .filter((issue) => !issue.resolved);
}

export function markNovelReviewIssuesResolved(
  reviews: NovelChapterReview[],
  issueKeys: string[],
  resolvedByVersionId: string,
): NovelChapterReview[] {
  const selected = new Set(issueKeys);

  return reviews.map((review) => ({
    ...review,
    issues: review.issues.map((issue) => {
      const key = `${review.id}:${issue.id}`;
      if (!selected.has(key) && !selected.has(issue.id)) {
        return issue;
      }

      return {
        ...issue,
        resolved: true,
        resolvedByVersionId,
      };
    }),
  }));
}

export function buildNovelChapterContextPreview(input: {
  project: Pick<
    InkosNovelProject,
    "title" | "genre" | "premise" | "world" | "protagonist" | "chapters" | "chapterWordCount" | "targetChapters"
  >;
  assets: Pick<
    NovelProjectAssets,
    | "outline"
    | "outlineNodes"
    | "worldNotes"
    | "characters"
    | "settings"
    | "knowledgeAssets"
    | "contextSelection"
  >;
  chapters: StoredNovelChapter[];
  selectedChapterId?: string;
}): string {
  const sortedChapters = sortStoredNovelChapters(input.chapters);
  const selectedChapter =
    sortedChapters.find((chapter) => chapter.id === input.selectedChapterId) ??
    sortedChapters.at(-1);
  const nextTarget = selectNextNovelChapterTarget(input.project, sortedChapters);
  const recentSummaries = sortedChapters
    .slice(-5)
    .map((chapter) => `- 第 ${chapter.number} 章《${chapter.title}》：${chapter.summary || "暂无摘要"}（${chapter.wordCount} 字，${chapter.status}）`)
    .join("\n");
  const selectedOutlineNode = (input.assets.outlineNodes ?? []).find(
    (node) => node.chapterNumber === nextTarget.number,
  );
  const contextSelection =
    input.assets.contextSelection ??
    buildDefaultNovelContextSelection(input.project);
  const knowledgeSummary = buildNovelKnowledgeSummary(input.assets);

  return [
    "# 章节上下文",
    `书名：${input.project.title}`,
    `题材：${input.project.genre}`,
    `当前进度：${sortedChapters.length} / ${input.project.targetChapters ?? 120} 章`,
    selectedChapter
      ? `当前章节：第 ${selectedChapter.number} 章《${selectedChapter.title}》`
      : "当前章节：暂无已生成章节",
    selectedChapter ? `当前章节摘要：${selectedChapter.summary || "暂无摘要"}` : "",
    selectedChapter?.reviewNotes
      ? `审稿记录：${selectedChapter.reviewNotes.slice(0, 500)}`
      : "",
    `下一章目标：第 ${nextTarget.number} 章《${nextTarget.title}》`,
    `下一章计划：${nextTarget.focus}`,
    selectedOutlineNode
      ? [
          "## 结构化章节计划",
          `目标：${selectedOutlineNode.goal}`,
          `冲突：${selectedOutlineNode.conflict || "暂无"}`,
          `角色：${selectedOutlineNode.characters || "暂无"}`,
          `信息增量：${selectedOutlineNode.information || "暂无"}`,
          `伏笔：${selectedOutlineNode.foreshadowing || "暂无"}`,
        ].join("\n")
      : "",
    "## 写作上下文选择",
    [
      contextSelection.includeOutline ? "大纲" : "",
      contextSelection.includePreviousSummary ? "上一章摘要" : "",
      contextSelection.includeWorld ? "世界观" : "",
      contextSelection.includeCharacters ? "角色" : "",
      contextSelection.includeForeshadowing ? "伏笔" : "",
      contextSelection.includeReviewIssues ? "审稿遗留问题" : "",
    ]
      .filter(Boolean)
      .join(" / ") || "未选择上下文",
    "## 最近章节摘要",
    recentSummaries || "暂无已生成章节摘要。",
    "## 大纲",
    input.assets.outline || "暂无大纲。",
    "## 世界观 / 角色 / 设定",
    [
      input.assets.worldNotes || input.project.world,
      input.assets.characters || input.project.protagonist,
      input.assets.settings || input.project.premise,
    ]
      .filter(Boolean)
      .join("\n\n"),
    knowledgeSummary ? `## 设定资产\n${knowledgeSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatNovelRelativeAge(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();

  if (!Number.isFinite(timestamp)) {
    return "刚刚";
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "刚刚";
  }

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))} 分钟`;
  }

  if (diffMs < day) {
    return `${Math.max(1, Math.floor(diffMs / hour))} 小时`;
  }

  return `${Math.max(1, Math.floor(diffMs / day))} 天`;
}

function toNovelChapterWriteTarget(
  chapter: InkosChapter,
  fallbackWordCount: number | undefined,
  reason: NovelChapterWriteTarget["reason"],
): NovelChapterWriteTarget {
  return {
    number: chapter.number,
    title: chapter.title,
    focus: chapter.focus,
    targetWords: chapter.targetWords ?? fallbackWordCount ?? 3000,
    reason,
  };
}

export function createDefaultNovelAssets(
  project: InkosNovelProject,
): NovelProjectAssets {
  const now = new Date().toISOString();
  const outlineNodes = buildNovelOutlineNodesFromProject(project);

  return {
    outline: (project.chapters ?? [])
      .map((chapter) => `${chapter.number}. ${chapter.title}：${chapter.focus}`)
      .join("\n"),
    outlineNodes,
    worldNotes: project.world,
    characters: project.protagonist,
    settings: project.premise,
    knowledgeAssets: [
      ...(project.world
        ? [
            {
              id: `asset-world-${Date.now()}`,
              category: "world" as const,
              title: "世界观基础",
              content: project.world,
              status: "active" as const,
              tags: ["世界观"],
              updatedAt: now,
            },
          ]
        : []),
      ...(project.protagonist
        ? [
            {
              id: `asset-character-${Date.now()}`,
              category: "character" as const,
              title: "主角",
              content: project.protagonist,
              status: "active" as const,
              tags: ["主角"],
              updatedAt: now,
            },
          ]
        : []),
    ],
    pendingAssetDeltas: [],
    contextSelection: buildDefaultNovelContextSelection(project),
    genres: [
      {
        id: `genre-${Date.now()}`,
        name: project.genre || "未设定题材",
        source: "project",
        language: project.language,
        chapterTypes: "开局钩子, 线索推进, 反转揭露",
        fatigueWords: "忽然, 竟然, 震惊",
        pacingRule: "每 1800-2500 字出现一次信息增量或冲突升级。",
      },
    ],
    styleSamples: [
      {
        id: `style-${Date.now()}`,
        title: `${project.title} · 样章`,
        content:
          "雨停以后，裂缝还在城市中央发光。林照站在人群后面，看见自己的影子被切成两半。",
        updatedAt: new Date().toISOString(),
      },
    ],
    importedMaterials: [],
    marketRadars: [],
    diagnostics: [],
    pendingMigration: normalizePendingMigration({
      schemaVersion: 2,
      appliedSyncIds: [],
      legacyAppliedChapters: [],
      skippedPendingIds: [],
    }),
  };
}

export async function loadNovelWorkspace(): Promise<NovelWorkspaceSnapshot> {
  const db = await openNovelDb();

  try {
    const [
      books,
      sessions,
      messages,
      chapters,
      loadedChapterVersions,
      loadedTasks,
    ] = await Promise.all([
      getAllFromStore<StoredNovelBook>(db, BOOKS_STORE),
      getAllFromStore<StoredNovelSession>(db, SESSIONS_STORE),
      getAllFromStore<StoredNovelMessage>(db, MESSAGES_STORE),
      getAllFromStore<StoredNovelChapter>(db, CHAPTERS_STORE),
      getAllFromStore<StoredNovelChapterVersion>(db, CHAPTER_VERSIONS_STORE),
      getAllFromStore<StoredNovelTask>(db, TASKS_STORE),
    ]);
    const chapterVersions = await backfillMissingChapterVersions(
      db,
      chapters,
      loadedChapterVersions,
    );
    const tasks = recoverInterruptedNovelTasks(loadedTasks);
    const recoveredTasks = tasks.filter((task) => {
      const original = loadedTasks.find((item) => item.id === task.id);
      return original?.status === "running" && task.status === "error";
    });

    await Promise.all(
      recoveredTasks.map((task) => putInStore(db, TASKS_STORE, task)),
    );

    const { migratePendingAssetDeltas } = await import(
      "./novel-asset-auto-sync"
    );
    const normalizedBooks = books.map(normalizeStoredNovelBook);
    const migratedBooks: StoredNovelBook[] = [];

    for (const book of normalizedBooks) {
      const nextAssets = migratePendingAssetDeltas(book.assets);
      const pendingChanged =
        nextAssets.pendingAssetDeltas.length !==
          book.assets.pendingAssetDeltas.length ||
        nextAssets.pendingMigration?.migratedAt !==
          book.assets.pendingMigration?.migratedAt ||
        JSON.stringify(nextAssets.pendingMigration?.appliedSyncIds) !==
          JSON.stringify(book.assets.pendingMigration?.appliedSyncIds) ||
        JSON.stringify(nextAssets.pendingMigration?.legacyAppliedChapters) !==
          JSON.stringify(book.assets.pendingMigration?.legacyAppliedChapters) ||
        JSON.stringify(nextAssets.pendingMigration?.appliedChapters) !==
          JSON.stringify(book.assets.pendingMigration?.appliedChapters) ||
        JSON.stringify(nextAssets.pendingMigration?.skippedPendingIds) !==
          JSON.stringify(book.assets.pendingMigration?.skippedPendingIds) ||
        (nextAssets.diagnostics?.length ?? 0) !==
          (book.assets.diagnostics?.length ?? 0);

      if (pendingChanged) {
        const nextBook = {
          ...book,
          assets: nextAssets,
          updatedAt: new Date().toISOString(),
        };
        await putInStore(db, BOOKS_STORE, nextBook);
        migratedBooks.push(nextBook);
      } else {
        migratedBooks.push(book);
      }
    }

    return buildNovelWorkspaceSnapshot(
      migratedBooks,
      sessions,
      messages,
      chapters,
      chapterVersions,
      tasks,
    );
  } finally {
    db.close();
  }
}

export async function exportNovelWorkspaceBackup(
  modelSettings?: Parameters<typeof buildNovelWorkspaceBackupPayload>[1],
): Promise<NovelWorkspaceBackupPayload> {
  const snapshot = await loadNovelWorkspace();

  return buildNovelWorkspaceBackupPayload(snapshot, modelSettings);
}

export async function restoreNovelWorkspaceBackup(
  raw: string,
): Promise<NovelWorkspaceBackupPayload> {
  const payload = parseNovelWorkspaceBackupPayload(raw);
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [
        BOOKS_STORE,
        SESSIONS_STORE,
        MESSAGES_STORE,
        CHAPTERS_STORE,
        CHAPTER_VERSIONS_STORE,
        TASKS_STORE,
      ],
      "readwrite",
    );
    const stores = [
      BOOKS_STORE,
      SESSIONS_STORE,
      MESSAGES_STORE,
      CHAPTERS_STORE,
      CHAPTER_VERSIONS_STORE,
      TASKS_STORE,
    ];

    stores.forEach((storeName) => {
      transaction.objectStore(storeName).clear();
    });
    payload.books.forEach((book) => {
      transaction.objectStore(BOOKS_STORE).put(book);
    });
    payload.sessions.forEach((session) => {
      transaction.objectStore(SESSIONS_STORE).put(session);
    });
    payload.messages.forEach((message) => {
      transaction.objectStore(MESSAGES_STORE).put(message);
    });
    payload.chapters.forEach((chapter) => {
      transaction.objectStore(CHAPTERS_STORE).put(chapter);
    });
    payload.chapterVersions.forEach((version) => {
      transaction.objectStore(CHAPTER_VERSIONS_STORE).put(version);
    });
    payload.tasks.forEach((task) => {
      transaction.objectStore(TASKS_STORE).put(task);
    });

    await transactionDone(transaction);
    return payload;
  } finally {
    db.close();
  }
}

export async function createStoredNovelBook(
  input: CreateStoredNovelBookInput,
): Promise<{
  book: StoredNovelBook;
  session: StoredNovelSession;
  messages: StoredNovelMessage[];
}> {
  const now = new Date().toISOString();
  const bookId = `book-${Date.now()}`;
  const sessionId = `${bookId}-session-new`;
  const book: StoredNovelBook = {
    id: bookId,
    title: input.title,
    genre: input.genre,
    premise: input.premise,
    project: input.project,
    assets: input.assets ?? createDefaultNovelAssets(input.project),
    archived: false,
    sortIndex: Date.now(),
    createdAt: now,
    updatedAt: now,
  };
  const session: StoredNovelSession = {
    id: sessionId,
    bookId,
    title: "新会话",
    summary: "默认创作会话",
    createdAt: now,
    updatedAt: now,
  };
  const messages = (input.initialMessages ?? []).map((message, index) => ({
    ...message,
    sessionId,
    createdAt: new Date(Date.now() + index).toISOString(),
    status: message.status ?? "sent",
  }));
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [BOOKS_STORE, SESSIONS_STORE, MESSAGES_STORE],
      "readwrite",
    );

    transaction.objectStore(BOOKS_STORE).put(book);
    transaction.objectStore(SESSIONS_STORE).put(session);

    const messageStore = transaction.objectStore(MESSAGES_STORE);
    messages.forEach((message) => {
      messageStore.put(message);
    });

    await transactionDone(transaction);

    return { book, session, messages };
  } finally {
    db.close();
  }
}

export async function createStoredNovelSession(
  bookId: string,
  initialMessages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "sent" | "error";
  }>,
): Promise<{
  session: StoredNovelSession;
  messages: StoredNovelMessage[];
}> {
  const now = new Date().toISOString();
  const sessionId = `${bookId}-session-${Date.now()}`;
  const session: StoredNovelSession = {
    id: sessionId,
    bookId,
    title: "新会话",
    summary: "新的创作会话",
    createdAt: now,
    updatedAt: now,
  };
  const messages = initialMessages.map((message, index) => ({
    ...message,
    sessionId,
    createdAt: new Date(Date.now() + index).toISOString(),
    status: message.status ?? "sent",
  }));
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [BOOKS_STORE, SESSIONS_STORE, MESSAGES_STORE],
      "readwrite",
    );

    transaction.objectStore(SESSIONS_STORE).put(session);
    transaction.objectStore(BOOKS_STORE).get(bookId).onsuccess = (event) => {
      const request = event.target as IDBRequest<StoredNovelBook | undefined>;
      const book = request.result;

      if (book) {
        transaction.objectStore(BOOKS_STORE).put({
          ...book,
          updatedAt: now,
        });
      }
    };

    const messageStore = transaction.objectStore(MESSAGES_STORE);
    messages.forEach((message) => {
      messageStore.put(message);
    });

    await transactionDone(transaction);

    return { session, messages };
  } finally {
    db.close();
  }
}

export async function updateStoredNovelBook(
  bookId: string,
  updates: Partial<
    Pick<
      StoredNovelBook,
      "title" | "genre" | "premise" | "project" | "assets" | "archived" | "sortIndex"
    >
  >,
): Promise<StoredNovelBook | null> {
  const db = await openNovelDb();

  try {
    const book = await getFromStore<StoredNovelBook>(db, BOOKS_STORE, bookId);

    if (!book) {
      return null;
    }

    const now = new Date().toISOString();
    const nextBook: StoredNovelBook = {
      ...normalizeStoredNovelBook(book),
      ...updates,
      updatedAt: now,
    };

    await putInStore(db, BOOKS_STORE, nextBook);

    return nextBook;
  } finally {
    db.close();
  }
}

export async function upsertStoredNovelChapter(input: {
  bookId: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  status: InkosChapterStatus;
  wordCount?: number;
  reviewNotes?: string;
  reviews?: NovelChapterReview[];
  activeReviewId?: string;
  versionSource?: StoredNovelChapterVersionSource;
  versionNote?: string;
  versionReviewId?: string;
  revisedFromReviewId?: string;
}): Promise<StoredNovelChapter> {
  const db = await openNovelDb();

  try {
    const now = new Date().toISOString();
    const id = createNovelChapterId(input.bookId, input.number);
    const existing = await getFromStore<StoredNovelChapter>(
      db,
      CHAPTERS_STORE,
      id,
    );
    const chapter: StoredNovelChapter = normalizeStoredNovelChapter({
      ...existing,
      id,
      bookId: input.bookId,
      number: input.number,
      title: input.title,
      content: input.content,
      summary: input.summary,
      status: input.status,
      wordCount: input.wordCount ?? countNovelWords(input.content),
      reviewNotes: input.reviewNotes ?? existing?.reviewNotes ?? "",
      reviews: input.reviews ?? existing?.reviews ?? [],
      activeReviewId: input.activeReviewId ?? existing?.activeReviewId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    const transaction = db.transaction(
      [BOOKS_STORE, CHAPTERS_STORE, CHAPTER_VERSIONS_STORE],
      "readwrite",
    );

    transaction.objectStore(CHAPTERS_STORE).put(chapter);
    transaction
      .objectStore(CHAPTER_VERSIONS_STORE)
      .put(
        createStoredNovelChapterVersion(
          chapter,
          input.versionSource ?? "generation",
          now,
          input.versionNote,
          {
            reviewId: input.versionReviewId,
            revisedFromReviewId: input.revisedFromReviewId,
          },
        ),
      );
    transaction.objectStore(BOOKS_STORE).get(input.bookId).onsuccess = (
      event,
    ) => {
      const request = event.target as IDBRequest<StoredNovelBook | undefined>;
      const book = request.result;

      if (book) {
        transaction.objectStore(BOOKS_STORE).put({
          ...book,
          updatedAt: now,
        });
      }
    };

    await transactionDone(transaction);

    return chapter;
  } finally {
    db.close();
  }
}

export async function updateStoredNovelChapter(
  chapterId: string,
  updates: Partial<
    Pick<
      StoredNovelChapter,
      | "title"
      | "content"
      | "summary"
      | "status"
      | "wordCount"
      | "reviewNotes"
      | "reviews"
      | "activeReviewId"
      | "publicationStatus"
      | "publishedAt"
    >
  >,
  options?: {
    versionSource?: StoredNovelChapterVersionSource;
    versionNote?: string;
    versionReviewId?: string;
    revisedFromReviewId?: string;
    skipVersion?: boolean;
  },
): Promise<StoredNovelChapter | null> {
  const db = await openNovelDb();

  try {
    const chapter = await getFromStore<StoredNovelChapter>(
      db,
      CHAPTERS_STORE,
      chapterId,
    );

    if (!chapter) {
      return null;
    }

    const now = new Date().toISOString();
    const nextChapter = normalizeStoredNovelChapter({
      ...chapter,
      ...updates,
      wordCount:
        updates.wordCount ??
        (updates.content === undefined
          ? chapter.wordCount
          : countNovelWords(updates.content)),
      updatedAt: now,
    });
    const shouldCreateVersion =
      !options?.skipVersion &&
      (updates.title !== undefined ||
        updates.content !== undefined ||
        updates.summary !== undefined ||
        updates.status !== undefined ||
        updates.reviewNotes !== undefined);
    const transaction = db.transaction(
      [BOOKS_STORE, CHAPTERS_STORE, CHAPTER_VERSIONS_STORE],
      "readwrite",
    );

    transaction.objectStore(CHAPTERS_STORE).put(nextChapter);
    if (shouldCreateVersion) {
      transaction
        .objectStore(CHAPTER_VERSIONS_STORE)
        .put(
          createStoredNovelChapterVersion(
            nextChapter,
            options?.versionSource ?? inferChapterVersionSource(updates),
            now,
            options?.versionNote,
            {
              reviewId: options?.versionReviewId,
              revisedFromReviewId: options?.revisedFromReviewId,
            },
          ),
        );
    }
    transaction.objectStore(BOOKS_STORE).get(nextChapter.bookId).onsuccess = (
      event,
    ) => {
      const request = event.target as IDBRequest<StoredNovelBook | undefined>;
      const book = request.result;

      if (book) {
        transaction.objectStore(BOOKS_STORE).put({
          ...book,
          updatedAt: now,
        });
      }
    };

    await transactionDone(transaction);

    return nextChapter;
  } finally {
    db.close();
  }
}

export async function restoreStoredNovelChapterVersion(
  versionId: string,
): Promise<StoredNovelChapter | null> {
  const db = await openNovelDb();

  try {
    const version = await getFromStore<StoredNovelChapterVersion>(
      db,
      CHAPTER_VERSIONS_STORE,
      versionId,
    );

    if (!version) {
      return null;
    }

    return updateStoredNovelChapter(
      version.chapterId,
      {
        title: version.title,
        content: version.content,
        summary: version.summary,
        status: version.status,
        wordCount: version.wordCount,
        reviewNotes: version.reviewNotes,
        reviews: version.reviews,
        activeReviewId: version.reviewId ?? version.revisedFromReviewId,
      },
      {
        versionSource: "restore",
        versionNote: `恢复自 ${formatNovelChapterVersionSource(version.source)} 版本`,
        versionReviewId: version.reviewId,
        revisedFromReviewId: version.revisedFromReviewId,
      },
    );
  } finally {
    db.close();
  }
}

export async function deleteStoredNovelChapter(
  chapterId: string,
): Promise<void> {
  const db = await openNovelDb();

  try {
    const chapter = await getFromStore<StoredNovelChapter>(
      db,
      CHAPTERS_STORE,
      chapterId,
    );
    const transaction = db.transaction(
      [BOOKS_STORE, CHAPTERS_STORE, CHAPTER_VERSIONS_STORE],
      "readwrite",
    );

    transaction.objectStore(CHAPTERS_STORE).delete(chapterId);
    const versionStore = transaction.objectStore(CHAPTER_VERSIONS_STORE);
    const versionIndex = versionStore.index("chapterId");
    const versionRequest = versionIndex.openCursor(chapterId);

    versionRequest.onsuccess = () => {
      const cursor = versionRequest.result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    if (chapter) {
      const now = new Date().toISOString();

      transaction.objectStore(BOOKS_STORE).get(chapter.bookId).onsuccess = (
        event,
      ) => {
        const request = event.target as IDBRequest<StoredNovelBook | undefined>;
        const book = request.result;

        if (book) {
          transaction.objectStore(BOOKS_STORE).put({
            ...book,
            updatedAt: now,
          });
        }
      };
    }

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function deleteStoredNovelBook(bookId: string): Promise<void> {
  const snapshot = await loadNovelWorkspace();
  const sessionIds = (snapshot.sessionsByBookId[bookId] ?? []).map(
    (session) => session.id,
  );
  const chapterIds = (snapshot.chaptersByBookId[bookId] ?? []).map(
    (chapter) => chapter.id,
  );
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [
        BOOKS_STORE,
        SESSIONS_STORE,
        MESSAGES_STORE,
        CHAPTERS_STORE,
        CHAPTER_VERSIONS_STORE,
      ],
      "readwrite",
    );

    transaction.objectStore(BOOKS_STORE).delete(bookId);

    const sessionStore = transaction.objectStore(SESSIONS_STORE);
    sessionIds.forEach((sessionId) => {
      sessionStore.delete(sessionId);
    });

    const messageStore = transaction.objectStore(MESSAGES_STORE);
    sessionIds.forEach((sessionId) => {
      (snapshot.messagesBySessionId[sessionId] ?? []).forEach((message) => {
        messageStore.delete(message.id);
      });
    });

    const chapterStore = transaction.objectStore(CHAPTERS_STORE);
    chapterIds.forEach((chapterId) => {
      chapterStore.delete(chapterId);
    });
    const versionStore = transaction.objectStore(CHAPTER_VERSIONS_STORE);
    const versionBookIndex = versionStore.index("bookId");
    const versionRequest = versionBookIndex.openCursor(bookId);

    versionRequest.onsuccess = () => {
      const cursor = versionRequest.result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function updateStoredNovelSession(
  sessionId: string,
  updates: Partial<Pick<StoredNovelSession, "title" | "summary">>,
): Promise<StoredNovelSession | null> {
  const db = await openNovelDb();

  try {
    const session = await getFromStore<StoredNovelSession>(
      db,
      SESSIONS_STORE,
      sessionId,
    );

    if (!session) {
      return null;
    }

    const now = new Date().toISOString();
    const nextSession: StoredNovelSession = {
      ...normalizeStoredNovelSession(session),
      ...updates,
      updatedAt: now,
    };

    await putInStore(db, SESSIONS_STORE, nextSession);

    return nextSession;
  } finally {
    db.close();
  }
}

export async function deleteStoredNovelSession(
  sessionId: string,
): Promise<void> {
  const snapshot = await loadNovelWorkspace();
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [SESSIONS_STORE, MESSAGES_STORE],
      "readwrite",
    );

    transaction.objectStore(SESSIONS_STORE).delete(sessionId);
    const messageStore = transaction.objectStore(MESSAGES_STORE);
    Object.values(snapshot.messagesBySessionId)
      .flat()
      .filter((message) => message.sessionId === sessionId)
      .forEach((message) => {
        messageStore.delete(message.id);
      });

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function clearStoredNovelSessionMessages(
  sessionId: string,
): Promise<void> {
  const snapshot = await loadNovelWorkspace();
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(MESSAGES_STORE, "readwrite");
    const messageStore = transaction.objectStore(MESSAGES_STORE);

    (snapshot.messagesBySessionId[sessionId] ?? []).forEach((message) => {
      messageStore.delete(message.id);
    });

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function updateStoredNovelMessage(
  messageId: string,
  updates: Partial<Pick<StoredNovelMessage, "content" | "status">>,
): Promise<StoredNovelMessage | null> {
  const db = await openNovelDb();

  try {
    const message = await getFromStore<StoredNovelMessage>(
      db,
      MESSAGES_STORE,
      messageId,
    );

    if (!message) {
      return null;
    }

    const nextMessage: StoredNovelMessage = {
      ...message,
      ...updates,
    };

    await putInStore(db, MESSAGES_STORE, nextMessage);

    return nextMessage;
  } finally {
    db.close();
  }
}

export async function appendStoredNovelMessage(
  sessionId: string,
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "sent" | "error";
  },
): Promise<StoredNovelMessage> {
  const now = new Date().toISOString();
  const storedMessage: StoredNovelMessage = {
    ...message,
    sessionId,
    createdAt: now,
    status: message.status ?? "sent",
  };
  const db = await openNovelDb();

  try {
    const transaction = db.transaction(
      [BOOKS_STORE, SESSIONS_STORE, MESSAGES_STORE],
      "readwrite",
    );

    transaction.objectStore(MESSAGES_STORE).put(storedMessage);
    transaction.objectStore(SESSIONS_STORE).get(sessionId).onsuccess = (event) => {
      const request = event.target as IDBRequest<StoredNovelSession | undefined>;
      const session = request.result;

      if (!session) {
        return;
      }

      transaction.objectStore(SESSIONS_STORE).put({
        ...session,
        updatedAt: now,
      });
      transaction.objectStore(BOOKS_STORE).get(session.bookId).onsuccess = (
        bookEvent,
      ) => {
        const bookRequest = bookEvent.target as IDBRequest<
          StoredNovelBook | undefined
        >;
        const book = bookRequest.result;

        if (book) {
          transaction.objectStore(BOOKS_STORE).put({
            ...book,
            updatedAt: now,
          });
        }
      };
    };

    await transactionDone(transaction);

    return storedMessage;
  } finally {
    db.close();
  }
}

export async function createStoredNovelTask(input: {
  bookId: string;
  sessionId: string;
  action: string;
  label: string;
  status?: Extract<StoredNovelTaskStatus, "queued" | "running">;
  targetChapterId?: string;
  targetChapterNumber?: number;
  targetChapterTitle?: string;
}): Promise<StoredNovelTask> {
  const now = new Date().toISOString();
  const status = input.status ?? "running";
  const task: StoredNovelTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookId: input.bookId,
    sessionId: input.sessionId,
    action: input.action,
    label: input.label,
    status,
    logs: [
      {
        id: `log-${Date.now()}`,
        message: status === "queued" ? "任务已加入队列。" : "任务开始。",
        createdAt: now,
      },
    ],
    targetChapterId: input.targetChapterId,
    targetChapterNumber: input.targetChapterNumber,
    targetChapterTitle: input.targetChapterTitle,
    startedAt: now,
  };
  const db = await openNovelDb();

  try {
    await putInStore(db, TASKS_STORE, task);
    return task;
  } finally {
    db.close();
  }
}

export async function startStoredNovelTask(
  taskId: string,
): Promise<StoredNovelTask | null> {
  const db = await openNovelDb();

  try {
    const task = await getFromStore<StoredNovelTask>(db, TASKS_STORE, taskId);
    if (!task) return null;
    const now = new Date().toISOString();
    const resumingFromCheckpoint =
      task.status === "paused" && Boolean(task.checkpoint);
    const nextTask: StoredNovelTask = {
      ...task,
      status: "running",
      errorMessage: undefined,
      startedAt:
        task.status === "queued" || task.status === "paused"
          ? now
          : task.startedAt,
      endedAt: undefined,
      logs: [
        ...task.logs,
        {
          id: `log-${Date.now()}-${task.logs.length + 1}`,
          message: resumingFromCheckpoint
            ? "从断点继续执行。"
            : "任务开始执行。",
          createdAt: now,
        },
      ],
    };
    await putInStore(db, TASKS_STORE, nextTask);
    return nextTask;
  } finally {
    db.close();
  }
}

export async function appendStoredNovelTaskLog(
  taskId: string,
  message: string,
): Promise<StoredNovelTask | null> {
  const db = await openNovelDb();

  try {
    const task = await getFromStore<StoredNovelTask>(db, TASKS_STORE, taskId);
    if (!task) return null;
    const nextTask: StoredNovelTask = {
      ...task,
      logs: [
        ...task.logs,
        {
          id: `log-${Date.now()}-${task.logs.length + 1}`,
          message,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await putInStore(db, TASKS_STORE, nextTask);
    return nextTask;
  } finally {
    db.close();
  }
}

export async function finishStoredNovelTask(
  taskId: string,
  status: Exclude<StoredNovelTaskStatus, "running">,
  errorMessage?: string,
): Promise<StoredNovelTask | null> {
  const db = await openNovelDb();

  try {
    const task = await getFromStore<StoredNovelTask>(db, TASKS_STORE, taskId);
    if (!task) return null;
    const now = new Date().toISOString();
    const nextTask: StoredNovelTask = {
      ...task,
      status,
      errorMessage,
      endedAt: now,
      logs: [
        ...task.logs,
        {
          id: `log-${Date.now()}-${task.logs.length + 1}`,
          message:
            status === "success"
              ? "任务完成。"
              : status === "cancelled"
                ? "任务取消。"
                : status === "skipped"
                  ? "任务跳过。"
                  : status === "paused"
                    ? "任务暂停。"
                    : errorMessage || "任务失败。",
          createdAt: now,
        },
      ],
    };
    await putInStore(db, TASKS_STORE, nextTask);
    return nextTask;
  } finally {
    db.close();
  }
}

export async function pauseStoredNovelTask(
  taskId: string,
): Promise<StoredNovelTask | null> {
  return finishStoredNovelTask(taskId, "paused", "任务已暂停，可稍后继续。");
}

export async function pauseStoredNovelTaskWithCheckpoint(
  taskId: string,
  checkpoint: StoredNovelTaskCheckpoint,
): Promise<StoredNovelTask | null> {
  const db = await openNovelDb();

  try {
    const task = await getFromStore<StoredNovelTask>(db, TASKS_STORE, taskId);
    if (!task) {
      return null;
    }

    const now = new Date().toISOString();
    const nextTask: StoredNovelTask = {
      ...task,
      status: "paused",
      endedAt: now,
      errorMessage: "任务已暂停，可从任务日志继续。",
      checkpoint: {
        ...checkpoint,
        savedAt: checkpoint.savedAt || now,
      },
      logs: [
        ...task.logs,
        {
          id: `log-${Date.now()}-${task.logs.length + 1}`,
          message: "任务已暂停，进度已保存。",
          createdAt: now,
        },
      ],
    };
    await putInStore(db, TASKS_STORE, nextTask);
    return nextTask;
  } finally {
    db.close();
  }
}

export function buildNovelTaskResumePreview(task: StoredNovelTask): {
  canResume: boolean;
  progressCount: number;
  savedAt?: string;
  summary: string;
} {
  if (task.status !== "paused" || !task.checkpoint) {
    return {
      canResume: false,
      progressCount: 0,
      summary: "当前任务不支持断点续跑。",
    };
  }

  const progressCount = task.checkpoint.progressMessages.length;

  return {
    canResume: true,
    progressCount,
    savedAt: task.checkpoint.savedAt,
    summary: `已保存 ${progressCount} 条进度，可继续执行。`,
  };
}

export async function clearStoredNovelTaskCheckpoint(
  taskId: string,
): Promise<StoredNovelTask | null> {
  const db = await openNovelDb();

  try {
    const task = await getFromStore<StoredNovelTask>(db, TASKS_STORE, taskId);
    if (!task || !task.checkpoint) {
      return task;
    }

    const nextTask: StoredNovelTask = {
      ...task,
      checkpoint: undefined,
    };
    await putInStore(db, TASKS_STORE, nextTask);
    return nextTask;
  } finally {
    db.close();
  }
}

export async function skipStoredNovelTask(
  taskId: string,
): Promise<StoredNovelTask | null> {
  return finishStoredNovelTask(taskId, "skipped", "任务已跳过。");
}

async function backfillMissingChapterVersions(
  db: IDBDatabase,
  chapters: StoredNovelChapter[],
  chapterVersions: StoredNovelChapterVersion[],
): Promise<StoredNovelChapterVersion[]> {
  const versionChapterIds = new Set(
    chapterVersions.map((version) => version.chapterId),
  );
  const missingVersions = chapters
    .map(normalizeStoredNovelChapter)
    .filter(
      (chapter) =>
        chapter.content.trim().length > 0 && !versionChapterIds.has(chapter.id),
    )
    .map((chapter) =>
      createStoredNovelChapterVersion(
        chapter,
        "generation",
        chapter.createdAt,
        "从既有章节补建初始版本",
      ),
    );

  if (missingVersions.length === 0) {
    return chapterVersions;
  }

  const transaction = db.transaction(CHAPTER_VERSIONS_STORE, "readwrite");
  const store = transaction.objectStore(CHAPTER_VERSIONS_STORE);
  missingVersions.forEach((version) => {
    store.put(version);
  });
  await transactionDone(transaction);

  return [...chapterVersions, ...missingVersions];
}

export function buildNovelWorkspaceSnapshotForTest(
  books: StoredNovelBook[],
  sessions: StoredNovelSession[],
  messages: StoredNovelMessage[],
  chapters: StoredNovelChapter[],
  chapterVersions: StoredNovelChapterVersion[],
  tasks: StoredNovelTask[] = [],
): NovelWorkspaceSnapshot {
  return buildNovelWorkspaceSnapshot(
    books,
    sessions,
    messages,
    chapters,
    chapterVersions,
    tasks,
  );
}

function buildNovelWorkspaceSnapshot(
  books: StoredNovelBook[],
  sessions: StoredNovelSession[],
  messages: StoredNovelMessage[],
  chapters: StoredNovelChapter[],
  chapterVersions: StoredNovelChapterVersion[],
  tasks: StoredNovelTask[] = [],
): NovelWorkspaceSnapshot {
  const normalizedSessions = sessions.map(normalizeStoredNovelSession);
  const normalizedChapters = chapters.map(normalizeStoredNovelChapter);
  const normalizedChapterVersions = chapterVersions.map(
    normalizeStoredNovelChapterVersion,
  );
  const sessionsByBookId = normalizedSessions.reduce<
    Record<string, StoredNovelSession[]>
  >((groups, session) => {
    groups[session.bookId] = [...(groups[session.bookId] ?? []), session];
    return groups;
  }, {});
  const messagesBySessionId = messages.reduce<
    Record<string, StoredNovelMessage[]>
  >((groups, message) => {
    groups[message.sessionId] = [...(groups[message.sessionId] ?? []), message];
    return groups;
  }, {});
  const chaptersByBookId = normalizedChapters.reduce<
    Record<string, StoredNovelChapter[]>
  >((groups, chapter) => {
    groups[chapter.bookId] = [...(groups[chapter.bookId] ?? []), chapter];
    return groups;
  }, {});
  const chapterVersionsByChapterId = normalizedChapterVersions.reduce<
    Record<string, StoredNovelChapterVersion[]>
  >((groups, version) => {
    groups[version.chapterId] = [...(groups[version.chapterId] ?? []), version];
    return groups;
  }, {});
  const tasksByBookId = tasks.reduce<Record<string, StoredNovelTask[]>>(
    (groups, task) => {
      groups[task.bookId] = [...(groups[task.bookId] ?? []), task];
      return groups;
    },
    {},
  );

  Object.keys(sessionsByBookId).forEach((bookId) => {
    sessionsByBookId[bookId] = sortStoredNovelSessions(sessionsByBookId[bookId]!);
  });
  Object.keys(messagesBySessionId).forEach((sessionId) => {
    messagesBySessionId[sessionId] = sortStoredNovelMessages(
      messagesBySessionId[sessionId]!,
    );
  });
  Object.keys(chaptersByBookId).forEach((bookId) => {
    chaptersByBookId[bookId] = sortStoredNovelChapters(chaptersByBookId[bookId]!);
  });
  Object.keys(chapterVersionsByChapterId).forEach((chapterId) => {
    chapterVersionsByChapterId[chapterId] = sortStoredNovelChapterVersions(
      chapterVersionsByChapterId[chapterId]!,
    );
  });
  Object.keys(tasksByBookId).forEach((bookId) => {
    tasksByBookId[bookId] = [...tasksByBookId[bookId]!].sort(
      (left, right) =>
        new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
    );
  });

  return {
    books: sortStoredNovelBooks(books.map(normalizeStoredNovelBook)),
    sessionsByBookId,
    messagesBySessionId,
    chaptersByBookId,
    chapterVersionsByChapterId,
    tasksByBookId,
  };
}

function normalizeStoredNovelBook(book: StoredNovelBook): StoredNovelBook {
  const project = book.project;

  return {
    ...book,
    assets: normalizeNovelProjectAssets(project, book.assets),
    archived: book.archived ?? false,
    sortIndex: book.sortIndex ?? new Date(book.updatedAt).getTime(),
  };
}

function normalizeStoredNovelSession(
  session: StoredNovelSession,
): StoredNovelSession {
  return {
    ...session,
    summary: session.summary ?? "创作会话",
  };
}

function normalizeStoredNovelChapter(
  chapter: StoredNovelChapter,
): StoredNovelChapter {
  const now = new Date().toISOString();
  const reviews =
    chapter.reviews?.length > 0
      ? chapter.reviews
      : chapter.reviewNotes
        ? [parseNovelReviewNotes(chapter.reviewNotes, chapter.updatedAt ?? now)]
        : [];

  return {
    ...chapter,
    id: chapter.id || createNovelChapterId(chapter.bookId, chapter.number),
    title: chapter.title || `第 ${chapter.number} 章`,
    content: chapter.content ?? "",
    summary: chapter.summary ?? "",
    status: chapter.status ?? "drafting",
    wordCount: chapter.wordCount ?? countNovelWords(chapter.content ?? ""),
    reviewNotes: chapter.reviewNotes ?? "",
    reviews,
    activeReviewId: chapter.activeReviewId ?? reviews[0]?.id,
    publicationStatus: chapter.publicationStatus ?? "draft",
    publishedAt: chapter.publishedAt,
    createdAt: chapter.createdAt ?? now,
    updatedAt: chapter.updatedAt ?? chapter.createdAt ?? now,
  };
}

function normalizeStoredNovelChapterVersion(
  version: StoredNovelChapterVersion,
): StoredNovelChapterVersion {
  const now = new Date().toISOString();
  const reviews =
    version.reviews?.length > 0
      ? version.reviews
      : version.reviewNotes
        ? [parseNovelReviewNotes(version.reviewNotes, version.createdAt ?? now)]
        : [];

  return {
    ...version,
    id:
      version.id ||
      createNovelChapterVersionId(version.chapterId, version.source, now),
    title: version.title || `第 ${version.number} 章`,
    content: version.content ?? "",
    summary: version.summary ?? "",
    status: version.status ?? "drafting",
    wordCount: version.wordCount ?? countNovelWords(version.content ?? ""),
    reviewNotes: version.reviewNotes ?? "",
    reviews,
    reviewId: version.reviewId ?? reviews[0]?.id,
    source: version.source ?? "manual-edit",
    createdAt: version.createdAt ?? now,
  };
}

function createNovelChapterId(bookId: string, chapterNumber: number): string {
  return `${bookId}-chapter-${String(chapterNumber).padStart(4, "0")}`;
}

function createNovelChapterVersionId(
  chapterId: string,
  source: StoredNovelChapterVersionSource,
  createdAt: string,
): string {
  const suffix = createdAt.replace(/[^0-9]/g, "");

  return `${chapterId}-version-${source}-${suffix}`;
}

function createNovelReviewId(createdAt: string): string {
  return `review-${createdAt.replace(/[^0-9]/g, "")}`;
}

function sanitizeNovelExportFilename(value: string): string {
  return (
    (value || "未命名章节")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "")
      .slice(0, 48) || "未命名章节"
  );
}

function extractNovelSection(content: string, title: string): string {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`(?:^|\\n)##\\s+${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`),
  );

  return match?.[1]?.trim() ?? "";
}

function extractNovelSubsection(content: string, title: string): string {
  if (!content.trim()) return "";
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`(?:^|\\n)###\\s+${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|$)`),
  );

  return match?.[1]?.trim() ?? "";
}

function parseNovelBulletLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[:：]/, "").trim())
    .filter((line) => line && !isEmptyNovelAssetMarker(line));
}

function parseNovelCharacterStates(
  content: string,
): Array<{ title: string; content: string }> {
  return parseNovelBulletLines(content).map((line) => {
    const [title = "", ...rest] = line.split(/[：:]/);
    const normalizedTitle = title.trim() || "未命名角色";
    const normalizedContent = rest.join("：").trim() || line.trim();

    return {
      title: normalizedTitle,
      content: normalizedContent,
    };
  });
}

function hasNovelChapterAssetDeltaContent(delta: NovelChapterAssetDelta): boolean {
  return (
    delta.characterStates.length > 0 ||
    delta.newForeshadowing.length > 0 ||
    delta.resolvedForeshadowing.length > 0 ||
    delta.worldIncrements.length > 0
  );
}

function buildFallbackNovelChapterSummary(content: string): string {
  return (
    content
      .replace(/^#\s+.+$/gm, "")
      .replace(/\n##\s+[\s\S]*$/m, "")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .find(Boolean)
      ?.slice(0, 180) ?? ""
  );
}

function isEmptyNovelAssetMarker(value: string): boolean {
  return /^(无|暂无|没有|无新增|无变化)[。.!！\s]*$/.test(value.trim());
}

function normalizeNovelAssetText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s，。；;,.、！!？?：:"""''（）()[\]【】]/g, "");
}

function extractNovelAssetKeywords(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[，。；;,.、\s/|]+/)
        .map((item) => normalizeNovelAssetText(item))
        .filter((item) => item.length >= 2),
    ),
  ];
}

function extractNovelForeshadowingCoreLabel(value: string): string {
  return value
    .replace(/^(新增伏笔|回收伏笔|伏笔)[·•\s-]*/u, "")
    .replace(/^第\d+章[·•\s-]*/u, "")
    .trim();
}

export function buildNovelKnowledgeAssetMatchPreview(
  assets: NovelKnowledgeAsset[],
  nextAsset: Omit<NovelKnowledgeAsset, "id">,
): NovelKnowledgeAssetMatchPreview {
  const index = matchNovelKnowledgeAssetIndex(assets, nextAsset);
  const matchedAsset = index >= 0 ? assets[index] : undefined;
  const score =
    matchedAsset !== undefined
      ? scoreNovelKnowledgeAssetMatch(matchedAsset, nextAsset)
      : 0;

  if (nextAsset.status === "resolved") {
    if (matchedAsset) {
      return {
        action: "resolve",
        score,
        label: `回收并合并至「${matchedAsset.title}」`,
        matchedAsset,
      };
    }

    return {
      action: "create",
      score: 0,
      label: "新建已回收伏笔条目",
    };
  }

  if (matchedAsset) {
    return {
      action: "merge",
      score,
      label: `合并至「${matchedAsset.title}」`,
      matchedAsset,
    };
  }

  return {
    action: "create",
    score: 0,
    label: "新建伏笔条目",
  };
}

export function buildNovelPendingAssetDeltaMatchReport(
  assets: Pick<NovelProjectAssets, "knowledgeAssets">,
  delta: NovelChapterAssetDelta,
): NovelPendingAssetDeltaMatchReport {
  const knowledgeAssets = assets.knowledgeAssets ?? [];
  const newForeshadowing = delta.newForeshadowing.map((text) => ({
    text,
    preview: buildNovelKnowledgeAssetMatchPreview(knowledgeAssets, {
      category: "foreshadowing",
      title: extractNovelForeshadowingCoreLabel(text),
      content: text,
      status: "draft",
      tags: ["新增伏笔"],
      updatedAt: new Date().toISOString(),
    }),
  }));
  const resolvedForeshadowing = delta.resolvedForeshadowing.map((text) => ({
    text,
    preview: buildNovelKnowledgeAssetMatchPreview(knowledgeAssets, {
      category: "foreshadowing",
      title: extractNovelForeshadowingCoreLabel(text),
      content: text,
      status: "resolved",
      tags: ["回收伏笔"],
      updatedAt: new Date().toISOString(),
    }),
  }));
  const mergeCount =
    newForeshadowing.filter((item) => item.preview.action === "merge").length +
    resolvedForeshadowing.filter((item) => item.preview.action === "resolve")
      .length;
  const createCount =
    newForeshadowing.filter((item) => item.preview.action === "create").length +
    resolvedForeshadowing.filter((item) => item.preview.action === "create")
      .length;

  return {
    newForeshadowing,
    resolvedForeshadowing,
    summary:
      mergeCount > 0
        ? `伏笔匹配：${mergeCount} 项可合并，${createCount} 项将新建。`
        : createCount > 0
          ? `伏笔匹配：${createCount} 项将新建。`
          : "暂无可匹配的伏笔增量。",
  };
}

function scoreNovelKnowledgeAssetMatch(
  existing: NovelKnowledgeAsset,
  nextAsset: Omit<NovelKnowledgeAsset, "id">,
): number {
  if (existing.category !== nextAsset.category) {
    return 0;
  }

  const existingTitle = normalizeNovelAssetText(existing.title);
  const nextTitle = normalizeNovelAssetText(nextAsset.title);
  const nextCoreTitle = normalizeNovelAssetText(
    extractNovelForeshadowingCoreLabel(nextAsset.title),
  );
  const existingCoreTitle = normalizeNovelAssetText(
    extractNovelForeshadowingCoreLabel(existing.title),
  );

  if (existingTitle && nextTitle && existingTitle === nextTitle) {
    return 1;
  }

  if (
    existingCoreTitle &&
    nextCoreTitle &&
    (existingCoreTitle === nextCoreTitle ||
      existingCoreTitle.includes(nextCoreTitle) ||
      nextCoreTitle.includes(existingCoreTitle))
  ) {
    return 0.95;
  }

  if (
    existingTitle &&
    nextTitle &&
    (existingTitle.includes(nextTitle) || nextTitle.includes(existingTitle))
  ) {
    return 0.88;
  }

  const existingKeywords = extractNovelAssetKeywords(
    `${existing.title} ${existing.content}`,
  );
  const nextKeywords = extractNovelAssetKeywords(
    `${nextAsset.title} ${nextAsset.content}`,
  );

  if (nextKeywords.length === 0) {
    return 0;
  }

  const overlap = nextKeywords.filter((keyword) =>
    existingKeywords.some(
      (existingKeyword) =>
        existingKeyword.includes(keyword) || keyword.includes(existingKeyword),
    ),
  ).length;
  const score = overlap / nextKeywords.length;

  if (
    nextAsset.category === "foreshadowing" ||
    nextAsset.category === "character"
  ) {
    return score >= 0.45 ? score : 0;
  }

  return score >= 0.6 ? score : 0;
}

export function matchNovelKnowledgeAssetIndex(
  assets: NovelKnowledgeAsset[],
  nextAsset: Omit<NovelKnowledgeAsset, "id">,
): number {
  const exactIndex = assets.findIndex(
    (asset) =>
      asset.category === nextAsset.category &&
      normalizeNovelAssetText(asset.title) ===
        normalizeNovelAssetText(nextAsset.title),
  );

  if (exactIndex >= 0) {
    return exactIndex;
  }

  let bestIndex = -1;
  let bestScore = 0;

  assets.forEach((asset, index) => {
    const score = scoreNovelKnowledgeAssetMatch(asset, nextAsset);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function upsertNovelKnowledgeAsset(
  assets: NovelKnowledgeAsset[],
  nextAsset: Omit<NovelKnowledgeAsset, "id">,
): NovelKnowledgeAsset[] {
  const index = matchNovelKnowledgeAssetIndex(assets, nextAsset);

  if (index < 0) {
    return [
      {
        id: `asset-${nextAsset.category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...nextAsset,
      },
      ...assets,
    ];
  }

  const existing = assets[index]!;
  const nextContent = existing.content.includes(nextAsset.content)
    ? existing.content
    : [existing.content, nextAsset.content].filter(Boolean).join("\n\n");
  const nextTags = Array.from(new Set([...existing.tags, ...nextAsset.tags]));

  return assets.map((asset, assetIndex) =>
    assetIndex === index
      ? {
          ...asset,
          content: nextContent,
          status:
            nextAsset.status === "resolved" ? "resolved" : asset.status,
          tags: nextTags,
          updatedAt: nextAsset.updatedAt,
        }
      : asset,
  );
}

function createNovelAssetTitle(
  prefix: string,
  chapterNumber: number,
  content: string,
  index: number,
): string {
  const compact = content.replace(/\s+/g, "").slice(0, 18);

  return `${prefix}·第${chapterNumber}章·${compact || index + 1}`;
}

function mergeNovelLongText(
  existing: string,
  additions: string[],
  heading: string,
): string {
  const uniqueAdditions = additions.filter(
    (item) => item.trim() && !existing.includes(item.trim()),
  );

  if (uniqueAdditions.length === 0) {
    return existing;
  }

  return [
    existing.trim(),
    `## ${heading}`,
    ...uniqueAdditions.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeDiffLines(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function countLineOccurrences(lines: string[]): Map<string, number> {
  return lines.reduce((counts, line) => {
    counts.set(line, (counts.get(line) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function createStoredNovelChapterVersion(
  chapter: StoredNovelChapter,
  source: StoredNovelChapterVersionSource,
  createdAt: string,
  note?: string,
  links?: {
    reviewId?: string;
    revisedFromReviewId?: string;
  },
): StoredNovelChapterVersion {
  return normalizeStoredNovelChapterVersion({
    id: createNovelChapterVersionId(chapter.id, source, createdAt),
    chapterId: chapter.id,
    bookId: chapter.bookId,
    number: chapter.number,
    title: chapter.title,
    content: chapter.content,
    summary: chapter.summary,
    status: chapter.status,
    wordCount: chapter.wordCount,
    reviewNotes: chapter.reviewNotes,
    reviews: chapter.reviews,
    reviewId: links?.reviewId,
    revisedFromReviewId: links?.revisedFromReviewId,
    source,
    note,
    createdAt,
  });
}

function inferChapterVersionSource(
  updates: Partial<
    Pick<
      StoredNovelChapter,
      "title" | "content" | "summary" | "status" | "wordCount" | "reviewNotes"
    >
  >,
): StoredNovelChapterVersionSource {
  if (updates.reviewNotes !== undefined && updates.content === undefined) {
    return "review";
  }
  if (updates.status !== undefined && updates.content === undefined) {
    return "status-change";
  }

  return "manual-edit";
}

export function formatNovelChapterVersionSource(
  source: StoredNovelChapterVersionSource,
): string {
  const labels: Record<StoredNovelChapterVersionSource, string> = {
    generation: "生成",
    "manual-edit": "手动编辑",
    review: "审稿",
    revision: "修订",
    "status-change": "状态变更",
    restore: "版本恢复",
  };

  return labels[source] ?? "版本";
}

export function countNovelWords(content: string): number {
  const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords =
    content
      .replace(/[\u4e00-\u9fff]/g, " ")
      .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;

  return chineseChars + latinWords;
}

export function deriveNovelReviewStatus(
  reviewNotes: string,
): InkosChapterStatus {
  const normalized = reviewNotes.toLowerCase();
  const hasApproval = [
    "通过",
    "定稿",
    "无需修改",
    "没有明显问题",
    "暂无明显问题",
    "approved",
    "pass",
  ].some((keyword) => normalized.includes(keyword));
  const hasBlockingIssue = [
    "需要修改",
    "需修改",
    "不通过",
    "待修改",
    "存在",
    "问题",
    "风险",
    "建议",
    "issue",
    "risk",
    "revise",
  ].some((keyword) => normalized.includes(keyword));

  return hasApproval ? "approved" : hasBlockingIssue ? "ready-for-review" : "ready-for-review";
}

function openNovelDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("当前浏览器不支持 IndexedDB。"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        const books = db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
        books.createIndex("updatedAt", "updatedAt");
        books.createIndex("archived", "archived");
        books.createIndex("sortIndex", "sortIndex");
      } else {
        const books = request.transaction?.objectStore(BOOKS_STORE);
        if (books && !books.indexNames.contains("archived")) {
          books.createIndex("archived", "archived");
        }
        if (books && !books.indexNames.contains("sortIndex")) {
          books.createIndex("sortIndex", "sortIndex");
        }
      }

      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessions = db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
        sessions.createIndex("bookId", "bookId");
        sessions.createIndex("updatedAt", "updatedAt");
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const messages = db.createObjectStore(MESSAGES_STORE, { keyPath: "id" });
        messages.createIndex("sessionId", "sessionId");
        messages.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
        const chapters = db.createObjectStore(CHAPTERS_STORE, { keyPath: "id" });
        chapters.createIndex("bookId", "bookId");
        chapters.createIndex("number", "number");
        chapters.createIndex("updatedAt", "updatedAt");
      }

      if (!db.objectStoreNames.contains(CHAPTER_VERSIONS_STORE)) {
        const chapterVersions = db.createObjectStore(CHAPTER_VERSIONS_STORE, {
          keyPath: "id",
        });
        chapterVersions.createIndex("chapterId", "chapterId");
        chapterVersions.createIndex("bookId", "bookId");
        chapterVersions.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        const tasks = db.createObjectStore(TASKS_STORE, { keyPath: "id" });
        tasks.createIndex("bookId", "bookId");
        tasks.createIndex("sessionId", "sessionId");
        tasks.createIndex("startedAt", "startedAt");
        tasks.createIndex("status", "status");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("打开本地创作库失败。"));
  });
}

function getAllFromStore<T>(
  db: IDBDatabase,
  storeName: string,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error("读取本地创作库失败。"));
  });
}

function getFromStore<T>(
  db: IDBDatabase,
  storeName: string,
  key: string,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("读取本地创作库失败。"));
  });
}

function putInStore<T>(
  db: IDBDatabase,
  storeName: string,
  value: T,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");

    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("写入本地创作库失败。"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("写入本地创作库已中止。"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("写入本地创作库失败。"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("写入本地创作库已中止。"));
  });
}

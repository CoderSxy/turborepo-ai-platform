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
  styleSamples: Array<{
    id: string;
    title: string;
    content: string;
    updatedAt: string;
  }>;
  importedMaterials: Array<{
    id: string;
    title: string;
    type: "chapters" | "canon" | "fanfic";
    content: string;
    createdAt: string;
  }>;
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
  | "history";

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

export function filterNovelReviewIssueViews(
  issues: NovelChapterReviewIssueView[],
  filter: NovelReviewIssueFilter,
): NovelChapterReviewIssueView[] {
  if (filter === "open") return issues.filter((issue) => !issue.resolved);
  if (filter === "resolved") return issues.filter((issue) => issue.resolved);
  if (filter === "current") {
    return issues.filter((issue) => issue.isCurrentReview);
  }
  if (filter === "history") {
    return issues.filter((issue) => !issue.isCurrentReview);
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

export function buildNovelPlatformExportText(input: {
  title: string;
  platform: "generic" | "qidian" | "fanqie";
  chapters: StoredNovelChapter[];
}): string {
  const platformLabel =
    input.platform === "qidian"
      ? "起点格式"
      : input.platform === "fanqie"
        ? "番茄格式"
        : "通用格式";
  const chapters = sortStoredNovelChapters(input.chapters).filter((chapter) =>
    chapter.content.trim().length > 0
  );

  return [
    `作品名：${input.title}`,
    `导出格式：${platformLabel}`,
    "",
    ...chapters.map((chapter) =>
      [
        input.platform === "fanqie"
          ? `第${chapter.number}章 ${chapter.title}`
          : `第 ${chapter.number} 章 ${chapter.title}`,
        "",
        chapter.content.trim(),
      ].join("\n"),
    ),
  ].join("\n\n");
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
  let nextKnowledgeAssets = assets.knowledgeAssets ?? [];

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

  return {
    ...assets,
    worldNotes,
    characters,
    knowledgeAssets: nextKnowledgeAssets,
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
  >;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  userInstruction?: string;
}): string {
  const selection =
    input.assets.contextSelection ??
    buildDefaultNovelContextSelection(input.project);
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

    return buildNovelWorkspaceSnapshot(
      books,
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
          message: "任务开始执行。",
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

function upsertNovelKnowledgeAsset(
  assets: NovelKnowledgeAsset[],
  nextAsset: Omit<NovelKnowledgeAsset, "id">,
): NovelKnowledgeAsset[] {
  const index = assets.findIndex(
    (asset) =>
      asset.category === nextAsset.category &&
      asset.title.trim().toLowerCase() === nextAsset.title.trim().toLowerCase(),
  );

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

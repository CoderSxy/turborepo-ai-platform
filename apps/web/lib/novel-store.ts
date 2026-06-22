import type {
  InkosChapter,
  InkosChapterStatus,
  InkosNovelProject,
} from "@repo/inkos-adapter";

const DB_NAME = "sxy-creative-studio";
const DB_VERSION = 4;
const BOOKS_STORE = "books";
const SESSIONS_STORE = "sessions";
const MESSAGES_STORE = "messages";
const CHAPTERS_STORE = "chapters";
const CHAPTER_VERSIONS_STORE = "chapterVersions";

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
  worldNotes: string;
  characters: string;
  settings: string;
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
  createdAt: string;
  updatedAt: string;
};

export type NovelChapterReviewVerdict = "approved" | "needs-revision";
export type NovelChapterReviewIssueSeverity = "info" | "warning" | "error";

export type NovelChapterReviewIssue = {
  id: string;
  severity: NovelChapterReviewIssueSeverity;
  title: string;
  detail: string;
  resolved: boolean;
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

export type NovelWorkspaceSnapshot = {
  books: StoredNovelBook[];
  sessionsByBookId: Record<string, StoredNovelSession[]>;
  messagesBySessionId: Record<string, StoredNovelMessage[]>;
  chaptersByBookId: Record<string, StoredNovelChapter[]>;
  chapterVersionsByChapterId: Record<string, StoredNovelChapterVersion[]>;
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

    return {
      id: `issue-${index + 1}`,
      severity,
      title,
      detail,
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
  assets: Pick<NovelProjectAssets, "outline" | "worldNotes" | "characters" | "settings">;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  userInstruction?: string;
}): string {
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

  return [
    "请按以下上下文生成小说章节。",
    `目标章号：${input.target.number}`,
    `目标标题：${input.target.title}`,
    `目标字数：${input.target.targetWords}`,
    `章节计划：${input.target.focus}`,
    plan ? `计划状态：${plan.status}` : "",
    input.userInstruction?.trim()
      ? `用户补充要求：${input.userInstruction.trim()}`
      : "",
    reviewWarning,
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
    "## 最近章节摘要",
    recentSummaries || "暂无已生成章节摘要。",
    previousChapter
      ? `上一章摘要：${previousChapter.summary || "暂无摘要"}`
      : "上一章摘要：暂无。",
    `上一章正文片段：${previousExcerpt}`,
    "## 输出要求",
    "直接输出本章正文，并在末尾提供“章节摘要”。不要覆盖既有章节，不要生成其他章节。",
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
  userInstruction?: string;
}): string {
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
    `审稿意见：${input.chapter.reviewNotes || "请做一次基础润色和连贯性修订。"}`,
    "## 原章节正文",
    `原章节正文：\n${input.chapter.content}`,
    "## 输出要求",
    "只输出修订后的完整章节正文；不要输出解释、审稿报告或额外章节。必须保留原章节核心事件和人物动机。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildNovelChapterContextPreview(input: {
  project: Pick<
    InkosNovelProject,
    "title" | "genre" | "premise" | "world" | "protagonist" | "chapters" | "chapterWordCount" | "targetChapters"
  >;
  assets: Pick<NovelProjectAssets, "outline" | "worldNotes" | "characters" | "settings">;
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
  return {
    outline: project.chapters
      .map((chapter) => `${chapter.number}. ${chapter.title}：${chapter.focus}`)
      .join("\n"),
    worldNotes: project.world,
    characters: project.protagonist,
    settings: project.premise,
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
    const [books, sessions, messages, chapters, loadedChapterVersions] = await Promise.all([
      getAllFromStore<StoredNovelBook>(db, BOOKS_STORE),
      getAllFromStore<StoredNovelSession>(db, SESSIONS_STORE),
      getAllFromStore<StoredNovelMessage>(db, MESSAGES_STORE),
      getAllFromStore<StoredNovelChapter>(db, CHAPTERS_STORE),
      getAllFromStore<StoredNovelChapterVersion>(db, CHAPTER_VERSIONS_STORE),
    ]);
    const chapterVersions = await backfillMissingChapterVersions(
      db,
      chapters,
      loadedChapterVersions,
    );

    return buildNovelWorkspaceSnapshot(
      books,
      sessions,
      messages,
      chapters,
      chapterVersions,
    );
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
): NovelWorkspaceSnapshot {
  return buildNovelWorkspaceSnapshot(
    books,
    sessions,
    messages,
    chapters,
    chapterVersions,
  );
}

function buildNovelWorkspaceSnapshot(
  books: StoredNovelBook[],
  sessions: StoredNovelSession[],
  messages: StoredNovelMessage[],
  chapters: StoredNovelChapter[],
  chapterVersions: StoredNovelChapterVersion[],
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

  return {
    books: sortStoredNovelBooks(books.map(normalizeStoredNovelBook)),
    sessionsByBookId,
    messagesBySessionId,
    chaptersByBookId,
    chapterVersionsByChapterId,
  };
}

function normalizeStoredNovelBook(book: StoredNovelBook): StoredNovelBook {
  const project = book.project;

  return {
    ...book,
    assets: book.assets ?? createDefaultNovelAssets(project),
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNovelChapterContextPreview,
  buildNovelChapterDraftMeta,
  buildNovelChapterAssetDelta,
  buildNovelChapterExportBundle,
  buildNovelChapterParagraphNavigation,
  buildNovelRecoverableErrorNotice,
  buildNovelCreationLogExportMarkdown,
  buildNovelEditorSearchState,
  buildNovelChapterVersionDiff,
  buildNovelChapterVersionCompareView,
  buildNovelReviewIssueHighlights,
  buildNovelReviewExportMarkdown,
  buildNovelKnowledgeSummary,
  buildNovelBatchQueueItems,
  buildNovelBatchQueueReport,
  buildNovelBookExportMarkdown,
  buildNovelBookExportText,
  buildNovelPlatformExportText,
  buildNovelVolumeExportBundle,
  buildNovelWorkspaceBackupPayload,
  buildNovelOutlineNodesFromProject,
  buildNovelReviewIssueViews,
  applyNovelReviewIssueSuggestionToContent,
  applyNovelChapterAssetDelta,
  applyNovelPendingAssetDelta,
  dismissNovelPendingAssetDelta,
  filterNovelReviewIssueViews,
  findNovelReviewIssueParagraph,
  queueNovelPendingAssetDelta,
  buildNovelReviseChapterInstruction,
  buildSelectedNovelReviewIssues,
  buildNovelWriteChapterInstruction,
  updateNovelPendingAssetDelta,
  buildNovelWorkspaceSnapshotForTest,
  parseNovelWorkspaceBackupPayload,
  countNovelWords,
  deriveNovelChapterProgress,
  deriveNovelReviewStatus,
  formatNovelRelativeAge,
  getNovelTaskGuard,
  recoverInterruptedNovelTasks,
  replaceNovelEditorSearchMatches,
  mergeNovelChapterPlan,
  moveNovelBatchQueueItem,
  skipNovelBatchQueueItem,
  parseNovelReviewNotes,
  reconcileNovelReviewHistory,
  markNovelReviewIssuesResolved,
  selectNextNovelChapterTarget,
  sortStoredNovelChapterVersions,
  sortStoredNovelBooks,
  sortStoredNovelChapters,
  sortStoredNovelMessages,
  sortStoredNovelSessions,
  syncNovelProjectChapterPlan,
  syncNovelProjectFromOutlineNodes,
} from "./novel-store.ts";

test("novel books are sorted by most recently updated first", () => {
  const books = sortStoredNovelBooks([
    {
      id: "older",
      title: "Older",
      genre: "悬疑",
      premise: "",
      project: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "newer",
      title: "Newer",
      genre: "科幻",
      premise: "",
      project: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    books.map((book) => book.id),
    ["newer", "older"],
  );
});

test("novel sessions are sorted by most recently updated first", () => {
  const sessions = sortStoredNovelSessions([
    {
      id: "draft",
      bookId: "book",
      title: "旧会话",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "active",
      bookId: "book",
      title: "新会话",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    sessions.map((session) => session.id),
    ["active", "draft"],
  );
});

test("novel messages are sorted from earliest to latest", () => {
  const messages = sortStoredNovelMessages([
    {
      id: "assistant",
      sessionId: "session",
      role: "assistant",
      content: "回复",
      createdAt: "2026-01-01T00:00:02.000Z",
    },
    {
      id: "user",
      sessionId: "session",
      role: "user",
      content: "请求",
      createdAt: "2026-01-01T00:00:01.000Z",
    },
  ]);

  assert.deepEqual(
    messages.map((message) => message.id),
    ["user", "assistant"],
  );
});

test("novel tasks are grouped by book and sorted by latest start time", () => {
  const snapshot = buildNovelWorkspaceSnapshotForTest(
    [
      {
        id: "book",
        title: "雨后裂缝",
        genre: "悬疑",
        premise: "",
        project: {
          title: "雨后裂缝",
          genre: "悬疑",
          premise: "",
          world: "",
          protagonist: "",
          chapters: [],
          chapterWordCount: 3000,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    [],
    [],
    [],
    [],
    [
      {
        id: "task-old",
        bookId: "book",
        sessionId: "session",
        action: "audit-chapter",
        label: "审稿",
        status: "success",
        logs: [],
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "task-new",
        bookId: "book",
        sessionId: "session",
        action: "revise-chapter",
        label: "修订本章",
        status: "running",
        logs: [],
        startedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  );

  assert.deepEqual(
    snapshot.tasksByBookId.book.map((task) => task.id),
    ["task-new", "task-old"],
  );
});

test("batch queue items can be skipped and reordered without mutating the queue", () => {
  const queue = [
    { id: "a", action: "review", label: "审稿第 1 章", number: 1, title: "一" },
    { id: "b", action: "review", label: "审稿第 2 章", number: 2, title: "二" },
    { id: "c", action: "review", label: "审稿第 3 章", number: 3, title: "三" },
  ];

  assert.deepEqual(
    moveNovelBatchQueueItem(queue, "c", "up").map((item) => item.id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    skipNovelBatchQueueItem(queue, "b").map((item) => item.id),
    ["a", "c"],
  );
  assert.deepEqual(
    queue.map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("batch queue report summarizes completed, skipped, cancelled, and failed tasks", () => {
  const report = buildNovelBatchQueueReport([
    {
      id: "task-ok",
      bookId: "book",
      sessionId: "session",
      action: "review",
      label: "审稿第 1 章",
      status: "success",
      logs: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:00:10.000Z",
    },
    {
      id: "task-skip",
      bookId: "book",
      sessionId: "session",
      action: "review",
      label: "审稿第 2 章",
      status: "skipped",
      logs: [],
      startedAt: "2026-01-01T00:00:01.000Z",
      endedAt: "2026-01-01T00:00:02.000Z",
    },
    {
      id: "task-fail",
      bookId: "book",
      sessionId: "session",
      action: "review",
      label: "审稿第 3 章",
      status: "error",
      logs: [],
      errorMessage: "模型超时",
      startedAt: "2026-01-01T00:00:03.000Z",
      endedAt: "2026-01-01T00:00:04.000Z",
    },
  ]);

  assert.equal(report.total, 3);
  assert.equal(report.success, 1);
  assert.equal(report.skipped, 1);
  assert.equal(report.failed, 1);
  assert.match(report.markdown, /审稿第 3 章：失败 - 模型超时/);
});

test("novel chapters are sorted by chapter number", () => {
  const chapters = sortStoredNovelChapters([
    {
      id: "chapter-2",
      bookId: "book",
      number: 2,
      title: "第二章",
      content: "",
      summary: "",
      status: "drafting",
      wordCount: 0,
      reviewNotes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "",
      summary: "",
      status: "approved",
      wordCount: 0,
      reviewNotes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    chapters.map((chapter) => chapter.id),
    ["chapter-1", "chapter-2"],
  );
});

test("novel chapter progress separates generated and approved chapters", () => {
  const progress = deriveNovelChapterProgress(
    [
      {
        id: "chapter-1",
        bookId: "book",
        number: 1,
        title: "第一章",
        content: "正文",
        summary: "",
        status: "ready-for-review",
        wordCount: 1200,
        reviewNotes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "chapter-2",
        bookId: "book",
        number: 2,
        title: "第二章",
        content: "正文",
        summary: "",
        status: "approved",
        wordCount: 1300,
        reviewNotes: "通过",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
      {
        id: "chapter-3",
        bookId: "book",
        number: 3,
        title: "第三章",
        content: "",
        summary: "",
        status: "planned",
        wordCount: 0,
        reviewNotes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-04T00:00:00.000Z",
      },
    ],
    120,
  );

  assert.equal(progress.generatedChapters, 2);
  assert.equal(progress.readyForReviewChapters, 1);
  assert.equal(progress.approvedChapters, 1);
  assert.equal(progress.generatedPercent, 2);
  assert.equal(progress.approvedPercent, 1);
});

test("chapter asset delta extracts summary, character state, foreshadowing and world increments", () => {
  const delta = buildNovelChapterAssetDelta({
    chapterNumber: 3,
    chapterTitle: "雨夜回声",
    content: [
      "林岚在旧车站听见雨声倒流，确认裂缝会吞掉没有影子的人。",
      "",
      "## 章节摘要",
      "林岚追踪旧车站的异常，发现裂缝正在扩大。",
      "",
      "## 资产增量",
      "### 角色状态",
      "- 林岚：确认母亲失踪与旧车站裂缝有关，开始主动追查。",
      "### 新增伏笔",
      "- 没有影子的人会被裂缝吞掉。",
      "### 回收伏笔",
      "- 第一章的倒流雨声对应旧车站的裂缝波动。",
      "### 世界观增量",
      "- 裂缝会优先吞噬失去影子的人。",
    ].join("\n"),
    existingSummary: "",
  });

  assert.equal(delta.summary, "林岚追踪旧车站的异常，发现裂缝正在扩大。");
  assert.deepEqual(delta.characterStates, [
    {
      title: "林岚",
      content: "确认母亲失踪与旧车站裂缝有关，开始主动追查。",
    },
  ]);
  assert.equal(delta.newForeshadowing[0], "没有影子的人会被裂缝吞掉。");
  assert.equal(delta.resolvedForeshadowing[0], "第一章的倒流雨声对应旧车站的裂缝波动。");
  assert.equal(delta.worldIncrements[0], "裂缝会优先吞噬失去影子的人。");
});

test("chapter asset delta ignores empty asset markers", () => {
  const delta = buildNovelChapterAssetDelta({
    chapterNumber: 4,
    chapterTitle: "空镜",
    content: [
      "正文。",
      "",
      "## 章节摘要",
      "这一章只推进气氛。",
      "",
      "## 资产增量",
      "### 角色状态",
      "无",
      "### 新增伏笔",
      "- 暂无",
      "### 回收伏笔",
      "- 无。",
      "### 世界观增量",
      "无新增",
    ].join("\n"),
  });

  assert.equal(delta.summary, "这一章只推进气氛。");
  assert.deepEqual(delta.characterStates, []);
  assert.deepEqual(delta.newForeshadowing, []);
  assert.deepEqual(delta.resolvedForeshadowing, []);
  assert.deepEqual(delta.worldIncrements, []);
});

test("chapter asset delta merges into knowledge assets without duplicating existing titles", () => {
  const assets = {
    outline: "",
    outlineNodes: [],
    worldNotes: "旧世界观",
    characters: "",
    settings: "",
    knowledgeAssets: [
      {
        id: "asset-linlan",
        category: "character",
        title: "林岚",
        content: "林岚原本回避旧车站。",
        status: "active",
        tags: ["角色"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    contextSelection: {
      includeOutline: true,
      includePreviousSummary: true,
      includeWorld: true,
      includeCharacters: true,
      includeForeshadowing: true,
      includeReviewIssues: true,
      targetWords: 3000,
      viewpoint: "第三人称",
      pacing: "",
      highlights: "",
    },
    genres: [],
    styleSamples: [],
    importedMaterials: [],
    marketRadars: [],
    diagnostics: [],
  };
  const nextAssets = applyNovelChapterAssetDelta(assets, {
    chapterNumber: 3,
    chapterTitle: "雨夜回声",
    summary: "林岚追踪旧车站。",
    characterStates: [
      {
        title: "林岚",
        content: "确认母亲失踪与旧车站裂缝有关。",
      },
    ],
    newForeshadowing: ["没有影子的人会被裂缝吞掉。"],
    resolvedForeshadowing: ["倒流雨声对应裂缝波动。"],
    worldIncrements: ["裂缝优先吞噬失去影子的人。"],
  });

  const linlanAssets = nextAssets.knowledgeAssets.filter(
    (asset) => asset.title === "林岚",
  );

  assert.equal(linlanAssets.length, 1);
  assert.match(linlanAssets[0].content, /第 3 章《雨夜回声》/);
  assert.ok(
    nextAssets.knowledgeAssets.some(
      (asset) =>
        asset.category === "foreshadowing" &&
        asset.status === "draft" &&
        asset.content.includes("没有影子的人"),
    ),
  );
  assert.ok(
    nextAssets.knowledgeAssets.some(
      (asset) =>
        asset.category === "foreshadowing" &&
        asset.status === "resolved" &&
        asset.content.includes("倒流雨声"),
    ),
  );
  assert.match(nextAssets.worldNotes, /裂缝优先吞噬失去影子的人/);
});

test("pending chapter asset delta waits for confirmation before merging assets", () => {
  const assets = {
    outline: "",
    outlineNodes: [],
    worldNotes: "旧世界观",
    characters: "",
    settings: "",
    knowledgeAssets: [],
    pendingAssetDeltas: [],
    contextSelection: {
      includeOutline: true,
      includePreviousSummary: true,
      includeWorld: true,
      includeCharacters: true,
      includeForeshadowing: true,
      includeReviewIssues: true,
      targetWords: 3000,
      viewpoint: "第三人称",
      pacing: "",
      highlights: "",
    },
    genres: [],
    styleSamples: [],
    importedMaterials: [],
    marketRadars: [],
    diagnostics: [],
  };
  const queued = queueNovelPendingAssetDelta(assets, {
    chapterNumber: 5,
    chapterTitle: "灯下回声",
    summary: "林岚发现灯塔记录。",
    characterStates: [{ title: "林岚", content: "开始相信母亲留下了线索。" }],
    newForeshadowing: ["灯塔每晚都会多亮一次。"],
    resolvedForeshadowing: [],
    worldIncrements: ["灯塔记录会自动抹去无影者姓名。"],
  });

  assert.equal(queued.knowledgeAssets.length, 0);
  assert.equal(queued.worldNotes, "旧世界观");
  assert.equal(queued.pendingAssetDeltas.length, 1);

  const confirmed = applyNovelPendingAssetDelta(
    queued,
    queued.pendingAssetDeltas[0].id,
  );

  assert.equal(confirmed.pendingAssetDeltas.length, 0);
  assert.ok(
    confirmed.knowledgeAssets.some((asset) =>
      asset.content.includes("灯塔每晚都会多亮一次"),
    ),
  );
  assert.match(confirmed.worldNotes, /灯塔记录会自动抹去无影者姓名/);
});

test("pending chapter asset delta can be edited or dismissed before confirmation", () => {
  const assets = {
    outline: "",
    outlineNodes: [],
    worldNotes: "",
    characters: "",
    settings: "",
    knowledgeAssets: [],
    pendingAssetDeltas: [],
    contextSelection: {
      includeOutline: true,
      includePreviousSummary: true,
      includeWorld: true,
      includeCharacters: true,
      includeForeshadowing: true,
      includeReviewIssues: true,
      targetWords: 3000,
      viewpoint: "第三人称",
      pacing: "",
      highlights: "",
    },
    genres: [],
    styleSamples: [],
    importedMaterials: [],
    marketRadars: [],
    diagnostics: [],
  };
  const queued = queueNovelPendingAssetDelta(assets, {
    chapterNumber: 6,
    chapterTitle: "旧门",
    summary: "林岚打开旧门。",
    characterStates: [],
    newForeshadowing: ["旧门会说话。"],
    resolvedForeshadowing: [],
    worldIncrements: [],
  });
  const edited = updateNovelPendingAssetDelta(
    queued,
    queued.pendingAssetDeltas[0].id,
    {
      newForeshadowing: ["旧门只会在雨夜回应。"],
      worldIncrements: ["旧门属于雨城旧防线。"],
    },
  );
  const confirmed = applyNovelPendingAssetDelta(
    edited,
    edited.pendingAssetDeltas[0].id,
  );

  assert.ok(
    confirmed.knowledgeAssets.some((asset) =>
      asset.content.includes("旧门只会在雨夜回应"),
    ),
  );
  assert.match(confirmed.worldNotes, /旧门属于雨城旧防线/);
  assert.equal(dismissNovelPendingAssetDelta(queued, "missing"), queued);
  assert.equal(
    dismissNovelPendingAssetDelta(queued, queued.pendingAssetDeltas[0].id)
      .pendingAssetDeltas.length,
    0,
  );
});

test("chapter paragraph navigation reports paragraph positions and target word progress", () => {
  const navigation = buildNovelChapterParagraphNavigation(
    "第一段内容。\n\n第二段更长一点。",
    20,
  );

  assert.equal(navigation.wordCount, 12);
  assert.equal(navigation.targetPercent, 60);
  assert.deepEqual(
    navigation.paragraphs.map((paragraph) => paragraph.index),
    [0, 1],
  );
  assert.equal(navigation.paragraphs[1].preview, "第二段更长一点。");
});

test("review issue highlights map issues to paragraph navigation", () => {
  const highlights = buildNovelReviewIssueHighlights(
    "雨停了，林岚看见门缝里的光。\n\n她忽然忘记自己为何而来。",
    [
      {
        id: "issue-1",
        reviewId: "review-1",
        reviewCreatedAt: "2026-01-01T00:00:00.000Z",
        isCurrentReview: true,
        statusLabel: "未解决",
        originLabel: "本轮新增",
        severity: "warning",
        title: "动机缺失",
        detail: "她为何而来需要补充动机",
        excerpt: "为何而来",
        resolved: false,
      },
    ],
  );

  assert.equal(highlights.length, 1);
  assert.equal(highlights[0].paragraphIndex, 1);
  assert.equal(highlights[0].issue.title, "动机缺失");
});

test("book export helpers build whole-book markdown, text, and chapter bundles", () => {
  const chapters = [
    {
      id: "chapter-1",
      bookId: "book",
      number: 1,
      title: "雨夜",
      content: "第一章正文",
      summary: "雨夜开场",
      status: "approved",
      publicationStatus: "ready",
      wordCount: 5,
      reviewNotes: "",
      reviews: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const markdown = buildNovelBookExportMarkdown({
    title: "裂缝中的阳光",
    genre: "悬疑",
    premise: "一场雨后的秘密。",
    chapters,
  });
  const text = buildNovelBookExportText({ title: "裂缝中的阳光", chapters });
  const bundle = buildNovelChapterExportBundle(chapters);
  const volumes = buildNovelVolumeExportBundle({
    title: "裂缝中的阳光",
    chapters,
    outlineNodes: [
      {
        id: "outline-1",
        volume: "第一卷 雨夜",
        chapterNumber: 1,
        title: "雨夜",
        goal: "",
        conflict: "",
        characters: "",
        information: "",
        foreshadowing: "",
        targetWords: 3000,
        status: "approved",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  const platformText = buildNovelPlatformExportText({
    title: "裂缝中的阳光",
    platform: "qidian",
    chapters,
  });

  assert.match(markdown, /# 裂缝中的阳光/);
  assert.match(markdown, /发布状态：ready/);
  assert.match(text, /第 1 章 雨夜/);
  assert.equal(bundle[0].filename, "第1章-雨夜.md");
  assert.equal(volumes[0].filename, "第一卷雨夜.md");
  assert.match(platformText, /作品名：裂缝中的阳光/);
});

test("creation log export includes task status and recent task logs", () => {
  const markdown = buildNovelCreationLogExportMarkdown({
    bookTitle: "裂缝中的阳光",
    tasks: [
      {
        id: "task-1",
        bookId: "book",
        sessionId: "session",
        action: "write-chapter",
        label: "生成第 1 章",
        status: "success",
        logs: [
          {
            id: "log-1",
            message: "写回 IndexedDB",
            createdAt: "2026-01-01T00:00:01.000Z",
          },
        ],
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:00:02.000Z",
      },
    ],
  });

  assert.match(markdown, /# 裂缝中的阳光 创作日志/);
  assert.match(markdown, /生成第 1 章/);
  assert.match(markdown, /写回 IndexedDB/);
});

test("novel chapter versions are sorted newest first", () => {
  const versions = sortStoredNovelChapterVersions([
    {
      id: "version-old",
      chapterId: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "旧正文",
      summary: "",
      status: "drafting",
      wordCount: 3,
      reviewNotes: "",
      source: "manual-edit",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "version-new",
      chapterId: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "新正文",
      summary: "",
      status: "ready-for-review",
      wordCount: 3,
      reviewNotes: "",
      source: "revision",
      revisedFromReviewId: "review-1",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    versions.map((version) => version.id),
    ["version-new", "version-old"],
  );
});

test("novel review notes are parsed into structured review issues", () => {
  const review = parseNovelReviewNotes(
    [
      "审稿结论：不通过，评分 72",
      "总体：节奏可以，但人物动机不足。",
      "- 严重：主角动机不够明确，需要补一处选择压力。",
      "- 警告：同一段连续使用三个比喻，建议削减。",
    ].join("\n"),
    "2026-01-02T00:00:00.000Z",
  );

  assert.equal(review.verdict, "needs-revision");
  assert.equal(review.score, 72);
  assert.equal(review.issues.length, 2);
  assert.equal(review.issues[0].severity, "error");
  assert.equal(review.issues[0].type, "character");
  assert.match(review.issues[0].detail, /主角动机/);
});

test("selected review issues are included in revise instruction", () => {
  const chapter = {
    id: "chapter-1",
    bookId: "book",
    number: 1,
    title: "雨夜",
    content: "正文",
    summary: "",
    status: "ready-for-review",
    wordCount: 2,
    reviewNotes: "审稿意见",
    activeReviewId: "review-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reviews: [
      {
        id: "review-1",
        verdict: "needs-revision",
        summary: "需要改",
        createdAt: "2026-01-01T00:00:00.000Z",
        issues: [
          {
            id: "issue-1",
            severity: "error",
            type: "character",
            title: "动机不足",
            detail: "主角选择压力不足。",
            excerpt: "他站在雨里。",
            suggestion: "补一处选择压力。",
            paragraphHint: "开头",
            resolved: false,
          },
        ],
      },
    ],
  };
  const selected = buildSelectedNovelReviewIssues(chapter, [
    "review-1:issue-1",
  ]);
  const instruction = buildNovelReviseChapterInstruction({
    project: {
      title: "长夜行",
      genre: "玄幻",
      premise: "",
      world: "",
      protagonist: "",
      chapters: [],
      chapterWordCount: 3000,
    },
    assets: {
      outline: "",
      worldNotes: "",
      characters: "",
      settings: "",
    },
    chapter,
    selectedIssueIds: ["review-1:issue-1"],
  });

  assert.equal(selected.length, 1);
  assert.match(instruction, /只修复以下选中的审稿问题/);
  assert.match(instruction, /原文片段：他站在雨里/);
  assert.match(instruction, /补一处选择压力/);
});

test("selected review issues can be marked resolved by revision version", () => {
  const reviews = markNovelReviewIssuesResolved(
    [
      {
        id: "review-1",
        verdict: "needs-revision",
        summary: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        issues: [
          {
            id: "issue-1",
            severity: "warning",
            title: "节奏",
            detail: "节奏偏慢。",
            resolved: false,
          },
        ],
      },
    ],
    ["review-1:issue-1"],
    "version-2",
  );

  assert.equal(reviews[0].issues[0].resolved, true);
  assert.equal(reviews[0].issues[0].resolvedByVersionId, "version-2");
});

test("novel review history marks previous issues resolved after an approved rereview", () => {
  const firstReview = parseNovelReviewNotes(
    "审稿结论：不通过，评分 70\n- 严重：主角动机不够明确。",
    "2026-01-02T00:00:00.000Z",
  );
  const rereview = parseNovelReviewNotes(
    "审稿结论：通过，评分 91\n总体：修订后主角动机已经明确，可以定稿。",
    "2026-01-03T00:00:00.000Z",
  );
  const reviews = reconcileNovelReviewHistory([firstReview], rereview);

  assert.equal(reviews[0].id, rereview.id);
  assert.equal(reviews[1].issues[0].resolved, true);
});

test("novel review issue views group active unresolved issues before history", () => {
  const firstReview = {
    id: "review-old",
    verdict: "needs-revision",
    summary: "第一次审稿",
    createdAt: "2026-01-02T00:00:00.000Z",
    issues: [
      {
        id: "old-resolved",
        severity: "warning",
        title: "节奏",
        detail: "前半章节奏偏慢。",
        resolved: true,
      },
    ],
  };
  const rereview = {
    id: "review-new",
    verdict: "needs-revision",
    summary: "复审",
    createdAt: "2026-01-03T00:00:00.000Z",
    issues: [
      {
        id: "new-open",
        severity: "error",
        title: "动机",
        detail: "主角动机仍然需要补强。",
        resolved: false,
      },
    ],
  };

  const views = buildNovelReviewIssueViews([firstReview, rereview], "review-new");

  assert.deepEqual(
    views.map((issue) => issue.id),
    ["new-open", "old-resolved"],
  );
  assert.equal(views[0].originLabel, "本轮新增");
  assert.equal(views[0].statusLabel, "未解决");
  assert.equal(views[1].originLabel, "历史问题");
  assert.equal(views[1].statusLabel, "已解决");
});

test("novel review issues can be filtered by review state", () => {
  const issues = buildNovelReviewIssueViews(
    [
      {
        id: "review-current",
        verdict: "needs-revision",
        summary: "",
        createdAt: "2026-01-02T00:00:00.000Z",
        issues: [
          {
            id: "issue-open",
            severity: "error",
            title: "本轮问题",
            detail: "当前仍需修订。",
            resolved: false,
          },
        ],
      },
      {
        id: "review-old",
        verdict: "needs-revision",
        summary: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        issues: [
          {
            id: "issue-resolved",
            severity: "warning",
            title: "历史问题",
            detail: "已经处理。",
            resolved: true,
          },
        ],
      },
    ],
    "review-current",
  );

  assert.deepEqual(
    filterNovelReviewIssueViews(issues, "open").map((issue) => issue.id),
    ["issue-open"],
  );
  assert.deepEqual(
    filterNovelReviewIssueViews(issues, "resolved").map((issue) => issue.id),
    ["issue-resolved"],
  );
  assert.deepEqual(
    filterNovelReviewIssueViews(issues, "current").map((issue) => issue.id),
    ["issue-open"],
  );
  assert.deepEqual(
    filterNovelReviewIssueViews(issues, "history").map((issue) => issue.id),
    ["issue-resolved"],
  );
});

test("novel review issue can locate the related chapter paragraph", () => {
  const location = findNovelReviewIssueParagraph(
    ["第一段。", "主角在雨里迟疑，动机不清。", "第三段。"].join("\n\n"),
    {
      id: "issue",
      reviewId: "review",
      reviewCreatedAt: "2026-01-01T00:00:00.000Z",
      isCurrentReview: true,
      statusLabel: "未解决",
      originLabel: "本轮新增",
      severity: "error",
      title: "动机不足",
      detail: "主角动机不清，需要补选择压力。",
      excerpt: "主角在雨里迟疑",
      resolved: false,
    },
  );

  assert.equal(location?.index, 1);
  assert.match(location?.paragraph ?? "", /动机不清/);
});

test("approved rereview issue suggestions are shown as resolved", () => {
  const views = buildNovelReviewIssueViews(
    [
      {
        id: "review-approved",
        verdict: "approved",
        summary: "复审通过，但仍给出润色建议。",
        createdAt: "2026-01-03T00:00:00.000Z",
        issues: [
          {
            id: "suggestion",
            severity: "info",
            title: "建议",
            detail: "可以继续压缩一句环境描写。",
            resolved: false,
          },
        ],
      },
    ],
    "review-approved",
  );

  assert.equal(views[0].resolved, true);
  assert.equal(views[0].statusLabel, "已解决");
});

test("review export markdown includes chapter metadata and structured issues", () => {
  const chapter = {
    id: "chapter-1",
    bookId: "book-1",
    number: 1,
    title: "雨夜",
    content: "第一段。\n\n第二段。",
    summary: "顾长安发现线索。",
    status: "ready-for-review",
    wordCount: 9,
    reviewNotes: "审稿记录",
    activeReviewId: "review-1",
    reviews: [
      {
        id: "review-1",
        verdict: "needs-revision",
        score: 72,
        summary: "节奏可加强。",
        createdAt: "2026-01-02T00:00:00.000Z",
        issues: [
          {
            id: "issue-1",
            severity: "warning",
            type: "pacing",
            title: "冲突弱",
            detail: "第二段缺少推进。",
            excerpt: "第二段",
            suggestion: "把第二段改成新的冲突。",
            resolved: false,
          },
        ],
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
  const markdown = buildNovelReviewExportMarkdown({
    bookTitle: "长夜行",
    chapter,
  });

  assert.match(markdown, /# 长夜行 审稿报告/);
  assert.match(markdown, /第 1 章《雨夜》/);
  assert.match(markdown, /评分：72/);
  assert.match(markdown, /冲突弱/);
  assert.match(markdown, /修改建议：把第二段改成新的冲突。/);
});

test("review issue suggestion can be applied to the located paragraph", () => {
  const content = "第一段保留。\n\n第二段缺少推进。\n\n第三段保留。";
  const issue = {
    id: "issue-1",
    reviewId: "review-1",
    reviewCreatedAt: "2026-01-02T00:00:00.000Z",
    severity: "warning",
    type: "pacing",
    title: "第二段弱",
    detail: "第二段缺少推进。",
    excerpt: "第二段缺少推进",
    suggestion: "第二段补入新的冲突。",
    resolved: false,
    isCurrentReview: true,
    statusLabel: "未解决",
    originLabel: "本轮新增",
  };
  const applied = applyNovelReviewIssueSuggestionToContent(content, issue);

  assert.equal(applied.applied, true);
  assert.equal(applied.paragraphIndex, 1);
  assert.equal(
    applied.content,
    "第一段保留。\n\n第二段补入新的冲突。\n\n第三段保留。",
  );
});

test("workspace backup payload validates and excludes model api keys", () => {
  const snapshot = buildNovelWorkspaceSnapshotForTest(
    [
      {
        id: "book-1",
        title: "长夜行",
        genre: "玄幻",
        premise: "长夜闭环。",
        project: { title: "长夜行", genre: "玄幻" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    [
      {
        id: "session-1",
        bookId: "book-1",
        title: "默认会话",
        summary: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    [],
    [],
    [],
    [],
  );
  const payload = buildNovelWorkspaceBackupPayload(snapshot, {
    providers: [
      {
        id: "deepseek",
        name: "DeepSeek",
        apiKey: "sk-secret",
        models: ["deepseek-chat"],
      },
    ],
  });

  assert.equal(payload.version, 1);
  assert.equal(payload.modelSettings.providers[0].apiKey, undefined);
  assert.equal(payload.modelSettings.providers[0].hasApiKey, true);
  assert.equal(payload.books.length, 1);
  assert.equal(
    parseNovelWorkspaceBackupPayload(JSON.stringify(payload)).books[0].id,
    "book-1",
  );
});

test("novel project chapter plan syncs generated chapter status and summary", () => {
  const project = {
    title: "长夜行",
    genre: "玄幻",
    platform: "web",
    language: "zh",
    targetChapters: 120,
    chapterWordCount: 3000,
    premise: "",
    protagonist: "",
    world: "",
    currentStage: "chapter-plan",
    chapters: [
      {
        number: 1,
        title: "雨夜",
        status: "planned",
        targetWords: 3000,
        focus: "雨夜发现尸体。",
      },
    ],
  };
  const synced = syncNovelProjectChapterPlan(project, {
    number: 1,
    title: "雨夜",
    summary: "顾长安在雨夜发现异常尸体。",
    status: "ready-for-review",
    wordCount: 3662,
  });

  assert.equal(synced.chapters[0].status, "ready-for-review");
  assert.equal(synced.chapters[0].focus, "顾长安在雨夜发现异常尸体。");
  assert.equal(synced.chapters[0].targetWords, 3662);
});

test("outline nodes can be synced back into project chapters", () => {
  const project = {
    title: "长夜行",
    genre: "玄幻",
    platform: "web",
    language: "zh",
    targetChapters: 120,
    chapterWordCount: 3000,
    premise: "",
    protagonist: "",
    world: "",
    currentStage: "foundation",
    chapters: [
      {
        number: 1,
        title: "雨夜",
        status: "planned",
        targetWords: 3000,
        focus: "发现尸体。",
      },
    ],
  };
  const nodes = buildNovelOutlineNodesFromProject(project).map((node) => ({
    ...node,
    goal: "雨夜发现异常尸体。",
    conflict: "父亲隐瞒真相。",
    characters: "顾长安, 顾城",
    information: "尸体没有尸斑。",
    foreshadowing: "黑线印记。",
  }));
  const synced = syncNovelProjectFromOutlineNodes(project, nodes);

  assert.equal(synced.currentStage, "chapter-plan");
  assert.match(synced.chapters[0].focus, /目标：雨夜发现异常尸体/);
  assert.match(synced.chapters[0].focus, /伏笔：黑线印记/);
});

test("knowledge assets are summarized for writing context", () => {
  const summary = buildNovelKnowledgeSummary({
    knowledgeAssets: [
      {
        id: "asset-1",
        category: "foreshadowing",
        title: "黑线印记",
        content: "触碰尸体后出现，后续回收。",
        status: "active",
        tags: ["主线"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  assert.match(summary, /foreshadowing/);
  assert.match(summary, /黑线印记/);
  assert.match(summary, /#主线/);
});

test("write chapter instruction respects context selection assets", () => {
  const instruction = buildNovelWriteChapterInstruction({
    project: {
      title: "长夜行",
      genre: "玄幻",
      premise: "黑水城异案。",
      world: "黑水城。",
      protagonist: "顾长安。",
      chapterWordCount: 3000,
      chapters: [
        {
          number: 2,
          title: "缺页档案",
          status: "planned",
          targetWords: 3200,
          focus: "进入档案室。",
        },
      ],
    },
    assets: {
      outline: "第二章进入档案室。",
      outlineNodes: [
        {
          id: "outline-2",
          volume: "第一卷",
          chapterNumber: 2,
          title: "缺页档案",
          goal: "找到缺页档案。",
          conflict: "档案管理员阻拦。",
          characters: "顾长安",
          information: "旧案编号出现。",
          foreshadowing: "黑线指向档案柜。",
          targetWords: 3200,
          status: "planned",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      worldNotes: "黑水城。",
      characters: "顾长安。",
      settings: "冷悬疑。",
      knowledgeAssets: [
        {
          id: "asset-1",
          category: "foreshadowing",
          title: "黑线印记",
          content: "黑线会指向旧档案。",
          status: "active",
          tags: ["主线"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      contextSelection: {
        includeOutline: true,
        includePreviousSummary: false,
        includeWorld: true,
        includeCharacters: true,
        includeForeshadowing: true,
        includeReviewIssues: true,
        targetWords: 3600,
        viewpoint: "第三人称有限视角",
        pacing: "开头 800 字给出新线索。",
        highlights: "强化档案室压迫感。",
      },
    },
    chapters: [],
    target: {
      number: 2,
      title: "缺页档案",
      focus: "进入档案室。",
      targetWords: 3200,
      reason: "planned",
    },
  });

  assert.match(instruction, /目标字数：3600/);
  assert.match(instruction, /结构化章节计划/);
  assert.match(instruction, /黑线印记/);
  assert.match(instruction, /强化档案室压迫感/);
});

test("novel task guard blocks new work while a task is running", () => {
  assert.deepEqual(getNovelTaskGuard({ isSending: false, isRunningCoreAction: false }), {
    canStart: true,
    message: "",
  });
  assert.deepEqual(getNovelTaskGuard({ isSending: false, isRunningCoreAction: true }), {
    canStart: false,
    message: "已有 InkOS 任务正在执行，可以先取消当前任务。",
  });
});

test("interrupted running novel tasks recover as retryable errors", () => {
  const recovered = recoverInterruptedNovelTasks([
    {
      id: "task-running",
      bookId: "book",
      sessionId: "session",
      action: "review",
      label: "审稿",
      status: "running",
      logs: [{ id: "log", message: "任务开始。", createdAt: "2026-01-01T00:00:00.000Z" }],
      startedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "task-success",
      bookId: "book",
      sessionId: "session",
      action: "write-chapter",
      label: "写下一章",
      status: "success",
      logs: [],
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-01T00:00:01.000Z",
    },
  ]);

  assert.equal(recovered[0].status, "error");
  assert.match(recovered[0].errorMessage ?? "", /页面刷新/);
  assert.equal(recovered[0].logs.at(-1)?.message, "页面刷新或异常中断，任务已标记为可重试。");
  assert.equal(recovered[1].status, "success");
});

test("recoverable error notice gives action-oriented guidance for model failures", () => {
  const missingKey = buildNovelRecoverableErrorNotice(
    new Error("401 Unauthorized: missing api key"),
  );
  assert.equal(missingKey.canRetry, true);
  assert.equal(missingKey.category, "auth");
  assert.match(missingKey.recoveryAction, /API Key/);

  const rateLimit = buildNovelRecoverableErrorNotice(
    new Error("429 Too Many Requests"),
  );
  assert.equal(rateLimit.category, "rate-limit");
  assert.match(rateLimit.recoveryAction, /稍后重试/);

  const cancelled = buildNovelRecoverableErrorNotice(
    new DOMException("Aborted", "AbortError"),
  );
  assert.equal(cancelled.canRetry, false);
  assert.equal(cancelled.category, "cancelled");
});

test("legacy chapter review notes are normalized into structured reviews", () => {
  const snapshot = buildNovelWorkspaceSnapshotForTest(
    [],
    [],
    [],
    [
      {
        id: "chapter-1",
        bookId: "book",
        number: 1,
        title: "第一章",
        content: "正文",
        summary: "",
        status: "ready-for-review",
        wordCount: 2,
        reviewNotes: "审稿结论：不通过，评分 68\n- 严重：动机不足。",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    [],
  );

  const chapter = snapshot.chaptersByBookId.book[0];

  assert.equal(chapter.reviews.length, 1);
  assert.equal(chapter.reviews[0].score, 68);
  assert.equal(chapter.activeReviewId, chapter.reviews[0].id);
});

test("chapter version diff reports added and removed lines", () => {
  const diff = buildNovelChapterVersionDiff(
    {
      id: "old",
      chapterId: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "雨落下来。\n顾长安沉默。",
      summary: "",
      status: "ready-for-review",
      wordCount: 8,
      reviewNotes: "",
      source: "generation",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "new",
      chapterId: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "雨落下来。\n顾长安握紧刀柄。",
      summary: "",
      status: "ready-for-review",
      wordCount: 10,
      reviewNotes: "",
      source: "revision",
      revisedFromReviewId: "review-1",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  );

  assert.equal(diff.changed, true);
  assert.equal(diff.wordDelta, 2);
  assert.deepEqual(diff.addedLines, ["顾长安握紧刀柄。"]);
  assert.deepEqual(diff.removedLines, ["顾长安沉默。"]);
});

test("chapter version compare view summarizes both sides and changes", () => {
  const compare = buildNovelChapterVersionCompareView(
    {
      id: "old",
      chapterId: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "雨落下来。\n顾长安沉默。",
      summary: "",
      status: "ready-for-review",
      wordCount: 8,
      reviewNotes: "",
      source: "generation",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "new",
      chapterId: "chapter-1",
      bookId: "book",
      number: 1,
      title: "第一章",
      content: "雨落下来。\n顾长安握紧刀柄。",
      summary: "",
      status: "ready-for-review",
      wordCount: 10,
      reviewNotes: "",
      source: "revision",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  );

  assert.equal(compare.wordDelta, 2);
  assert.equal(compare.addedCount, 1);
  assert.equal(compare.removedCount, 1);
  assert.deepEqual(compare.previousLines.map((line) => line.state), [
    "unchanged",
    "removed",
  ]);
  assert.deepEqual(compare.nextLines.map((line) => line.state), [
    "unchanged",
    "added",
  ]);
});

test("chapter draft meta reports words paragraphs and summary state", () => {
  const meta = buildNovelChapterDraftMeta(
    "第一段。\n\n第二段还有英文 words。",
    "本章摘要。",
  );

  assert.equal(meta.wordCount, 11);
  assert.equal(meta.paragraphCount, 2);
  assert.equal(meta.hasSummary, true);
});

test("chapter editor search state reports match count and active match", () => {
  const state = buildNovelEditorSearchState(
    "雨夜里，雨声落在屋檐。雨没有停。",
    "雨",
    1,
  );

  assert.equal(state.count, 3);
  assert.equal(state.activeIndex, 1);
  assert.deepEqual(state.matches[1], { start: 4, end: 5 });
});

test("chapter editor replace supports one match and all matches", () => {
  assert.equal(
    replaceNovelEditorSearchMatches("雨落，雨停。", "雨", "雪", "current", 1),
    "雨落，雪停。",
  );
  assert.equal(
    replaceNovelEditorSearchMatches("雨落，雨停。", "雨", "雪", "all", 0),
    "雪落，雪停。",
  );
});

test("novel chapter plan merges planned chapters with generated drafts", () => {
  const project = {
    chapters: [
      {
        number: 1,
        title: "雨后裂缝",
        status: "planned",
        targetWords: 3000,
        focus: "主角发现异常。",
      },
      {
        number: 2,
        title: "缺页档案",
        status: "planned",
        targetWords: 3000,
        focus: "档案室出现线索。",
      },
    ],
  };
  const rows = mergeNovelChapterPlan(project, [
    {
      id: "chapter-1",
      bookId: "book",
      number: 1,
      title: "雨后裂缝",
      content: "正文",
      summary: "主角看见裂缝。",
      status: "ready-for-review",
      wordCount: 1200,
      reviewNotes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    rows.map((row) => ({
      key: row.key,
      generated: row.generated,
      number: row.number,
      title: row.title,
      wordCount: row.wordCount,
    })),
    [
      {
        key: "chapter-1",
        generated: true,
        number: 1,
        title: "雨后裂缝",
        wordCount: 1200,
      },
      {
        key: "plan-2",
        generated: false,
        number: 2,
        title: "缺页档案",
        wordCount: 0,
      },
    ],
  );
});

test("novel batch queue chooses eligible chapters for generation review and revision", () => {
  const rows = mergeNovelChapterPlan(
    {
      chapters: [
        { number: 1, title: "第一章", focus: "开局", status: "planned", targetWords: 3000 },
        { number: 2, title: "第二章", focus: "推进", status: "planned", targetWords: 3000 },
        { number: 3, title: "第三章", focus: "转折", status: "planned", targetWords: 3000 },
      ],
      chapterWordCount: 3000,
    },
    [
      {
        id: "chapter-1",
        bookId: "book",
        number: 1,
        title: "第一章",
        content: "正文",
        summary: "",
        status: "ready-for-review",
        wordCount: 1000,
        reviewNotes: "需要修订",
        activeReviewId: "review-1",
        reviews: [
          {
            id: "review-1",
            verdict: "needs-revision",
            summary: "",
            createdAt: "2026-01-01T00:00:00.000Z",
            issues: [
              {
                id: "issue-1",
                severity: "error",
                title: "动机不足",
                detail: "补充选择压力。",
                resolved: false,
              },
            ],
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "chapter-2",
        bookId: "book",
        number: 2,
        title: "第二章",
        content: "正文",
        summary: "",
        status: "approved",
        wordCount: 1000,
        reviewNotes: "通过",
        reviews: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  );

  assert.deepEqual(
    buildNovelBatchQueueItems(rows, "write-chapter").map((item) => item.title),
    ["第三章"],
  );
  assert.deepEqual(
    buildNovelBatchQueueItems(rows, "review").map((item) => item.title),
    ["第一章"],
  );
  assert.deepEqual(
    buildNovelBatchQueueItems(rows, "revise-chapter").map((item) => item.title),
    ["第一章"],
  );
});

test("next chapter target prefers the first ungenerated planned chapter", () => {
  const project = {
    chapters: [
      {
        number: 1,
        title: "雨后裂缝",
        status: "ready-for-review",
        targetWords: 3000,
        focus: "主角发现异常。",
      },
      {
        number: 2,
        title: "缺页档案",
        status: "planned",
        targetWords: 3000,
        focus: "档案室出现线索。",
      },
    ],
    chapterWordCount: 3000,
  };
  const target = selectNextNovelChapterTarget(project, [
    {
      id: "chapter-1",
      bookId: "book",
      number: 1,
      title: "雨后裂缝",
      content: "正文",
      summary: "主角看见裂缝。",
      status: "ready-for-review",
      wordCount: 1200,
      reviewNotes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);

  assert.equal(target.number, 2);
  assert.equal(target.title, "缺页档案");
  assert.equal(target.reason, "planned");
});

test("write chapter instruction includes target plan and recent chapter context", () => {
  const project = {
    title: "裂缝中的阳光",
    genre: "都市悬疑",
    premise: "公共记忆被篡改。",
    world: "近未来南方城市。",
    protagonist: "林照，档案修复师。",
    chapterWordCount: 3000,
    chapters: [
      {
        number: 2,
        title: "缺页档案",
        status: "planned",
        targetWords: 3000,
        focus: "档案室出现线索。",
      },
    ],
  };
  const instruction = buildNovelWriteChapterInstruction({
    project,
    assets: {
      outline: "第一卷：雨后裂缝到旧城蓝光。",
      worldNotes: "城市裂缝会吞掉记忆。",
      characters: "林照：档案修复师。",
      settings: "核心设定：裂缝抹除公共记忆。",
      genres: [],
      styleSamples: [],
      importedMaterials: [],
      marketRadars: [],
      diagnostics: [],
    },
    chapters: [
      {
        id: "chapter-1",
        bookId: "book",
        number: 1,
        title: "雨后裂缝",
        content: "雨停以后，裂缝还在城市中央发光。林照看见档案编号消失。",
        summary: "林照发现城市裂缝会抹掉档案。",
        status: "ready-for-review",
        wordCount: 24,
        reviewNotes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    target: {
      number: 2,
      title: "缺页档案",
      focus: "档案室出现线索。",
      targetWords: 3000,
      reason: "planned",
    },
    userInstruction: "保持悬疑感。",
  });

  assert.match(instruction, /目标章号：2/);
  assert.match(instruction, /章节计划：档案室出现线索/);
  assert.match(instruction, /上一章摘要：林照发现城市裂缝会抹掉档案/);
  assert.match(instruction, /上一章正文片段：雨停以后/);
  assert.match(instruction, /用户补充要求：保持悬疑感/);
});

test("revise chapter instruction includes review notes and original chapter", () => {
  const instruction = buildNovelReviseChapterInstruction({
    project: {
      title: "裂缝中的阳光",
      genre: "都市悬疑",
      premise: "公共记忆被篡改。",
      world: "近未来南方城市。",
      protagonist: "林照，档案修复师。",
      chapters: [],
      chapterWordCount: 3000,
    },
    assets: {
      outline: "第一卷：雨后裂缝到旧城蓝光。",
      worldNotes: "城市裂缝会吞掉记忆。",
      characters: "林照：档案修复师。",
      settings: "核心设定：裂缝抹除公共记忆。",
      genres: [],
      styleSamples: [],
      importedMaterials: [],
      marketRadars: [],
      diagnostics: [],
    },
    chapter: {
      id: "chapter-1",
      bookId: "book",
      number: 1,
      title: "雨后裂缝",
      content: "雨停以后，裂缝还在城市中央发光。",
      summary: "林照发现裂缝。",
      status: "ready-for-review",
      wordCount: 16,
      reviewNotes: "主角动机不够明确，需要补一处选择压力。",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    userInstruction: "保留开头意象。",
  });

  assert.match(instruction, /修订目标：第 1 章《雨后裂缝》/);
  assert.match(instruction, /审稿意见：主角动机不够明确/);
  assert.match(instruction, /原章节正文：/);
  assert.match(instruction, /用户补充要求：保留开头意象/);
});

test("chapter context preview includes selected chapter and next target", () => {
  const preview = buildNovelChapterContextPreview({
    project: {
      title: "裂缝中的阳光",
      genre: "都市悬疑",
      premise: "公共记忆被篡改。",
      world: "近未来南方城市。",
      protagonist: "林照，档案修复师。",
      chapters: [
        {
          number: 2,
          title: "缺页档案",
          status: "planned",
          targetWords: 3000,
          focus: "档案室出现线索。",
        },
      ],
      chapterWordCount: 3000,
      targetChapters: 120,
    },
    assets: {
      outline: "第一卷：雨后裂缝到旧城蓝光。",
      worldNotes: "城市裂缝会吞掉记忆。",
      characters: "林照：档案修复师。",
      settings: "核心设定：裂缝抹除公共记忆。",
      genres: [],
      styleSamples: [],
      importedMaterials: [],
      marketRadars: [],
      diagnostics: [],
    },
    chapters: [
      {
        id: "chapter-1",
        bookId: "book",
        number: 1,
        title: "雨后裂缝",
        content: "正文",
        summary: "林照发现裂缝。",
        status: "ready-for-review",
        wordCount: 1200,
        reviewNotes: "建议强化主角动机。",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    selectedChapterId: "chapter-1",
  });

  assert.match(preview, /当前章节：第 1 章《雨后裂缝》/);
  assert.match(preview, /下一章目标：第 2 章《缺页档案》/);
  assert.match(preview, /最近章节摘要/);
  assert.match(preview, /审稿记录：建议强化主角动机/);
});

test("novel word count supports Chinese characters and latin words", () => {
  assert.equal(countNovelWords("雨停了 after the storm"), 6);
});

test("novel review status is derived from review notes", () => {
  assert.equal(
    deriveNovelReviewStatus("审稿通过，暂无明显问题，可以定稿。"),
    "approved",
  );
  assert.equal(
    deriveNovelReviewStatus("存在节奏问题，建议补充主角动机。"),
    "ready-for-review",
  );
});

test("novel relative age falls back gracefully", () => {
  assert.equal(formatNovelRelativeAge("not-a-date"), "刚刚");
});

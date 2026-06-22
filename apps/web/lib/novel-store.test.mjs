import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNovelChapterContextPreview,
  buildNovelChapterDraftMeta,
  buildNovelChapterVersionDiff,
  buildNovelChapterVersionCompareView,
  buildNovelReviewIssueViews,
  buildNovelReviseChapterInstruction,
  buildNovelWriteChapterInstruction,
  buildNovelWorkspaceSnapshotForTest,
  countNovelWords,
  deriveNovelChapterProgress,
  deriveNovelReviewStatus,
  formatNovelRelativeAge,
  getNovelTaskGuard,
  mergeNovelChapterPlan,
  parseNovelReviewNotes,
  reconcileNovelReviewHistory,
  selectNextNovelChapterTarget,
  sortStoredNovelChapterVersions,
  sortStoredNovelBooks,
  sortStoredNovelChapters,
  sortStoredNovelMessages,
  sortStoredNovelSessions,
  syncNovelProjectChapterPlan,
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
  assert.match(review.issues[0].detail, /主角动机/);
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

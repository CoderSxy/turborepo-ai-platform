import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { register } from "node:module";
import { afterEach, beforeEach, describe, it } from "node:test";

await register("../node-test-resolve.mjs", import.meta.url);

const {
  commitWriteChapterResultWithDb,
  createDefaultNovelAssets,
  selectNextNovelChapterTarget,
  validateCommitWriteChapterResultInput,
} = await import("../../../../lib/novel-store.ts");
const {
  runWriteChapterPipeline,
  validateWriteChapterState,
} = await import("./run-write-chapter-pipeline.ts");
const {
  buildWriteChapterPipelineTimelineView,
  collectChapterAuditIssues,
} = await import("./write-chapter-pipeline-timeline.ts");

const TEST_DB_NAME = "sxy-write-chapter-integration-test";
const TEST_DB_VERSION = 5;
const BOOKS_STORE = "books";
const CHAPTERS_STORE = "chapters";
const CHAPTER_VERSIONS_STORE = "chapterVersions";
const TASKS_STORE = "tasks";
const MESSAGES_STORE = "messages";

const NOW = "2026-07-14T12:00:00.000Z";
const TASK_ID = "task-integration-1";

const DRAFT_CONTENT = [
  "# 第二章 试炼",
  "",
  "主角进入试炼场。",
  "",
  "## 章节摘要",
  "试炼开始。",
].join("\n");

const REVISED_CONTENT = [
  "# 第二章 试炼",
  "",
  "主角带着明确动机进入试炼场。",
  "",
  "## 章节摘要",
  "试炼开始（修订）。",
].join("\n");

function buildPassAudit() {
  return {
    totalScore: 88,
    dimensions: [
      { key: "continuity", score: 90, issues: [] },
      { key: "character", score: 85, issues: [] },
      { key: "plot", score: 88, issues: [] },
      { key: "style", score: 86, issues: [] },
      { key: "pacing", score: 84, issues: [] },
      { key: "foreshadowing", score: 87, issues: [] },
      { key: "length", score: 90, issues: [] },
    ],
  };
}

function buildCriticalAudit() {
  return {
    totalScore: 52,
    dimensions: [
      {
        key: "plot",
        score: 40,
        issues: [
          {
            severity: "critical",
            evidence: "主角动机不足",
            suggestion: "补一处选择压力",
          },
        ],
      },
      { key: "continuity", score: 70, issues: [] },
      { key: "character", score: 65, issues: [] },
      { key: "style", score: 75, issues: [] },
      { key: "pacing", score: 68, issues: [] },
      { key: "foreshadowing", score: 72, issues: [] },
      { key: "length", score: 80, issues: [] },
    ],
  };
}

function buildBook() {
  const project = {
    title: "测试书",
    genre: "玄幻",
    premise: "少年修行",
    protagonist: "林凡",
    world: "修行世界",
    chapters: [
      {
        number: 2,
        title: "试炼",
        status: "planned",
        targetWords: 3000,
        focus: "进入试炼",
      },
    ],
    currentStage: "chapter-plan",
    chapterWordCount: 3000,
  };

  return {
    id: "book-1",
    title: project.title,
    genre: project.genre,
    premise: project.premise,
    project,
    assets: createDefaultNovelAssets(project),
    archived: false,
    sortIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildTask() {
  return {
    id: TASK_ID,
    bookId: "book-1",
    sessionId: "session-1",
    action: "write-chapter",
    label: "写下一章",
    status: "running",
    logs: [{ id: "log-1", message: "任务开始。", createdAt: NOW }],
    targetChapterNumber: 2,
    targetChapterTitle: "试炼",
    startedAt: NOW,
  };
}

function createRecordingAdapters(handlers = {}) {
  const calls = [];
  let auditCallIndex = 0;

  return {
    calls,
    adapters: {
      planChapter: async (context) => {
        calls.push("plan");
        return handlers.planChapter
          ? handlers.planChapter(context)
          : `第 ${context.target.number} 章 intent`;
      },
      draftChapter: async () => {
        calls.push("draft");
        return handlers.draftChapter ? handlers.draftChapter() : DRAFT_CONTENT;
      },
      auditChapter: async (context) => {
        calls.push(context.attempt === 1 ? "audit" : "audit-retry");
        if (handlers.auditChapter) {
          return handlers.auditChapter(context);
        }

        const responses = handlers.auditResponses ?? [
          JSON.stringify(buildPassAudit()),
        ];
        const response = responses[Math.min(auditCallIndex, responses.length - 1)];
        auditCallIndex += 1;
        return response;
      },
      reviseChapter: async () => {
        calls.push("revise");
        return handlers.reviseContent ?? REVISED_CONTENT;
      },
    },
  };
}

function upgradeNovelDbSchema(db) {
  if (!db.objectStoreNames.contains(BOOKS_STORE)) {
    db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
    db.createObjectStore(CHAPTERS_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(CHAPTER_VERSIONS_STORE)) {
    db.createObjectStore(CHAPTER_VERSIONS_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(TASKS_STORE)) {
    db.createObjectStore(TASKS_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
    db.createObjectStore(MESSAGES_STORE, { keyPath: "id" });
  }
}

function openTestNovelDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TEST_DB_NAME, TEST_DB_VERSION);
    request.onupgradeneeded = () => {
      upgradeNovelDbSchema(request.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open test IndexedDB."));
  });
}

function deleteTestNovelDb() {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(TEST_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to read ${storeName}.`));
  });
}

async function readStoreSnapshot(db) {
  const [books, chapters, chapterVersions, tasks, messages] = await Promise.all([
    getAllFromStore(db, BOOKS_STORE),
    getAllFromStore(db, CHAPTERS_STORE),
    getAllFromStore(db, CHAPTER_VERSIONS_STORE),
    getAllFromStore(db, TASKS_STORE),
    getAllFromStore(db, MESSAGES_STORE),
  ]);
  return { books, chapters, chapterVersions, tasks, messages };
}

function putInStore(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error(`Failed to write ${storeName}.`));
  });
}

async function runPipelineAndCommit(db, handlers = {}) {
  const { adapters } = createRecordingAdapters(handlers);
  const result = await runWriteChapterPipeline({
    book: buildBook(),
    chapters: [],
    target: {
      number: 2,
      title: "试炼",
      focus: "进入试炼",
      targetWords: 3000,
      reason: "planned",
    },
    task: buildTask(),
    sessionId: "session-1",
    assistantMessageId: "assistant-1",
    label: "写下一章",
    startedAt: NOW,
    adapters,
    now: () => NOW,
    config: handlers.config,
    signal: handlers.signal,
  });

  if (
    result.terminal === "completed" ||
    result.terminal === "completed_with_attention"
  ) {
    validateCommitWriteChapterResultInput(result.commitInput);
    await commitWriteChapterResultWithDb(db, result.commitInput);
  }

  return result;
}

describe("write-chapter integration", () => {
  let db;

  beforeEach(async () => {
    await deleteTestNovelDb();
    db = await openTestNovelDb();
    await putInStore(db, BOOKS_STORE, buildBook());
  });

  afterEach(async () => {
    db.close();
    await deleteTestNovelDb();
  });

  it("commits a successful no-revision write in one transaction", async () => {
    const result = await runPipelineAndCommit(db);

    assert.equal(result.terminal, "completed");
    const snapshot = await readStoreSnapshot(db);
    assert.equal(snapshot.chapters.length, 1);
    assert.equal(snapshot.chapterVersions.length, 1);
    assert.equal(snapshot.tasks[0]?.status, "success");
    assert.equal(snapshot.tasks[0]?.pipelineStage, "completed");
    assert.match(snapshot.messages[0]?.content ?? "", /已保存/);
  });

  it("auto-revises on critical issues and commits the revised version", async () => {
    const result = await runPipelineAndCommit(db, {
      auditResponses: [
        JSON.stringify(buildCriticalAudit()),
        JSON.stringify(buildPassAudit()),
      ],
      config: { maxRevisionAttempts: 1 },
    });

    assert.equal(result.terminal, "completed");
    if (result.terminal === "completed" || result.terminal === "completed_with_attention") {
      assert.match(result.commitInput.finalChapter.content, /明确动机/);
      assert.equal(result.checkpoint.revisionAttempts, 1);
    }
  });

  it("saves unrepaired attention results and allows the next chapter target", async () => {
    const result = await runPipelineAndCommit(db, {
      auditResponses: [
        JSON.stringify(buildCriticalAudit()),
        JSON.stringify(buildCriticalAudit()),
      ],
      config: { maxRevisionAttempts: 1 },
    });

    assert.equal(result.terminal, "completed_with_attention");
    const snapshot = await readStoreSnapshot(db);
    const nextTarget = selectNextNovelChapterTarget(
      buildBook().project,
      snapshot.chapters,
    );
    assert.equal(nextTarget.number, 3);
    assert.equal(snapshot.tasks[0]?.status, "completed_with_attention");
  });

  it("handles parser failure as completed_with_attention without pretending pass", async () => {
    const result = await runPipelineAndCommit(db, {
      auditResponses: ["无法解析的审核输出", "仍然无法解析"],
    });

    assert.equal(result.terminal, "completed_with_attention");
    if (result.terminal === "completed_with_attention") {
      assert.equal(result.audit, null);
      assert.match(result.attentionReason ?? "", /无法解析/);
    }
  });

  it("returns cancelled without persisting final assets", async () => {
    const controller = new AbortController();
    const { adapters } = createRecordingAdapters({
      auditChapter: async () => {
        controller.abort();
        return JSON.stringify(buildPassAudit());
      },
    });

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      signal: controller.signal,
      now: () => NOW,
    });

    assert.equal(result.terminal, "cancelled");
    const snapshot = await readStoreSnapshot(db);
    assert.equal(snapshot.chapters.length, 0);
    assert.equal(snapshot.chapterVersions.length, 0);
  });

  it("fails on model errors without writing final assets", async () => {
    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters: {
        planChapter: async () => "intent",
        draftChapter: async () => {
          throw new Error("模型服务不可用");
        },
        auditChapter: async () => JSON.stringify(buildPassAudit()),
        reviseChapter: async () => REVISED_CONTENT,
      },
      now: () => NOW,
    });

    assert.equal(result.terminal, "failed");
    assert.match(result.errorMessage, /模型服务不可用/);
    const snapshot = await readStoreSnapshot(db);
    assert.equal(snapshot.chapters.length, 0);
  });

  it("reload after commit leaves a completed task and non-streaming message", async () => {
    const result = await runPipelineAndCommit(db);
    assert.equal(result.terminal, "completed");

    const snapshot = await readStoreSnapshot(db);
    const task = snapshot.tasks[0];
    const message = snapshot.messages[0];

    assert.equal(task?.status, "success");
    assert.ok(task?.endedAt);
    assert.doesNotMatch(message?.content ?? "", /streaming|正在保存/i);
    assert.match(message?.content ?? "", /已保存/);
  });

  it("blocks writing the next chapter when state validation fails", async () => {
    const book = buildBook();
    const validation = validateWriteChapterState({
      generatedChapter: {
        bookId: book.id,
        number: 3,
        title: "错位章节",
        content: "正文。",
        summary: "摘要。",
        status: "ready-for-review",
        wordCount: 2,
      },
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      assets: book.assets,
    });

    assert.equal(validation.ok, false);
    if (!validation.ok) {
      assert.match(validation.reason, /章节序号/);
    }

    const snapshot = await readStoreSnapshot(db);
    const nextTarget = selectNextNovelChapterTarget(book.project, snapshot.chapters);
    assert.equal(nextTarget.number, 2);
    assert.equal(snapshot.chapters.length, 0);
  });
});

describe("write-chapter pipeline timeline", () => {
  it("builds a compact timeline view with collapsed audit issues", () => {
    const audit = buildCriticalAudit();
    const timeline = buildWriteChapterPipelineTimelineView({
      checkpoint: {
        stage: "completed_with_attention",
        stageTimeline: [],
        revisionAttempts: 1,
        auditParseAttempts: 1,
        draftVersionIds: ["draft-1", "revision-1"],
      },
      audit,
      draftContent: REVISED_CONTENT,
      contextSummary: "章节计划 / 大纲、角色状态",
      syncStatus: "applied",
      terminal: "completed_with_attention",
      attentionReason: "仍有阻塞问题未完全修复",
    });

    assert.ok(timeline.draftWordCount && timeline.draftWordCount > 0);
    assert.equal(timeline.revisionCount, 1);
    assert.equal(timeline.reAuditOutcome, "attention");
    assert.equal(collectChapterAuditIssues(audit).length, 1);
    assert.equal(timeline.auditIssues?.length, 1);
    assert.match(timeline.auditDimensions?.[0]?.label ?? "", /剧情推进/);
  });
});

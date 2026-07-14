import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createChapterPipelineSyncId } from "../../../../lib/novel-asset-auto-sync.ts";
import {
  createDefaultNovelAssets,
  validateCommitWriteChapterResultInput,
} from "../../../../lib/novel-store.ts";
import {
  assertCanCommitWriteChapter,
  buildCompletedWriteChapterTask,
  buildInMemoryChapterVersion,
  buildInMemoryStoredChapter,
  buildWriteChapterCommitInput,
  preallocateWriteChapterIds,
} from "./commit-write-chapter-result.ts";

const NOW = "2026-07-14T12:00:00.000Z";
const TASK_ID = "task-1720000000-abc123";

function buildFixtureTask() {
  return {
    id: "task-1",
    bookId: "book-1",
    sessionId: "session-1",
    action: "write-chapter",
    label: "写下一章",
    status: "running" as const,
    logs: [{ id: "log-1", message: "任务开始。", createdAt: NOW }],
    targetChapterNumber: 2,
    targetChapterTitle: "第二章",
    startedAt: NOW,
  };
}

describe("preallocateWriteChapterIds", () => {
  it("returns stable deterministic ids from task identity", () => {
    const first = preallocateWriteChapterIds("book-1", 2, TASK_ID);
    const second = preallocateWriteChapterIds("book-1", 2, TASK_ID);

    assert.equal(first.chapterId, "book-1-chapter-0002");
    assert.equal(
      first.chapterVersionId,
      "book-1-chapter-0002-version-generation-task1720000000abc123",
    );
    assert.deepEqual(first, second);
  });

  it("returns different version ids for different tasks on the same chapter", () => {
    const first = preallocateWriteChapterIds("book-1", 2, "task-1");
    const second = preallocateWriteChapterIds("book-1", 2, "task-2");

    assert.equal(first.chapterId, second.chapterId);
    assert.notEqual(first.chapterVersionId, second.chapterVersionId);
  });
});

describe("assertCanCommitWriteChapter", () => {
  it("throws AbortError when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();

    assert.throws(
      () => assertCanCommitWriteChapter(controller.signal),
      (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError",
    );
  });

  it("allows commit when the signal is active", () => {
    const controller = new AbortController();
    assert.doesNotThrow(() => assertCanCommitWriteChapter(controller.signal));
  });
});

describe("buildWriteChapterCommitInput", () => {
  it("links chapter, version, task, and message identities", () => {
    const { chapterId, chapterVersionId } = preallocateWriteChapterIds(
      "book-1",
      2,
      TASK_ID,
    );
    const generatedChapter = {
      bookId: "book-1",
      number: 2,
      title: "第二章",
      content: "正文内容。",
      summary: "章节摘要",
      status: "ready-for-review" as const,
      wordCount: 5,
    };
    const storedChapter = buildInMemoryStoredChapter({
      generatedChapter,
      chapterId,
      now: NOW,
    });
    const chapterVersion = buildInMemoryChapterVersion({
      chapter: storedChapter,
      chapterVersionId,
      now: NOW,
    });
    const syncId = createChapterPipelineSyncId({
      chapterId,
      chapterVersionId,
      delta: {
        chapterNumber: 2,
        chapterTitle: "第二章",
        summary: "章节摘要",
        characterStates: [],
        newForeshadowing: [],
        resolvedForeshadowing: [],
        worldIncrements: [],
      },
    });
    const activeBook = {
      id: "book-1",
      title: "测试书",
      genre: "悬疑",
      premise: "前提",
      project: {
        title: "测试书",
        genre: "悬疑",
        premise: "前提",
        chapters: [],
      },
      assets: createDefaultNovelAssets({
        title: "测试书",
        genre: "悬疑",
        premise: "前提",
        chapters: [],
      }),
      archived: false,
      sortIndex: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const savedMessage = "第 2 章《第二章》已保存";
    const progressMessages = [
      "正在准备第 2 章《第二章》",
      "已同步：章节摘要、角色状态、世界观、伏笔与大纲",
      savedMessage,
    ];

    const input = buildWriteChapterCommitInput({
      bookSnapshot: {
        id: "book-1",
        archived: false,
        sortIndex: 0,
        createdAt: NOW,
      },
      nextProject: activeBook.project,
      nextAssets: activeBook.assets,
      storedChapter,
      chapterVersion,
      runningTask: buildFixtureTask(),
      sessionId: "session-1",
      label: "写下一章",
      assistantMessageId: "assistant-core-1",
      progressMessages,
      resultContent: "模型输出",
      completionSummary: savedMessage,
      startedAt: NOW,
      now: NOW,
    });

    assert.equal(input.finalChapter.id, chapterId);
    assert.equal(input.finalChapterVersion.id, chapterVersionId);
    assert.equal(input.finalChapterVersion.chapterId, chapterId);
    assert.equal(input.completedTask.targetChapterId, chapterId);
    assert.equal(input.completedTask.status, "success");
    assert.equal(input.finalAssistantMessage.sessionId, "session-1");
    assert.match(input.finalAssistantMessage.content, /已保存/);
    assert.doesNotThrow(() => validateCommitWriteChapterResultInput(input));
    assert.match(syncId, new RegExp(`^${chapterId}:${chapterVersionId}:`));
  });

  it("does not include saved progress until caller adds it", () => {
    const { chapterId, chapterVersionId } = preallocateWriteChapterIds(
      "book-1",
      1,
      TASK_ID,
    );
    const generatedChapter = {
      bookId: "book-1",
      number: 1,
      title: "第一章",
      content: "正文。",
      summary: "摘要",
      status: "ready-for-review" as const,
      wordCount: 2,
    };
    const storedChapter = buildInMemoryStoredChapter({
      generatedChapter,
      chapterId,
      now: NOW,
    });
    const chapterVersion = buildInMemoryChapterVersion({
      chapter: storedChapter,
      chapterVersionId,
      now: NOW,
    });
    const activeBook = {
      id: "book-1",
      title: "测试书",
      genre: "悬疑",
      premise: "前提",
      project: {
        title: "测试书",
        genre: "悬疑",
        premise: "前提",
        chapters: [],
      },
      assets: createDefaultNovelAssets({
        title: "测试书",
        genre: "悬疑",
        premise: "前提",
        chapters: [],
      }),
      archived: false,
      sortIndex: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const progressBeforeSave = ["正在写回 IndexedDB。"];

    const input = buildWriteChapterCommitInput({
      bookSnapshot: {
        id: "book-1",
        archived: false,
        sortIndex: 0,
        createdAt: NOW,
      },
      nextProject: activeBook.project,
      nextAssets: activeBook.assets,
      storedChapter,
      chapterVersion,
      runningTask: buildFixtureTask(),
      sessionId: "session-1",
      label: "写下一章",
      assistantMessageId: "assistant-core-1",
      progressMessages: progressBeforeSave,
      resultContent: "模型输出",
      completionSummary: "已同步：章节摘要、角色状态、世界观、伏笔与大纲",
      startedAt: NOW,
      now: NOW,
    });

    assert.doesNotMatch(input.finalAssistantMessage.content, /已保存/);
    assert.equal(input.completedTask.status, "success");
  });
});

describe("buildCompletedWriteChapterTask", () => {
  it("clears recoverable checkpoint on terminal success", () => {
    const storedChapter = buildInMemoryStoredChapter({
      generatedChapter: {
        bookId: "book-1",
        number: 2,
        title: "第二章",
        content: "正文。",
        summary: "摘要",
        status: "ready-for-review",
        wordCount: 2,
      },
      chapterId: "book-1-chapter-0002",
      now: NOW,
    });

    const completed = buildCompletedWriteChapterTask({
      task: {
        ...buildFixtureTask(),
        checkpoint: {
          progressMessages: ["正在保存，请勿关闭…"],
          savedAt: NOW,
          assistantMessageId: "assistant-1",
          pipeline: {
            stage: "committing",
            stageTimeline: [],
            revisionAttempts: 0,
            auditParseAttempts: 1,
            draftVersionIds: [],
          },
        },
      },
      storedChapter,
      progressMessages: ["第 2 章《第二章》已保存"],
      now: NOW,
    });

    assert.equal(completed.status, "success");
    assert.equal(completed.checkpoint, undefined);
  });
});

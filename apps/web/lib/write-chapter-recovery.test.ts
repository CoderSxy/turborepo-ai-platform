import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type {
  CommitWriteChapterResultInput,
  StoredNovelBook,
  StoredNovelChapter,
  StoredNovelChapterVersion,
  StoredNovelMessage,
  StoredNovelTask,
} from "./novel-store.ts";
import {
  commitWriteChapterResultWithDb,
  createDefaultNovelAssets,
  selectNextNovelChapterTarget,
} from "./novel-store.ts";

const TEST_DB_NAME = "sxy-creative-studio-recovery-test";
const TEST_DB_VERSION = 5;
const BOOKS_STORE = "books";
const CHAPTERS_STORE = "chapters";
const CHAPTER_VERSIONS_STORE = "chapterVersions";
const TASKS_STORE = "tasks";
const MESSAGES_STORE = "messages";

type StoreSnapshot = {
  books: StoredNovelBook[];
  chapters: StoredNovelChapter[];
  chapterVersions: StoredNovelChapterVersion[];
  tasks: StoredNovelTask[];
  messages: StoredNovelMessage[];
};

function upgradeNovelDbSchema(
  db: IDBDatabase,
  transaction: IDBTransaction | null,
): void {
  if (!db.objectStoreNames.contains(BOOKS_STORE)) {
    const books = db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
    books.createIndex("updatedAt", "updatedAt");
    books.createIndex("archived", "archived");
    books.createIndex("sortIndex", "sortIndex");
  } else {
    const books = transaction?.objectStore(BOOKS_STORE);
    if (books && !books.indexNames.contains("archived")) {
      books.createIndex("archived", "archived");
    }
    if (books && !books.indexNames.contains("sortIndex")) {
      books.createIndex("sortIndex", "sortIndex");
    }
  }

  if (!db.objectStoreNames.contains("sessions")) {
    const sessions = db.createObjectStore("sessions", { keyPath: "id" });
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
}

function openTestNovelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TEST_DB_NAME, TEST_DB_VERSION);

    request.onupgradeneeded = () => {
      upgradeNovelDbSchema(request.result, request.transaction);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open test IndexedDB."));
  });
}

function deleteTestNovelDb(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(TEST_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to read ${storeName}.`));
  });
}

function putInStore<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error(`Failed to write ${storeName}.`));
  });
}

async function readStoreSnapshot(db: IDBDatabase): Promise<StoreSnapshot> {
  const [books, chapters, chapterVersions, tasks, messages] = await Promise.all([
    getAllFromStore<StoredNovelBook>(db, BOOKS_STORE),
    getAllFromStore<StoredNovelChapter>(db, CHAPTERS_STORE),
    getAllFromStore<StoredNovelChapterVersion>(db, CHAPTER_VERSIONS_STORE),
    getAllFromStore<StoredNovelTask>(db, TASKS_STORE),
    getAllFromStore<StoredNovelMessage>(db, MESSAGES_STORE),
  ]);

  return { books, chapters, chapterVersions, tasks, messages };
}

function buildCommitInput(
  overrides: Partial<CommitWriteChapterResultInput> = {},
): CommitWriteChapterResultInput {
  const now = "2026-07-14T10:00:00.000Z";
  const bookId = "book-1";
  const sessionId = "session-1";
  const chapterId = "book-1-chapter-0002";
  const versionId = "book-1-chapter-0002-version-generation-20260714100000000";
  const taskId = "task-1";
  const messageId = "assistant-core-1";

  const book: StoredNovelBook = {
    id: bookId,
    title: "测试书",
    genre: "悬疑",
    premise: "前提",
    project: {
      title: "测试书",
      genre: "悬疑",
      premise: "前提",
      chapters: [
        {
          number: 1,
          title: "第一章",
          status: "ready-for-review",
          targetWords: 3000,
          focus: "开端",
        },
        {
          number: 2,
          title: "第二章",
          status: "planned",
          targetWords: 3000,
          focus: "推进",
        },
      ],
      chapterWordCount: 3000,
    },
    assets: createDefaultNovelAssets({
      title: "测试书",
      genre: "悬疑",
      premise: "前提",
      chapters: [
        {
          number: 1,
          title: "第一章",
          status: "ready-for-review",
          targetWords: 3000,
          focus: "开端",
        },
        {
          number: 2,
          title: "第二章",
          status: "planned",
          targetWords: 3000,
          focus: "推进",
        },
      ],
    }),
    archived: false,
    sortIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  const finalChapter: StoredNovelChapter = {
    id: chapterId,
    bookId,
    number: 2,
    title: "第二章",
    content: "第二章正文。",
    summary: "第二章摘要",
    status: "ready-for-review",
    wordCount: 6,
    reviewNotes: "",
    reviews: [],
    createdAt: now,
    updatedAt: now,
  };

  const finalChapterVersion: StoredNovelChapterVersion = {
    id: versionId,
    chapterId,
    bookId,
    number: 2,
    title: "第二章",
    content: "第二章正文。",
    summary: "第二章摘要",
    status: "ready-for-review",
    wordCount: 6,
    reviewNotes: "",
    reviews: [],
    source: "generation",
    createdAt: now,
  };

  const completedTask: StoredNovelTask = {
    id: taskId,
    bookId,
    sessionId,
    action: "write-chapter",
    label: "写下一章",
    status: "success",
    logs: [{ id: "log-1", message: "第 2 章《第二章》已保存", createdAt: now }],
    targetChapterId: chapterId,
    targetChapterNumber: 2,
    targetChapterTitle: "第二章",
    startedAt: now,
    endedAt: now,
  };

  const finalAssistantMessage: StoredNovelMessage = {
    id: messageId,
    sessionId,
    role: "assistant",
    content: "第 2 章《第二章》已保存",
    createdAt: now,
    status: "sent",
  };

  return {
    bookId,
    book,
    finalChapter,
    finalChapterVersion,
    completedTask,
    finalAssistantMessage,
    ...overrides,
  };
}

async function seedPreCommitWriteState(
  db: IDBDatabase,
  input: CommitWriteChapterResultInput,
): Promise<void> {
  const runningTask: StoredNovelTask = {
    ...input.completedTask,
    status: "running",
    endedAt: undefined,
    logs: [{ id: "log-running", message: "正在提交章节与资产…", createdAt: "2026-07-14T09:59:00.000Z" }],
  };
  const streamingMessage: StoredNovelMessage = {
    ...input.finalAssistantMessage,
    content: "写下一章\n\n[进度] 正在提交章节与资产…",
    status: "sent",
  };
  const existingChapter: StoredNovelChapter = {
    id: "book-1-chapter-0001",
    bookId: input.bookId,
    number: 1,
    title: "第一章",
    content: "第一章正文。",
    summary: "第一章摘要",
    status: "ready-for-review",
    wordCount: 6,
    reviewNotes: "",
    reviews: [],
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
  };

  await putInStore(db, BOOKS_STORE, {
    ...input.book,
    title: "旧标题",
    updatedAt: "2026-07-13T10:00:00.000Z",
  });
  await putInStore(db, CHAPTERS_STORE, existingChapter);
  await putInStore(db, TASKS_STORE, runningTask);
  await putInStore(db, MESSAGES_STORE, streamingMessage);
}

function existingChapterOne(bookId: string): StoredNovelChapter {
  return {
    id: `${bookId}-chapter-0001`,
    bookId,
    number: 1,
    title: "第一章",
    content: "第一章正文。",
    summary: "第一章摘要",
    status: "ready-for-review",
    wordCount: 6,
    reviewNotes: "",
    reviews: [],
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
  };
}

describe("write-chapter recovery", () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteTestNovelDb();
    db = await openTestNovelDb();
  });

  afterEach(async () => {
    db.close();
    await deleteTestNovelDb();
  });

  it("reload after success leaves one completed task and non-streaming message", async () => {
    const input = buildCommitInput();
    await seedPreCommitWriteState(db, input);

    await commitWriteChapterResultWithDb(db, input);

    const snapshot = await readStoreSnapshot(db);
    const task = snapshot.tasks.find((item) => item.id === input.completedTask.id);
    const message = snapshot.messages.find(
      (item) => item.id === input.finalAssistantMessage.id,
    );

    assert.ok(task);
    assert.notEqual(task.status, "running");
    assert.equal(task.status, "success");
    assert.ok(task.endedAt);
    assert.ok(message);
    assert.equal(message.status, "sent");
    assert.doesNotMatch(message.content, /正在提交|streaming/i);
    assert.match(message.content, /已保存/);
    assert.equal(snapshot.chapters.length, 2);
    assert.equal(snapshot.chapterVersions.length, 1);
    assert.equal(snapshot.books.length, 1);
    assert.equal(snapshot.messages.length, 1);
    assert.equal(snapshot.tasks.length, 1);
    assert.equal(snapshot.books[0]?.title, "测试书");
  });

  it("abort before commit leaves no final chapter, version, book assets, or final message", async () => {
    const input = buildCommitInput();
    await seedPreCommitWriteState(db, input);
    const before = await readStoreSnapshot(db);

    assert.equal(before.chapters.length, 1);
    assert.equal(before.chapterVersions.length, 0);
    assert.equal(before.tasks[0]?.status, "running");
    assert.doesNotMatch(before.messages[0]?.content ?? "", /已保存/);

    const after = await readStoreSnapshot(db);
    assert.deepEqual(after.chapters, before.chapters);
    assert.deepEqual(after.chapterVersions, before.chapterVersions);
    assert.deepEqual(after.books, before.books);
    assert.deepEqual(after.tasks, before.tasks);
    assert.deepEqual(after.messages, before.messages);
  });

  it("transaction abort leaves stores unchanged and retry produces one clean result", async () => {
    const input = buildCommitInput();
    await seedPreCommitWriteState(db, input);
    const before = await readStoreSnapshot(db);

    const failingChapter = {
      ...input.finalChapter,
      cloneTrap: () => "cannot clone",
    } as StoredNovelChapter & { cloneTrap: () => string };

    await assert.rejects(
      () =>
        commitWriteChapterResultWithDb(db, {
          ...input,
          finalChapter: failingChapter,
        }),
      (error: unknown) => error instanceof DOMException && error.name === "DataCloneError",
    );

    const afterAbort = await readStoreSnapshot(db);
    assert.deepEqual(afterAbort, before);

    await commitWriteChapterResultWithDb(db, input);

    const afterRetry = await readStoreSnapshot(db);
    assert.equal(afterRetry.chapters.length, 2);
    assert.equal(afterRetry.chapterVersions.length, 1);
    assert.equal(afterRetry.messages.length, 1);
    assert.equal(afterRetry.tasks.length, 1);
    assert.equal(afterRetry.tasks[0]?.status, "success");
    assert.equal(afterRetry.chapters.find((chapter) => chapter.number === 2)?.id, input.finalChapter.id);
  });

  it("after failed commit the next write still targets the original next chapter", async () => {
    const input = buildCommitInput();
    const project = input.book.project;
    const chapters = [existingChapterOne(input.bookId)];

    const beforeFailure = selectNextNovelChapterTarget(project, chapters);
    assert.equal(beforeFailure.number, 2);
    assert.equal(beforeFailure.title, "第二章");

    await seedPreCommitWriteState(db, input);
    const failingChapter = {
      ...input.finalChapter,
      cloneTrap: () => "cannot clone",
    } as StoredNovelChapter & { cloneTrap: () => string };

    await assert.rejects(
      () =>
        commitWriteChapterResultWithDb(db, {
          ...input,
          finalChapter: failingChapter,
        }),
      (error: unknown) => error instanceof DOMException && error.name === "DataCloneError",
    );

    const snapshot = await readStoreSnapshot(db);
    assert.equal(snapshot.chapters.length, 1);

    const afterFailure = selectNextNovelChapterTarget(project, snapshot.chapters);
    assert.equal(afterFailure.number, 2);
    assert.equal(afterFailure.title, "第二章");
    assert.equal(afterFailure.reason, "planned");
  });
});

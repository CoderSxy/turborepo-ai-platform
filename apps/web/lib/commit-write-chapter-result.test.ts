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
  CommitWriteChapterResultValidationError,
  commitWriteChapterResult,
  commitWriteChapterResultWithDb,
  createDefaultNovelAssets,
  validateCommitWriteChapterResultInput,
} from "./novel-store.ts";

const TEST_DB_NAME = "sxy-creative-studio-commit-test";
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
  const chapterId = "chapter-1";
  const versionId = "version-1";
  const taskId = "task-1";
  const messageId = "message-1";

  const book: StoredNovelBook = {
    id: bookId,
    title: "测试书",
    genre: "悬疑",
    premise: "前提",
    project: { title: "测试书", genre: "悬疑", premise: "前提", chapters: [] },
    assets: createDefaultNovelAssets({
      title: "测试书",
      genre: "悬疑",
      premise: "前提",
      chapters: [],
    }),
    archived: false,
    sortIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  const finalChapter: StoredNovelChapter = {
    id: chapterId,
    bookId,
    number: 1,
    title: "第一章",
    content: "正文内容。",
    summary: "摘要",
    status: "draft",
    wordCount: 5,
    reviewNotes: "",
    reviews: [],
    createdAt: now,
    updatedAt: now,
  };

  const finalChapterVersion: StoredNovelChapterVersion = {
    id: versionId,
    chapterId,
    bookId,
    number: 1,
    title: "第一章",
    content: "正文内容。",
    summary: "摘要",
    status: "draft",
    wordCount: 5,
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
    label: "写第一章",
    status: "success",
    logs: [{ id: "log-1", message: "任务完成。", createdAt: now }],
    targetChapterId: chapterId,
    targetChapterNumber: 1,
    targetChapterTitle: "第一章",
    startedAt: now,
    endedAt: now,
  };

  const finalAssistantMessage: StoredNovelMessage = {
    id: messageId,
    sessionId,
    role: "assistant",
    content: "第 1 章已保存。",
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

async function seedBaselineSnapshot(
  db: IDBDatabase,
  input: CommitWriteChapterResultInput,
): Promise<void> {
  await putInStore(db, BOOKS_STORE, {
    ...input.book,
    title: "旧标题",
    updatedAt: "2026-07-13T10:00:00.000Z",
  });
  await putInStore(db, CHAPTERS_STORE, {
    ...input.finalChapter,
    content: "旧正文",
    updatedAt: "2026-07-13T10:00:00.000Z",
  });
  await putInStore(db, CHAPTER_VERSIONS_STORE, {
    ...input.finalChapterVersion,
    content: "旧版本正文",
    createdAt: "2026-07-13T10:00:00.000Z",
  });
  await putInStore(db, TASKS_STORE, {
    ...input.completedTask,
    status: "running",
    endedAt: undefined,
  });
  await putInStore(db, MESSAGES_STORE, {
    ...input.finalAssistantMessage,
    content: "流式输出中…",
  });
}

describe("commitWriteChapterResult", () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteTestNovelDb();
    db = await openTestNovelDb();
  });

  afterEach(async () => {
    db.close();
    await deleteTestNovelDb();
  });

  it("writes chapter, version, book, task, and message exactly once on success", async () => {
    const input = buildCommitInput();

    await commitWriteChapterResultWithDb(db, input);

    const snapshot = await readStoreSnapshot(db);

    assert.equal(snapshot.chapters.length, 1);
    assert.equal(snapshot.chapterVersions.length, 1);
    assert.equal(snapshot.books.length, 1);
    assert.equal(snapshot.tasks.length, 1);
    assert.equal(snapshot.messages.length, 1);
    assert.deepEqual(snapshot.chapters[0], input.finalChapter);
    assert.deepEqual(snapshot.chapterVersions[0], input.finalChapterVersion);
    assert.deepEqual(snapshot.books[0], input.book);
    assert.deepEqual(snapshot.tasks[0], input.completedTask);
    assert.deepEqual(snapshot.messages[0], input.finalAssistantMessage);
  });

  it("leaves all five stores unchanged when a put fails", async () => {
    const input = buildCommitInput();
    await seedBaselineSnapshot(db, input);
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

    const after = await readStoreSnapshot(db);
    assert.deepEqual(after, before);
  });

  it("upserts stable ids on retry without duplicating records", async () => {
    const input = buildCommitInput();

    await commitWriteChapterResultWithDb(db, input);

    const retryInput = buildCommitInput({
      book: {
        ...input.book,
        title: "更新后的标题",
        updatedAt: "2026-07-14T11:00:00.000Z",
      },
      finalChapter: {
        ...input.finalChapter,
        content: "更新后的正文。",
        updatedAt: "2026-07-14T11:00:00.000Z",
      },
      finalChapterVersion: {
        ...input.finalChapterVersion,
        content: "更新后的正文。",
        createdAt: "2026-07-14T11:00:00.000Z",
      },
      completedTask: {
        ...input.completedTask,
        logs: [
          ...input.completedTask.logs,
          {
            id: "log-2",
            message: "重试后完成。",
            createdAt: "2026-07-14T11:00:00.000Z",
          },
        ],
        endedAt: "2026-07-14T11:00:00.000Z",
      },
      finalAssistantMessage: {
        ...input.finalAssistantMessage,
        content: "第 1 章已更新保存。",
      },
    });

    await commitWriteChapterResultWithDb(db, retryInput);

    const snapshot = await readStoreSnapshot(db);

    assert.equal(snapshot.chapters.length, 1);
    assert.equal(snapshot.chapterVersions.length, 1);
    assert.equal(snapshot.books.length, 1);
    assert.equal(snapshot.tasks.length, 1);
    assert.equal(snapshot.messages.length, 1);
    assert.equal(snapshot.books[0]?.title, "更新后的标题");
    assert.equal(snapshot.chapters[0]?.content, "更新后的正文。");
    assert.equal(snapshot.chapterVersions[0]?.content, "更新后的正文。");
    assert.equal(snapshot.messages[0]?.content, "第 1 章已更新保存。");
    assert.equal(snapshot.tasks[0]?.logs.length, 2);
  });

  it("rejects cross-book input before any store mutation", async () => {
    const input = buildCommitInput();
    const before = await readStoreSnapshot(db);
    const crossBookChapter = { ...input.finalChapter, bookId: "other-book" };

    assert.throws(
      () =>
        validateCommitWriteChapterResultInput({
          ...input,
          finalChapter: crossBookChapter,
        }),
      CommitWriteChapterResultValidationError,
    );

    await assert.rejects(
      () =>
        commitWriteChapterResultWithDb(db, {
          ...input,
          finalChapter: crossBookChapter,
        }),
      (error: unknown) =>
        error instanceof CommitWriteChapterResultValidationError,
    );

    const after = await readStoreSnapshot(db);
    assert.deepEqual(after, before);
  });

  it("commits through openNovelDb when IndexedDB is available", async () => {
    db.close();
    await deleteTestNovelDb();

    const productionDbName = "sxy-creative-studio";
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(productionDbName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });

    const input = buildCommitInput({
      bookId: "book-open",
      book: {
        ...buildCommitInput().book,
        id: "book-open",
      },
      finalChapter: {
        ...buildCommitInput().finalChapter,
        id: "chapter-open",
        bookId: "book-open",
      },
      finalChapterVersion: {
        ...buildCommitInput().finalChapterVersion,
        id: "version-open",
        chapterId: "chapter-open",
        bookId: "book-open",
      },
      completedTask: {
        ...buildCommitInput().completedTask,
        id: "task-open",
        bookId: "book-open",
        targetChapterId: "chapter-open",
      },
      finalAssistantMessage: {
        ...buildCommitInput().finalAssistantMessage,
        id: "message-open",
      },
    });

    await commitWriteChapterResult(input);

    const opened = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(productionDbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to open production test DB."));
    });

    try {
      const snapshot = await readStoreSnapshot(opened);
      assert.equal(snapshot.chapters.length, 1);
      assert.equal(snapshot.chapters[0]?.id, "chapter-open");
    } finally {
      opened.close();
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(productionDbName);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    }
  });
});

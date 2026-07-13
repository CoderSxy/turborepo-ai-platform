import assert from "node:assert/strict";
import test from "node:test";

import { resolveHydrateActiveIds } from "./hydrate-active-ids.ts";

function makeBook(id, sessionIds, archived = false) {
  return {
    id,
    title: id,
    meta: "",
    archived,
    sortIndex: 0,
    project: {},
    assets: {},
    chapters: [],
    tasks: [],
    sessions: sessionIds.map((sessionId) => ({
      id: sessionId,
      title: sessionId,
      summary: "",
      age: "",
    })),
  };
}

test("resolveHydrateActiveIds keeps session when it belongs to active book", () => {
  const books = [makeBook("book-a", ["s-a1", "s-a2"]), makeBook("book-b", ["s-b1"])];

  const result = resolveHydrateActiveIds(books, "book-a", "s-a2");

  assert.equal(result.activeBookId, "book-a");
  assert.equal(result.activeSessionId, "s-a2");
});

test("resolveHydrateActiveIds falls back when session belongs to another book", () => {
  const books = [makeBook("book-a", ["s-a1"]), makeBook("book-b", ["s-b1", "s-b2"])];

  const result = resolveHydrateActiveIds(books, "book-b", "s-a1");

  assert.equal(result.activeBookId, "book-b");
  assert.equal(result.activeSessionId, "s-b1");
});

test("resolveHydrateActiveIds falls back to first non-archived book", () => {
  const books = [
    makeBook("book-archived", ["s-old"], true),
    makeBook("book-active", ["s-active"]),
  ];

  const result = resolveHydrateActiveIds(books, "missing-book", "s-old");

  assert.equal(result.activeBookId, "book-active");
  assert.equal(result.activeSessionId, "s-active");
});

test("resolveHydrateActiveIds returns empty ids when books are empty", () => {
  const result = resolveHydrateActiveIds([], "book-a", "s-a1");

  assert.equal(result.activeBookId, "");
  assert.equal(result.activeSessionId, "");
});

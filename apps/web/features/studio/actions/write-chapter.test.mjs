// apps/web/features/studio/actions/write-chapter.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDefaultWriteChapterSelection,
  summarizeContextSelection,
} from "./write-chapter.ts";

const savedSelection = {
  includeOutline: false,
  includePreviousSummary: true,
  includeWorld: false,
  includeCharacters: true,
  includeForeshadowing: false,
  includeReviewIssues: true,
  targetWords: 2500,
  viewpoint: "第一人称",
  pacing: "快节奏",
  highlights: "反转",
  bannedWords: "烂俗",
  styleConstraints: "冷峻",
  thrillPoints: "悬疑",
};

const bookWithSaved = {
  assets: { contextSelection: savedSelection },
};

const bookWithoutSaved = {
  assets: {},
};

const project = { chapterWordCount: 3000 };

test("resolveDefaultWriteChapterSelection uses saved assets.contextSelection", () => {
  const result = resolveDefaultWriteChapterSelection(bookWithSaved, project);
  assert.deepEqual(result, savedSelection);
  assert.notEqual(result, savedSelection);
});

test("resolveDefaultWriteChapterSelection falls back to buildDefaultNovelContextSelection", () => {
  const result = resolveDefaultWriteChapterSelection(bookWithoutSaved, project);
  assert.equal(result.targetWords, 3000);
  assert.equal(result.includeOutline, true);
  assert.equal(result.viewpoint, "第三人称有限视角");
});

test("resolveDefaultWriteChapterSelection does not mutate book assets", () => {
  resolveDefaultWriteChapterSelection(bookWithSaved, project).includeOutline = true;
  assert.equal(bookWithSaved.assets.contextSelection.includeOutline, false);
});

test("summarizeContextSelection lists only enabled context items", () => {
  const summary = summarizeContextSelection(savedSelection);
  assert.match(summary, /上一章摘要/);
  assert.match(summary, /角色/);
  assert.match(summary, /审稿遗留问题/);
  assert.doesNotMatch(summary, /大纲|世界观|伏笔/);
});

test("summarizeContextSelection returns fallback when nothing enabled", () => {
  const summary = summarizeContextSelection({
    ...savedSelection,
    includeOutline: false,
    includePreviousSummary: false,
    includeWorld: false,
    includeCharacters: false,
    includeForeshadowing: false,
    includeReviewIssues: false,
  });
  assert.equal(summary, "无额外上下文");
});

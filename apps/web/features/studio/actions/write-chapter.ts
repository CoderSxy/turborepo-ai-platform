import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  buildDefaultNovelContextSelection,
  selectNextNovelChapterTarget,
  type NovelChapterWriteTarget,
  type NovelContextSelection,
} from "#lib/novel-store";
import type { NovelBookEntry } from "../state/studio-types";
import { runCoreAction } from "./run-core-action";
import type { StudioActionContext, StudioActionSource } from "./types";

export type WriteChapterRequest = {
  target: NovelChapterWriteTarget;
  contextSelection: NovelContextSelection;
  source: StudioActionSource;
};

const CONTEXT_LABELS: Array<[keyof NovelContextSelection, string]> = [
  ["includeOutline", "章节计划 / 大纲"],
  ["includePreviousSummary", "上一章摘要"],
  ["includeWorld", "世界观"],
  ["includeCharacters", "角色状态"],
  ["includeForeshadowing", "伏笔池"],
  ["includeReviewIssues", "审稿遗留问题"],
];

export function resolveDefaultWriteChapterSelection(
  book: Pick<NovelBookEntry, "assets">,
  project: Pick<InkosNovelProject, "chapterWordCount">,
): NovelContextSelection {
  const base =
    book.assets.contextSelection ??
    buildDefaultNovelContextSelection(project);
  return structuredClone(base);
}

export function summarizeContextSelection(
  selection: NovelContextSelection,
): string {
  const enabled = CONTEXT_LABELS.filter(([key]) =>
    Boolean(selection[key]),
  ).map(([, label]) => label);
  return enabled.length > 0 ? enabled.join("、") : "无额外上下文";
}

export async function executeWriteChapter(
  ctx: StudioActionContext,
  options: {
    source: StudioActionSource;
    target?: NovelChapterWriteTarget;
    contextSelection?: NovelContextSelection;
  },
): Promise<boolean> {
  const store = ctx.getState();
  const activeBook = store.books.find((book) => book.id === store.activeBookId) ?? null;
  const project = activeBook?.project ?? null;

  if (!activeBook || !project) {
    ctx.notify("请先创建一本书籍。", "warning");
    return false;
  }

  const target =
    options.target ??
    selectNextNovelChapterTarget(project, activeBook.chapters);

  const selection =
    options.contextSelection ??
    resolveDefaultWriteChapterSelection(activeBook, project);

  return runCoreAction(ctx, "write-chapter", {
    targetChapter: target,
    contextSelectionOverride: selection,
  });
}

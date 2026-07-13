import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  buildDefaultNovelContextSelection,
  type NovelContextSelection,
} from "#lib/novel-store";
import type { NovelBookEntry } from "../state/studio-types";

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

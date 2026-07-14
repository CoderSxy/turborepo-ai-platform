"use client";

import { useEffect, useRef, useState } from "react";
import { INKOS_STATUS_LABELS, type InkosNovelProject } from "@repo/inkos-adapter";
import styles from "../../../studio.module.css";
import {
  applyNovelReviewIssueSuggestionToContent,
  buildNovelChapterDraftMeta,
  buildNovelChapterParagraphNavigation,
  buildNovelChapterVersionCompareView,
  buildNovelCompareDiffMarkers,
  buildNovelDocxDocumentModel,
  buildNovelEditorSearchState,
  buildNovelReviewExportMarkdown,
  buildNovelReviewIssueHighlights,
  buildNovelReviewIssueKey,
  buildNovelReviewIssueKeysForDiffMarkers,
  buildNovelReviewIssueParagraphMarks,
  buildNovelReviewIssueViews,
  filterNovelCompareDiffMarkers,
  filterNovelReviewIssueViews,
  findNovelCompareDiffMarkerForReviewIssue,
  findNovelReviewIssueParagraph,
  formatNovelChapterVersionSource,
  formatNovelRelativeAge,
  replaceNovelEditorSearchMatches,
  restoreNovelCompareLineInContent,
  type NovelChapterListItem,
  type NovelChapterWriteTarget,
  type NovelCompareDiffMarker,
  type NovelReviewIssueFilter,
  type StoredNovelChapter,
  type StoredNovelChapterVersion,
} from "../../../../../lib/novel-store";
import {
  downloadTextFile,
  downloadBytesFile,
  createNovelBookDocxFile,
} from "../../../helpers/export-helpers";
import { reviewSeverityLabel } from "../../../helpers/novel-helpers";
import { MarkdownContent } from "../../chat/MarkdownContent";

export function ChapterDetailView({
  chapterId,
  chapterRows,
  chapterVersions,
  project,
  onChapterSelect,
  onChapterDraftSave,
  onChapterStatusChange,
  onChapterPublicationStatusChange,
  onChapterDelete,
  onChapterVersionRestore,
  onGenerateChapter,
  onReviseChapter,
}: {
  chapterId: string;
  chapterRows: NovelChapterListItem[];
  chapterVersions: StoredNovelChapterVersion[];
  project: InkosNovelProject;
  onChapterSelect: (chapterId: string) => void;
  onChapterDraftSave: (
    chapter: StoredNovelChapter,
    updates: Pick<StoredNovelChapter, "content" | "summary">,
  ) => Promise<void>;
  onChapterStatusChange: (
    chapter: StoredNovelChapter,
    status: StoredNovelChapter["status"],
  ) => Promise<void>;
  onChapterPublicationStatusChange: (
    chapter: StoredNovelChapter,
    status: NonNullable<StoredNovelChapter["publicationStatus"]>,
  ) => Promise<void>;
  onChapterDelete: (chapter: StoredNovelChapter) => Promise<void>;
  onChapterVersionRestore: (version: StoredNovelChapterVersion) => Promise<void>;
  onGenerateChapter: (target: NovelChapterWriteTarget) => Promise<void>;
  onReviseChapter: (selectedIssueIds?: string[]) => Promise<void>;
}) {
  const detailRow =
    chapterRows.find((chapter) => chapter.key === chapterId) ?? null;
  const detailChapter = detailRow?.chapter ?? null;

  const [compareVersionId, setCompareVersionId] = useState("");
  const [isChapterEditorOpen, setIsChapterEditorOpen] = useState(false);
  const [chapterEditorContent, setChapterEditorContent] = useState("");
  const [chapterEditorSummary, setChapterEditorSummary] = useState("");
  const [isSavingChapterDraft, setIsSavingChapterDraft] = useState(false);
  const [chapterEditorSearch, setChapterEditorSearch] = useState("");
  const [chapterEditorReplacement, setChapterEditorReplacement] = useState("");
  const [chapterEditorSearchIndex, setChapterEditorSearchIndex] = useState(0);
  const [compareSearch, setCompareSearch] = useState("");
  const [compareDiffIndex, setCompareDiffIndex] = useState(0);
  const [compareRestoreParagraphIndex, setCompareRestoreParagraphIndex] =
    useState<number | null>(null);
  const [isChapterEditorFullscreen, setIsChapterEditorFullscreen] =
    useState(false);
  const [chapterDraftSavedAt, setChapterDraftSavedAt] = useState("");
  const [hasRestoredLocalDraft, setHasRestoredLocalDraft] = useState(false);
  const [selectedReviewIssueIds, setSelectedReviewIssueIds] = useState<string[]>([]);
  const [reviewIssueFilter, setReviewIssueFilter] =
    useState<NovelReviewIssueFilter>("all");
  const [locatedReviewIssue, setLocatedReviewIssue] = useState<{
    issueKey: string;
    paragraphIndex: number;
    paragraph: string;
  } | null>(null);
  const chapterEditorTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const compareDiffMarkerRefs = useRef<Record<string, HTMLSpanElement | null>>(
    {},
  );
  const latestVersion = chapterVersions[0] ?? null;
  const previousVersion = chapterVersions[1] ?? null;
  const compareVersion = chapterVersions.find(
    (version) => version.id === compareVersionId,
  );
  const compareVersionIndex = compareVersion
    ? chapterVersions.findIndex((version) => version.id === compareVersion.id)
    : -1;
  const compareBaseVersion =
    compareVersionIndex >= 0 ? chapterVersions[compareVersionIndex + 1] : null;
  const compareView =
    compareVersion && compareBaseVersion
      ? buildNovelChapterVersionCompareView(compareBaseVersion, compareVersion)
      : null;
  const versionWordDelta =
    latestVersion && previousVersion
      ? latestVersion.wordCount - previousVersion.wordCount
      : 0;
  const activeReview =
    detailChapter?.reviews?.find(
      (review) => review.id === detailChapter.activeReviewId,
    ) ?? detailChapter?.reviews?.[0] ?? null;
  const reviewIssueViews = detailChapter
    ? buildNovelReviewIssueViews(
        detailChapter.reviews ?? [],
        detailChapter.activeReviewId,
      )
    : [];
  const openReviewIssueCount = reviewIssueViews.filter(
    (issue) => !issue.resolved,
  ).length;
  const resolvedReviewIssueCount = reviewIssueViews.filter(
    (issue) => issue.resolved,
  ).length;
  const currentReviewIssueCount = reviewIssueViews.filter(
    (issue) => issue.isCurrentReview,
  ).length;
  const chapterDraftMeta = buildNovelChapterDraftMeta(
    chapterEditorContent,
    chapterEditorSummary,
  );
  const editorSearchState = buildNovelEditorSearchState(
    chapterEditorContent,
    chapterEditorSearch,
    chapterEditorSearchIndex,
  );
  const paragraphNavigation = buildNovelChapterParagraphNavigation(
    chapterEditorContent || detailChapter?.content || "",
    detailRow?.targetWords ?? project.chapterWordCount ?? 0,
  );
  const reviewIssueHighlights =
    detailChapter && reviewIssueViews.length > 0
      ? buildNovelReviewIssueHighlights(detailChapter.content, reviewIssueViews)
      : [];
  const reviewParagraphMarks = buildNovelReviewIssueParagraphMarks(
    (isChapterEditorOpen ? chapterEditorContent : detailChapter?.content) ?? "",
    reviewIssueViews,
  );
  const allCompareDiffMarkers =
    compareView && detailChapter
      ? buildNovelCompareDiffMarkers(compareView, reviewIssueViews)
      : [];
  const compareDiffMarkers = filterNovelCompareDiffMarkers(
    allCompareDiffMarkers,
    compareSearch,
  );
  const activeCompareDiffMarker =
    compareDiffMarkers[compareDiffIndex] ?? compareDiffMarkers[0] ?? null;
  const compareDiffIssueKeys =
    reviewIssueFilter === "diff"
      ? activeCompareDiffMarker &&
        activeCompareDiffMarker.relatedIssues.length > 0
        ? new Set(
            activeCompareDiffMarker.relatedIssues.map((issue) =>
              buildNovelReviewIssueKey(issue),
            ),
          )
        : buildNovelReviewIssueKeysForDiffMarkers(allCompareDiffMarkers)
      : undefined;
  const filteredReviewIssueViews = filterNovelReviewIssueViews(
    reviewIssueViews,
    reviewIssueFilter,
    { diffIssueKeys: compareDiffIssueKeys },
  );
  const activeDiffRelatedIssueKeys = new Set(
    activeCompareDiffMarker?.relatedIssues.map((issue) =>
      buildNovelReviewIssueKey(issue),
    ) ?? [],
  );
  const generatedRows = chapterRows.filter((row) => row.chapter);
  const activeGeneratedIndex = detailChapter
    ? generatedRows.findIndex((row) => row.chapter?.id === detailChapter.id)
    : -1;
  const previousGeneratedRow =
    activeGeneratedIndex > 0 ? generatedRows[activeGeneratedIndex - 1] : null;
  const nextGeneratedRow =
    activeGeneratedIndex >= 0
      ? generatedRows[activeGeneratedIndex + 1] ?? null
      : null;
  const chapterDraftStorageKey = detailChapter
    ? `sxy-novel-chapter-draft:${detailChapter.id}`
    : "";
  const isChapterDraftDirty =
    Boolean(detailChapter) &&
    (chapterEditorContent !== detailChapter?.content ||
      chapterEditorSummary !== detailChapter?.summary);

  useEffect(() => {
    const nextContent = detailChapter?.content ?? "";
    const nextSummary = detailChapter?.summary ?? "";
    let restoredDraft = false;
    let restoredSavedAt = "";

    if (detailChapter?.id && typeof window !== "undefined") {
      const draftKey = `sxy-novel-chapter-draft:${detailChapter.id}`;
      const rawDraft = window.localStorage.getItem(draftKey);

      if (rawDraft) {
        try {
          const draft = JSON.parse(rawDraft) as {
            content?: unknown;
            summary?: unknown;
            savedAt?: unknown;
          };
          const draftContent =
            typeof draft.content === "string" ? draft.content : nextContent;
          const draftSummary =
            typeof draft.summary === "string" ? draft.summary : nextSummary;

          if (draftContent !== nextContent || draftSummary !== nextSummary) {
            setChapterEditorContent(draftContent);
            setChapterEditorSummary(draftSummary);
            restoredDraft = true;
            restoredSavedAt =
              typeof draft.savedAt === "string" ? draft.savedAt : "";
          } else {
            window.localStorage.removeItem(draftKey);
          }
        } catch {
          window.localStorage.removeItem(draftKey);
        }
      }
    }

    if (!restoredDraft) {
      setChapterEditorContent(nextContent);
      setChapterEditorSummary(nextSummary);
    }
    setIsSavingChapterDraft(false);
    setChapterEditorSearch("");
    setChapterEditorReplacement("");
    setChapterEditorSearchIndex(0);
    setCompareSearch("");
    setCompareDiffIndex(0);
    setCompareRestoreParagraphIndex(null);
    compareDiffMarkerRefs.current = {};
    setChapterDraftSavedAt(restoredSavedAt);
    setHasRestoredLocalDraft(restoredDraft);
    setIsChapterEditorFullscreen(false);
    setSelectedReviewIssueIds([]);
    setReviewIssueFilter("all");
    setLocatedReviewIssue(null);
  }, [detailChapter?.id, detailChapter?.content, detailChapter?.summary]);

  useEffect(() => {
    if (
      !detailChapter ||
      !chapterDraftStorageKey ||
      !isChapterEditorOpen ||
      !isChapterDraftDirty ||
      typeof window === "undefined"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(
        chapterDraftStorageKey,
        JSON.stringify({
          content: chapterEditorContent,
          summary: chapterEditorSummary,
          savedAt,
        }),
      );
      setChapterDraftSavedAt(savedAt);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    detailChapter,
    chapterDraftStorageKey,
    chapterEditorContent,
    chapterEditorSummary,
    isChapterDraftDirty,
    isChapterEditorOpen,
  ]);

  useEffect(() => {
    setCompareDiffIndex(0);
    compareDiffMarkerRefs.current = {};
  }, [compareVersionId]);

  useEffect(() => {
    setCompareDiffIndex((current) => {
      if (compareDiffMarkers.length === 0) {
        return 0;
      }

      return current >= compareDiffMarkers.length ? 0 : current;
    });
  }, [compareDiffMarkers.length, compareSearch]);

  useEffect(() => {
    if (!activeCompareDiffMarker) {
      return;
    }

    const node =
      compareDiffMarkerRefs.current[activeCompareDiffMarker.id] ?? null;
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCompareDiffMarker]);

  useEffect(() => {
    if (!locatedReviewIssue || !isChapterEditorOpen) {
      return;
    }

    const textarea = chapterEditorTextAreaRef.current;
    if (!textarea) {
      return;
    }

    const start = chapterEditorContent.indexOf(locatedReviewIssue.paragraph);
    textarea.focus();
    if (start >= 0) {
      textarea.setSelectionRange(start, start + locatedReviewIssue.paragraph.length);
    }
  }, [chapterEditorContent, isChapterEditorOpen, locatedReviewIssue]);

  function locateReviewIssue(issue: (typeof reviewIssueViews)[number]) {
    if (!detailChapter) {
      return;
    }

    const location = findNovelReviewIssueParagraph(detailChapter.content, issue);
    if (!location) {
      setLocatedReviewIssue({
        issueKey: `${issue.reviewId}:${issue.id}`,
        paragraphIndex: -1,
        paragraph: "没有在正文中匹配到明确段落，可以根据原文片段手动定位。",
      });
      setIsChapterEditorOpen(true);
      return;
    }

    setLocatedReviewIssue({
      issueKey: `${issue.reviewId}:${issue.id}`,
      paragraphIndex: location.index,
      paragraph: location.paragraph,
    });
    setIsChapterEditorOpen(true);
  }

  function exportActiveChapterReview() {
    if (!detailChapter) {
      return;
    }

    downloadTextFile(
      `${project.title}-第${detailChapter.number}章-审稿报告.md`,
      buildNovelReviewExportMarkdown({
        bookTitle: project.title,
        chapter: detailChapter,
      }),
      "text/markdown;charset=utf-8",
    );
  }

  function applyReviewIssueSuggestion(issue: (typeof reviewIssueViews)[number]) {
    if (!detailChapter) {
      return;
    }

    const result = applyNovelReviewIssueSuggestionToContent(
      isChapterEditorOpen ? chapterEditorContent : detailChapter.content,
      issue,
    );

    if (!result.applied) {
      setLocatedReviewIssue({
        issueKey: `${issue.reviewId}:${issue.id}`,
        paragraphIndex: -1,
        paragraph: result.reason ?? "没有可应用的段落级修改建议。",
      });
      setIsChapterEditorOpen(true);
      return;
    }

    const paragraphs = result.content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    setChapterEditorContent(result.content);
    setLocatedReviewIssue({
      issueKey: `${issue.reviewId}:${issue.id}`,
      paragraphIndex: result.paragraphIndex,
      paragraph:
        paragraphs[result.paragraphIndex] ??
        "已应用建议，请检查章节正文后保存版本。",
    });
    setIsChapterEditorOpen(true);
  }

  function selectEditorSearchMatch(index: number) {
    const match = editorSearchState.matches[index];
    const textarea = chapterEditorTextAreaRef.current;
    if (!match || !textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
  }

  function moveEditorSearchMatch(direction: 1 | -1) {
    if (editorSearchState.count === 0) {
      return;
    }

    const nextIndex =
      (editorSearchState.activeIndex + direction + editorSearchState.count) %
      editorSearchState.count;
    setChapterEditorSearchIndex(nextIndex);
    window.setTimeout(() => selectEditorSearchMatch(nextIndex), 0);
  }

  function replaceEditorMatch(mode: "current" | "all") {
    if (editorSearchState.count === 0) {
      return;
    }

    const nextContent = replaceNovelEditorSearchMatches(
      chapterEditorContent,
      chapterEditorSearch,
      chapterEditorReplacement,
      mode,
      editorSearchState.activeIndex,
    );
    setChapterEditorContent(nextContent);
    setChapterEditorSearchIndex(0);
  }

  function jumpToParagraph(paragraphIndex: number) {
    const paragraph = paragraphNavigation.paragraphs[paragraphIndex];
    const textarea = chapterEditorTextAreaRef.current;

    if (!paragraph || !textarea) {
      return;
    }

    setIsChapterEditorOpen(true);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(paragraph.start, paragraph.end);
    }, 0);
  }

  function jumpToReviewHighlight(highlight: (typeof reviewIssueHighlights)[number]) {
    setLocatedReviewIssue({
      issueKey: highlight.key,
      paragraphIndex: highlight.paragraphIndex,
      paragraph: highlight.paragraph,
    });
    jumpToParagraph(highlight.paragraphIndex);
  }

  function moveCompareDiff(direction: -1 | 1) {
    if (compareDiffMarkers.length === 0) {
      return;
    }

    setCompareDiffIndex((current) => {
      const next = current + direction;
      if (next < 0) {
        return compareDiffMarkers.length - 1;
      }
      if (next >= compareDiffMarkers.length) {
        return 0;
      }
      return next;
    });
  }

  function focusCompareDiffMarker(marker: NovelCompareDiffMarker) {
    const markerIndex = compareDiffMarkers.findIndex((item) => item.id === marker.id);
    if (markerIndex >= 0) {
      setCompareDiffIndex(markerIndex);
    }
  }

  function jumpToDiffForReviewIssue(
    issue: (typeof reviewIssueViews)[number],
  ) {
    const marker = findNovelCompareDiffMarkerForReviewIssue(
      issue,
      allCompareDiffMarkers,
    );

    if (!marker) {
      return;
    }

    if (compareSearch.trim()) {
      setCompareSearch("");
    }

    const markerIndex = allCompareDiffMarkers.findIndex(
      (item) => item.id === marker.id,
    );

    if (markerIndex >= 0) {
      setCompareDiffIndex(markerIndex);
    }

    setReviewIssueFilter("diff");
  }

  function filterReviewIssuesByActiveDiff() {
    if (!compareView) {
      return;
    }

    setReviewIssueFilter("diff");
  }

  function prepareCompareLineRestore(lineText: string) {
    const trimmed = lineText.trim();
    if (!trimmed) {
      setCompareRestoreParagraphIndex(null);
      return;
    }

    const matched = paragraphNavigation.paragraphs.find(
      (paragraph) =>
        paragraph.text.includes(trimmed) || trimmed.includes(paragraph.text),
    );
    setCompareRestoreParagraphIndex(matched?.index ?? null);
  }

  function restoreCompareLine(
    lineText: string,
    paragraphIndex?: number | null,
  ) {
    if (!lineText.trim()) {
      return;
    }

    const textarea = chapterEditorTextAreaRef.current;
    const result = restoreNovelCompareLineInContent(
      chapterEditorContent,
      lineText,
      {
        paragraphIndex:
          paragraphIndex ?? compareRestoreParagraphIndex ?? undefined,
        selectionStart: textarea?.selectionStart,
        selectionEnd: textarea?.selectionEnd,
      },
    );

    setChapterEditorContent(result.content);
    setCompareRestoreParagraphIndex(result.paragraphIndex);
    setIsChapterEditorOpen(true);
  }

  function exportActiveChapter(format: "markdown" | "text" | "docx") {
    if (!detailChapter) {
      return;
    }

    const title = `第${detailChapter.number}章-${detailChapter.title}`;
    const markdown = [
      `# 第 ${detailChapter.number} 章 ${detailChapter.title}`,
      "",
      detailChapter.summary ? `> ${detailChapter.summary}` : "",
      "",
      detailChapter.content,
    ]
      .filter(Boolean)
      .join("\n");

    if (format === "markdown") {
      downloadTextFile(`${title}.md`, markdown, "text/markdown;charset=utf-8");
    } else if (format === "text") {
      downloadTextFile(`${title}.txt`, detailChapter.content, "text/plain;charset=utf-8");
    } else {
      downloadBytesFile(
        `${title}.docx`,
        createNovelBookDocxFile(
          buildNovelDocxDocumentModel({
            title,
            chapters: [detailChapter],
          }),
        ),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    }
  }

  function discardChapterLocalDraft() {
    if (!detailChapter) {
      return;
    }

    if (chapterDraftStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(chapterDraftStorageKey);
    }
    setChapterEditorContent(detailChapter.content);
    setChapterEditorSummary(detailChapter.summary);
    setChapterDraftSavedAt("");
    setHasRestoredLocalDraft(false);
    setChapterEditorSearchIndex(0);
  }

  async function saveChapterEditor() {
    if (!detailChapter || !isChapterDraftDirty || isSavingChapterDraft) {
      return;
    }

    setIsSavingChapterDraft(true);
    try {
      await onChapterDraftSave(detailChapter, {
        content: chapterEditorContent,
        summary: chapterEditorSummary,
      });
      if (chapterDraftStorageKey && typeof window !== "undefined") {
        window.localStorage.removeItem(chapterDraftStorageKey);
      }
      setChapterDraftSavedAt("");
      setHasRestoredLocalDraft(false);
      setIsChapterEditorOpen(false);
    } finally {
      setIsSavingChapterDraft(false);
    }
  }

  if (!detailRow) {
    return null;
  }

  return (
      <>
          <div className={styles.chapterDetailHeader}>
            {detailChapter ? (
              <select
                value={detailChapter.status}
                onChange={(event) =>
                  void onChapterStatusChange(
                    detailChapter,
                    event.target.value as StoredNovelChapter["status"],
                  )
                }
              >
                {Object.entries(INKOS_STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={styles.chapterPlanBadge}>计划章节</span>
            )}
          </div>
          <div className={styles.chapterDetailMeta}>
            <strong>第 {detailRow.number} 章 · {detailRow.title}</strong>
            {detailChapter ? (
              <span>
                {detailChapter.wordCount} 字 / 更新于{" "}
                {formatNovelRelativeAge(detailChapter.updatedAt)}前
              </span>
            ) : (
              <span>
                目标 {detailRow.targetWords} 字 / {INKOS_STATUS_LABELS[detailRow.status]}
              </span>
            )}
          </div>
          <div className={styles.chapterDetailActions}>
            {detailChapter ? (
              <>
                <select
                  value={detailChapter.publicationStatus ?? "draft"}
                  onChange={(event) =>
                    void onChapterPublicationStatusChange(
                      detailChapter,
                      event.target
                        .value as NonNullable<StoredNovelChapter["publicationStatus"]>,
                    )
                  }
                >
                  <option value='draft'>未发布</option>
                  <option value='ready'>待发布</option>
                  <option value='published'>已发布</option>
                </select>
                <button
                  onClick={() => setIsChapterEditorOpen((isOpen) => !isOpen)}
                >
                  {isChapterEditorOpen ? "收起编辑器" : "编辑章节"}
                </button>
                <button
                  onClick={() =>
                    void onReviseChapter(
                      selectedReviewIssueIds.length > 0
                        ? selectedReviewIssueIds
                        : undefined,
                    )
                  }
                >
                  {selectedReviewIssueIds.length > 0
                    ? `修订选中问题 (${selectedReviewIssueIds.length})`
                    : "根据审稿修订"}
                </button>
                <button
                  className={styles.dangerTextButton}
                  onClick={() => void onChapterDelete(detailChapter)}
                >
                  删除
                </button>
                <button onClick={() => exportActiveChapter("markdown")}>
                  导出 MD
                </button>
                <button onClick={() => exportActiveChapter("text")}>
                  导出 TXT
                </button>
                <button onClick={() => exportActiveChapter("docx")}>
                  导出 docx
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  void onGenerateChapter({
                    number: detailRow.number,
                    title: detailRow.title,
                    focus: detailRow.focus,
                    targetWords: detailRow.targetWords,
                    reason: "planned",
                  })
                }
              >
                生成本章
              </button>
            )}
          </div>
          {detailChapter?.reviewNotes &&
          detailChapter.status === "ready-for-review" ? (
            <div className={styles.chapterRevisionNotice}>
              <strong>修订后建议重新审稿</strong>
              <span>
                当前章节已有审稿记录且状态为待审稿。再次点击“审稿”可以验证修订是否解决问题。
              </span>
            </div>
          ) : null}
          <div className={styles.chapterDetailBlock}>
            <span>{detailChapter ? "摘要" : "章节计划"}</span>
            <p>{detailChapter?.summary || detailRow.focus || "暂无计划。"}</p>
          </div>
          {detailChapter ? (
            <>
              {isChapterEditorOpen ? (
                <div
                  className={`${styles.chapterEditorPanel} ${
                    isChapterEditorFullscreen
                      ? styles.chapterEditorFullscreen
                      : ""
                  }`}
                >
                  <div className={styles.chapterEditorHeader}>
                    <div>
                      <strong>章节正文编辑器</strong>
                      <span>
                        {chapterDraftMeta.wordCount} 字 /{" "}
                        {chapterDraftMeta.paragraphCount} 段 /{" "}
                        {chapterDraftMeta.hasSummary ? "摘要完整" : "暂无摘要"}
                      </span>
                      <span>
                        目标 {paragraphNavigation.targetWords || detailRow.targetWords} 字 /{" "}
                        {paragraphNavigation.targetPercent}% 完成
                      </span>
                      <span>
                        {chapterDraftSavedAt
                          ? `自动保存于 ${formatNovelRelativeAge(chapterDraftSavedAt)}前`
                          : isChapterDraftDirty
                            ? "本地草稿等待自动保存"
                            : "已与章节版本同步"}
                      </span>
                    </div>
                    <div>
                      <button
                        disabled={!previousGeneratedRow}
                        onClick={() =>
                          previousGeneratedRow && onChapterSelect(previousGeneratedRow.key)
                        }
                      >
                        上一章
                      </button>
                      <button
                        disabled={!nextGeneratedRow}
                        onClick={() =>
                          nextGeneratedRow && onChapterSelect(nextGeneratedRow.key)
                        }
                      >
                        下一章
                      </button>
                      <button
                        onClick={() =>
                          setIsChapterEditorFullscreen((current) => !current)
                        }
                      >
                        {isChapterEditorFullscreen ? "退出全屏" : "全屏"}
                      </button>
                      <button
                        onClick={discardChapterLocalDraft}
                        disabled={
                          (!isChapterDraftDirty && !hasRestoredLocalDraft) ||
                          isSavingChapterDraft
                        }
                      >
                        还原
                      </button>
                      <button
                        className={styles.chapterEditorSaveButton}
                        onClick={() => void saveChapterEditor()}
                        disabled={!isChapterDraftDirty || isSavingChapterDraft}
                      >
                        {isSavingChapterDraft ? "保存中" : "保存版本"}
                      </button>
                    </div>
                  </div>
                  {hasRestoredLocalDraft ? (
                    <div className={styles.chapterDraftNotice}>
                      <div>
                        <strong>已恢复本地草稿</strong>
                        <span>
                          上次未保存的编辑已载入，可以继续保存为章节版本。
                        </span>
                      </div>
                      <button onClick={discardChapterLocalDraft}>丢弃草稿</button>
                    </div>
                  ) : null}
                  <div className={styles.chapterEditorTools}>
                    <label>
                      查找
                      <input
                        value={chapterEditorSearch}
                        onChange={(event) => {
                          setChapterEditorSearch(event.target.value);
                          setChapterEditorSearchIndex(0);
                        }}
                        placeholder="输入关键词"
                      />
                    </label>
                    <label>
                      替换为
                      <input
                        value={chapterEditorReplacement}
                        onChange={(event) =>
                          setChapterEditorReplacement(event.target.value)
                        }
                        placeholder="替换文本"
                      />
                    </label>
                    <span className={styles.chapterEditorSearchMeta}>
                      {editorSearchState.count > 0
                        ? `${editorSearchState.activeIndex + 1} / ${
                            editorSearchState.count
                          }`
                        : "0 / 0"}
                    </span>
                    <button
                      onClick={() => moveEditorSearchMatch(-1)}
                      disabled={editorSearchState.count === 0}
                    >
                      上一个
                    </button>
                    <button
                      onClick={() => moveEditorSearchMatch(1)}
                      disabled={editorSearchState.count === 0}
                    >
                      下一个
                    </button>
                    <button
                      onClick={() => replaceEditorMatch("current")}
                      disabled={editorSearchState.count === 0}
                    >
                      替换
                    </button>
                    <button
                      onClick={() => replaceEditorMatch("all")}
                      disabled={editorSearchState.count === 0}
                    >
                      全部替换
                    </button>
                  </div>
                  <label>
                    章节摘要
                    <textarea
                      rows={4}
                      value={chapterEditorSummary}
                      onChange={(event) =>
                        setChapterEditorSummary(event.target.value)
                      }
                    />
                  </label>
                  <div className={styles.chapterParagraphNavigator}>
                    <div>
                      <span>段落导航</span>
                      <em>
                        {paragraphNavigation.wordCount} /{" "}
                        {paragraphNavigation.targetWords || detailRow.targetWords} 字
                      </em>
                    </div>
                    <div className={styles.chapterWordProgress}>
                      <span
                        style={{
                          width: `${paragraphNavigation.targetPercent}%`,
                        }}
                      />
                    </div>
                    <div>
                      {paragraphNavigation.paragraphs.slice(0, 12).map((paragraph) => (
                        <button
                          key={paragraph.index}
                          type='button'
                          onClick={() => jumpToParagraph(paragraph.index)}
                        >
                          {paragraph.index + 1}. {paragraph.preview}
                        </button>
                      ))}
                    </div>
                  </div>
                  {reviewParagraphMarks.length > 0 ? (
                    <div className={styles.reviewInlineHighlightPanel}>
                      <div className={styles.reviewInlineHighlightHeader}>
                        <span>审稿原位高亮</span>
                        <em>{reviewParagraphMarks.length} 段有问题</em>
                      </div>
                      <div className={styles.reviewInlineHighlightBody}>
                        {reviewParagraphMarks.map((mark) => (
                          <button
                            key={mark.paragraphIndex}
                            type='button'
                            className={`${styles.reviewInlineHighlightParagraph} ${
                              mark.issues.some(
                                (issue) =>
                                  `${issue.reviewId}:${issue.id}` ===
                                  locatedReviewIssue?.issueKey,
                              )
                                ? styles.reviewInlineHighlightActive
                                : ""
                            } ${styles[`reviewSeverity_${mark.highestSeverity}`]}`}
                            onClick={() => {
                              setLocatedReviewIssue({
                                issueKey: `${mark.issues[0]?.reviewId}:${mark.issues[0]?.id}`,
                                paragraphIndex: mark.paragraphIndex,
                                paragraph: mark.paragraph,
                              });
                              jumpToParagraph(mark.paragraphIndex);
                            }}
                          >
                            <strong>第 {mark.paragraphIndex + 1} 段</strong>
                            <p>{mark.paragraph}</p>
                            <div className={styles.reviewInlineHighlightTags}>
                              {mark.issues.map((issue) => (
                                <span key={`${issue.reviewId}:${issue.id}`}>
                                  {issue.title}
                                </span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <label>
                    章节正文
                    <textarea
                      ref={chapterEditorTextAreaRef}
                      rows={isChapterEditorFullscreen ? 28 : 18}
                      value={chapterEditorContent}
                      onChange={(event) =>
                        setChapterEditorContent(event.target.value)
                      }
                    />
                  </label>
                  {locatedReviewIssue ? (
                    <div className={styles.reviewIssueLocatedPanel}>
                      <strong>
                        {locatedReviewIssue.paragraphIndex >= 0
                          ? `已定位到第 ${locatedReviewIssue.paragraphIndex + 1} 段`
                          : "未匹配到明确段落"}
                      </strong>
                      <p>{locatedReviewIssue.paragraph}</p>
                    </div>
                  ) : null}
                  <div className={styles.chapterEditorPreview}>
                    <span>预览</span>
                    <MarkdownContent
                      content={
                        chapterEditorContent.trim() ||
                        "正文为空，保存前可以先补充内容。"
                      }
                      compact
                    />
                  </div>
                </div>
              ) : null}
              <div className={styles.chapterDetailBlock}>
                <span>正文预览</span>
                <MarkdownContent
                  content={
                    detailChapter.content.length > 600
                      ? `${detailChapter.content.slice(0, 600)}...`
                      : detailChapter.content
                  }
                  compact
                />
              </div>
              {detailChapter.reviewNotes ? (
                <div className={styles.chapterDetailBlock}>
                  <span>审稿记录</span>
                  {activeReview ? (
                    <div className={styles.reviewInsightCard}>
                      <div>
                        <strong>
                          {activeReview.verdict === "approved"
                            ? "审稿通过"
                            : "需要修订"}
                        </strong>
                        {activeReview.score !== undefined ? (
                          <em>{activeReview.score} 分</em>
                        ) : null}
                      </div>
                      <div className={styles.reviewInsightMeta}>
                        <span>未解决 {openReviewIssueCount}</span>
                        <span>已解决 {resolvedReviewIssueCount}</span>
                        <span>本轮 {currentReviewIssueCount}</span>
                      </div>
                      <div className={styles.reviewIssueFilters}>
                        {(
                          [
                            ["all", "全部"],
                            ["open", "未解决"],
                            ["resolved", "已解决"],
                            ["current", "本轮新增"],
                            ["history", "历史问题"],
                            ["diff", "差异关联"],
                          ] satisfies Array<[NovelReviewIssueFilter, string]>
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            className={
                              reviewIssueFilter === value
                                ? styles.activeReviewIssueFilter
                                : ""
                            }
                            onClick={() => setReviewIssueFilter(value)}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          type='button'
                          onClick={exportActiveChapterReview}
                        >
                          导出报告
                        </button>
                      </div>
                      <MarkdownContent content={activeReview.summary} compact />
                      {reviewIssueHighlights.length > 0 ? (
                        <div className={styles.reviewHighlightList}>
                          <span>正文高亮定位</span>
                          {reviewIssueHighlights.slice(0, 6).map((highlight) => (
                            <button
                              key={highlight.key}
                              type='button'
                              onClick={() => jumpToReviewHighlight(highlight)}
                            >
                              第 {highlight.paragraphIndex + 1} 段 ·{" "}
                              {highlight.issue.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {reviewIssueFilter === "diff" && !compareView ? (
                        <p className={styles.emptyMiniState}>
                          请先打开版本对比，再筛选差异关联问题。
                        </p>
                      ) : null}
                      {filteredReviewIssueViews.length > 0 ? (
                        <ul className={styles.reviewIssueList}>
                          {filteredReviewIssueViews.slice(0, 8).map((issue) => {
                            const issueKey = buildNovelReviewIssueKey(issue);
                            const diffMarker = findNovelCompareDiffMarkerForReviewIssue(
                              issue,
                              allCompareDiffMarkers,
                            );

                            return (
                            <li
                              key={issueKey}
                              className={
                                activeDiffRelatedIssueKeys.has(issueKey)
                                  ? styles.reviewIssueDiffLinked
                                  : undefined
                              }
                            >
                              <label className={styles.reviewIssueSelect}>
                                <input
                                  type='checkbox'
                                  disabled={issue.resolved}
                                  checked={selectedReviewIssueIds.includes(
                                    `${issue.reviewId}:${issue.id}`,
                                  )}
                                  onChange={(event) => {
                                    const key = `${issue.reviewId}:${issue.id}`;
                                    setSelectedReviewIssueIds((current) =>
                                      event.target.checked
                                        ? [...current, key]
                                        : current.filter((item) => item !== key),
                                    );
                                  }}
                                />
                                <b>{reviewSeverityLabel(issue.severity)}</b>
                              </label>
                              <span>{issue.detail}</span>
                              <div className={styles.reviewIssueStructure}>
                                <small>{issue.type ?? "other"}</small>
                                {issue.paragraphHint ? (
                                  <small>{issue.paragraphHint}</small>
                                ) : null}
                                {issue.excerpt ? (
                                  <small>原文：{issue.excerpt}</small>
                                ) : null}
                                {issue.suggestion ? (
                                  <small>建议：{issue.suggestion}</small>
                                ) : null}
                              </div>
                              <div className={styles.reviewIssueStatus}>
                                <small
                                  className={
                                    issue.resolved
                                      ? styles.reviewIssueResolved
                                      : styles.reviewIssueOpen
                                  }
                                >
                                  {issue.statusLabel}
                                </small>
                                <small className={styles.reviewIssueOrigin}>
                                  {issue.originLabel}
                                </small>
                                <button
                                  type='button'
                                  onClick={() => locateReviewIssue(issue)}
                                >
                                  定位
                                </button>
                                {diffMarker ? (
                                  <button
                                    type='button'
                                    onClick={() => jumpToDiffForReviewIssue(issue)}
                                  >
                                    跳转差异
                                  </button>
                                ) : null}
                                {issue.suggestion && !issue.resolved ? (
                                  <button
                                    type='button'
                                    onClick={() =>
                                      applyReviewIssueSuggestion(issue)
                                    }
                                  >
                                    应用建议
                                  </button>
                                ) : null}
                              </div>
                            </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p>当前筛选下没有审稿问题。</p>
                      )}
                    </div>
                  ) : null}
                  <MarkdownContent content={detailChapter.reviewNotes} compact />
                </div>
              ) : null}
              <div className={styles.chapterDetailBlock}>
                <span>版本记录</span>
                {latestVersion && previousVersion ? (
                  <div className={styles.chapterVersionDelta}>
                    较上一版{" "}
                    {versionWordDelta >= 0 ? `+${versionWordDelta}` : versionWordDelta}{" "}
                    字 / {formatNovelChapterVersionSource(previousVersion.source)}
                    {" -> "}
                    {formatNovelChapterVersionSource(latestVersion.source)}
                  </div>
                ) : null}
                {chapterVersions.length > 0 ? (
                  <div className={styles.chapterVersionList}>
                    {chapterVersions.slice(0, 6).map((version, index) => (
                      <div key={version.id} className={styles.chapterVersionItem}>
                        <div>
                          <strong>
                            {formatNovelChapterVersionSource(version.source)}
                            {index === 0 ? " · 当前" : ""}
                          </strong>
                          <span>
                            {version.wordCount} 字 /{" "}
                            {formatNovelRelativeAge(version.createdAt)}前
                          </span>
                          {version.note ? <em>{version.note}</em> : null}
                        </div>
                        <button
                          disabled={index === 0}
                          onClick={() => void onChapterVersionRestore(version)}
                        >
                          恢复
                        </button>
                        <button
                          disabled={index >= chapterVersions.length - 1}
                          onClick={() =>
                            setCompareVersionId(
                              compareVersionId === version.id ? "" : version.id,
                            )
                          }
                        >
                          对比
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>暂无版本记录。生成、审稿、修订或手动编辑后会自动保存。</p>
                )}
                {compareVersion && compareBaseVersion && compareView ? (
                  <div className={styles.chapterVersionCompare}>
                    <div className={styles.chapterVersionCompareHeader}>
                      <div>
                        <strong>版本对比</strong>
                        <span>
                          {formatNovelChapterVersionSource(compareBaseVersion.source)}
                          {" -> "}
                          {formatNovelChapterVersionSource(compareVersion.source)}
                        </span>
                      </div>
                      <em>
                        字数{" "}
                        {compareView.wordDelta >= 0
                          ? `+${compareView.wordDelta}`
                          : compareView.wordDelta}
                        {" / "}
                        新增 {compareView.addedCount} / 移除{" "}
                        {compareView.removedCount}
                      </em>
                      <input
                        value={compareSearch}
                        onChange={(event) => setCompareSearch(event.target.value)}
                        placeholder='搜索差异'
                      />
                      <div className={styles.compareDiffNav}>
                        <button
                          type='button'
                          disabled={compareDiffMarkers.length === 0}
                          onClick={() => moveCompareDiff(-1)}
                        >
                          上一处差异
                        </button>
                        <span>
                          {compareDiffMarkers.length > 0
                            ? `${compareDiffIndex + 1} / ${compareDiffMarkers.length}`
                            : "0 / 0"}
                        </span>
                        <button
                          type='button'
                          disabled={compareDiffMarkers.length === 0}
                          onClick={() => moveCompareDiff(1)}
                        >
                          下一处差异
                        </button>
                        <button
                          type='button'
                          disabled={!activeCompareDiffMarker?.relatedIssues.length}
                          onClick={filterReviewIssuesByActiveDiff}
                        >
                          筛选关联问题
                        </button>
                      </div>
                    </div>
                    {activeCompareDiffMarker?.relatedIssues.length ? (
                      <div className={styles.compareRelatedIssues}>
                        <strong>关联审稿问题</strong>
                        <div>
                          {activeCompareDiffMarker.relatedIssues.map((issue) => (
                            <button
                              key={`${issue.reviewId}:${issue.id}`}
                              type='button'
                              onClick={() => locateReviewIssue(issue)}
                            >
                              {issue.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {compareVersion.revisedFromReviewId ? (
                      <span>
                        处理审稿：{compareVersion.revisedFromReviewId}
                      </span>
                    ) : null}
                    <div className={styles.chapterVersionCompareGrid}>
                      <div>
                        <p>旧版本</p>
                        <div className={styles.chapterVersionCompareText}>
                          {compareView.previousLines.slice(0, 80).map((line, index) => {
                            if (
                              compareSearch.trim() &&
                              !line.text
                                .toLowerCase()
                                .includes(compareSearch.trim().toLowerCase())
                            ) {
                              return null;
                            }

                            const markerId =
                              line.state === "removed" ? `previous-${index}` : null;
                            const isActive =
                              activeCompareDiffMarker?.id === markerId;

                            return (
                              <span
                                key={`previous-${index}`}
                                ref={(node) => {
                                  if (markerId) {
                                    compareDiffMarkerRefs.current[markerId] = node;
                                  }
                                }}
                                className={`${
                                  line.state === "removed"
                                    ? styles.removedCompareLine
                                    : styles.unchangedCompareLine
                                } ${isActive ? styles.activeCompareDiffLine : ""}`}
                                onClick={() => {
                                  if (line.state === "removed") {
                                    prepareCompareLineRestore(line.text);
                                    const marker = compareDiffMarkers.find(
                                      (item) => item.id === `previous-${index}`,
                                    );
                                    if (marker) {
                                      focusCompareDiffMarker(marker);
                                    }
                                  }
                                }}
                              >
                                {line.text}
                                {line.state === "removed" ? (
                                  <button
                                    type='button'
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      prepareCompareLineRestore(line.text);
                                      restoreCompareLine(line.text);
                                    }}
                                  >
                                    恢复此段
                                  </button>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p>新版本</p>
                        <div className={styles.chapterVersionCompareText}>
                          {compareView.nextLines.slice(0, 80).map((line, index) => {
                            if (
                              compareSearch.trim() &&
                              !line.text
                                .toLowerCase()
                                .includes(compareSearch.trim().toLowerCase())
                            ) {
                              return null;
                            }

                            const markerId =
                              line.state === "added" ? `next-${index}` : null;
                            const isActive =
                              activeCompareDiffMarker?.id === markerId;

                            return (
                              <span
                                key={`next-${index}`}
                                ref={(node) => {
                                  if (markerId) {
                                    compareDiffMarkerRefs.current[markerId] = node;
                                  }
                                }}
                                className={`${
                                  line.state === "added"
                                    ? styles.addedCompareLine
                                    : styles.unchangedCompareLine
                                } ${isActive ? styles.activeCompareDiffLine : ""}`}
                                onClick={() => {
                                  if (line.state === "added") {
                                    const marker = compareDiffMarkers.find(
                                      (item) => item.id === `next-${index}`,
                                    );
                                    if (marker) {
                                      focusCompareDiffMarker(marker);
                                    }
                                  }
                                }}
                              >
                                {line.text}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
      </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  INKOS_STATUS_LABELS,
  type InkosNovelProject,
} from "@repo/inkos-adapter";
import styles from "../studio.module.css";
import {
  applyNovelAssetConflictFixes,
  applyNovelPendingAssetDelta,
  applyNovelReviewIssueSuggestionToContent,
  buildNovelAssetConflictReport,
  buildNovelChapterDraftMeta,
  buildNovelChapterParagraphNavigation,
  buildNovelChapterVersionCompareView,
  buildNovelCompareDiffMarkers,
  buildNovelDocxDocumentModel,
  buildNovelEditorSearchState,
  buildNovelOutlineNodesFromOutlineText,
  buildNovelOutlineNodesFromProject,
  buildNovelOutlineSyncDriftReport,
  buildNovelPendingAssetDeltaMatchReport,
  buildNovelPublicationTimeline,
  buildNovelRecoverableErrorNotice,
  buildNovelReviewExportMarkdown,
  buildNovelReviewIssueHighlights,
  buildNovelReviewIssueKey,
  buildNovelReviewIssueKeysForDiffMarkers,
  buildNovelReviewIssueParagraphMarks,
  buildNovelReviewIssueViews,
  buildNovelTaskResumePreview,
  deriveNovelChapterProgress,
  dismissNovelPendingAssetDelta,
  filterNovelCompareDiffMarkers,
  filterNovelReviewIssueViews,
  findNovelCompareDiffMarkerForReviewIssue,
  findNovelReviewIssueParagraph,
  formatNovelChapterVersionSource,
  formatNovelRelativeAge,
  mergeNovelChapterPlan,
  replaceNovelEditorSearchMatches,
  restoreNovelCompareLineInContent,
  syncNovelOutlineNodesFromChapters,
  syncNovelProjectFromOutlineNodes,
  updateNovelPendingAssetDelta,
  type NovelAssetConflictReport,
  type NovelChapterWriteTarget,
  type NovelCompareDiffMarker,
  type NovelContextSelection,
  type NovelKnowledgeAsset,
  type NovelOutlineNode,
  type NovelPendingAssetDelta,
  type NovelProjectAssets,
  type NovelReviewIssueFilter,
  type StoredNovelChapter,
  type StoredNovelChapterVersion,
  type StoredNovelTask,
} from "../../../lib/novel-store";
import {
  downloadTextFile,
  downloadBytesFile,
  createNovelBookDocxFile,
} from "../helpers/export-helpers";
import {
  formatPendingAssetLines,
  formatPendingCharacterStates,
  isNovelKnowledgeAssetCategory,
  parsePendingAssetLines,
  parsePendingCharacterStates,
  reviewSeverityLabel,
} from "../helpers/novel-helpers";
import {
  FORESHADOWING_STATUS_LABELS,
  KNOWLEDGE_ASSET_LABELS,
  KNOWLEDGE_ASSET_STATUS_LABELS,
} from "../state/studio-constants";
import { MarkdownContent } from "./chat/MarkdownContent";
import { AssetConflictDialog } from "./dialogs/AssetConflictDialog";
import { KnowledgeAssetLibraryDialog } from "./dialogs/KnowledgeAssetLibraryDialog";
import { OutlineEditorDialog } from "./dialogs/OutlineEditorDialog";
import { CollapsibleSection } from "./sidebar/CollapsibleSection";

export function NovelBookPanel({
  project,
  assets,
  chapters,
  chapterVersions,
  tasks,
  activeChapterId,
  stats,
  promptPreview,
  onChapterSelect,
  onChapterDraftSave,
  onChapterStatusChange,
  onChapterPublicationStatusChange,
  onChapterDelete,
  onChapterVersionRestore,
  onGenerateChapter,
  onReviseChapter,
  onRetryTask,
  onProjectChange,
  onRequestPrompt,
  onRequestConfirm,
  onShowToast,
}: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters: StoredNovelChapter[];
  chapterVersions: StoredNovelChapterVersion[];
  tasks: StoredNovelTask[];
  activeChapterId: string;
  stats: ReturnType<typeof deriveNovelChapterProgress>;
  promptPreview: string;
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
  onChapterVersionRestore: (
    version: StoredNovelChapterVersion,
  ) => Promise<void>;
  onGenerateChapter: (target: NovelChapterWriteTarget) => Promise<void>;
  onReviseChapter: (selectedIssueIds?: string[]) => Promise<void>;
  onRetryTask: (task: StoredNovelTask) => void;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }) => Promise<string | null>;
  onRequestConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  onShowToast: (
    message: string,
    tone?: "success" | "warning" | "error",
  ) => void;
}) {
  const chapterRows = mergeNovelChapterPlan(project, chapters);
  const publicationTimeline = buildNovelPublicationTimeline(assets, chapters);
  const assetConflictPreview = useMemo(
    () => buildNovelAssetConflictReport({ project, assets }),
    [project, assets],
  );
  const activeRow =
    chapterRows.find((chapter) => chapter.key === activeChapterId) ??
    chapterRows.at(-1) ??
    null;
  const activeChapter = activeRow?.chapter ?? null;
  const latestVersion = chapterVersions[0] ?? null;
  const previousVersion = chapterVersions[1] ?? null;
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
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [outlineEditorDraft, setOutlineEditorDraft] = useState<NovelOutlineNode[]>(
    [],
  );
  const [isKnowledgeLibraryOpen, setIsKnowledgeLibraryOpen] = useState(false);
  const [assetConflictReport, setAssetConflictReport] =
    useState<NovelAssetConflictReport | null>(null);
  const [isApplyingConflictFixes, setIsApplyingConflictFixes] = useState(false);
  const [locatedReviewIssue, setLocatedReviewIssue] = useState<{
    issueKey: string;
    paragraphIndex: number;
    paragraph: string;
  } | null>(null);
  const chapterEditorTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const compareDiffMarkerRefs = useRef<Record<string, HTMLSpanElement | null>>(
    {},
  );
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
    activeChapter?.reviews?.find(
      (review) => review.id === activeChapter.activeReviewId,
    ) ?? activeChapter?.reviews?.[0] ?? null;
  const reviewIssueViews = activeChapter
    ? buildNovelReviewIssueViews(
        activeChapter.reviews ?? [],
        activeChapter.activeReviewId,
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
    chapterEditorContent || activeChapter?.content || "",
    activeRow?.targetWords ?? project.chapterWordCount ?? 0,
  );
  const reviewIssueHighlights =
    activeChapter && reviewIssueViews.length > 0
      ? buildNovelReviewIssueHighlights(activeChapter.content, reviewIssueViews)
      : [];
  const reviewParagraphMarks = buildNovelReviewIssueParagraphMarks(
    (isChapterEditorOpen ? chapterEditorContent : activeChapter?.content) ?? "",
    reviewIssueViews,
  );
  const allCompareDiffMarkers =
    compareView && activeChapter
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
  const activeGeneratedIndex = activeChapter
    ? generatedRows.findIndex((row) => row.chapter?.id === activeChapter.id)
    : -1;
  const previousGeneratedRow =
    activeGeneratedIndex > 0 ? generatedRows[activeGeneratedIndex - 1] : null;
  const nextGeneratedRow =
    activeGeneratedIndex >= 0
      ? generatedRows[activeGeneratedIndex + 1] ?? null
      : null;
  const chapterDraftStorageKey = activeChapter
    ? `sxy-novel-chapter-draft:${activeChapter.id}`
    : "";
  const isChapterDraftDirty =
    Boolean(activeChapter) &&
    (chapterEditorContent !== activeChapter?.content ||
      chapterEditorSummary !== activeChapter?.summary);

  useEffect(() => {
    const nextContent = activeChapter?.content ?? "";
    const nextSummary = activeChapter?.summary ?? "";
    let restoredDraft = false;
    let restoredSavedAt = "";

    if (activeChapter?.id && typeof window !== "undefined") {
      const draftKey = `sxy-novel-chapter-draft:${activeChapter.id}`;
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
  }, [activeChapter?.id, activeChapter?.content, activeChapter?.summary]);

  useEffect(() => {
    if (
      !activeChapter ||
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
    activeChapter,
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
    if (!activeChapter) {
      return;
    }

    const location = findNovelReviewIssueParagraph(activeChapter.content, issue);
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
    if (!activeChapter) {
      return;
    }

    downloadTextFile(
      `${project.title}-第${activeChapter.number}章-审稿报告.md`,
      buildNovelReviewExportMarkdown({
        bookTitle: project.title,
        chapter: activeChapter,
      }),
      "text/markdown;charset=utf-8",
    );
  }

  function applyReviewIssueSuggestion(issue: (typeof reviewIssueViews)[number]) {
    if (!activeChapter) {
      return;
    }

    const result = applyNovelReviewIssueSuggestionToContent(
      isChapterEditorOpen ? chapterEditorContent : activeChapter.content,
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
    if (!activeChapter) {
      return;
    }

    const title = `第${activeChapter.number}章-${activeChapter.title}`;
    const markdown = [
      `# 第 ${activeChapter.number} 章 ${activeChapter.title}`,
      "",
      activeChapter.summary ? `> ${activeChapter.summary}` : "",
      "",
      activeChapter.content,
    ]
      .filter(Boolean)
      .join("\n");

    if (format === "markdown") {
      downloadTextFile(`${title}.md`, markdown, "text/markdown;charset=utf-8");
    } else if (format === "text") {
      downloadTextFile(`${title}.txt`, activeChapter.content, "text/plain;charset=utf-8");
    } else {
      downloadBytesFile(
        `${title}.docx`,
        createNovelBookDocxFile(
          buildNovelDocxDocumentModel({
            title,
            chapters: [activeChapter],
          }),
        ),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    }
  }

  function discardChapterLocalDraft() {
    if (!activeChapter) {
      return;
    }

    if (chapterDraftStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(chapterDraftStorageKey);
    }
    setChapterEditorContent(activeChapter.content);
    setChapterEditorSummary(activeChapter.summary);
    setChapterDraftSavedAt("");
    setHasRestoredLocalDraft(false);
    setChapterEditorSearchIndex(0);
  }

  async function saveChapterEditor() {
    if (!activeChapter || !isChapterDraftDirty || isSavingChapterDraft) {
      return;
    }

    setIsSavingChapterDraft(true);
    try {
      await onChapterDraftSave(activeChapter, {
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

  async function editAsset(
    label: string,
    key: keyof Pick<
      NovelProjectAssets,
      "outline" | "worldNotes" | "characters" | "settings"
    >,
  ) {
    const nextValue = await onRequestPrompt({
      title: label,
      initialValue: String(assets[key] ?? ""),
      multiline: true,
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    const nextAssets = {
      ...assets,
      [key]: nextValue,
    };
    const projectUpdates: Partial<InkosNovelProject> =
      key === "worldNotes"
        ? { world: nextValue }
        : key === "characters"
          ? { protagonist: nextValue }
          : key === "settings"
            ? { premise: nextValue }
            : {};

    await onProjectChange(projectUpdates, nextAssets);
  }

  async function saveAssets(
    nextAssets: NovelProjectAssets,
    projectUpdates: Partial<InkosNovelProject> = {},
  ) {
    await onProjectChange(projectUpdates, nextAssets);
  }

  async function addOutlineNode() {
    const title = await onRequestPrompt({
      title: "新增章节计划",
      message: "输入章节标题。",
      initialValue: `第 ${assets.outlineNodes.length + 1} 章`,
      confirmLabel: "创建",
    });

    if (!title?.trim()) {
      return;
    }

    const chapterNumber =
      Math.max(0, ...assets.outlineNodes.map((node) => node.chapterNumber)) + 1;
    const node: NovelOutlineNode = {
      id: `outline-${Date.now()}`,
      volume: `第 ${Math.max(1, Math.ceil(chapterNumber / 20))} 卷`,
      chapterNumber,
      title: title.trim(),
      goal: "推进主线并制造新的悬念。",
      conflict: "",
      characters: "",
      information: "",
      foreshadowing: "",
      targetWords: project.chapterWordCount ?? 3000,
      status: "planned",
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      outlineNodes: [...assets.outlineNodes, node],
    });
  }

  async function editOutlineNode(
    node: NovelOutlineNode,
    field: keyof Pick<
      NovelOutlineNode,
      | "title"
      | "volume"
      | "goal"
      | "conflict"
      | "characters"
      | "information"
      | "foreshadowing"
      | "targetWords"
    >,
  ) {
    const nextValue = await onRequestPrompt({
      title: `编辑章节计划：${node.title}`,
      message: field === "targetWords" ? "输入目标字数。" : undefined,
      initialValue: String(node[field] ?? ""),
      multiline: field !== "title" && field !== "volume" && field !== "targetWords",
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    const nextNode = {
      ...node,
      [field]:
        field === "targetWords"
          ? Math.max(500, Number(nextValue) || node.targetWords)
          : nextValue,
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      outlineNodes: assets.outlineNodes.map((item) =>
        item.id === node.id ? nextNode : item,
      ),
    });
  }

  async function deleteOutlineNode(node: NovelOutlineNode) {
    await saveAssets({
      ...assets,
      outlineNodes: assets.outlineNodes.filter((item) => item.id !== node.id),
    });
  }

  async function syncOutlineToProject(nodes = assets.outlineNodes) {
    const drift = buildNovelOutlineSyncDriftReport(project, nodes);

    if (drift.hasDrift) {
      const confirmed = await onRequestConfirm({
        title: "同步章节计划",
        message: `${drift.message} 继续将把大纲写回 project.chapters。`,
        confirmLabel: "继续同步",
      });

      if (!confirmed) {
        return;
      }
    }

    const nextProject = syncNovelProjectFromOutlineNodes(project, nodes);
    const outline = nodes
      .sort((left, right) => left.chapterNumber - right.chapterNumber)
      .map(
        (node) =>
          `${node.chapterNumber}. ${node.title}：${node.goal || node.information}`,
      )
      .join("\n");

    await saveAssets({ ...assets, outlineNodes: nodes, outline }, nextProject);
  }

  function openOutlineEditor() {
    setOutlineEditorDraft([...assets.outlineNodes]);
    setIsOutlineEditorOpen(true);
  }

  async function saveOutlineEditorDraft(nodes: NovelOutlineNode[]) {
    await saveAssets({ ...assets, outlineNodes: nodes });
    setOutlineEditorDraft(nodes);
    setIsOutlineEditorOpen(false);
  }

  async function importOutlineFromText() {
    const source =
      assets.outline ||
      (await onRequestPrompt({
        title: "从 outline 文本生成章节计划",
        message: "粘贴大纲文本，支持「第 N 章 标题：目标」格式。",
        initialValue: assets.outline,
        multiline: true,
        confirmLabel: "解析",
      }));

    if (!source?.trim()) {
      return;
    }

    const imported = buildNovelOutlineNodesFromOutlineText(source, {
      defaultTargetWords: project.chapterWordCount ?? 3000,
    });

    if (imported.length === 0) {
      return;
    }

    setOutlineEditorDraft(imported);
  }

  function importOutlineFromProject() {
    setOutlineEditorDraft(buildNovelOutlineNodesFromProject(project));
  }

  function reverseSyncOutlineFromChapters() {
    setOutlineEditorDraft(
      syncNovelOutlineNodesFromChapters(
        outlineEditorDraft.length > 0 ? outlineEditorDraft : assets.outlineNodes,
        chapters,
        project,
      ),
    );
  }

  function openAssetConflictReport() {
    setAssetConflictReport(
      buildNovelAssetConflictReport({
        project,
        assets,
      }),
    );
  }

  async function applyAssetConflictFixes() {
    if (isApplyingConflictFixes) {
      return;
    }

    setIsApplyingConflictFixes(true);

    try {
      const result = applyNovelAssetConflictFixes({
        project,
        assets,
        chapters,
      });

      if (result.applied.length === 0) {
        onShowToast(result.summary, "warning");
        return;
      }

      await onProjectChange(result.project, result.assets);
      setAssetConflictReport(
        buildNovelAssetConflictReport({
          project: result.project,
          assets: result.assets,
        }),
      );
      onShowToast(result.summary);
    } finally {
      setIsApplyingConflictFixes(false);
    }
  }

  async function createKnowledgeAsset() {
    const categoryInput = await onRequestPrompt({
      title: "新建设定资产",
      message: "类型可填 world / character / foreshadowing / location / faction / item / term。",
      initialValue: "character",
      confirmLabel: "下一步",
    });
    const category = categoryInput?.trim() ?? "";

    if (!isNovelKnowledgeAssetCategory(category)) {
      return;
    }

    const title = await onRequestPrompt({
      title: `新建${KNOWLEDGE_ASSET_LABELS[category]}`,
      initialValue: KNOWLEDGE_ASSET_LABELS[category],
      confirmLabel: "下一步",
    });

    if (!title?.trim()) {
      return;
    }

    const content = await onRequestPrompt({
      title: `填写${title.trim()}内容`,
      multiline: true,
      confirmLabel: "保存",
    });

    if (content === null) {
      return;
    }

    const nextAsset: NovelKnowledgeAsset = {
      id: `knowledge-${Date.now()}`,
      category,
      title: title.trim(),
      content,
      status: "active",
      tags: [],
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      knowledgeAssets: [nextAsset, ...assets.knowledgeAssets],
    });
  }

  async function editKnowledgeAsset(
    item: NovelKnowledgeAsset,
    field: keyof Pick<NovelKnowledgeAsset, "title" | "content" | "status" | "tags">,
  ) {
    const nextValue = await onRequestPrompt({
      title: `编辑${item.title}`,
      message:
        field === "tags"
          ? "多个标签用逗号分隔。"
          : field === "status"
            ? "可填 active / draft / resolved。"
            : undefined,
      initialValue:
        field === "tags" ? item.tags.join(", ") : String(item[field] ?? ""),
      multiline: field === "content",
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    const nextItem: NovelKnowledgeAsset = {
      ...item,
      [field]:
        field === "tags"
          ? nextValue
              .split(/[,，]/)
              .map((tag) => tag.trim())
              .filter(Boolean)
          : field === "status" &&
              ["active", "draft", "resolved"].includes(nextValue)
            ? (nextValue as NovelKnowledgeAsset["status"])
            : nextValue,
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      knowledgeAssets: assets.knowledgeAssets.map((asset) =>
        asset.id === item.id ? nextItem : asset,
      ),
    });
  }

  async function deleteKnowledgeAsset(item: NovelKnowledgeAsset) {
    await saveAssets({
      ...assets,
      knowledgeAssets: assets.knowledgeAssets.filter(
        (asset) => asset.id !== item.id,
      ),
    });
  }

  async function confirmPendingAssetDelta(item: NovelPendingAssetDelta) {
    await saveAssets(applyNovelPendingAssetDelta(assets, item.id));
  }

  async function dismissPendingAssetDelta(item: NovelPendingAssetDelta) {
    await saveAssets(dismissNovelPendingAssetDelta(assets, item.id));
  }

  async function editPendingAssetDelta(
    item: NovelPendingAssetDelta,
    field:
      | "summary"
      | "characterStates"
      | "newForeshadowing"
      | "resolvedForeshadowing"
      | "worldIncrements",
  ) {
    const titleMap = {
      summary: "编辑章节摘要",
      characterStates: "编辑角色状态",
      newForeshadowing: "编辑新增伏笔",
      resolvedForeshadowing: "编辑回收伏笔",
      worldIncrements: "编辑世界观增量",
    };
    const initialValue =
      field === "characterStates"
        ? formatPendingCharacterStates(item.characterStates)
        : field === "summary"
          ? item.summary
          : formatPendingAssetLines(item[field]);
    const nextValue = await onRequestPrompt({
      title: titleMap[field],
      message:
        field === "characterStates"
          ? "一行一个，格式：角色名：状态变化。"
          : field === "summary"
            ? undefined
            : "一行一个，可直接删除误提取的条目。",
      initialValue,
      multiline: true,
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    await saveAssets(
      updateNovelPendingAssetDelta(assets, item.id, {
        [field]:
          field === "characterStates"
            ? parsePendingCharacterStates(nextValue)
            : field === "summary"
              ? nextValue.trim()
              : parsePendingAssetLines(nextValue),
      }),
    );
  }

  async function updateContextSelection(
    updates: Partial<NovelContextSelection>,
  ) {
    await saveAssets({
      ...assets,
      contextSelection: {
        ...assets.contextSelection,
        ...updates,
      },
    });
  }

  return (
    <>
    <aside className={styles.bookContextPanel}>
      <CollapsibleSection id="book-progress" title="书籍信息" defaultOpen>
        <div className={styles.bookProgress}>
          <span>生成进度</span>
          <strong>{stats.generatedPercent}%</strong>
          <em>
            已生成 {stats.generatedChapters} / {stats.totalChapters} 章
          </em>
          <div className={styles.bookProgressMetrics}>
            <span>已定稿 {stats.approvedChapters} 章</span>
            <span>待审稿 {stats.readyForReviewChapters} 章</span>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="chapter-list" title="章节" defaultOpen>
        <div className={styles.compactChapterList}>
          {chapterRows.length > 0 ? (
            chapterRows.map((chapter) => (
              <button
                key={chapter.key}
                className={
                  chapter.key === activeRow?.key
                    ? styles.activeCompactChapter
                    : ""
                }
                onClick={() => onChapterSelect(chapter.key)}
              >
                <span>{chapter.number}</span>
                <strong>{chapter.title}</strong>
                <em>
                  {INKOS_STATUS_LABELS[chapter.status]}
                  {chapter.generated ? ` · ${chapter.wordCount} 字` : " · 未生成"}
                </em>
              </button>
            ))
          ) : (
            <div>
              <span>-</span>
              <strong>暂无章节</strong>
              <em>点击“写下一章”后会自动保存正文</em>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {activeRow ? (
        <CollapsibleSection id="chapter-detail" title="章节详情">
          <div className={styles.chapterDetailHeader}>
            {activeChapter ? (
              <select
                value={activeChapter.status}
                onChange={(event) =>
                  void onChapterStatusChange(
                    activeChapter,
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
            <strong>第 {activeRow.number} 章 · {activeRow.title}</strong>
            {activeChapter ? (
              <span>
                {activeChapter.wordCount} 字 / 更新于{" "}
                {formatNovelRelativeAge(activeChapter.updatedAt)}前
              </span>
            ) : (
              <span>
                目标 {activeRow.targetWords} 字 / {INKOS_STATUS_LABELS[activeRow.status]}
              </span>
            )}
          </div>
          <div className={styles.chapterDetailActions}>
            {activeChapter ? (
              <>
                <select
                  value={activeChapter.publicationStatus ?? "draft"}
                  onChange={(event) =>
                    void onChapterPublicationStatusChange(
                      activeChapter,
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
                  onClick={() => void onChapterDelete(activeChapter)}
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
                    number: activeRow.number,
                    title: activeRow.title,
                    focus: activeRow.focus,
                    targetWords: activeRow.targetWords,
                    reason: "planned",
                  })
                }
              >
                生成本章
              </button>
            )}
          </div>
          {activeChapter?.reviewNotes &&
          activeChapter.status === "ready-for-review" ? (
            <div className={styles.chapterRevisionNotice}>
              <strong>修订后建议重新审稿</strong>
              <span>
                当前章节已有审稿记录且状态为待审稿。再次点击“审稿”可以验证修订是否解决问题。
              </span>
            </div>
          ) : null}
          <div className={styles.chapterDetailBlock}>
            <span>{activeChapter ? "摘要" : "章节计划"}</span>
            <p>{activeChapter?.summary || activeRow.focus || "暂无计划。"}</p>
          </div>
          {activeChapter ? (
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
                        目标 {paragraphNavigation.targetWords || activeRow.targetWords} 字 /{" "}
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
                        {paragraphNavigation.targetWords || activeRow.targetWords} 字
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
                    activeChapter.content.length > 600
                      ? `${activeChapter.content.slice(0, 600)}...`
                      : activeChapter.content
                  }
                  compact
                />
              </div>
              {activeChapter.reviewNotes ? (
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
                  <MarkdownContent content={activeChapter.reviewNotes} compact />
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
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection id="outline" title="大纲与章节计划">
        <div className={styles.contextSectionHeader}>
          <div>
            <button onClick={() => openOutlineEditor()}>打开编辑器</button>
            <button onClick={() => void addOutlineNode()}>+ 章节</button>
            <button onClick={() => void syncOutlineToProject()}>同步计划</button>
          </div>
        </div>
        <div className={styles.outlineNodeList}>
          {assets.outlineNodes.slice(0, 8).map((node) => (
            <article key={node.id} className={styles.outlineNodeCard}>
              <div>
                <strong>
                  {node.chapterNumber}. {node.title}
                </strong>
                <span>
                  {node.volume} / {INKOS_STATUS_LABELS[node.status]} /{" "}
                  {node.targetWords} 字
                </span>
              </div>
              <p>{node.goal || node.information || "暂无章节目标。"}</p>
              <em>
                {[
                  node.conflict ? `冲突：${node.conflict}` : "",
                  node.characters ? `角色：${node.characters}` : "",
                  node.foreshadowing ? `伏笔：${node.foreshadowing}` : "",
                ]
                  .filter(Boolean)
                  .join(" / ") || "暂无冲突、角色或伏笔。"}
              </em>
              <div>
                <button onClick={() => void editOutlineNode(node, "title")}>
                  标题
                </button>
                <button onClick={() => void editOutlineNode(node, "goal")}>
                  目标
                </button>
                <button onClick={() => void editOutlineNode(node, "conflict")}>
                  冲突
                </button>
                <button onClick={() => void editOutlineNode(node, "characters")}>
                  角色
                </button>
                <button
                  onClick={() => void editOutlineNode(node, "foreshadowing")}
                >
                  伏笔
                </button>
                <button
                  onClick={() => void editOutlineNode(node, "targetWords")}
                >
                  字数
                </button>
                <button
                  className={styles.dangerTextButton}
                  onClick={() => void deleteOutlineNode(node)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
          {assets.outlineNodes.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无结构化章节计划，可以从项目 chapters 同步或手动新建。
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="assets" title="设定资产">
        <div className={styles.contextSectionHeader}>
          <div>
            <button onClick={() => setIsKnowledgeLibraryOpen(true)}>
              打开资产库
              {assetConflictPreview.issues.length > 0
                ? ` (${assetConflictPreview.warningCount + assetConflictPreview.errorCount})`
                : ""}
            </button>
            <button onClick={openAssetConflictReport}>检测冲突</button>
            <button onClick={() => void createKnowledgeAsset()}>+ 资产</button>
          </div>
        </div>
        {assets.assetChangeEvents && assets.assetChangeEvents.length > 0 ? (
          <div className={styles.assetChangeTimeline}>
            <strong>资产变更记录</strong>
            <div className={styles.modelCallLogList}>
              {assets.assetChangeEvents.slice(0, 6).map((entry) => (
                <article key={entry.id} className={styles.modelCallLogItem}>
                  <strong>{entry.label}</strong>
                  <span>{entry.detail}</span>
                  <time>{formatNovelRelativeAge(entry.createdAt)}前</time>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {assets.pendingAssetDeltas.length > 0 ? (
          <div className={styles.pendingAssetDeltaList}>
            {assets.pendingAssetDeltas.slice(0, 4).map((item) => {
              const matchReport = buildNovelPendingAssetDeltaMatchReport(
                assets,
                item,
              );

              return (
              <article key={item.id} className={styles.pendingAssetDeltaCard}>
                <div>
                  <strong>
                    第 {item.chapterNumber} 章《{item.chapterTitle}》
                  </strong>
                  <span>待确认</span>
                </div>
                <p>{item.summary || "暂无摘要。"}</p>
                {matchReport.newForeshadowing.length > 0 ||
                matchReport.resolvedForeshadowing.length > 0 ? (
                  <div className={styles.pendingAssetMatchPreview}>
                    <strong>{matchReport.summary}</strong>
                    <ul>
                      {matchReport.newForeshadowing.map((entry) => (
                        <li key={`match-new-${entry.text}`}>
                          新增：{entry.text} → {entry.preview.label}
                          {entry.preview.score > 0
                            ? ` (${Math.round(entry.preview.score * 100)}%)`
                            : ""}
                        </li>
                      ))}
                      {matchReport.resolvedForeshadowing.map((entry) => (
                        <li key={`match-resolved-${entry.text}`}>
                          回收：{entry.text} → {entry.preview.label}
                          {entry.preview.score > 0
                            ? ` (${Math.round(entry.preview.score * 100)}%)`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul>
                  {item.characterStates.map((state) => (
                    <li key={`character-${state.title}`}>
                      角色：{state.title} - {state.content}
                    </li>
                  ))}
                  {item.newForeshadowing.map((entry) => (
                    <li key={`new-${entry}`}>新增伏笔：{entry}</li>
                  ))}
                  {item.resolvedForeshadowing.map((entry) => (
                    <li key={`resolved-${entry}`}>回收伏笔：{entry}</li>
                  ))}
                  {item.worldIncrements.map((entry) => (
                    <li key={`world-${entry}`}>世界观：{entry}</li>
                  ))}
                </ul>
                <div>
                  <button onClick={() => void confirmPendingAssetDelta(item)}>
                    确认写入
                  </button>
                  <button
                    onClick={() => void editPendingAssetDelta(item, "summary")}
                  >
                    摘要
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "characterStates")
                    }
                  >
                    角色
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "newForeshadowing")
                    }
                  >
                    新伏笔
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "resolvedForeshadowing")
                    }
                  >
                    回收
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "worldIncrements")
                    }
                  >
                    世界观
                  </button>
                  <button
                    className={styles.dangerTextButton}
                    onClick={() => void dismissPendingAssetDelta(item)}
                  >
                    忽略
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        ) : null}
        <div className={styles.knowledgeAssetList}>
          {assets.knowledgeAssets.slice(0, 8).map((item) => (
            <article key={item.id} className={styles.knowledgeAssetCard}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {KNOWLEDGE_ASSET_LABELS[item.category]} /{" "}
                  {item.category === "foreshadowing"
                    ? FORESHADOWING_STATUS_LABELS[item.status]
                    : KNOWLEDGE_ASSET_STATUS_LABELS[item.status]}
                </span>
              </div>
              <p>{item.content || "暂无内容。"}</p>
              {item.tags.length > 0 ? (
                <em>{item.tags.map((tag) => `#${tag}`).join(" ")}</em>
              ) : null}
              <div>
                <button onClick={() => void editKnowledgeAsset(item, "title")}>
                  标题
                </button>
                <button onClick={() => void editKnowledgeAsset(item, "content")}>
                  内容
                </button>
                <button onClick={() => void editKnowledgeAsset(item, "tags")}>
                  标签
                </button>
                <button onClick={() => void editKnowledgeAsset(item, "status")}>
                  状态
                </button>
                <button
                  className={styles.dangerTextButton}
                  onClick={() => void deleteKnowledgeAsset(item)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
          {assets.knowledgeAssets.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无设定资产。建议先添加世界观、角色和伏笔。
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="context" title="写作上下文">
        <div className={styles.contextSelectorGrid}>
          {(
            [
            ["includeOutline", "大纲"],
            ["includePreviousSummary", "上一章摘要"],
            ["includeWorld", "世界观"],
            ["includeCharacters", "角色"],
            ["includeForeshadowing", "伏笔"],
            ["includeReviewIssues", "审稿遗留"],
            ] satisfies Array<
              [
                keyof Pick<
                  NovelContextSelection,
                  | "includeOutline"
                  | "includePreviousSummary"
                  | "includeWorld"
                  | "includeCharacters"
                  | "includeForeshadowing"
                  | "includeReviewIssues"
                >,
                string,
              ]
            >
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type='checkbox'
                checked={Boolean(
                  assets.contextSelection[key as keyof NovelContextSelection],
                )}
                onChange={(event) =>
                  void updateContextSelection({
                    [key]: event.target.checked,
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className={styles.contextSelectorActions}>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "目标字数",
                initialValue: String(
                  assets.contextSelection.targetWords ??
                    project.chapterWordCount ??
                    3000,
                ),
                confirmLabel: "保存",
              });
              if (value !== null) {
                void updateContextSelection({
                  targetWords: Math.max(500, Number(value) || 3000),
                });
              }
            }}
          >
            字数 {assets.contextSelection.targetWords ?? project.chapterWordCount}
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "视角要求",
                initialValue: assets.contextSelection.viewpoint,
                confirmLabel: "保存",
              });
              if (value !== null) void updateContextSelection({ viewpoint: value });
            }}
          >
            视角
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "节奏要求",
                initialValue: assets.contextSelection.pacing,
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null) void updateContextSelection({ pacing: value });
            }}
          >
            节奏
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "本章高亮要求",
                initialValue: assets.contextSelection.highlights,
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null)
                void updateContextSelection({ highlights: value });
            }}
          >
            高亮要求
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "读者爽点 / 悬疑点",
                initialValue: assets.contextSelection.thrillPoints ?? "",
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null) {
                void updateContextSelection({ thrillPoints: value });
              }
            }}
          >
            爽点 / 悬疑
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "禁用词 / 避免表达",
                initialValue: assets.contextSelection.bannedWords ?? "",
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null) {
                void updateContextSelection({ bannedWords: value });
              }
            }}
          >
            禁用词
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "额外风格约束",
                initialValue: assets.contextSelection.styleConstraints ?? "",
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null) {
                void updateContextSelection({ styleConstraints: value });
              }
            }}
          >
            风格约束
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="tasks" title="任务日志">
        <div className={styles.taskLogList}>
          {tasks.slice(0, 5).map((task) => {
            const errorNotice = task.errorMessage
              ? buildNovelRecoverableErrorNotice(task.errorMessage)
              : null;
            const resumePreview = buildNovelTaskResumePreview(task);
            const canRetryTask =
              task.status === "queued" ||
              task.status === "paused" ||
              task.status === "cancelled" ||
              (task.status === "error" && errorNotice?.canRetry !== false);

            return (
              <article key={task.id} className={styles.taskLogCard}>
                <div>
                  <strong>{task.label}</strong>
                  <span>{task.status}</span>
                </div>
                <em>
                  {formatNovelRelativeAge(task.startedAt)}前
                  {task.endedAt ? ` / 结束于 ${formatNovelRelativeAge(task.endedAt)}前` : ""}
                </em>
                {task.targetChapterNumber ? (
                  <em>
                    第 {task.targetChapterNumber} 章
                    {task.targetChapterTitle ? ` · ${task.targetChapterTitle}` : ""}
                  </em>
                ) : null}
                {resumePreview.canResume ? (
                  <div className={styles.taskRecoveryHint}>
                    <strong>断点已保存</strong>
                    <p>{resumePreview.summary}</p>
                  </div>
                ) : null}
                <ul>
                  {task.logs.slice(-4).map((log) => (
                    <li key={log.id}>{log.message}</li>
                  ))}
                </ul>
                {errorNotice && task.status !== "paused" ? (
                  <div className={styles.taskRecoveryHint}>
                    <strong>{errorNotice.title}</strong>
                    <p>{errorNotice.detail}</p>
                    <em>{errorNotice.recoveryAction}</em>
                  </div>
                ) : null}
                {canRetryTask ? (
                  <button
                    type='button'
                    className={styles.taskRetryButton}
                    onClick={() => onRetryTask(task)}
                  >
                    {task.status === "queued"
                      ? "执行任务"
                      : task.status === "paused"
                        ? "继续执行"
                        : "重试任务"}
                  </button>
                ) : null}
              </article>
            );
          })}
          {tasks.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无任务日志。写下一章、审稿或修订后会自动记录。
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="publication" title="发布记录">
        {publicationTimeline.length === 0 ? (
          <p className={styles.emptyMiniState}>暂无发布或导出记录。</p>
        ) : (
          <div className={styles.modelCallLogList}>
            {publicationTimeline.slice(0, 12).map((entry) => (
              <article key={entry.id} className={styles.modelCallLogItem}>
                <strong>{entry.label}</strong>
                <span>{entry.detail || "—"}</span>
                <time>{new Date(entry.createdAt).toLocaleString()}</time>
              </article>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="settings" title="设定">
        <div className={styles.foundationList}>
          <button onClick={() => void editAsset("世界观设定", "worldNotes")}>
            世界观设定
          </button>
          <button onClick={() => void editAsset("卷纲规划", "outline")}>
            卷纲规划
          </button>
          <button onClick={() => void editAsset("状态卡/核心设定", "settings")}>
            状态卡
          </button>
          <button onClick={() => void editAsset("角色矩阵", "characters")}>
            角色矩阵
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="preview" title="上下文预览">
        <MarkdownContent content={promptPreview} compact />
      </CollapsibleSection>
    </aside>
    {isOutlineEditorOpen ? (
      <OutlineEditorDialog
        nodes={outlineEditorDraft}
        outlineText={assets.outline}
        project={project}
        onChange={setOutlineEditorDraft}
        onClose={() => setIsOutlineEditorOpen(false)}
        onSave={saveOutlineEditorDraft}
        onImportFromOutlineText={importOutlineFromText}
        onImportFromProject={importOutlineFromProject}
        onReverseSyncFromChapters={reverseSyncOutlineFromChapters}
        onSyncToProject={syncOutlineToProject}
        onRequestPrompt={onRequestPrompt}
        onRequestConfirm={onRequestConfirm}
      />
    ) : null}
    {isKnowledgeLibraryOpen ? (
      <KnowledgeAssetLibraryDialog
        assets={assets}
        project={project}
        onClose={() => setIsKnowledgeLibraryOpen(false)}
        onEditAsset={editKnowledgeAsset}
        onDeleteAsset={deleteKnowledgeAsset}
        onCreateAsset={createKnowledgeAsset}
        onRunConflictCheck={openAssetConflictReport}
      />
    ) : null}
    {assetConflictReport ? (
      <AssetConflictDialog
        report={assetConflictReport}
        isApplying={isApplyingConflictFixes}
        onClose={() => setAssetConflictReport(null)}
        onApplyFixes={() => void applyAssetConflictFixes()}
      />
    ) : null}
    </>
  );
}

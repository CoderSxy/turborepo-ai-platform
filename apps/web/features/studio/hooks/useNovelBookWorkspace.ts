"use client";

import { useMemo, useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  applyNovelAssetConflictFixes,
  applyNovelPendingAssetDelta,
  buildNovelAssetConflictReport,
  buildNovelOutlineNodesFromOutlineText,
  buildNovelOutlineNodesFromProject,
  buildNovelOutlineSyncDriftReport,
  dismissNovelPendingAssetDelta,
  syncNovelOutlineNodesFromChapters,
  syncNovelProjectFromOutlineNodes,
  updateNovelPendingAssetDelta,
  type NovelAssetConflictReport,
  type NovelKnowledgeAsset,
  type NovelOutlineNode,
  type NovelPendingAssetDelta,
  type NovelProjectAssets,
  type StoredNovelChapter,
} from "../../../lib/novel-store";
import {
  formatPendingAssetLines,
  formatPendingCharacterStates,
  isNovelKnowledgeAssetCategory,
  parsePendingAssetLines,
  parsePendingCharacterStates,
} from "../helpers/novel-helpers";
import { KNOWLEDGE_ASSET_LABELS } from "../state/studio-constants";

export function useNovelBookWorkspace({
  project,
  assets,
  chapters,
  onProjectChange,
  onRequestPrompt,
  onRequestConfirm,
  onShowToast,
}: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters: StoredNovelChapter[];
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
  const assetConflictPreview = useMemo(
    () => buildNovelAssetConflictReport({ project, assets }),
    [project, assets],
  );
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [outlineEditorDraft, setOutlineEditorDraft] = useState<NovelOutlineNode[]>(
    [],
  );
  const [isKnowledgeLibraryOpen, setIsKnowledgeLibraryOpen] = useState(false);
  const [assetConflictReport, setAssetConflictReport] =
    useState<NovelAssetConflictReport | null>(null);
  const [isApplyingConflictFixes, setIsApplyingConflictFixes] = useState(false);

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

  return {
    assetConflictPreview,
    isOutlineEditorOpen,
    setIsOutlineEditorOpen,
    outlineEditorDraft,
    setOutlineEditorDraft,
    isKnowledgeLibraryOpen,
    setIsKnowledgeLibraryOpen,
    assetConflictReport,
    setAssetConflictReport,
    isApplyingConflictFixes,
    addOutlineNode,
    editOutlineNode,
    deleteOutlineNode,
    syncOutlineToProject,
    openOutlineEditor,
    saveOutlineEditorDraft,
    importOutlineFromText,
    importOutlineFromProject,
    reverseSyncOutlineFromChapters,
    openAssetConflictReport,
    applyAssetConflictFixes,
    createKnowledgeAsset,
    editKnowledgeAsset,
    deleteKnowledgeAsset,
    confirmPendingAssetDelta,
    dismissPendingAssetDelta,
    editPendingAssetDelta,
  };
}

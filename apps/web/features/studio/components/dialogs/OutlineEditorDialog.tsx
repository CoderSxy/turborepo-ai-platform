"use client";

import { useMemo, useState } from "react";
import { INKOS_STATUS_LABELS, type InkosNovelProject } from "@repo/inkos-adapter";
import {
  buildNovelOutlineSyncDriftReport,
  groupNovelOutlineNodesByVolume,
  moveNovelOutlineNode,
  reorderNovelOutlineNodes,
  type NovelOutlineNode,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function OutlineEditorDialog({
  nodes,
  outlineText,
  project,
  onChange,
  onClose,
  onSave,
  onImportFromOutlineText,
  onImportFromProject,
  onReverseSyncFromChapters,
  onSyncToProject,
  onRequestPrompt,
  onRequestConfirm,
}: {
  nodes: NovelOutlineNode[];
  outlineText: string;
  project: InkosNovelProject;
  onChange: (nodes: NovelOutlineNode[]) => void;
  onClose: () => void;
  onSave: (nodes: NovelOutlineNode[]) => void | Promise<void>;
  onImportFromOutlineText: () => void | Promise<void>;
  onImportFromProject: () => void | Promise<void>;
  onReverseSyncFromChapters: () => void | Promise<void>;
  onSyncToProject: (nodes: NovelOutlineNode[]) => void | Promise<void>;
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
  }) => Promise<boolean>;
}) {
  const volumeGroups = useMemo(
    () => groupNovelOutlineNodesByVolume(nodes),
    [nodes],
  );
  const driftReport = useMemo(
    () => buildNovelOutlineSyncDriftReport(project, nodes),
    [project, nodes],
  );
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  function updateNode(nodeId: string, patch: Partial<NovelOutlineNode>) {
    onChange(
      nodes.map((node) =>
        node.id === nodeId
          ? { ...node, ...patch, updatedAt: new Date().toISOString() }
          : node,
      ),
    );
  }

  async function addVolume() {
    const volume = await onRequestPrompt({
      title: "新增卷",
      initialValue: `第 ${volumeGroups.length + 1} 卷`,
      confirmLabel: "创建",
    });

    if (!volume?.trim()) {
      return;
    }

    const chapterNumber =
      Math.max(0, ...nodes.map((node) => node.chapterNumber)) + 1;
    const node: NovelOutlineNode = {
      id: `outline-${Date.now()}`,
      volume: volume.trim(),
      chapterNumber,
      title: `第 ${chapterNumber} 章`,
      goal: "推进主线并制造新的悬念。",
      conflict: "",
      characters: "",
      information: "",
      foreshadowing: "",
      targetWords: project.chapterWordCount ?? 3000,
      status: "planned",
      updatedAt: new Date().toISOString(),
    };

    onChange([...nodes, node]);
  }

  async function addChapterToVolume(volume: string) {
    const title = await onRequestPrompt({
      title: `新增章节 · ${volume}`,
      initialValue: `第 ${nodes.length + 1} 章`,
      confirmLabel: "创建",
    });

    if (!title?.trim()) {
      return;
    }

    const chapterNumber =
      Math.max(0, ...nodes.map((node) => node.chapterNumber)) + 1;
    const node: NovelOutlineNode = {
      id: `outline-${Date.now()}`,
      volume,
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

    onChange([...nodes, node]);
  }

  function handleDrop(targetNodeId: string) {
    if (!draggingNodeId || draggingNodeId === targetNodeId) {
      return;
    }

    const sorted = [...nodes].sort(
      (left, right) => left.chapterNumber - right.chapterNumber,
    );
    const fromIndex = sorted.findIndex((node) => node.id === draggingNodeId);
    const toIndex = sorted.findIndex((node) => node.id === targetNodeId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    onChange(reorderNovelOutlineNodes(nodes, fromIndex, toIndex));
    setDraggingNodeId(null);
  }

  async function handleSyncToProject() {
    if (driftReport.hasDrift) {
      const confirmed = await onRequestConfirm({
        title: "同步章节计划",
        message: `${driftReport.message} 继续将把当前大纲写回 project.chapters。`,
        confirmLabel: "继续同步",
      });

      if (!confirmed) {
        return;
      }
    }

    await onSyncToProject(nodes);
  }

  return (
    <div className={styles.outlineEditorOverlay} role='presentation'>
      <section className={styles.outlineEditorDialog} aria-modal='true'>
        <header className={styles.outlineEditorHeader}>
          <div>
            <h2>大纲编辑器</h2>
            <p>
              按卷 / 章管理章节计划，可拖拽排序、从 outline 文本导入，或反向同步已生成章节状态。
            </p>
          </div>
          <button onClick={onClose}>关闭</button>
        </header>

        <div className={styles.outlineEditorToolbar}>
          <button onClick={() => void addVolume()}>+ 卷 / 章</button>
          <button onClick={() => void onImportFromOutlineText()}>
            从 outline 文本生成
          </button>
          <button onClick={() => void onImportFromProject()}>
            从 project 导入
          </button>
          <button onClick={() => void onReverseSyncFromChapters()}>
            反向同步章节状态
          </button>
          <button onClick={() => void handleSyncToProject()}>同步到 project</button>
        </div>

        <div
          className={
            driftReport.hasDrift
              ? styles.outlineEditorDriftWarning
              : styles.outlineEditorDriftOk
          }
        >
          {driftReport.message}
        </div>

        <div className={styles.outlineEditorBody}>
          {volumeGroups.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无章节计划。可从 outline 文本导入，或从 project.chapters 同步。
            </p>
          ) : (
            volumeGroups.map((group) => (
              <section key={group.volume} className={styles.outlineVolumeSection}>
                <header>
                  <strong>{group.volume}</strong>
                  <button onClick={() => void addChapterToVolume(group.volume)}>
                    + 章节
                  </button>
                </header>
                <div className={styles.outlineEditorNodeList}>
                  {group.nodes.map((node) => (
                    <article
                      key={node.id}
                      className={
                        draggingNodeId === node.id
                          ? styles.outlineEditorNodeDragging
                          : styles.outlineEditorNode
                      }
                      draggable
                      onDragStart={() => setDraggingNodeId(node.id)}
                      onDragEnd={() => setDraggingNodeId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop(node.id);
                      }}
                    >
                      <div className={styles.outlineEditorNodeHead}>
                        <strong>
                          {node.chapterNumber}. {node.title}
                        </strong>
                        <span>
                          {INKOS_STATUS_LABELS[node.status]} / {node.targetWords} 字
                        </span>
                        <div className={styles.outlineEditorNodeActions}>
                          <button
                            onClick={() =>
                              onChange(moveNovelOutlineNode(nodes, node.id, "up"))
                            }
                          >
                            ↑
                          </button>
                          <button
                            onClick={() =>
                              onChange(moveNovelOutlineNode(nodes, node.id, "down"))
                            }
                          >
                            ↓
                          </button>
                          <button
                            className={styles.dangerTextButton}
                            onClick={() =>
                              onChange(nodes.filter((item) => item.id !== node.id))
                            }
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      <div className={styles.outlineEditorFields}>
                        <label>
                          标题
                          <input
                            value={node.title}
                            onChange={(event) =>
                              updateNode(node.id, { title: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          卷
                          <input
                            value={node.volume}
                            onChange={(event) =>
                              updateNode(node.id, { volume: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          章节目标
                          <textarea
                            rows={2}
                            value={node.goal}
                            onChange={(event) =>
                              updateNode(node.id, { goal: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          冲突
                          <textarea
                            rows={2}
                            value={node.conflict}
                            onChange={(event) =>
                              updateNode(node.id, { conflict: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          出场角色
                          <input
                            value={node.characters}
                            onChange={(event) =>
                              updateNode(node.id, { characters: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          信息增量
                          <textarea
                            rows={2}
                            value={node.information}
                            onChange={(event) =>
                              updateNode(node.id, { information: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          伏笔
                          <textarea
                            rows={2}
                            value={node.foreshadowing}
                            onChange={(event) =>
                              updateNode(node.id, { foreshadowing: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          目标字数
                          <input
                            type='number'
                            min={500}
                            value={node.targetWords}
                            onChange={(event) =>
                              updateNode(node.id, {
                                targetWords: Math.max(
                                  500,
                                  Number(event.target.value) || node.targetWords,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {outlineText ? (
          <details className={styles.outlineEditorSource}>
            <summary>当前 outline 文本</summary>
            <pre>{outlineText}</pre>
          </details>
        ) : null}

        <footer className={styles.outlineEditorFooter}>
          <span>{nodes.length} 个章节计划</span>
          <button className={styles.primaryButton} onClick={() => void onSave(nodes)}>
            保存大纲
          </button>
        </footer>
      </section>
    </div>
  );
}

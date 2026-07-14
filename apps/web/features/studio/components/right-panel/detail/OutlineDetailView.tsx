"use client";

import { INKOS_STATUS_LABELS } from "@repo/inkos-adapter";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../../lib/novel-store";
import styles from "../../../studio.module.css";
import { CoreFileDetailView } from "./CoreFileDetailView";

export function OutlineDetailView({
  assets,
  project,
  onProjectChange,
  onOpenOutlineEditor,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    nextAssets?: NovelProjectAssets,
  ) => Promise<void>;
  onOpenOutlineEditor?: () => void;
}) {
  const nodes = [...assets.outlineNodes].sort(
    (left, right) => left.chapterNumber - right.chapterNumber,
  );

  return (
    <div className={styles.outlineDetailView}>
      <CoreFileDetailView
        fileKey="outline"
        assets={assets}
        project={project}
        onProjectChange={onProjectChange}
      />
      <section className={styles.outlineDetailNodes}>
        <header className={styles.outlineDetailNodesHeader}>
          <h3>章节计划</h3>
          {onOpenOutlineEditor ? (
            <button type="button" onClick={onOpenOutlineEditor}>
              打开编辑器
            </button>
          ) : null}
        </header>
        {nodes.length > 0 ? (
          <div className={styles.outlineDetailNodeList}>
            {nodes.map((node) => (
              <article key={node.id} className={styles.outlineDetailNodeCard}>
                <strong>
                  {node.chapterNumber}. {node.title}
                </strong>
                <span>
                  {node.volume} / {INKOS_STATUS_LABELS[node.status]} /{" "}
                  {node.targetWords} 字
                </span>
                <p>{node.goal || node.information || "暂无章节目标。"}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyMiniState}>
            暂无结构化章节计划，可在更多工作区同步或新建。
          </p>
        )}
      </section>
    </div>
  );
}

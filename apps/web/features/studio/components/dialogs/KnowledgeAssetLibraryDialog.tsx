"use client";

import { useMemo, useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  buildNovelAssetConflictReport,
  buildNovelCharacterRelationGraph,
  buildNovelCharacterStateTimeline,
  buildNovelForeshadowingPoolSummary,
  filterNovelKnowledgeAssets,
  type NovelKnowledgeAsset,
  type NovelKnowledgeAssetCategory,
  type NovelProjectAssets,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import {
  FORESHADOWING_STATUS_LABELS,
  KNOWLEDGE_ASSET_LABELS,
  KNOWLEDGE_ASSET_STATUS_LABELS,
} from "../../state/studio-constants";
import { CharacterRelationGraphPanel } from "../sidebar/CharacterRelationGraphPanel";
import { CharacterStateTimelinePanel } from "../sidebar/CharacterStateTimelinePanel";

export function KnowledgeAssetLibraryDialog({
  assets,
  project,
  onClose,
  onEditAsset,
  onDeleteAsset,
  onCreateAsset,
  onRunConflictCheck,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onClose: () => void;
  onEditAsset: (
    item: NovelKnowledgeAsset,
    field: keyof Pick<NovelKnowledgeAsset, "title" | "content" | "status" | "tags">,
  ) => void | Promise<void>;
  onDeleteAsset: (item: NovelKnowledgeAsset) => void | Promise<void>;
  onCreateAsset: () => void | Promise<void>;
  onRunConflictCheck: () => void;
}) {
  const [view, setView] = useState<"assets" | "timeline" | "relations">("assets");
  const [category, setCategory] = useState<NovelKnowledgeAssetCategory | "all">(
    "all",
  );
  const conflictPreview = useMemo(
    () => buildNovelAssetConflictReport({ project, assets }),
    [project, assets],
  );
  const foreshadowingPool = useMemo(
    () => buildNovelForeshadowingPoolSummary(assets),
    [assets],
  );
  const characterTimeline = useMemo(
    () => buildNovelCharacterStateTimeline({ assets, project }),
    [assets, project],
  );
  const characterRelations = useMemo(
    () => buildNovelCharacterRelationGraph({ assets, project }),
    [assets, project],
  );
  const visibleAssets = useMemo(
    () => filterNovelKnowledgeAssets(assets, category),
    [assets, category],
  );

  return (
    <div className={styles.outlineEditorOverlay} role='presentation'>
      <section className={styles.outlineEditorDialog} aria-modal='true'>
        <header className={styles.outlineEditorHeader}>
          <div>
            <h2>设定资产库</h2>
            <p>
              {view === "assets"
                ? "按类型浏览世界观、角色、伏笔等资产，伏笔池会按状态分组展示。"
                : view === "timeline"
                  ? characterTimeline.summary
                  : characterRelations.summary}
            </p>
            {view === "assets" && conflictPreview.issues.length > 0 ? (
              <em className={styles.assetConflictHint}>{conflictPreview.summary}</em>
            ) : null}
          </div>
          <div className={styles.outlineEditorHeaderActions}>
            {view === "assets" ? (
              <button onClick={onRunConflictCheck}>检测冲突</button>
            ) : null}
            <button onClick={onClose}>关闭</button>
          </div>
        </header>

        <div className={styles.knowledgeLibraryFilters}>
          <button
            className={view === "assets" ? styles.activeFilterButton : ""}
            onClick={() => setView("assets")}
          >
            全部资产
          </button>
          <button
            className={view === "timeline" ? styles.activeFilterButton : ""}
            onClick={() => setView("timeline")}
          >
            状态追踪 ({characterTimeline.characters.length})
          </button>
          <button
            className={view === "relations" ? styles.activeFilterButton : ""}
            onClick={() => setView("relations")}
          >
            关系图 ({characterRelations.nodes.length})
          </button>
        </div>

        {view === "assets" ? (
          <>
            <div className={styles.foreshadowingPoolSummary}>
              <article>
                <strong>{foreshadowingPool.planted.length}</strong>
                <span>已埋设</span>
              </article>
              <article>
                <strong>{foreshadowingPool.progressing.length}</strong>
                <span>推进中</span>
              </article>
              <article>
                <strong>{foreshadowingPool.resolved.length}</strong>
                <span>已回收</span>
              </article>
              <article>
                <strong>{foreshadowingPool.stale.length}</strong>
                <span>遗忘风险</span>
              </article>
            </div>

            <div className={styles.knowledgeLibraryFilters}>
              <button
                className={category === "all" ? styles.activeFilterButton : ""}
                onClick={() => setCategory("all")}
              >
                全部 {assets.knowledgeAssets.length}
              </button>
              {(Object.keys(KNOWLEDGE_ASSET_LABELS) as NovelKnowledgeAssetCategory[]).map(
                (key) => (
                  <button
                    key={key}
                    className={category === key ? styles.activeFilterButton : ""}
                    onClick={() => setCategory(key)}
                  >
                    {KNOWLEDGE_ASSET_LABELS[key]}{" "}
                    {
                      assets.knowledgeAssets.filter((item) => item.category === key)
                        .length
                    }
                  </button>
                ),
              )}
              <button onClick={() => void onCreateAsset()}>+ 资产</button>
            </div>

            <div className={styles.knowledgeLibraryList}>
              {visibleAssets.length === 0 ? (
                <p className={styles.emptyMiniState}>当前分类下暂无设定资产。</p>
              ) : (
                visibleAssets.map((item) => (
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
                      <button onClick={() => void onEditAsset(item, "title")}>
                        标题
                      </button>
                      <button onClick={() => void onEditAsset(item, "content")}>
                        内容
                      </button>
                      <button onClick={() => void onEditAsset(item, "tags")}>
                        标签
                      </button>
                      <button onClick={() => void onEditAsset(item, "status")}>
                        状态
                      </button>
                      <button
                        className={styles.dangerTextButton}
                        onClick={() => void onDeleteAsset(item)}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        ) : null}

        {view === "timeline" ? (
          <CharacterStateTimelinePanel timeline={characterTimeline} />
        ) : null}

        {view === "relations" ? (
          <CharacterRelationGraphPanel graph={characterRelations} />
        ) : null}
      </section>
    </div>
  );
}

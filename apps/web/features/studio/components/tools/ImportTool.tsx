"use client";

import { useEffect, useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  formatNovelRelativeAge,
  processImportedNovelMaterial,
  splitImportedNovelChapters,
  type NovelImportedChapter,
  type NovelProjectAssets,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import type { AppToastState } from "../../state/studio-types";

export function ImportTool({
  assets,
  project,
  onProjectChange,
  onImportChapters,
  onNotify,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onImportChapters: (chapters: NovelImportedChapter[]) => Promise<void>;
  onNotify: (message: string, tone?: AppToastState["tone"]) => void;
}) {
  const [tab, setTab] = useState<"chapters" | "canon" | "fanfic">("chapters");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [previewCount, setPreviewCount] = useState(0);

  useEffect(() => {
    if (tab !== "chapters" || !content.trim()) {
      setPreviewCount(0);
      return;
    }
    setPreviewCount(splitImportedNovelChapters(content).length);
  }, [content, tab]);

  async function importMaterial() {
    if (!content.trim()) {
      onNotify("请先粘贴导入内容。", "warning");
      return;
    }

    const processed = processImportedNovelMaterial({
      title: title.trim() || `${project.title} 导入素材`,
      content: content.trim(),
      type: tab,
      project,
      assets,
    });

    await onProjectChange(processed.project, processed.assets);

    if (processed.chapters.length > 0) {
      await onImportChapters(processed.chapters);
    }

    onNotify(
      tab === "chapters"
        ? `已导入 ${processed.chapters.length} 章，并提取 ${processed.extractedAssetCount} 条资产线索。`
        : `已导入素材，并提取 ${processed.extractedAssetCount} 条资产线索。`,
    );
    setTitle("");
    setContent("");
  }

  return (
    <section className={styles.toolFormPanel}>
      <div className={styles.innerTabs}>
        {[
          ["chapters", "章节导入"],
          ["canon", "原作设定"],
          ["fanfic", "同人初始化"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? styles.activeInnerTab : ""}
            onClick={() => setTab(id as "chapters" | "canon" | "fanfic")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "chapters" ? (
        <>
          <input
            value={title}
            placeholder='素材标题或章节拆分规则'
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            rows={12}
            value={content}
            placeholder='粘贴需要导入的章节正文...'
            onChange={(event) => setContent(event.target.value)}
          />
          <button className={styles.toolPrimaryButton} onClick={() => void importMaterial()}>
            导入并解析章节
          </button>
          {previewCount > 0 ? (
            <p className={styles.toolNotice}>
              预计识别 {previewCount} 章，将自动拆章、生成摘要，并提取角色 / 伏笔 / 设定线索。
            </p>
          ) : null}
        </>
      ) : null}
      {tab === "canon" ? (
        <>
          <input
            value={title}
            placeholder='原作或资料来源'
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            rows={12}
            value={content}
            placeholder='粘贴原作设定、世界观或人物关系...'
            onChange={(event) => setContent(event.target.value)}
          />
          <button className={styles.toolPrimaryButton} onClick={() => void importMaterial()}>
            导入并提取设定
          </button>
        </>
      ) : null}
      {tab === "fanfic" ? (
        <>
          <input
            value={title}
            placeholder='同人作品标题'
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            rows={10}
            value={content}
            placeholder='粘贴原作资料或世界观素材...'
            onChange={(event) => setContent(event.target.value)}
          />
          <button className={styles.toolPrimaryButton} onClick={() => void importMaterial()}>
            初始化并提取资产
          </button>
        </>
      ) : null}
      {assets.importedMaterials.length > 0 ? (
        <div className={styles.importHistory}>
          {assets.importedMaterials.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>
                {item.type} · {formatNovelRelativeAge(item.createdAt)}
                {item.parsedChapterCount
                  ? ` · ${item.parsedChapterCount} 章`
                  : ""}
                {item.extractedAssetCount
                  ? ` · ${item.extractedAssetCount} 条资产`
                  : ""}
                {item.status === "processed" ? " · 已解析" : ""}
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  analyzeNovelGenreProfile,
  applyNovelGenreAnalysisToAssets,
  type NovelProjectAssets,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import type { AppToastState } from "../../state/studio-types";

export function GenreTool({
  assets,
  project,
  onProjectChange,
  onRequestPrompt,
  onNotify,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    confirmLabel?: string;
  }) => Promise<string | null>;
  onNotify: (message: string, tone?: AppToastState["tone"]) => void;
}) {
  const [selectedGenre, setSelectedGenre] = useState(
    assets.genres[0]?.id ?? "project",
  );
  const detail = assets.genres.find((genre) => genre.id === selectedGenre) ??
    assets.genres[0] ?? {
      id: "project",
      name: project.genre,
      source: "project" as const,
      language: project.language,
      chapterTypes: "",
      fatigueWords: "",
      pacingRule: "",
    };

  async function saveGenre(field: keyof typeof detail, value: string) {
    const nextGenre = { ...detail, [field]: value };
    const nextAssets = {
      ...assets,
      genres: assets.genres.some((genre) => genre.id === detail.id)
        ? assets.genres.map((genre) =>
            genre.id === detail.id ? nextGenre : genre,
          )
        : [nextGenre, ...assets.genres],
    };

    await onProjectChange(
      field === "name" ? { genre: value } : {},
      nextAssets,
    );
  }

  async function analyzeAndApplyGenre() {
    const analysis = analyzeNovelGenreProfile(detail, project);
    const nextAssets = applyNovelGenreAnalysisToAssets(
      assets,
      detail.id,
      analysis,
    );

    await onProjectChange({}, nextAssets);
    onNotify("题材分析已写入设定资产与风格约束。");
  }

  return (
    <div className={styles.toolTwoColumn}>
      <aside className={styles.toolListPanel}>
        <div className={styles.toolListHeader}>
          <strong>题材库</strong>
          <button
            onClick={async () => {
              const name = await onRequestPrompt({
                title: "新建题材",
                message: "输入题材名称。",
                initialValue: "新题材",
                confirmLabel: "创建",
              });
              if (!name?.trim()) return;
              const nextGenre = {
                id: `genre-${Date.now()}`,
                name: name.trim(),
                source: "project" as const,
                language: project.language,
                chapterTypes: "",
                fatigueWords: "",
                pacingRule: "",
              };
              void onProjectChange({}, {
                ...assets,
                genres: [nextGenre, ...assets.genres],
              });
              setSelectedGenre(nextGenre.id);
            }}
          >
            + 新建题材
          </button>
        </div>
        {assets.genres.map((genre) => (
          <button
            key={genre.id}
            className={genre.id === selectedGenre ? styles.activeToolListItem : ""}
            onClick={() => setSelectedGenre(genre.id)}
          >
            <strong>{genre.name}</strong>
            <span>{genre.source === "project" ? "项目题材" : "内置题材"} · {genre.language}</span>
          </button>
        ))}
      </aside>
      <section className={styles.toolFormPanel}>
        <div className={styles.formGrid}>
          <label>
            ID
            <input value={detail.id} readOnly />
          </label>
          <label>
            名称
            <input
              value={detail.name}
              onChange={(event) => void saveGenre("name", event.target.value)}
            />
          </label>
          <label>
            章节类型
            <input
              value={detail.chapterTypes}
              onChange={(event) =>
                void saveGenre("chapterTypes", event.target.value)
              }
            />
          </label>
          <label>
            疲劳词
            <input
              value={detail.fatigueWords}
              onChange={(event) =>
                void saveGenre("fatigueWords", event.target.value)
              }
            />
          </label>
          <label className={styles.fullField}>
            节奏规则
            <textarea
              rows={5}
              value={detail.pacingRule}
              onChange={(event) =>
                void saveGenre("pacingRule", event.target.value)
              }
            />
          </label>
        </div>
        <button
          className={styles.toolPrimaryButton}
          onClick={() => void analyzeAndApplyGenre()}
        >
          分析并写入项目资产
        </button>
        {detail.analysis ? (
          <section className={styles.toolResultPanel}>
            <h2>题材分析</h2>
            <p>{detail.analysis.summary}</p>
            <div className={styles.toolMetricGrid}>
              <article>
                <span>受众钩子</span>
                <strong>{detail.analysis.audienceHook}</strong>
              </article>
              <article>
                <span>冲突模式</span>
                <strong>{detail.analysis.conflictPattern}</strong>
              </article>
            </div>
            {detail.analysis.riskPoints.length > 0 ? (
              <div className={styles.tagGroup}>
                {detail.analysis.riskPoints.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </div>
  );
}

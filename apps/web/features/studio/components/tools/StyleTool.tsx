"use client";

import { useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  analyzeNovelStyleSample,
  applyNovelStyleAnalysisToAssets,
  type NovelProjectAssets,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import type { AppToastState } from "../../state/studio-types";

export function StyleTool({
  assets,
  project,
  onProjectChange,
  onNotify,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onNotify: (message: string, tone?: AppToastState["tone"]) => void;
}) {
  const currentSample = assets.styleSamples[0] ?? {
    id: `style-${Date.now()}`,
    title: `${project.title} · 样章`,
    content: "",
    updatedAt: new Date().toISOString(),
  };
  const [sample, setSample] = useState(currentSample.content);
  const analysis =
    currentSample.analysis ??
    (sample.trim() ? analyzeNovelStyleSample(sample) : null);

  async function saveAndAnalyzeSample() {
    if (!sample.trim()) {
      onNotify("请先粘贴或输入文风样章。", "warning");
      return;
    }

    const nextAnalysis = analyzeNovelStyleSample(sample);
    const nextSample = {
      ...currentSample,
      content: sample,
      updatedAt: new Date().toISOString(),
      analysis: nextAnalysis,
    };
    const nextAssets = applyNovelStyleAnalysisToAssets(
      {
        ...assets,
        styleSamples: [nextSample, ...assets.styleSamples.slice(1)],
      },
      nextSample.id,
      nextAnalysis,
    );

    await onProjectChange({}, nextAssets);
    onNotify("文风分析已保存，并写入风格约束。");
  }

  return (
    <div className={styles.toolTwoColumn}>
      <section className={styles.toolFormPanel}>
        <label>
          来源名称
          <input value={`${project.title} · 样章`} readOnly />
        </label>
        <label>
          文本样本
          <textarea
            rows={12}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
          />
        </label>
        <button
          className={styles.toolPrimaryButton}
          onClick={() => void saveAndAnalyzeSample()}
        >
          保存并分析文风
        </button>
      </section>
      <section className={styles.toolResultPanel}>
        <h2>分析结果</h2>
        {analysis ? (
          <>
            <div className={styles.toolMetricGrid}>
              <article>
                <span>平均句长</span>
                <strong>{analysis.averageSentenceLength}</strong>
              </article>
              <article>
                <span>词汇多样性</span>
                <strong>{analysis.vocabularyDiversity}%</strong>
              </article>
              <article>
                <span>段落密度</span>
                <strong>{analysis.paragraphDensity}</strong>
              </article>
              <article>
                <span>情绪倾向</span>
                <strong>{analysis.emotionalTone}</strong>
              </article>
            </div>
            <div className={styles.tagGroup}>
              {analysis.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className={styles.toolNotice}>
              <strong>风格约束</strong>
              <p>{analysis.styleConstraints}</p>
            </div>
          </>
        ) : (
          <p>粘贴样章后点击「保存并分析文风」。</p>
        )}
      </section>
    </div>
  );
}

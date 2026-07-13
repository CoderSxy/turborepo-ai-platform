"use client";

import type { InkosCoreAction, InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function RadarTool({
  assets,
  project,
  isRunningCoreAction,
  onRunCoreAction,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  isRunningCoreAction: boolean;
  onRunCoreAction: (action: InkosCoreAction) => Promise<void>;
}) {
  return (
    <div className={styles.toolTwoColumn}>
      <section className={styles.toolFormPanel}>
        <h2>市场扫描</h2>
        <p>
          使用 InkOS Core RadarAgent 扫描同题材趋势、标题简介卖点和章节留存风险。当前题材：{project.genre}
        </p>
        <button
          className={styles.toolPrimaryButton}
          disabled={isRunningCoreAction}
          onClick={() => void onRunCoreAction("radar")}
        >
          {isRunningCoreAction ? "扫描中" : "开始扫描"}
        </button>
      </section>
      <section className={styles.toolResultPanel}>
        <h2>推荐方向</h2>
        {assets.projectStrategy ? (
          <article className={styles.radarResultItem}>
            <strong>项目策略摘要</strong>
            <p>{assets.projectStrategy.summary}</p>
            {assets.projectStrategy.platformHints.length > 0 ? (
              <div className={styles.tagGroup}>
                {assets.projectStrategy.platformHints.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
            {assets.projectStrategy.riskAlerts.length > 0 ? (
              <em>风险：{assets.projectStrategy.riskAlerts.join("；")}</em>
            ) : null}
          </article>
        ) : null}
        {assets.marketRadars.map((item) => (
          <article key={item.id} className={styles.radarResultItem}>
            <strong>{item.platform} · {item.genre}</strong>
            <span>{item.score}</span>
            <p>{item.concept}</p>
          </article>
        ))}
        {assets.marketRadars.length === 0 ? <p>暂无扫描结果。</p> : null}
      </section>
    </div>
  );
}

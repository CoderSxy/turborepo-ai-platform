"use client";

import {
  createDemoInkosProject,
  deriveInkosProjectStats,
} from "@repo/inkos-adapter";
import styles from "./shell.module.css";
import {
  isProviderConnected,
  type LocalModelSettings,
} from "../../lib/model-settings";

export function HomeDashboard({ settings }: { settings: LocalModelSettings }) {
  const connectedProviders = settings.providers.filter(isProviderConnected);
  const demoProject = createDemoInkosProject();
  const stats = deriveInkosProjectStats(demoProject);

  return (
    <div className={styles.homeShell}>
      <section className={styles.homeHero}>
        <div>
          <span className={styles.brandLine}>SXY Platform</span>
          <h1>创作中台</h1>
          <p>
            统一管理模型服务商、AI 小说工作台和后续多模态创作模块。当前配置只保存在本地浏览器。
          </p>
        </div>
        <div className={styles.homeHeroBadge}>
          <strong>{connectedProviders.length}</strong>
          <span>已连接模型服务商</span>
        </div>
      </section>

      <section className={styles.homeMetrics}>
        <article>
          <span>模型服务商</span>
          <strong>{settings.providers.length}</strong>
          <p>聚合 API、海外原厂、国产原厂、本地/订阅与 CodingPlan。</p>
        </article>
        <article>
          <span>小说项目</span>
          <strong>{demoProject.title}</strong>
          <p>当前示例工作台已准备 {demoProject.chapters.length} 个章节节点。</p>
        </article>
        <article>
          <span>定稿进度</span>
          <strong>{stats.progressPercent}%</strong>
          <p>{stats.approvedChapters} 章已定稿，{stats.readyForReviewChapters} 章待审稿。</p>
        </article>
      </section>

      <section className={styles.homeBand}>
        <div>
          <h2>下一步建议</h2>
          <p>
            先完成模型配置，再进入 AI 小说创作。后续图片、视频、小红书文案等模块可以复用同一套模型 Key。
          </p>
        </div>
      </section>
    </div>
  );
}

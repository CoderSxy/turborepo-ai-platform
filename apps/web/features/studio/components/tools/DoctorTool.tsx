"use client";

import type { InkosCoreAction, InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function DoctorTool({
  assets,
  project,
  isRunningCoreAction,
  onRunCoreAction,
  onRunLocalDiagnostics,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  isRunningCoreAction: boolean;
  onRunCoreAction: (action: InkosCoreAction) => Promise<void>;
  onRunLocalDiagnostics: () => void;
}) {
  return (
    <section className={styles.toolFormPanel}>
      <h2>环境诊断</h2>
      <p>
        使用 InkOS Core StateValidatorAgent 校验《{project.title}》当前状态、伏笔和章节上下文。
      </p>
      <div className={styles.toolActionRow}>
        <button
          className={styles.toolPrimaryButton}
          disabled={isRunningCoreAction}
          onClick={() => void onRunCoreAction("diagnostics")}
        >
          {isRunningCoreAction ? "诊断中" : "运行 Core 诊断"}
        </button>
        <button disabled={isRunningCoreAction} onClick={onRunLocalDiagnostics}>
          本地快速诊断
        </button>
      </div>
      <div className={styles.doctorList}>
        {assets.diagnostics.map((check) => (
          <div key={check.id}>
            <span className={check.ok ? styles.checkOk : styles.checkWarn}>
              {check.ok ? "✓" : "!"}
            </span>
            <strong>{check.label}</strong>
            <em>{check.detail}</em>
          </div>
        ))}
        {assets.diagnostics.length === 0 ? (
          <div>
            <span className={styles.checkWarn}>!</span>
            <strong>未运行诊断</strong>
            <em>点击上方按钮生成当前书籍的环境诊断。</em>
          </div>
        ) : null}
      </div>
      <div className={styles.toolNotice}>诊断结果会保存到当前书籍资产中。</div>
    </section>
  );
}

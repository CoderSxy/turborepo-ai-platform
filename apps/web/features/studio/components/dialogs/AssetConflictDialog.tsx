"use client";

import {
  isNovelAssetConflictAutoFixable,
  type NovelAssetConflictReport,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function AssetConflictDialog({
  report,
  isApplying,
  onClose,
  onApplyFixes,
}: {
  report: NovelAssetConflictReport;
  isApplying: boolean;
  onClose: () => void;
  onApplyFixes: () => void;
}) {
  const fixableCount = report.issues.filter((issue) =>
    isNovelAssetConflictAutoFixable(issue.code),
  ).length;

  return (
    <div className={styles.dialogOverlay} role='presentation'>
      <section className={styles.appDialog} role='dialog' aria-modal='true'>
        <header>
          <h2>设定冲突检测</h2>
          <p>{report.summary}</p>
          {fixableCount > 0 ? (
            <p className={styles.cloudSyncMeta}>
              其中 {fixableCount} 项可一键自动修复（合并重复资产、同步大纲状态等）。
            </p>
          ) : null}
        </header>
        <div className={styles.modelCallLogList}>
          {report.issues.length === 0 ? (
            <p className={styles.emptyMiniState}>未发现设定冲突。</p>
          ) : (
            report.issues.map((issue) => (
              <article
                key={issue.id}
                className={
                  issue.severity === "error"
                    ? styles.outlineEditorDriftWarning
                    : issue.severity === "warning"
                      ? styles.outlineEditorDriftWarning
                      : styles.outlineEditorDriftOk
                }
              >
                <strong>{issue.title}</strong>
                <span>{issue.detail}</span>
                {issue.chapterNumbers?.length ? (
                  <em>章节：{issue.chapterNumbers.join("、")}</em>
                ) : null}
                {isNovelAssetConflictAutoFixable(issue.code) ? (
                  <em>可自动修复</em>
                ) : null}
              </article>
            ))
          )}
        </div>
        <footer>
          <button onClick={onClose}>关闭</button>
          {fixableCount > 0 ? (
            <button
              className={styles.primaryButton}
              disabled={isApplying}
              onClick={onApplyFixes}
            >
              {isApplying ? "修复中…" : `一键修复 (${fixableCount})`}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

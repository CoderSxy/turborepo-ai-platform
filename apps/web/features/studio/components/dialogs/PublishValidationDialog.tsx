"use client";

import type { NovelPublishValidationReport } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function PublishValidationDialog({
  report,
  onClose,
  onProceed,
}: {
  report: NovelPublishValidationReport;
  onClose: () => void;
  onProceed: () => void;
}) {
  return (
    <div className={styles.dialogOverlay} role='presentation'>
      <section className={styles.appDialog} role='dialog' aria-modal='true'>
        <header>
          <h2>发布校验</h2>
          <p>{report.summary}</p>
        </header>
        <div className={styles.modelCallLogList}>
          {report.issues.length === 0 ? (
            <p className={styles.emptyMiniState}>未发现校验问题。</p>
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
              </article>
            ))
          )}
        </div>
        <footer>
          <button onClick={onClose}>取消</button>
          <button
            className={styles.primaryButton}
            disabled={!report.canPublish}
            onClick={onProceed}
          >
            {report.canPublish ? "继续导出" : "无法导出"}
          </button>
        </footer>
      </section>
    </div>
  );
}

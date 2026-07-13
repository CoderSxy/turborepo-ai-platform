"use client";

import {
  formatNovelRelativeAge,
  type NovelWorkspaceMergeReport,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function CloudSyncMergeDialog({
  remoteLabel,
  report,
  resolutions,
  onClose,
  onToggleResolution,
  onConfirm,
}: {
  remoteLabel: string;
  report: NovelWorkspaceMergeReport;
  resolutions: Record<string, "local" | "remote">;
  onClose: () => void;
  onToggleResolution: (entityId: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.dialogOverlay} role='presentation'>
      <section className={styles.appDialog} role='dialog' aria-modal='true'>
        <header>
          <h2>同步合并预览</h2>
          <p>
            来自「{remoteLabel}」的同步包。{report.summary}
          </p>
        </header>
        <div className={styles.modelCallLogList}>
          {report.conflicts.length === 0 ? (
            <p className={styles.emptyMiniState}>未发现冲突，可直接合并。</p>
          ) : (
            report.conflicts.map((conflict) => (
              <article key={conflict.id} className={styles.cloudSyncConflictItem}>
                <strong>{conflict.label}</strong>
                <span>
                  本地 {formatNovelRelativeAge(conflict.localUpdatedAt)} · 远端{" "}
                  {formatNovelRelativeAge(conflict.remoteUpdatedAt)}
                </span>
                <button onClick={() => onToggleResolution(conflict.entityId)}>
                  保留：
                  {resolutions[conflict.entityId] === "local" ? "本地" : "远端"}
                </button>
              </article>
            ))
          )}
        </div>
        <footer>
          <button onClick={onClose}>取消</button>
          <button className={styles.primaryButton} onClick={onConfirm}>
            确认合并
          </button>
        </footer>
      </section>
    </div>
  );
}

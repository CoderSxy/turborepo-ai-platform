"use client";

import type { NovelProjectAssets } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import { listPresentCoreFiles, type CoreFileKey } from "./core-file-keys";
import type { AssetAlertCounts } from "./right-panel-summaries";
import { SidebarCard } from "./SidebarCard";
import { SidebarCardAlert } from "./SidebarCardAlert";

export function CoreFilesSection({
  assets,
  alerts,
  onOpenCoreFile,
  onOpenAlerts,
}: {
  assets: NovelProjectAssets;
  alerts: AssetAlertCounts;
  onOpenCoreFile: (fileKey: CoreFileKey) => void;
  onOpenAlerts?: () => void;
}) {
  const presentFiles = listPresentCoreFiles(assets);
  const summary = `已加载 ${presentFiles.length} 项`;

  return (
    <SidebarCard
      id="core-files"
      title="核心文件"
      summary={summary}
      actions={<SidebarCardAlert alerts={alerts} onClick={onOpenAlerts} />}
    >
      {presentFiles.length > 0 ? (
        <div className={styles.inkosFoundationList}>
          {presentFiles.map((file) => (
            <button
              key={file.key}
              type="button"
              onClick={() => onOpenCoreFile(file.key)}
            >
              {file.label}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMiniState}>暂无核心文件，生成设定后会出现在这里。</p>
      )}
    </SidebarCard>
  );
}

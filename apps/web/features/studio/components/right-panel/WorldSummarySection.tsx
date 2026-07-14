"use client";

import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../lib/novel-store";
import { MarkdownContent } from "../chat/MarkdownContent";
import styles from "../../studio.module.css";
import {
  buildWorldSummaryText,
  truncateText,
  type AssetAlertCounts,
} from "./right-panel-summaries";
import { SidebarCard } from "./SidebarCard";
import { SidebarCardAlert } from "./SidebarCardAlert";
import type { CoreFileKey } from "./core-file-keys";

export function WorldSummarySection({
  project,
  assets,
  alerts,
  onOpenCoreFile,
  onOpenAlerts,
}: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  alerts: AssetAlertCounts;
  onOpenCoreFile: (fileKey: CoreFileKey) => void;
  onOpenAlerts?: () => void;
}) {
  const worldText = buildWorldSummaryText(project, assets);
  const summary = worldText
    ? truncateText(worldText, 60)
    : "暂无世界观摘要";

  return (
    <SidebarCard
      id="world-summary"
      title="世界观"
      summary={summary}
      actions={<SidebarCardAlert alerts={alerts} onClick={onOpenAlerts} />}
    >
      {worldText ? (
        <>
          <div className={styles.worldSummaryPreview}>
            <MarkdownContent content={truncateText(worldText, 240)} compact />
          </div>
          <button
            type="button"
            className={styles.worldSummaryViewAll}
            onClick={() => onOpenCoreFile("worldNotes")}
          >
            查看完整
          </button>
        </>
      ) : (
        <p className={styles.emptyMiniState}>暂无世界观内容。</p>
      )}
    </SidebarCard>
  );
}

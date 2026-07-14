"use client";

import type { NovelProjectAssets } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import {
  buildCharacterProfilesView,
  buildCharactersSectionSummary,
  formatLastSyncedChapter,
  truncateText,
  type AssetAlertCounts,
} from "./right-panel-summaries";
import { SidebarCard } from "./SidebarCard";
import { SidebarCardAlert } from "./SidebarCardAlert";

export function CharactersSection({
  assets,
  activeChapterNumber,
  alerts,
  onOpenCharacter,
  onOpenCharacterMatrix,
  onOpenAlerts,
}: {
  assets: NovelProjectAssets;
  activeChapterNumber: number | null;
  alerts: AssetAlertCounts;
  onOpenCharacter?: (characterName: string) => void;
  onOpenCharacterMatrix?: () => void;
  onOpenAlerts?: () => void;
}) {
  const view = buildCharacterProfilesView(assets, activeChapterNumber);
  const summary = buildCharactersSectionSummary(assets, activeChapterNumber);

  return (
    <SidebarCard
      id="characters"
      title="角色状态"
      summary={summary}
      actions={<SidebarCardAlert alerts={alerts} onClick={onOpenAlerts} />}
    >
      {view.totalCount > 0 ? (
        <div className={styles.inkosCharacterList}>
          {view.groups.map((group) => (
            <section key={group.tier} className={styles.inkosCharacterGroup}>
              <h4 className={styles.inkosCharacterGroupLabel}>{group.label}</h4>
              {group.rows.map((row) => (
                <button
                  key={row.profile.id}
                  type="button"
                  className={styles.inkosCharacterRow}
                  onClick={() => onOpenCharacter?.(row.profile.name)}
                >
                  <strong>{row.profile.name}</strong>
                  {row.narrativeRole ? <span>{row.narrativeRole}</span> : null}
                  <em>{truncateText(row.stateSummary, 48)}</em>
                  <small>{formatLastSyncedChapter(row.lastSyncedChapter)}</small>
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMiniState}>
          暂无角色状态，可在更多工作区管理资产。
        </p>
      )}
      {view.totalCount > 0 && onOpenCharacterMatrix ? (
        <button
          type="button"
          className={styles.worldSummaryViewAll}
          onClick={onOpenCharacterMatrix}
        >
          打开角色矩阵
        </button>
      ) : null}
    </SidebarCard>
  );
}

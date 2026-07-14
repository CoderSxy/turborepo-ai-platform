"use client";

import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import {
  buildCharactersSectionSummary,
  pickCharactersForChapterPreview,
  truncateText,
  type AssetAlertCounts,
} from "./right-panel-summaries";
import { SidebarCard } from "./SidebarCard";
import { SidebarCardAlert } from "./SidebarCardAlert";

export function CharactersSection({
  assets,
  project,
  activeChapterNumber,
  alerts,
  onOpenCharacter,
  onOpenCharacterMatrix,
  onOpenAlerts,
}: {
  assets: NovelProjectAssets;
  project: Pick<InkosNovelProject, "protagonist">;
  activeChapterNumber: number | null;
  alerts: AssetAlertCounts;
  onOpenCharacter?: (characterName: string) => void;
  onOpenCharacterMatrix?: () => void;
  onOpenAlerts?: () => void;
}) {
  const preview = pickCharactersForChapterPreview(
    assets,
    activeChapterNumber,
    4,
    project,
  );
  const summary = buildCharactersSectionSummary(
    assets,
    activeChapterNumber,
    project,
  );

  return (
    <SidebarCard
      id="characters"
      title="角色状态"
      summary={summary}
      actions={<SidebarCardAlert alerts={alerts} onClick={onOpenAlerts} />}
    >
      {preview.length > 0 ? (
        <div className={styles.inkosCharacterList}>
          {preview.map((character) => (
            <button
              key={character.name}
              type="button"
              className={styles.inkosCharacterRow}
              onClick={() => onOpenCharacter?.(character.name)}
            >
              <strong>{character.name}</strong>
              {character.role ? <span>{character.role}</span> : null}
              <em>
                {truncateText(
                  character.current || character.tags || "暂无状态",
                  48,
                )}
              </em>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMiniState}>
          暂无角色状态，可在更多工作区管理资产。
        </p>
      )}
      {preview.length > 0 && onOpenCharacterMatrix ? (
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

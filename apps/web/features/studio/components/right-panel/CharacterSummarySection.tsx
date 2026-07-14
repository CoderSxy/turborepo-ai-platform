"use client";

import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../lib/novel-store";
import { MarkdownContent } from "../chat/MarkdownContent";
import styles from "../../studio.module.css";
import {
  buildCharacterSummaryText,
  truncateText,
} from "./right-panel-summaries";
import { SidebarCard } from "./SidebarCard";
import type { CoreFileKey } from "./core-file-keys";

export function CharacterSummarySection({
  project,
  assets,
  onOpenCoreFile,
}: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  onOpenCoreFile: (fileKey: CoreFileKey) => void;
}) {
  const { protagonist, supporting, supportingCount } = buildCharacterSummaryText(
    project,
    assets,
  );
  const summary = protagonist
    ? supportingCount > 0
      ? `${truncateText(protagonist, 16)} 等 ${supportingCount + 1} 人`
      : truncateText(protagonist, 24)
    : supportingCount > 0
      ? `${supportingCount} 位配角`
      : "暂无人物摘要";

  return (
    <SidebarCard id="character-summary" title="人物摘要" summary={summary}>
      {protagonist || supporting ? (
        <>
          <div className={styles.characterSummaryPreview}>
            {protagonist ? (
              <div>
                <strong>主角</strong>
                <MarkdownContent content={truncateText(protagonist, 160)} compact />
              </div>
            ) : null}
            {supporting ? (
              <div>
                <strong>配角</strong>
                <MarkdownContent content={truncateText(supporting, 160)} compact />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.worldSummaryViewAll}
            onClick={() => onOpenCoreFile("characters")}
          >
            查看完整
          </button>
        </>
      ) : (
        <p className={styles.emptyMiniState}>暂无人物摘要。</p>
      )}
    </SidebarCard>
  );
}

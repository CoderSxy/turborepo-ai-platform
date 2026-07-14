"use client";

import {
  buildNovelCharacterStateTimeline,
  formatNovelRelativeAge,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import { KNOWLEDGE_ASSET_STATUS_LABELS } from "../../state/studio-constants";

export function CharacterStateTimelinePanel({
  timeline,
}: {
  timeline: ReturnType<typeof buildNovelCharacterStateTimeline>;
}) {
  if (timeline.characters.length === 0) {
    return (
      <p className={styles.emptyMiniState}>暂无角色状态记录。写章沉淀后会自动生成。</p>
    );
  }

  return (
    <div className={styles.characterTimelinePanel}>
      {timeline.characters.map((group) => (
        <article key={group.name} className={styles.characterTimelineGroup}>
          <header>
            <strong>{group.name}</strong>
            <span>
              {group.entries.length} 条记录
              {group.status ? ` / ${KNOWLEDGE_ASSET_STATUS_LABELS[group.status]}` : ""}
            </span>
          </header>
          <p className={styles.characterTimelineLatest}>{group.latestContent}</p>
          {group.entries.length > 0 ? (
            <ol className={styles.characterTimelineEntries}>
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <div>
                    {entry.chapterNumber ? (
                      <strong>
                        第 {entry.chapterNumber} 章
                        {entry.chapterTitle ? `《${entry.chapterTitle}》` : ""}
                      </strong>
                    ) : (
                      <strong>
                        {entry.source === "asset"
                          ? "角色卡"
                          : entry.source === "pending-delta"
                            ? "章节同步"
                            : entry.source === "change-event"
                              ? "变更记录"
                              : "状态追踪"}
                      </strong>
                    )}
                    <time>{formatNovelRelativeAge(entry.updatedAt)}前</time>
                  </div>
                  <p>{entry.content}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.emptyMiniState}>暂无章节级状态变化。</p>
          )}
        </article>
      ))}
    </div>
  );
}

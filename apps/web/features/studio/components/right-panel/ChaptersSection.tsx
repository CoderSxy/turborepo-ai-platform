"use client";

import { INKOS_STATUS_LABELS } from "@repo/inkos-adapter";
import type { NovelChapterListItem } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import { getChapterStatusSymbol } from "./chapter-status-symbol";
import { SidebarCard } from "./SidebarCard";

export function ChaptersSection({
  chapterRows,
  activeChapterId,
  onChapterSelect,
  onOpenChapterDetail,
}: {
  chapterRows: NovelChapterListItem[];
  activeChapterId: string;
  onChapterSelect: (chapterId: string) => void;
  onOpenChapterDetail: (chapterId: string) => void;
}) {
  const activeRow =
    chapterRows.find((chapter) => chapter.key === activeChapterId) ??
    chapterRows.at(-1) ??
    null;

  const summary = activeRow
    ? `${chapterRows.length} 章 · 当前第 ${activeRow.number} 章`
    : `${chapterRows.length} 章`;

  return (
    <SidebarCard id="chapter-list" title="章节" defaultOpen summary={summary}>
      <div className={styles.inkosChapterList}>
        {chapterRows.length > 0 ? (
          chapterRows.map((chapter) => (
            <button
              key={chapter.key}
              type="button"
              className={`${styles.inkosChapterRow} ${
                chapter.key === activeRow?.key ? styles.inkosChapterRowActive : ""
              }`}
              onClick={() => {
                if (chapter.key === activeChapterId && chapter.generated) {
                  onOpenChapterDetail(chapter.key);
                  return;
                }
                onChapterSelect(chapter.key);
              }}
            >
              <span
                className={styles.inkosChapterStatusSymbol}
                aria-hidden
              >
                {getChapterStatusSymbol(chapter.status, chapter.generated)}
              </span>
              <span className={styles.inkosChapterBadge}>{chapter.number}</span>
              <strong className={styles.inkosChapterTitle}>{chapter.title}</strong>
              <em className={styles.inkosChapterMeta}>
                {chapter.generated
                  ? `${chapter.wordCount} 字`
                  : INKOS_STATUS_LABELS[chapter.status]}
              </em>
            </button>
          ))
        ) : (
          <p className={styles.emptyMiniState}>
            暂无章节，点击「写下一章」后会自动保存正文。
          </p>
        )}
      </div>
    </SidebarCard>
  );
}

"use client";

import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { StoredNovelTask } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

const TASK_ACTION_LABELS: Record<string, string> = {
  "write-chapter": "写作",
  review: "审稿",
  "revise-chapter": "修订",
  outline: "生成大纲",
  settings: "整理设定",
};

export function BookSummaryHeader({
  project,
  generatedChapters,
  totalChapters,
  tasks,
  onOpenBookStats,
}: {
  project: InkosNovelProject;
  generatedChapters: number;
  totalChapters: number;
  tasks: StoredNovelTask[];
  onOpenBookStats?: () => void;
}) {
  const runningTask = tasks.find((task) => task.status === "running");

  return (
    <header className={styles.inkosBookHeader}>
      <button
        type="button"
        className={styles.inkosBookTitle}
        onClick={onOpenBookStats}
      >
        {project.title}
      </button>
      {runningTask ? (
        <p className={styles.inkosBookMeta}>
          正在{TASK_ACTION_LABELS[runningTask.action] ?? "执行"}…
          {runningTask.targetChapterNumber
            ? ` 第 ${runningTask.targetChapterNumber} 章`
            : ""}
        </p>
      ) : (
        <p className={styles.inkosBookMeta}>
          已生成 {generatedChapters} / {totalChapters} 章
        </p>
      )}
    </header>
  );
}

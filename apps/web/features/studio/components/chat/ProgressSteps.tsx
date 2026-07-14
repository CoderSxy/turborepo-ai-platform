"use client";

import { useEffect, useState } from "react";
import {
  formatTaskElapsedMs,
  inferProgressStatus,
  shouldExpandTaskCard,
} from "../../store/slices/message/parts-builder";
import type { StudioMessagePart } from "../../store/types";
import { WriteChapterPipelineTimeline } from "./WriteChapterPipelineTimeline";
import styles from "../../studio.module.css";

const STATUS_LABELS = {
  running: "进行中",
  completed: "已完成",
  error: "失败",
  paused: "已暂停",
} as const;

export function ProgressSteps({
  part,
  siblingParts = [],
}: {
  part: Extract<StudioMessagePart, { type: "progress" }>;
  siblingParts?: StudioMessagePart[];
}) {
  const status = inferProgressStatus(part, siblingParts);
  const [expanded, setExpanded] = useState(shouldExpandTaskCard(status));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const statusClass =
    {
      running: styles.taskExecutionCardRunning,
      completed: styles.taskExecutionCardCompleted,
      error: styles.taskExecutionCardError,
      paused: styles.taskExecutionCardPaused,
    }[status] ?? "";

  useEffect(() => {
    setExpanded(shouldExpandTaskCard(status));
  }, [status]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  const elapsed = formatTaskElapsedMs(
    part.startedAt,
    part.completedAt,
    nowMs,
  );
  const summary = part.summary ?? part.steps.at(-1)?.message ?? part.label;

  return (
    <section
      className={`${styles.taskExecutionCard} ${statusClass}`}
      data-status={status}
    >
      <button
        type="button"
        className={styles.taskExecutionCardHeader}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={styles.taskExecutionCardChevron}>
          {expanded ? "▾" : "▸"}
        </span>
        <span className={styles.taskExecutionCardTitle}>{part.label}</span>
        <span className={styles.taskExecutionCardStatus}>
          {STATUS_LABELS[status]}
        </span>
        {elapsed ? (
          <span className={styles.taskExecutionCardElapsed}>{elapsed}</span>
        ) : null}
      </button>

      {!expanded && summary ? (
        <p className={styles.taskExecutionCardSummary}>{summary}</p>
      ) : null}

      {expanded ? (
        <div className={styles.taskExecutionCardBody}>
          {summary ? (
            <p className={styles.taskExecutionCardSummary}>{summary}</p>
          ) : null}
          <ul className={styles.taskExecutionSteps}>
            {part.steps.length === 0 ? (
              <li>等待任务开始</li>
            ) : (
              part.steps.map((step, index) => (
                <li key={`${step.at}-${index}`}>{step.message}</li>
              ))
            )}
          </ul>
          {part.pipelineTimeline ? (
            <WriteChapterPipelineTimeline timeline={part.pipelineTimeline} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

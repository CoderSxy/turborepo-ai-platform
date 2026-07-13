"use client";

import styles from "../../studio.module.css";
import type { StudioMessagePart } from "../../store/types";

export function ProgressSteps({
  part,
}: {
  part: Extract<StudioMessagePart, { type: "progress" }>;
}) {
  return (
    <div className={styles.progressSteps}>
      <strong>
        {part.label}
        {part.paused ? "（已暂停）" : ""}
      </strong>
      <ul>
        {part.steps.length === 0 ? (
          <li>等待任务开始</li>
        ) : (
          part.steps.map((step, index) => (
            <li key={index}>{step.message}</li>
          ))
        )}
      </ul>
    </div>
  );
}

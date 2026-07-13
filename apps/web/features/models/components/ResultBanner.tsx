"use client";

import styles from "../models.module.css";

export function ResultBanner({
  ok,
  title,
  message,
  latencyMs,
  sample,
}: {
  ok: boolean;
  title: string;
  message: string;
  latencyMs?: number;
  sample?: string;
}) {
  return (
    <div className={ok ? styles.testResultSuccess : styles.testResultError}>
      <strong>{title}</strong>
      <span>{message}</span>
      {latencyMs ? <em>{latencyMs} ms</em> : null}
      {sample ? <code>{sample}</code> : null}
    </div>
  );
}

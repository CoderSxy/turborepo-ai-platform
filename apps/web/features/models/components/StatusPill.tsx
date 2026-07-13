"use client";

import styles from "../models.module.css";

export function StatusPill({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    ready: "已连接",
    "missing-api-key": "未配置",
    "provider-disabled": "已停用",
  };

  return (
    <span
      className={status === "ready" ? styles.statusReady : styles.statusWarning}
    >
      {labelMap[status] ?? status}
    </span>
  );
}

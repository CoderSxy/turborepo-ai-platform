"use client";

import styles from "../../studio.module.css";
import type { AssetAlertCounts } from "./right-panel-summaries";

export function SidebarCardAlert({
  alerts,
  onClick,
}: {
  alerts: AssetAlertCounts;
  onClick?: () => void;
}) {
  const { syncAttentionCount, conflictErrors, conflictWarnings } = alerts;

  if (
    syncAttentionCount === 0 &&
    conflictErrors === 0 &&
    conflictWarnings === 0
  ) {
    return null;
  }

  const label =
    syncAttentionCount > 0
      ? `${syncAttentionCount} 需关注`
      : conflictErrors > 0
        ? `${conflictErrors} 冲突`
        : `${conflictWarnings} 提醒`;

  const tone =
    syncAttentionCount > 0 || conflictErrors > 0
      ? styles.sidebarCardAlertDanger
      : styles.sidebarCardAlertWarning;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.sidebarCardAlert} ${tone}`}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {label}
      </button>
    );
  }

  return <span className={`${styles.sidebarCardAlert} ${tone}`}>{label}</span>;
}

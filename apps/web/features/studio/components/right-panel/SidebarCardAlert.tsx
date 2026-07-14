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
  const { pendingCount, conflictErrors, conflictWarnings } = alerts;

  if (pendingCount === 0 && conflictErrors === 0 && conflictWarnings === 0) {
    return null;
  }

  const label =
    pendingCount > 0
      ? `${pendingCount} 待确认`
      : conflictErrors > 0
        ? `${conflictErrors} 冲突`
        : `${conflictWarnings} 提醒`;

  const tone =
    pendingCount > 0 || conflictErrors > 0
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

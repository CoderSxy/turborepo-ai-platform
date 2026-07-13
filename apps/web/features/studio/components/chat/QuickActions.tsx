"use client";

import styles from "../../studio.module.css";
import type { StudioAction } from "../../actions/types";

const ACTIONS = [
  { label: "写下一章", type: "write-chapter" as const },
  { label: "审稿", type: "review" as const },
  { label: "修订本章", type: "revise-chapter" as const },
];

export function QuickActions({
  disabled,
  onAction,
}: {
  disabled: boolean;
  onAction: (action: StudioAction) => void;
}) {
  return (
    <div className={styles.composerQuickActions}>
      {ACTIONS.map((action) => (
        <button
          key={action.type}
          type="button"
          disabled={disabled}
          onClick={() => onAction({ type: action.type })}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

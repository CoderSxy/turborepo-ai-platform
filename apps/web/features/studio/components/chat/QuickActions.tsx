"use client";

import styles from "../../studio.module.css";
import type { StudioAction } from "../../actions/types";
import { WriteChapterSplitButton } from "./WriteChapterSplitButton";

const OTHER_ACTIONS = [
  { label: "审稿", type: "review" as const },
  { label: "修订本章", type: "revise-chapter" as const },
];

export function QuickActions({
  disabled,
  onAction,
  onWriteChapter,
  onOpenAdvancedOptions,
  onEditDefaultPreferences,
}: {
  disabled: boolean;
  onAction: (action: StudioAction) => void;
  onWriteChapter: () => void;
  onOpenAdvancedOptions: () => void;
  onEditDefaultPreferences: () => void;
}) {
  return (
    <div className={styles.composerQuickActions}>
      <WriteChapterSplitButton
        disabled={disabled}
        onWriteChapter={onWriteChapter}
        onOpenAdvancedOptions={onOpenAdvancedOptions}
        onEditDefaultPreferences={onEditDefaultPreferences}
      />
      {OTHER_ACTIONS.map((action) => (
        <button
          key={action.type}
          type="button"
          disabled={disabled}
          onClick={() =>
            onAction({ type: action.type, source: "quick-action" })
          }
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

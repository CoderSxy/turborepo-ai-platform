"use client";

import { useEffect } from "react";
import styles from "../studio.module.css";

export function SessionActionsMenu({
  open,
  onClose,
  onRename,
  onDelete,
  anchorLabel,
}: {
  open: boolean;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  anchorLabel?: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.bookTreeMenu}
      role="menu"
      aria-label={anchorLabel ?? "会话操作"}
    >
      <button
        type="button"
        role="menuitem"
        className={styles.bookTreeMenuItem}
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        重命名
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${styles.bookTreeMenuItem} ${styles.dangerTextButton}`}
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        删除
      </button>
    </div>
  );
}

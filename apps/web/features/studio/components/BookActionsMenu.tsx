"use client";

import { useEffect } from "react";
import styles from "../studio.module.css";

export function BookActionsMenu({
  open,
  onClose,
  archived,
  canMoveUp,
  canMoveDown,
  onRename,
  onArchive,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  archived: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: () => void;
  onArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
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
    <div className={styles.bookTreeMenu} role="menu" aria-label="书籍操作">
      <button
        type="button"
        role="menuitem"
        className={styles.bookTreeMenuItem}
        onClick={() => {
          onClose();
          onRename();
        }}
      >
        重命名
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.bookTreeMenuItem}
        onClick={() => {
          onClose();
          onArchive();
        }}
      >
        {archived ? "还原" : "归档"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.bookTreeMenuItem}
        disabled={!canMoveUp}
        onClick={() => {
          onClose();
          onMoveUp();
        }}
      >
        上移
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.bookTreeMenuItem}
        disabled={!canMoveDown}
        onClick={() => {
          onClose();
          onMoveDown();
        }}
      >
        下移
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${styles.bookTreeMenuItem} ${styles.dangerTextButton}`}
        onClick={() => {
          onClose();
          onDelete();
        }}
      >
        删除
      </button>
    </div>
  );
}

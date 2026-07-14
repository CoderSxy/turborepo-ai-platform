"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "../studio.module.css";
import { useBookTreeAnchoredMenu } from "./use-book-tree-anchored-menu";

export function BookActionsMenu({
  open,
  onClose,
  anchorRef,
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
  anchorRef: RefObject<HTMLElement | null>;
  archived: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: () => void;
  onArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { menuRef, style } = useBookTreeAnchoredMenu({
    open,
    onClose,
    anchorRef,
  });

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className={`${styles.bookTreeMenu} ${styles.bookTreeMenuPortaled}`}
      style={style}
      role="menu"
      aria-label="书籍操作"
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
        className={styles.bookTreeMenuItem}
        onClick={() => {
          onArchive();
          onClose();
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
          onMoveUp();
          onClose();
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
          onMoveDown();
          onClose();
        }}
      >
        下移
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
    </div>,
    document.body,
  );
}

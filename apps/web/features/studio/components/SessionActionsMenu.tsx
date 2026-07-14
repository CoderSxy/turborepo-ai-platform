"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "../studio.module.css";
import { useBookTreeAnchoredMenu } from "./use-book-tree-anchored-menu";

export function SessionActionsMenu({
  open,
  onClose,
  anchorRef,
  onRename,
  onDelete,
  anchorLabel,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  onRename: () => void;
  onDelete: () => void;
  anchorLabel?: string;
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
    </div>,
    document.body,
  );
}

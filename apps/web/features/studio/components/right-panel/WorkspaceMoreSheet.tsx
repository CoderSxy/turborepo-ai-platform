"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  focusInitialElement,
  handleFocusTrapKeyDown,
} from "../../lib/focus-trap";
import styles from "../../studio.module.css";

export function WorkspaceMoreSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    triggerRef.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (panelRef.current) {
        handleFocusTrapKeyDown(panelRef.current, event);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    const frame = window.requestAnimationFrame(() => {
      if (panelRef.current) {
        focusInitialElement(panelRef.current);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.writingOptionsOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={panelRef}
        className={`${styles.writingOptionsSheet} ${styles.workspaceMoreSheet}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.writingOptionsSheetHeader}>
          <h2 id={titleId}>更多工作区</h2>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className={styles.workspaceMoreSheetBody}>{children}</div>
      </section>
    </div>
  );
}

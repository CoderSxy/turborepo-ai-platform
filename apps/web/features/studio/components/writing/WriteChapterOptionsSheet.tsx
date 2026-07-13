"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { NovelChapterWriteTarget, NovelContextSelection } from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import { WriteChapterOptionsForm } from "./WriteChapterOptionsForm";

export type WriteChapterOptionsSheetMode = "once" | "defaults";

export function WriteChapterOptionsSheet({
  open,
  mode,
  target,
  initialValue,
  derivedStyleConstraints,
  onClose,
  onStartGenerate,
  onSaveDefaults,
}: {
  open: boolean;
  mode: WriteChapterOptionsSheetMode;
  target?: NovelChapterWriteTarget;
  initialValue: NovelContextSelection;
  derivedStyleConstraints?: string;
  onClose: () => void;
  onStartGenerate?: (selection: NovelContextSelection) => void;
  onSaveDefaults?: (selection: NovelContextSelection) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [selection, setSelection] = useState(initialValue);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setSelection(structuredClone(initialValue));
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const title =
    mode === "once" ? "本章高级选项" : "编辑默认写作偏好";
  const primaryLabel = mode === "once" ? "开始生成" : "保存偏好";

  function handlePrimary() {
    if (mode === "once") {
      onStartGenerate?.(selection);
      return;
    }
    onSaveDefaults?.(selection);
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
        className={styles.writingOptionsSheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.writingOptionsSheetHeader}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <WriteChapterOptionsForm
          value={selection}
          onChange={setSelection}
          target={target}
          derivedStyleConstraints={derivedStyleConstraints}
        />

        <footer className={styles.writingOptionsSheetFooter}>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handlePrimary}
          >
            {primaryLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

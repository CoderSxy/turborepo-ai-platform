"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "../../studio.module.css";

export function WriteChapterSplitButton({
  disabled,
  onWriteChapter,
  onOpenAdvancedOptions,
  onEditDefaultPreferences,
}: {
  disabled: boolean;
  onWriteChapter: () => void;
  onOpenAdvancedOptions: () => void;
  onEditDefaultPreferences: () => void;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div ref={rootRef} className={styles.writeChapterSplitButton}>
      <button
        type="button"
        className={styles.writeChapterSplitMain}
        disabled={disabled}
        aria-label="写下一章"
        onClick={onWriteChapter}
      >
        写下一章
      </button>
      <button
        type="button"
        className={styles.writeChapterSplitToggle}
        disabled={disabled}
        aria-label="更多写作选项"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((current) => !current)}
      >
        ⌄
      </button>
      {menuOpen ? (
        <div id={menuId} className={styles.writeChapterSplitMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onWriteChapter();
            }}
          >
            按默认偏好写下一章
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onOpenAdvancedOptions();
            }}
          >
            本章高级选项…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onEditDefaultPreferences();
            }}
          >
            编辑默认写作偏好…
          </button>
        </div>
      ) : null}
    </div>
  );
}

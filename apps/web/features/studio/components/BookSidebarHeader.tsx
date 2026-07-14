"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../studio.module.css";

export function BookSidebarHeader({
  manageMode,
  showArchived,
  onCreateBook,
  onToggleSearch,
  onToggleArchived,
  onEnterManageMode,
  onExitManageMode,
}: {
  manageMode: boolean;
  showArchived: boolean;
  onCreateBook: () => void;
  onToggleSearch: () => void;
  onToggleArchived: () => void;
  onEnterManageMode: () => void;
  onExitManageMode: () => void;
}) {
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
    <div ref={rootRef} className={styles.bookSidebarHeader}>
      <span className={styles.bookSidebarHeaderTitle}>书籍</span>
      <div className={styles.bookSidebarHeaderActions}>
        <button type="button" onClick={onCreateBook}>
          + 新建书籍
        </button>
        <button
          type="button"
          className={styles.bookSidebarIconButton}
          aria-label="搜索书籍"
          title="搜索书籍"
          onClick={onToggleSearch}
        >
          ⌕
        </button>
        <button
          type="button"
          className={styles.bookSidebarIconButton}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="更多书籍区操作"
          title="更多书籍区操作"
          onClick={() => setMenuOpen((current) => !current)}
        >
          ⋯
        </button>
        {menuOpen ? (
          <div className={styles.bookTreeMenu} role="menu" aria-label="书籍区操作">
            {manageMode ? (
              <button
                type="button"
                role="menuitem"
                className={styles.bookTreeMenuItem}
                onClick={() => {
                  closeMenu();
                  onExitManageMode();
                }}
              >
                完成管理
              </button>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.bookTreeMenuItem}
                  onClick={() => {
                    closeMenu();
                    onToggleArchived();
                  }}
                >
                  {showArchived ? "显示进行中书籍" : "已归档书籍"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.bookTreeMenuItem}
                  onClick={() => {
                    closeMenu();
                    onEnterManageMode();
                  }}
                >
                  管理书籍
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../studio.module.css";
import { SessionActionsMenu } from "./SessionActionsMenu";

export function SessionTreeItem({
  title,
  age,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  title: string;
  age: string;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
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
        event.stopPropagation();
        event.preventDefault();
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.sessionTreeRow} ${
        active ? styles.activeSessionButton : ""
      }`}
    >
      <button
        type="button"
        className={styles.sessionTreeRowMain}
        onClick={onSelect}
      >
        <span className={styles.sessionTreeRowTitle}>{title}</span>
        <span className={styles.bookTreeAge}>{age}</span>
      </button>
      <button
        type="button"
        className={styles.bookTreeMoreButton}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="更多会话操作"
        title="更多会话操作"
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((current) => !current);
        }}
      >
        ⋯
      </button>
      <SessionActionsMenu
        open={menuOpen}
        onClose={closeMenu}
        onRename={onRename}
        onDelete={onDelete}
        anchorLabel="更多会话操作"
      />
    </div>
  );
}

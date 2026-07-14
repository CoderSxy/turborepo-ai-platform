"use client";

import { useRef, useState } from "react";
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
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div
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
        ref={moreButtonRef}
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
        anchorRef={moreButtonRef}
        onRename={onRename}
        onDelete={onDelete}
        anchorLabel="更多会话操作"
      />
    </div>
  );
}

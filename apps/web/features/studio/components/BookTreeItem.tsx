"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../studio.module.css";
import type { NovelBookEntry } from "../state/studio-types";
import { BookActionsMenu } from "./BookActionsMenu";
import { SessionTreeItem } from "./SessionTreeItem";

export function BookTreeItem({
  book,
  expanded,
  active,
  manageMode,
  selected,
  canMoveUp,
  canMoveDown,
  activeSessionId,
  onToggleExpand,
  onSelectBook,
  onToggleSelect,
  onCreateSession,
  onSessionSelect,
  onRenameBook,
  onArchiveBook,
  onMoveBook,
  onDeleteBook,
  onRenameSession,
  onDeleteSession,
}: {
  book: NovelBookEntry;
  expanded: boolean;
  active: boolean;
  manageMode: boolean;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  activeSessionId: string;
  onToggleExpand: () => void;
  onSelectBook: () => void;
  onToggleSelect: () => void;
  onCreateSession: () => void;
  onSessionSelect: (sessionId: string) => void;
  onRenameBook: () => void;
  onArchiveBook: () => void;
  onMoveBook: (direction: -1 | 1) => void;
  onDeleteBook: () => void;
  onRenameSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (manageMode) {
      setMenuOpen(false);
    }
  }, [manageMode]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <section className={styles.bookListGroup}>
      <div
        className={`${styles.bookTreeRow} ${
          active ? styles.bookTreeRowActive : ""
        }`}
      >
        {manageMode ? (
          <label className={styles.bookSelectBox}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
            />
            <span>选择</span>
          </label>
        ) : null}
        <button
          type="button"
          className={styles.bookTreeExpandButton}
          aria-expanded={expanded}
          aria-label={expanded ? "收起书籍" : "展开书籍"}
          title={expanded ? "收起书籍" : "展开书籍"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className={styles.bookTreeFolderGlyph} aria-hidden="true">
          📁
        </span>
        <button
          type="button"
          className={styles.bookTreeTitle}
          onClick={onSelectBook}
        >
          {book.title}
        </button>
        {!manageMode ? (
          <>
            <button
              ref={moreButtonRef}
              type="button"
              className={styles.bookTreeMoreButton}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="更多书籍操作"
              title="更多书籍操作"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((current) => !current);
              }}
            >
              ⋯
            </button>
            <BookActionsMenu
              open={menuOpen}
              onClose={closeMenu}
              anchorRef={moreButtonRef}
              archived={book.archived}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onRename={onRenameBook}
              onArchive={onArchiveBook}
              onMoveUp={() => onMoveBook(-1)}
              onMoveDown={() => onMoveBook(1)}
              onDelete={onDeleteBook}
            />
          </>
        ) : null}
      </div>
      {expanded ? (
        <div className={styles.sessionList}>
          {book.sessions.map((session) => (
            <SessionTreeItem
              key={session.id}
              title={session.title}
              age={session.age}
              active={activeSessionId === session.id}
              onSelect={() => onSessionSelect(session.id)}
              onRename={() => onRenameSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
          <button
            type="button"
            className={styles.newSessionButton}
            onClick={onCreateSession}
          >
            + 新建会话
          </button>
        </div>
      ) : null}
    </section>
  );
}

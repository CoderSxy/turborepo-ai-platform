"use client";

import { useEffect, useState, type RefObject } from "react";
import styles from "../studio.module.css";
import type { NovelBookEntry } from "../state/studio-types";
import { BookSidebarHeader } from "./BookSidebarHeader";
import { BookTreeItem } from "./BookTreeItem";
import { ensureExpanded, toggleExpanded } from "./book-tree-expand";

export function NovelBookList({
  books,
  activeBookId,
  activeSessionId,
  searchQuery,
  searchOpen,
  onSearchOpenChange,
  manageMode,
  onManageModeChange,
  selectedBookIds,
  showArchived,
  totalBooks: _totalBooks,
  searchInputRef,
  onBulkArchive,
  onBulkDelete,
  onBulkRestore,
  onClearSelection,
  onCreateBook,
  onCreateSession,
  onArchiveBook,
  onBookSelect,
  onDeleteBook,
  onDeleteSession,
  onMoveBook,
  onRenameBook,
  onRenameSession,
  onSelectAllVisible,
  onSelectBook,
  onSearchQueryChange,
  onSessionSelect,
  onShowArchivedChange,
}: {
  books: NovelBookEntry[];
  activeBookId: string;
  activeSessionId: string;
  searchQuery: string;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  manageMode: boolean;
  onManageModeChange: (next: boolean) => void;
  selectedBookIds: string[];
  showArchived: boolean;
  totalBooks: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onBulkRestore: () => void;
  onClearSelection: () => void;
  onCreateBook: () => void;
  onCreateSession: (bookId: string) => void;
  onArchiveBook: (bookId: string) => void;
  onBookSelect: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onDeleteSession: (bookId: string, sessionId: string) => void;
  onMoveBook: (bookId: string, direction: -1 | 1) => void;
  onRenameBook: (bookId: string) => void;
  onRenameSession: (sessionId: string) => void;
  onSelectAllVisible: () => void;
  onSelectBook: (bookId: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSessionSelect: (bookId: string, sessionId: string) => void;
  onShowArchivedChange: (value: boolean) => void;
}) {
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(() =>
    activeBookId ? new Set([activeBookId]) : new Set(),
  );

  const selectedCount = selectedBookIds.length;
  const visibleAllSelected =
    books.length > 0 &&
    books.every((book) => selectedBookIds.includes(book.id));

  useEffect(() => {
    if (!activeBookId) return;
    setExpandedBookIds((current) => ensureExpanded(current, activeBookId));
  }, [activeBookId]);

  function openSearch() {
    onSearchOpenChange(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function handleSelectBook(bookId: string) {
    setExpandedBookIds((current) => ensureExpanded(current, bookId));
    onBookSelect(bookId);
  }

  function handleToggleExpand(bookId: string) {
    setExpandedBookIds((current) => toggleExpanded(current, bookId));
  }

  function handleSessionSelect(bookId: string, sessionId: string) {
    setExpandedBookIds((current) => ensureExpanded(current, bookId));
    onSessionSelect(bookId, sessionId);
  }

  function handleCreateSession(bookId: string) {
    setExpandedBookIds((current) => ensureExpanded(current, bookId));
    onCreateSession(bookId);
  }

  function exitManageMode() {
    onManageModeChange(false);
  }

  return (
    <aside className={styles.novelBookList}>
      <BookSidebarHeader
        manageMode={manageMode}
        showArchived={showArchived}
        onCreateBook={onCreateBook}
        onToggleSearch={openSearch}
        onToggleArchived={() => onShowArchivedChange(!showArchived)}
        onEnterManageMode={() => onManageModeChange(true)}
        onExitManageMode={exitManageMode}
      />
      {searchOpen ? (
        <div className={styles.bookTreeSearchRow}>
          <input
            ref={searchInputRef}
            value={searchQuery}
            placeholder="搜索书名、题材或设定"
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          <button
            type="button"
            className={styles.bookSidebarIconButton}
            aria-label="关闭搜索"
            title="关闭搜索"
            onClick={() => {
              onSearchOpenChange(false);
              onSearchQueryChange("");
            }}
          >
            ✕
          </button>
        </div>
      ) : null}
      {manageMode && selectedCount > 0 ? (
        <div className={styles.bulkActionBar}>
          <strong>已选 {selectedCount}</strong>
          <button type="button" onClick={onSelectAllVisible}>
            {visibleAllSelected ? "取消全选" : "全选"}
          </button>
          {showArchived ? (
            <button type="button" onClick={onBulkRestore}>
              还原
            </button>
          ) : (
            <button type="button" onClick={onBulkArchive}>
              归档
            </button>
          )}
          <button type="button" onClick={onBulkDelete}>
            删除
          </button>
          <button type="button" onClick={onClearSelection}>
            取消
          </button>
          <button type="button" onClick={exitManageMode}>
            完成管理
          </button>
        </div>
      ) : null}
      <div className={styles.bookListBody}>
        {books.length === 0 ? (
          <div className={styles.emptyBookList}>
            <strong>{searchQuery ? "没有匹配的书籍" : "还没有书籍"}</strong>
            {searchQuery ? (
              <>
                <span>换一个关键词，或者清空搜索条件。</span>
                <button type="button" onClick={() => onSearchQueryChange("")}>
                  清空搜索
                </button>
              </>
            ) : (
              <button type="button" onClick={onCreateBook}>
                新建书籍
              </button>
            )}
          </div>
        ) : (
          books.map((book, index) => (
            <BookTreeItem
              key={book.id}
              book={book}
              expanded={expandedBookIds.has(book.id)}
              active={activeBookId === book.id}
              manageMode={manageMode}
              selected={selectedBookIds.includes(book.id)}
              canMoveUp={index > 0}
              canMoveDown={index < books.length - 1}
              activeSessionId={activeSessionId}
              onToggleExpand={() => handleToggleExpand(book.id)}
              onSelectBook={() => handleSelectBook(book.id)}
              onToggleSelect={() => onSelectBook(book.id)}
              onCreateSession={() => handleCreateSession(book.id)}
              onSessionSelect={(sessionId) =>
                handleSessionSelect(book.id, sessionId)
              }
              onRenameBook={() => onRenameBook(book.id)}
              onArchiveBook={() => onArchiveBook(book.id)}
              onMoveBook={(direction) => onMoveBook(book.id, direction)}
              onDeleteBook={() => onDeleteBook(book.id)}
              onRenameSession={onRenameSession}
              onDeleteSession={(sessionId) =>
                onDeleteSession(book.id, sessionId)
              }
            />
          ))
        )}
      </div>
    </aside>
  );
}

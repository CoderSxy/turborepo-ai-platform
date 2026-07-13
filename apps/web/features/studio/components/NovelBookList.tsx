"use client";

import type { RefObject } from "react";
import styles from "../studio.module.css";
import type { NovelBookEntry } from "../state/studio-types";

export function NovelBookList({
  books,
  activeBookId,
  activeSessionId,
  searchQuery,
  selectedBookIds,
  showArchived,
  totalBooks,
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
  const selectedCount = selectedBookIds.length;
  const visibleSelected =
    books.length > 0 && books.every((book) => selectedBookIds.includes(book.id));

  return (
    <aside className={styles.novelBookList}>
      <div className={styles.bookListHeader}>
        <span>书籍</span>
        <button onClick={onCreateBook}>+ 新建书籍</button>
      </div>
      <div className={styles.bookListFilters}>
        <input
          ref={searchInputRef}
          value={searchQuery}
          placeholder='搜索书名、题材或设定'
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <div>
          <button onClick={() => onShowArchivedChange(!showArchived)}>
            {showArchived ? "显示进行中" : "显示归档"} · {totalBooks}
          </button>
          <button onClick={onSelectAllVisible}>
            {visibleSelected ? "取消全选" : "全选当前"}
          </button>
        </div>
        <p>/ 搜索 · N 新建 · Esc 取消选择</p>
      </div>

      {selectedCount > 0 ? (
        <div className={styles.bulkActionBar}>
          <strong>已选 {selectedCount}</strong>
          {showArchived ? (
            <button onClick={onBulkRestore}>还原</button>
          ) : (
            <button onClick={onBulkArchive}>归档</button>
          )}
          <button onClick={onBulkDelete}>删除</button>
          <button onClick={onClearSelection}>取消</button>
        </div>
      ) : null}

      <div className={styles.bookListBody}>
        {books.length === 0 ? (
          <div className={styles.emptyBookList}>
            <strong>{searchQuery ? "没有匹配的书籍" : "这里暂时没有书籍"}</strong>
            <span>
              {searchQuery
                ? "换一个关键词，或者清空搜索条件。"
                : "创建一本书后，会在这里管理会话、归档和导出。"}
            </span>
            <button onClick={searchQuery ? () => onSearchQueryChange("") : onCreateBook}>
              {searchQuery ? "清空搜索" : "新建书籍"}
            </button>
          </div>
        ) : null}
        {books.map((book) => (
          <section key={book.id} className={styles.bookListGroup}>
            <div
              className={`${styles.bookListItem} ${
                activeBookId === book.id ? styles.activeBookButton : ""
              }`}
            >
              <label className={styles.bookSelectBox}>
                <input
                  type='checkbox'
                  checked={selectedBookIds.includes(book.id)}
                  onChange={() => onSelectBook(book.id)}
                />
                <span>选择</span>
              </label>
              <button onClick={() => onBookSelect(book.id)}>
                <strong>{book.title}</strong>
                <span>{book.meta}</span>
                <em>
                  {book.sessions.length} 个会话
                  {book.archived ? " · 已归档" : ""}
                </em>
              </button>
              <div className={styles.bookActions}>
                <button title='上移' onClick={() => onMoveBook(book.id, -1)}>
                  ↑
                </button>
                <button title='下移' onClick={() => onMoveBook(book.id, 1)}>
                  ↓
                </button>
                <button title='重命名' onClick={() => onRenameBook(book.id)}>
                  改
                </button>
                <button title='归档' onClick={() => onArchiveBook(book.id)}>
                  {book.archived ? "还原" : "归档"}
                </button>
                <button title='删除' onClick={() => onDeleteBook(book.id)}>
                  删
                </button>
              </div>
            </div>
            {activeBookId === book.id ? (
              <div className={styles.sessionList}>
                {book.sessions.map((session) => (
                  <div
                    key={session.id}
                    className={
                      activeSessionId === session.id
                        ? styles.activeSessionButton
                        : ""
                    }
                  >
                    <button onClick={() => onSessionSelect(book.id, session.id)}>
                      <span>{session.title}</span>
                      <em>{session.summary} · {session.age}</em>
                    </button>
                    <div>
                      <button onClick={() => onRenameSession(session.id)}>改</button>
                      <button
                        onClick={() => onDeleteSession(book.id, session.id)}
                      >
                        删
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className={styles.newSessionButton}
                  onClick={() => onCreateSession(book.id)}
                >
                  + 新建会话
                </button>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </aside>
  );
}

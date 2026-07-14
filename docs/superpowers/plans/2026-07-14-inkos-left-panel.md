# InkOS Left Panel Book Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AI-studio book list into an InkOS-style lightweight tree: expand multiple books, progressive disclosure for search/archive/manage, hover `…` menus — without schema changes or the deferred “普通聊天” tree.

**Architecture:** Keep `NovelStudio` → `NovelBookList` wiring. Refactor `NovelBookList` in place and extract `BookSidebarHeader`, `BookTreeItem`, `SessionTreeItem`, `BookActionsMenu`, `SessionActionsMenu`. Local UI state: `expandedBookIds`, `searchOpen`, `manageMode`. Reuse existing archive/search/selection props from `NovelStudio`.

**Tech Stack:** React Client Components, CSS Modules (`studio.module.css`), Node `node:test` for pure helpers.

**Spec:** [2026-07-14-inkos-left-panel-design.md](../specs/2026-07-14-inkos-left-panel-design.md)

---

## File map

| Path | Responsibility |
|------|----------------|
| `apps/web/features/studio/components/book-tree-expand.ts` | Pure expand-set helpers (testable) |
| `apps/web/features/studio/components/book-tree-expand.test.ts` | Unit tests for expand helpers |
| `apps/web/features/studio/components/BookSidebarHeader.tsx` | Title row: 新建 / ⌕ / ⋯ |
| `apps/web/features/studio/components/BookActionsMenu.tsx` | Book overflow menu |
| `apps/web/features/studio/components/SessionActionsMenu.tsx` | Session overflow menu |
| `apps/web/features/studio/components/BookTreeItem.tsx` | Book row + optional sessions |
| `apps/web/features/studio/components/SessionTreeItem.tsx` | Session row |
| `apps/web/features/studio/components/NovelBookList.tsx` | Orchestrator (replace heavy default UI) |
| `apps/web/features/studio/components/NovelStudio.tsx` | Esc `/` search-open callback; keep book callbacks |
| `apps/web/features/studio/studio.module.css` | Compact tree + menu + manage-mode styles |
| `apps/web/package.json` | Register new test file in `test` script |

**Out of scope files:** `novel-store.ts` schema, right-panel, ChatComposer, tools panels.

---

## Task 1: Expand-set helpers (TDD)

**Files:**
- Create: `apps/web/features/studio/components/book-tree-expand.ts`
- Create: `apps/web/features/studio/components/book-tree-expand.test.ts`
- Modify: `apps/web/package.json` (`test` script)

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureExpanded,
  toggleExpanded,
} from "./book-tree-expand.ts";

describe("book-tree-expand", () => {
  it("ensureExpanded adds id without removing others", () => {
    const next = ensureExpanded(new Set(["a"]), "b");
    assert.equal(next.has("a"), true);
    assert.equal(next.has("b"), true);
  });

  it("toggleExpanded removes when present and adds when absent", () => {
    const removed = toggleExpanded(new Set(["a", "b"]), "a");
    assert.equal(removed.has("a"), false);
    assert.equal(removed.has("b"), true);
    const added = toggleExpanded(new Set(["b"]), "a");
    assert.equal(added.has("a"), true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
cd apps/web && node --test --experimental-strip-types features/studio/components/book-tree-expand.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` or missing export.

- [ ] **Step 3: Implement helpers**

```ts
export function ensureExpanded(
  expanded: ReadonlySet<string>,
  bookId: string,
): Set<string> {
  if (expanded.has(bookId)) {
    return new Set(expanded);
  }
  const next = new Set(expanded);
  next.add(bookId);
  return next;
}

export function toggleExpanded(
  expanded: ReadonlySet<string>,
  bookId: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(bookId)) {
    next.delete(bookId);
  } else {
    next.add(bookId);
  }
  return next;
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Append test path to `apps/web/package.json` `test` script** (same list style as right-panel tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/features/studio/components/book-tree-expand.ts \
  apps/web/features/studio/components/book-tree-expand.test.ts \
  apps/web/package.json
git commit -m "test: add book tree expand-set helpers"
```

---

## Task 2: Action menus (book + session)

**Files:**
- Create: `apps/web/features/studio/components/BookActionsMenu.tsx`
- Create: `apps/web/features/studio/components/SessionActionsMenu.tsx`
- Modify: `apps/web/features/studio/studio.module.css` (`.bookTreeMenu`, `.bookTreeMenuItem`, `.bookTreeMoreButton`)

- [ ] **Step 1: Implement `SessionActionsMenu`**

Props: `{ open, onClose, onRename, onDelete, anchorLabel? }`.  
Render when `open`: absolutely positioned panel with buttons「重命名」「删除」.  
On `Escape` while open, call `onClose`. Use `role="menu"` / `menuitem`.

- [ ] **Step 2: Implement `BookActionsMenu`**

Props:

```ts
{
  open: boolean;
  onClose: () => void;
  archived: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: () => void;
  onArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}
```

Items: 重命名 / 归档|还原 / 上移 / 下移 / 删除. Disable 上移/下移 when `canMove*` is false. Each action calls handler then `onClose`.

- [ ] **Step 3: CSS** — more button width reserved; hover/focus-visible/open shows opacity 1; menu `z-index` above list; danger style for delete optional via existing `.dangerTextButton`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(studio): add book/session overflow menus for left tree"
```

---

## Task 3: Tree row components

**Files:**
- Create: `apps/web/features/studio/components/SessionTreeItem.tsx`
- Create: `apps/web/features/studio/components/BookTreeItem.tsx`
- Create: `apps/web/features/studio/components/BookSidebarHeader.tsx`

- [ ] **Step 1: `SessionTreeItem`**

```tsx
// props sketch
{
  title: string;
  age: string;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}
```

Single row: title (ellipsis) + age. Local `menuOpen` + `SessionActionsMenu`. More button always in DOM (touch).

- [ ] **Step 2: `BookTreeItem`**

```tsx
{
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
}
```

Row structure:
- manageMode ? checkbox : null
- button arrow (`aria-expanded={expanded}`) → `onToggleExpand` (stopPropagation)
- folder glyph `📁`
- button book title → `onSelectBook`
- `BookActionsMenu` trigger (hidden when manageMode)

When `expanded`, render `SessionTreeItem` list + `+ 新建会话` button. **Do not render** book.meta, session count, or session.summary.

- [ ] **Step 3: `BookSidebarHeader`**

Props: `{ manageMode, onCreateBook, onToggleSearch, onOpenHeaderMenu }` with header menu items handled by parent OR internal menu for「已归档书籍」「管理书籍」「完成管理」.

Recommended: header owns a small menu:
- when !manageMode: 「已归档书籍」(toggle via callback), 「管理书籍」
- when manageMode: 「完成管理」

Also: `+ 新建书籍`, search toggle button (`aria-label="搜索书籍"`).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(studio): add book sidebar tree row components"
```

---

## Task 4: Rewrite `NovelBookList` (L1 + L2 orchestration)

**Files:**
- Modify: `apps/web/features/studio/components/NovelBookList.tsx` (full rewrite, keep export name + prop surface)
- Modify: `apps/web/features/studio/studio.module.css`

Keep **existing prop names** from current `NovelBookList` so `NovelStudio` compiles with minimal changes. Add optional:

```ts
searchOpen?: boolean;
onSearchOpenChange?: (open: boolean) => void;
```

If you prefer all search-open state local to the list, keep `searchOpen` local and have NovelStudio `/` focus via `searchInputRef` after calling a new `onRequestOpenSearch` — simplest: **local `searchOpen`**, and when `/` is pressed in NovelStudio, set a prop `searchOpenSignal` OR focus ref after parent sets `bookSearchQuery` — cleaner approach:

**Local state in NovelBookList:**
- `expandedBookIds` — init `activeBookId ? new Set([activeBookId]) : new Set()`
- `searchOpen` — boolean
- `manageMode` — boolean

**Reuse props:** `searchQuery`, `showArchived`, `selectedBookIds`, all action callbacks.

- [ ] **Step 1: Effects**

```ts
useEffect(() => {
  if (!activeBookId) return;
  setExpandedBookIds((current) => ensureExpanded(current, activeBookId));
}, [activeBookId]);
```

- [ ] **Step 2: Handlers**

```ts
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
  setManageMode(false);
  onClearSelection();
}
```

- [ ] **Step 3: Render structure**

```tsx
<aside className={styles.novelBookList}>
  <BookSidebarHeader ... />
  {searchOpen ? (
    <div className={styles.bookTreeSearchRow}>
      <input ref={searchInputRef} value={searchQuery} ... />
    </div>
  ) : null}
  {manageMode && selectedCount > 0 ? <div className={styles.bulkActionBar}>...</div> : null}
  <div className={styles.bookListBody}>
    {books.length === 0 ? empty state "还没有书籍" / "没有匹配的书籍" : null}
    {books.map((book, index) => (
      <BookTreeItem
        key={book.id}
        expanded={expandedBookIds.has(book.id)}
        canMoveUp={index > 0}
        canMoveDown={index < books.length - 1}
        ...
      />
    ))}
  </div>
</aside>
```

**Remove from default DOM:** always-visible filters block, keyboard tip paragraph, permanent checkboxes, permanent bookActions column, meta/session count.

- [ ] **Step 4: When opening search**, `setSearchOpen(true)` then `requestAnimationFrame(() => searchInputRef.current?.focus())`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(studio): rebuild NovelBookList as expandable book tree"
```

---

## Task 5: Lift search/manage open state + Esc chain in NovelStudio

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/features/studio/components/NovelBookList.tsx` (accept lifted props)

**Decision (locked):** lift `searchOpen` and `manageMode` to `NovelStudio` so one `keydown` handler owns Esc order. Keep `expandedBookIds` local to the list.

- [ ] **Step 1: Add state in NovelStudio**

```ts
const [bookSearchOpen, setBookSearchOpen] = useState(false);
const [bookManageMode, setBookManageMode] = useState(false);
```

Pass into `NovelBookList`:

```tsx
searchOpen={bookSearchOpen}
onSearchOpenChange={setBookSearchOpen}
manageMode={bookManageMode}
onManageModeChange={(next) => {
  setBookManageMode(next);
  if (!next) {
    setSelectedBookIds([]);
  }
}}
```

Remove local `searchOpen` / `manageMode` from the list if introduced in Task 4.

- [ ] **Step 2: Update `/` handler**

```ts
if (event.key === "/") {
  event.preventDefault();
  setBookSearchOpen(true);
  requestAnimationFrame(() => bookSearchInputRef.current?.focus());
  return;
}
```

- [ ] **Step 3: Replace Esc handling (after dialog branch)**

```ts
if (event.key === "Escape") {
  if (bookSearchOpen) {
    event.preventDefault();
    setBookSearchOpen(false);
    setBookSearchQuery("");
    return;
  }
  if (bookManageMode) {
    event.preventDefault();
    setBookManageMode(false);
    setSelectedBookIds([]);
    return;
  }
  if (selectedBookIds.length > 0) {
    event.preventDefault();
    setSelectedBookIds([]);
  }
  return;
}
```

Do not clear Composer input. Keep `isTypingTarget` guard for `/` and `N` only. Menus close via their own Esc listeners and should `stopPropagation` when they handle the event.

- [ ] **Step 4: Run check-types**

```bash
pnpm --filter web run check-types
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/studio/components/NovelStudio.tsx \
  apps/web/features/studio/components/NovelBookList.tsx
git commit -m "feat(studio): wire search/manage open state and Esc chain for book tree"
```

---

## Task 6: CSS density (L4 visual)

**Files:**
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: Add/adjust classes**

- `.bookTreeRow`, `.bookTreeRowActive`, `.sessionTreeRow`, `.sessionTreeRowActive`
- `.bookTreeTitle` ellipsis; `.bookTreeAge` muted
- `.bookTreeSearchRow` compact
- Hide meta styles from default book button layout
- Indent session list under book (`padding-left`)
- Ensure `.bookTreeMoreButton` doesn’t shift layout (`opacity` / `visibility`)

Keep existing teal palette (`#14342f`, `#dbe4e7`, etc.).

- [ ] **Step 2: Manual visual check list** (note in commit body): default view has no filter strip; expand two books; hover menus.

- [ ] **Step 3: Commit**

```bash
git commit -m "style(studio): compact InkOS-like book tree density"
```

---

## Task 7: Verify + mark acceptance

**Files:**
- Modify: `docs/INKOS_STUDIO_LEFT_PANEL_ALIGNMENT.md` — check off items that apply (optional, only if file tracked)
- Modify: `docs/superpowers/specs/2026-07-14-inkos-left-panel-design.md` §10 checkboxes

- [ ] **Step 1: Run full verification**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
```

Expected: all green.

- [ ] **Step 2: Manual QA**

1. Expand book A and B together  
2. Click title switches active book; arrow only toggles  
3. Search via ⌕ and `/`; Esc closes search  
4. Header ⋯ → 管理书籍 → multi-select archive/delete → 完成管理  
5. Header ⋯ → 已归档书籍 shows only archived  
6. Book/session rename/delete still confirm via existing dialogs  

- [ ] **Step 3: Commit docs checkbox updates if any**

```bash
git commit -m "docs: mark left panel book-tree acceptance items done"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `expandedBookIds` + ensure on select | 1, 4 |
| Tree components / header | 3, 4 |
| Menus progressive disclosure | 2, 4 |
| Search / archive / manage mode | 4, 5 |
| Keyboard `/` `N` Esc | 5 |
| CSS density + a11y hooks | 2, 6 |
| No general chat / no schema | (omitted) |
| Unit tests + verify commands | 1, 7 |

---

## Handoff

Plan saved to `docs/superpowers/plans/2026-07-14-inkos-left-panel.md`.

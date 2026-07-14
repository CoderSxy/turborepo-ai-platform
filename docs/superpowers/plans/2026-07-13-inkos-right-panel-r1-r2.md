# InkOS Right Panel R1+R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the novel studio right panel to InkOS-style IA (5 main cards + more sheet) and add detail views for chapters and core files, keeping existing `studio.module.css` theme.

**Architecture:** `BookContextPanel` orchestrates main cards and `panelView` routing; `NovelBookPanel` keeps business logic initially and passes `workspaceSections` children into more sheet; `ChapterDetailView` receives extracted JSX/state from `NovelBookPanel` in R2.

**Tech Stack:** React, CSS Modules (`studio.module.css`), existing novel-store helpers.

**Spec:** [2026-07-13-inkos-right-panel-r1-r2-design.md](../specs/2026-07-13-inkos-right-panel-r1-r2-design.md)

---

## Phase 1 — R1 Main Panel

### Task 1: Foundation (`SidebarCard`, `core-file-keys`, summaries)

**Files:**
- Create: `apps/web/features/studio/components/right-panel/SidebarCard.tsx`
- Create: `apps/web/features/studio/components/right-panel/core-file-keys.ts`
- Create: `apps/web/features/studio/components/right-panel/right-panel-summaries.ts`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] Add `SidebarCard` with localStorage + collapsed `summary` slot
- [ ] Add `core-file-keys.ts` with 4 asset field mappings
- [ ] Add summary parsers (character matrix, world excerpt, protagonist)
- [ ] Add `.sidebarCardSummary`, `.compactChapterListScroll`, `.bookSummaryHeader`, `.workspaceMoreFooter`

### Task 2: Section components

**Files:**
- Create: `ChaptersSection.tsx`, `CharactersSection.tsx`, `CoreFilesSection.tsx`, `WorldSummarySection.tsx`, `CharacterSummarySection.tsx`, `BookSummaryHeader.tsx`

- [ ] Each section uses `SidebarCard` + existing CSS classes
- [ ] Chapters: compact list max-h 220px, select +「打开」button
- [ ] Wire summary text from `right-panel-summaries.ts`

### Task 3: `WorkspaceMoreSheet` + `BookContextPanel`

**Files:**
- Create: `WorkspaceMoreSheet.tsx`, `BookContextPanel.tsx`
- Modify: `NovelBookPanel.tsx`

- [ ] `WorkspaceMoreSheet` mirrors `WriteChapterOptionsSheet` overlay pattern
- [ ] `BookContextPanel` renders header + 5 sections + more button; accepts `workspaceSections` children
- [ ] `NovelBookPanel` moves低频 sections into `workspaceSections` prop; removes them from main aside

### Task 4: Verify R1

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

---

## Phase 2 — R2 Detail Views

### Task 5: Detail shell + core file view

**Files:**
- Create: `detail/BookContextDetailView.tsx`, `detail/CoreFileDetailView.tsx`

- [ ] `panelView` / `detailTarget` state in `BookContextPanel`
- [ ] Scroll position save/restore on return
- [ ] `CoreFileDetailView`: read/edit markdown via `onProjectChange`

### Task 6: Extract `ChapterDetailView`

**Files:**
- Create: `detail/ChapterDetailView.tsx`
- Modify: `NovelBookPanel.tsx`, `BookContextPanel.tsx`

- [ ] Move chapter editor state, effects, handlers from `NovelBookPanel`
- [ ] Remove `chapter-detail` from `workspaceSections`
- [ ] `ChaptersSection`「打开」→ detail route

### Task 7: Re-export + verify R2

**Files:**
- Modify: `NovelBookPanel.tsx` → re-export `BookContextPanel`

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

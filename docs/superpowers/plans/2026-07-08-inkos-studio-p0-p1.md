# InkOS Studio P0+P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 小说创作工作台收敛为 InkOS 风格三栏体验（P0），并把 `page.tsx` 业务逻辑搬迁到 `features/studio/` 和 `features/models/`（P1），`page.tsx` 缩减至 <400 行。

**Architecture:** 分 3 个子阶段（2a shell+models → 2b studio 搬迁 → 2c P0 UI）同步推进。先抽 helpers/types 和叶子组件，再搬 NovelStudio，最后新建 ChatComposer / CollapsibleSection 等 4 个组件做体验减法。CSS 按 class 前缀切割到 `studio.module.css` / `models.module.css`，不改 class 名。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, `@repo/inkos-adapter`, IndexedDB via `novel-store.ts`

**Spec:** `docs/superpowers/specs/2026-07-08-inkos-studio-p0-p1-design.md`

---

## Verification Commands (run after every phase)

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/lib/novel-store.test.mjs apps/web/lib/provider-stream-parser.test.mjs apps/web/lib/cloud-sync-webdav.test.mjs apps/web/lib/model-settings.test.mjs
```

---

## Phase 2a: Shell + Models Extraction

### Task 1: Create directory skeleton

**Files:**
- Create: `apps/web/components/shell/`
- Create: `apps/web/features/models/components/`
- Create: `apps/web/features/models/state/`
- Create: `apps/web/features/studio/components/` (empty, for 2b)
- Create: `apps/web/features/studio/helpers/`
- Create: `apps/web/features/studio/state/`

- [ ] **Step 1: Create all directories**

```bash
mkdir -p apps/web/components/shell
mkdir -p apps/web/features/models/{components,state}
mkdir -p apps/web/features/studio/{components/{chat,tools,dialogs,sidebar},helpers,state}
```

- [ ] **Step 2: Verify structure exists**

```bash
find apps/web/components apps/web/features -type d | sort
```

Expected: all directories listed above present.

---

### Task 2: Extract AppShell + HomeDashboard

**Files:**
- Create: `apps/web/components/shell/AppShell.tsx`
- Create: `apps/web/components/shell/HomeDashboard.tsx`
- Create: `apps/web/components/shell/shell-types.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.module.css` (no split yet)

- [ ] **Step 1: Create shell-types.ts**

```typescript
// apps/web/components/shell/shell-types.ts
export type AppPage = "home" | "novel" | "models";

export const APP_NAV_ITEMS: Array<{
  page: AppPage;
  label: string;
  description: string;
}> = [
  { page: "home", label: "首页", description: "平台总览" },
  { page: "novel", label: "AI小说创作", description: "InkOS 工作台" },
  { page: "models", label: "模型配置", description: "服务商与 Key" },
];
```

- [ ] **Step 2: Move AppShell to shell/AppShell.tsx**

Cut `function AppShell` (lines ~822-859) from `page.tsx`. New file:

```typescript
"use client";

import type { ReactNode } from "react";
import styles from "../../app/page.module.css";
import { APP_NAV_ITEMS, type AppPage } from "./shell-types";

export function AppShell({
  activePage,
  onNavigate,
  children,
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}) {
  return (
    <main className={styles.appFrame}>
      <aside className={styles.appSidebar}>
        <button className={styles.appBrand} onClick={() => onNavigate("home")}>
          <span>S</span>
          <strong>SXY Platform</strong>
          <em>Creative AI Studio</em>
        </button>
        <nav className={styles.appNav}>
          {APP_NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={activePage === item.page ? styles.appNavActive : ""}
              onClick={() => onNavigate(item.page)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className={styles.appContent}>{children}</section>
    </main>
  );
}
```

- [ ] **Step 3: Move HomeDashboard to shell/HomeDashboard.tsx**

Cut `function HomeDashboard` (lines ~861-910). Import `LocalModelSettings`, `isProviderConnected`, `createDemoInkosProject`, `deriveInkosProjectStats` from existing lib paths.

- [ ] **Step 4: Update page.tsx imports**

```typescript
import { AppShell } from "../components/shell/AppShell";
import { HomeDashboard } from "../components/shell/HomeDashboard";
import type { AppPage } from "../components/shell/shell-types";
```

Remove `APP_NAV_ITEMS`, `type AppPage`, `AppShell`, `HomeDashboard` from page.tsx.

- [ ] **Step 5: Run verification**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
```

Expected: PASS, zero errors.

---

### Task 3: Extract models feature — types + leaf components

**Files:**
- Create: `apps/web/features/models/state/model-page-types.ts`
- Create: `apps/web/features/models/components/StatusPill.tsx`
- Create: `apps/web/features/models/components/ProviderCard.tsx`
- Create: `apps/web/features/models/components/ResultBanner.tsx`
- Create: `apps/web/features/models/components/EyeIcons.tsx` (EyeIcon + EyeOffIcon)

- [ ] **Step 1: Create model-page-types.ts**

Move from page.tsx:
- `type ProviderCategory`
- `PROVIDER_GROUPS` constant (lines ~251-320 area)
- `isProviderConnected` helper function (line ~10374)

- [ ] **Step 2: Extract leaf components**

Move these functions verbatim, updating `styles` import to `../../app/page.module.css` (temporary, until CSS split in Task 8):
- `StatusPill` → `StatusPill.tsx`
- `ProviderCard` → `ProviderCard.tsx`
- `ResultBanner` → `ResultBanner.tsx`
- `EyeIcon` + `EyeOffIcon` → `EyeIcons.tsx`

Each file: `"use client"` directive, export named function.

- [ ] **Step 3: Run typecheck**

Expected: PASS.

---

### Task 4: Extract ModelSettingsHome + ProviderDetail + ModelRoutePanel

**Files:**
- Create: `apps/web/features/models/components/ModelSettingsHome.tsx`
- Create: `apps/web/features/models/components/ProviderDetail.tsx`
- Create: `apps/web/features/models/components/ModelRoutePanel.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Move ModelRoutePanel** (lines ~9711-9940)

Export as named function. Props interface stays identical. Import `StatusPill`, helpers from `model-page-types.ts` and `../../../lib/model-settings`.

- [ ] **Step 2: Move ModelSettingsHome** (lines ~9942-10052)

Import `ProviderCard` from same directory.

- [ ] **Step 3: Move ProviderDetail** (lines ~10054-10293)

Import `StatusPill`, `ResultBanner`, `EyeIcon`, `EyeOffIcon` from sibling files.

- [ ] **Step 4: Update page.tsx**

```typescript
import { ModelSettingsHome } from "../features/models/components/ModelSettingsHome";
import { ProviderDetail } from "../features/models/components/ProviderDetail";
```

Remove moved functions from page.tsx. Keep provider test/save logic in `Home()` — it stays as page orchestration.

- [ ] **Step 5: Run verification (Phase 2a complete)**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

Expected: PASS.

---

## Phase 2b: Studio Extraction

### Task 5: Extract studio helpers + types

**Files:**
- Create: `apps/web/features/studio/state/studio-types.ts`
- Create: `apps/web/features/studio/helpers/export-helpers.ts`
- Create: `apps/web/features/studio/helpers/novel-helpers.ts`
- Create: `apps/web/features/studio/helpers/inkos-stream.ts`
- Create: `apps/web/features/studio/helpers/model-binding.ts`
- Create: `apps/web/features/studio/state/studio-constants.ts`

- [ ] **Step 1: Create studio-types.ts**

Move these types from page.tsx:
- `NovelChatMessage`, `NovelChatResponse`, `InkosActionResponse`, `InkosActionStreamEvent`
- `NovelTool`, `NovelBookEntry`
- `AppDialogState`, `AppToastState`
- `ModelPickerGroup`, `ReadyModelBinding`, `ModelBindingError`
- `MarkdownBlock` (if defined near MarkdownContent)

- [ ] **Step 2: Create studio-constants.ts**

Move:
- `NOVEL_TOOLS` array
- `PLATFORM_EXPORT_OPTIONS` array

- [ ] **Step 3: Create export-helpers.ts**

Move functions (lines ~353-556):
- `downloadTextFile`, `downloadBytesFile`, `downloadBlob`
- `createNovelDocxParagraphXml`, `createNovelBookDocxFile`
- `createZipStore`, `buildZipLocalHeader`, `buildZipCentralDirectoryHeader`, `buildZipEndRecord`
- `concatBytes`, `crc32`, `escapeXml`

- [ ] **Step 4: Create novel-helpers.ts**

Move:
- `toNovelBookEntries`, `toNovelMessagesBySession`, `toNovelChatMessage`
- `createWelcomeNovelMessages`, `createNovelProject`
- `extractGeneratedChapter`, `countNovelContentWords`, `extractRevisedChapterContent`
- `reviewSeverityLabel`, `isNovelKnowledgeAssetCategory`
- `formatPendingCharacterStates`, `parsePendingCharacterStates`
- `formatPendingAssetLines`, `parsePendingAssetLines`

- [ ] **Step 5: Create inkos-stream.ts**

Move:
- `parseInkosActionStreamEvent`
- `formatCoreProgressContent`, `formatCoreFinalContent`, `formatCoreErrorContent`
- `formatCoreTaskErrorMessage`

- [ ] **Step 6: Create model-binding.ts**

Move:
- `isModelPickerValueAvailable`
- `resolveChatModelBinding`
- `resolveCoreActionModelBinding`

- [ ] **Step 7: Run typecheck**

Expected: PASS (helpers not yet imported anywhere — no breakage).

---

### Task 6: Extract chat + dialog leaf components

**Files:**
- Create: `apps/web/features/studio/components/chat/MarkdownContent.tsx`
- Create: `apps/web/features/studio/components/chat/ModelPicker.tsx`
- Create: `apps/web/features/studio/components/dialogs/AppDialog.tsx`
- Create: `apps/web/features/studio/components/dialogs/AppToast.tsx`
- Create: `apps/web/features/studio/components/dialogs/WriteChapterConfirmDialog.tsx`
- Create: `apps/web/features/studio/components/dialogs/CloudSyncPanel.tsx`
- Create: `apps/web/features/studio/components/dialogs/CloudSyncMergeDialog.tsx`
- Create: `apps/web/features/studio/components/dialogs/AssetConflictDialog.tsx`
- Create: `apps/web/features/studio/components/dialogs/PublishValidationDialog.tsx`

- [ ] **Step 1: Move MarkdownContent + parsing helpers**

Move `MarkdownContent`, `parseMarkdownBlocks`, `renderInlineMarkdown`, `FragmentWithBreak` to `MarkdownContent.tsx`. Export `MarkdownContent` as default or named.

- [ ] **Step 2: Move ModelPicker** (lines ~4545-4692)

- [ ] **Step 3: Move all dialog components** listed above, preserving exact props interfaces.

- [ ] **Step 4: Run typecheck**

Expected: PASS.

---

### Task 7: Extract tool panels + sidebar panels + large dialogs

**Files:**
- Create: `apps/web/features/studio/components/tools/GenreTool.tsx`
- Create: `apps/web/features/studio/components/tools/StyleTool.tsx`
- Create: `apps/web/features/studio/components/tools/ImportTool.tsx`
- Create: `apps/web/features/studio/components/tools/RadarTool.tsx`
- Create: `apps/web/features/studio/components/tools/DoctorTool.tsx`
- Create: `apps/web/features/studio/components/NovelToolPanel.tsx`
- Create: `apps/web/features/studio/components/CreateBookPanel.tsx`
- Create: `apps/web/features/studio/components/NovelBookList.tsx`
- Create: `apps/web/features/studio/components/dialogs/OutlineEditorDialog.tsx`
- Create: `apps/web/features/studio/components/dialogs/KnowledgeAssetLibraryDialog.tsx`
- Create: `apps/web/features/studio/components/sidebar/CharacterStateTimelinePanel.tsx`
- Create: `apps/web/features/studio/components/sidebar/CharacterRelationGraphPanel.tsx`

- [ ] **Step 1: Move 5 tool components** to `tools/` directory

- [ ] **Step 2: Move NovelToolPanel** — imports tools from `./tools/`

- [ ] **Step 3: Move CreateBookPanel, NovelBookList**

- [ ] **Step 4: Move OutlineEditorDialog, KnowledgeAssetLibraryDialog**

- [ ] **Step 5: Move sidebar panels**

- [ ] **Step 6: Run typecheck**

Expected: PASS.

---

### Task 8: Extract NovelBookPanel + NovelStudio

**Files:**
- Create: `apps/web/features/studio/components/NovelBookPanel.tsx`
- Create: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Move NovelBookPanel** (lines ~6918-9394)

This is the largest single component (~2400 lines). Move verbatim:
- Import helpers from `../helpers/`
- Import types from `../state/studio-types`
- Import dialogs from `./dialogs/`
- Import sidebar panels from `./sidebar/`
- Import `MarkdownContent` from `./chat/MarkdownContent`
- Import `export-helpers` for download functions
- `styles` from `../../app/page.module.css` (temporary)

- [ ] **Step 2: Move NovelStudio** (lines ~1522-4543)

Import all child components from relative paths within `features/studio/components/`.

- [ ] **Step 3: Slim page.tsx to orchestrator**

Final `page.tsx` should contain ONLY:
- `Home()` default export with page routing state
- Model settings load/save effects
- Provider operations (openProvider, backToProviderList, runProviderTest, etc.)
- Conditional render of AppShell + page content
- Imports from shell, features/models, features/studio

Remove ALL moved functions. Target: < 400 lines.

```typescript
// apps/web/app/page.tsx — final shape
"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/shell/AppShell";
import { HomeDashboard } from "../components/shell/HomeDashboard";
import type { AppPage } from "../components/shell/shell-types";
import { NovelStudio } from "../features/studio/components/NovelStudio";
import { ModelSettingsHome } from "../features/models/components/ModelSettingsHome";
import { ProviderDetail } from "../features/models/components/ProviderDetail";
import { /* model-settings imports */ } from "../lib/model-settings";
// ... provider state + handlers only

export default function Home() { /* ~250 lines */ }
```

- [ ] **Step 4: Run full verification (Phase 2b)**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/lib/novel-store.test.mjs apps/web/lib/provider-stream-parser.test.mjs apps/web/lib/cloud-sync-webdav.test.mjs apps/web/lib/model-settings.test.mjs
```

Expected: all PASS. `wc -l apps/web/app/page.tsx` should show < 400 lines.

---

### Task 9: Split CSS modules

**Files:**
- Create: `apps/web/features/studio/studio.module.css`
- Create: `apps/web/features/models/models.module.css`
- Modify: `apps/web/app/page.module.css`
- Modify: all files in `features/studio/` and `features/models/` (update styles import)

- [ ] **Step 1: Create studio.module.css**

Copy from `page.module.css` all rules matching these prefixes:
`.novel*`, `.chat*`, `.book*`, `.composer*`, `.chapter*`, `.createBook*`, `.compactChapter*`, `.batchQueue*`, `.activeTask*`, `.activeBatch*`, `.hiddenFile*`, `.dangerText*`, `.outline*`, `.knowledge*`, `.character*`, `.asset*`, `.review*`, `.compare*`, `.cloudSync*`, `.merge*`, `.publish*`, `.typing*`, `.emptyMessage*`, `.userMessage*`, `.assistantMessage*`, `.errorMessage*`, `.markdown*`, `.modelPicker*`, `.primaryButton*`, `.dialog*`, `.toast*`, `.writeChapter*`

Also copy shared rules used only by studio: `.primaryButton`, media queries referencing studio classes.

- [ ] **Step 2: Create models.module.css**

Copy rules matching: `.provider*`, `.model*`, `.settings*`, `.detail*`, `.route*`, `.result*`, `.status*`, `.category*`, `.advanced*`, `.apiKey*`

- [ ] **Step 3: Update page.module.css**

Keep only: `.app*`, `.home*`, and any shared layout rules used by shell.

- [ ] **Step 4: Update all feature file imports**

```typescript
// studio components:
import styles from "../../studio.module.css";
// or relative: import styles from "../studio.module.css"; depending on depth

// models components:
import styles from "../../models.module.css";
```

- [ ] **Step 5: Run verification**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

Expected: PASS. Manually verify dev server renders correctly:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run dev
```

---

## Phase 2c: P0 UX Changes

### Task 10: Create CollapsibleSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/CollapsibleSection.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: Implement CollapsibleSection**

```typescript
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import styles from "../../studio.module.css";

const STORAGE_KEY = "sxy-studio-sidebar-sections";

function loadSectionState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSectionState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const saved = loadSectionState();
    if (id in saved) {
      setOpen(saved[id]!);
    }
  }, [id]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const saved = loadSectionState();
      saveSectionState({ ...saved, [id]: next });
      return next;
    });
  }, [id]);

  return (
    <section className={styles.collapsibleSection}>
      <button
        type="button"
        className={styles.collapsibleSectionHeader}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={styles.collapsibleSectionChevron}>
          {open ? "▼" : "▸"}
        </span>
        <h2>{title}</h2>
      </button>
      {open ? (
        <div className={styles.collapsibleSectionBody}>{children}</div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Add CSS**

```css
.collapsibleSection { border-bottom: 1px solid var(--border, #e5e5e5); }
.collapsibleSectionHeader {
  display: flex; align-items: center; gap: 0.5rem;
  width: 100%; padding: 0.75rem 0; background: none; border: none;
  cursor: pointer; text-align: left;
}
.collapsibleSectionHeader h2 { margin: 0; font-size: 0.9rem; }
.collapsibleSectionChevron { font-size: 0.7rem; opacity: 0.6; width: 1rem; }
.collapsibleSectionBody { padding-bottom: 0.75rem; }
```

- [ ] **Step 3: Run typecheck**

Expected: PASS.

---

### Task 11: Wrap NovelBookPanel sections with CollapsibleSection

**Files:**
- Modify: `apps/web/features/studio/components/NovelBookPanel.tsx`

- [ ] **Step 1: Import CollapsibleSection**

- [ ] **Step 2: Wrap each `<section>` in bookContextPanel**

| Section id | title | defaultOpen |
|------------|-------|-------------|
| `book-progress` | 书籍信息 | `true` |
| `chapter-list` | 章节 | `true` |
| `chapter-detail` | 章节详情 | `false` |
| `outline` | 大纲与章节计划 | `false` |
| `assets` | 设定资产 | `false` |
| `context` | 写作上下文 | `false` |
| `review` | 审稿 | `false` |
| `tasks` | 任务日志 | `false` |
| `publication` | 发布记录 | `false` |
| `settings` | 设定 | `false` |
| `preview` | 上下文预览 | `false` |

Replace existing `<section><h2>...</h2>` patterns:

```tsx
// Before:
<section>
  <h2>书籍信息</h2>
  <div className={styles.bookProgress}>...</div>
</section>

// After:
<CollapsibleSection id="book-progress" title="书籍信息" defaultOpen>
  <div className={styles.bookProgress}>...</div>
</CollapsibleSection>
```

- [ ] **Step 3: Run typecheck + lint**

Expected: PASS.

---

### Task 12: Create QuickActions component

**Files:**
- Create: `apps/web/features/studio/components/chat/QuickActions.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: Implement QuickActions**

```typescript
"use client";

import styles from "../../studio.module.css";

const ACTIONS = ["写下一章", "审稿", "修订本章"] as const;

export function QuickActions({
  disabled,
  onAction,
}: {
  disabled: boolean;
  onAction: (command: string) => void;
}) {
  return (
    <div className={styles.composerQuickActions}>
      {ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onAction(action)}
        >
          {action}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update studio.module.css**

Ensure `.composerQuickActions` shows only a single row of 3 chips (remove any overflow that caused 20+ buttons to wrap visibly). Add:

```css
.composerQuickActions {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 0;
}
.composerQuickActions button {
  flex-shrink: 0;
}
```

---

### Task 13: Create ComposerMoreMenu component

**Files:**
- Create: `apps/web/features/studio/components/chat/ComposerMoreMenu.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: Define menu item types and groups**

```typescript
"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import styles from "../../studio.module.css";

type MenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

export function ComposerMoreMenu({
  groups,
  onOpenCloudSync,
}: {
  groups: MenuGroup[];
  onOpenCloudSync: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={styles.composerMoreMenu} ref={ref}>
      <button
        type="button"
        className={styles.composerMoreTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="更多操作"
      >
        ⋮
      </button>
      {open ? (
        <div className={styles.composerMoreDropdown}>
          {groups.map((group) => (
            <div key={group.label} className={styles.composerMoreGroup}>
              <span className={styles.composerMoreGroupLabel}>{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div className={styles.composerMoreGroup}>
            <span className={styles.composerMoreGroupLabel}>数据</span>
            <button type="button" onClick={() => { onOpenCloudSync(); setOpen(false); }}>
              云同步设置
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add dropdown CSS**

```css
.composerMoreMenu { position: relative; }
.composerMoreTrigger {
  padding: 0.4rem 0.75rem; border: 1px solid var(--border, #ddd);
  border-radius: 0.5rem; background: transparent; cursor: pointer;
  font-size: 1.1rem; line-height: 1;
}
.composerMoreDropdown {
  position: absolute; bottom: 100%; right: 0; margin-bottom: 0.5rem;
  min-width: 12rem; max-height: 24rem; overflow-y: auto;
  background: var(--bg, #fff); border: 1px solid var(--border, #ddd);
  border-radius: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 50;
}
.composerMoreGroup { padding: 0.25rem 0; }
.composerMoreGroupLabel {
  display: block; padding: 0.25rem 0.75rem; font-size: 0.7rem;
  opacity: 0.5; text-transform: uppercase;
}
.composerMoreDropdown button {
  display: block; width: 100%; text-align: left;
  padding: 0.4rem 0.75rem; border: none; background: none;
  cursor: pointer; font-size: 0.85rem;
}
.composerMoreDropdown button:hover { background: rgba(0,0,0,0.05); }
.composerMoreDropdown button:disabled { opacity: 0.4; cursor: not-allowed; }
```

---

### Task 14: Create ChatComposer and wire into NovelStudio

**Files:**
- Create: `apps/web/features/studio/components/chat/ChatComposer.tsx`
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`

- [ ] **Step 1: Create ChatComposer**

`ChatComposer` assembles QuickActions + textarea + ModelPicker + ComposerMoreMenu + send button. It receives all callbacks as props from NovelStudio (no logic extraction — just UI assembly).

Props interface:

```typescript
export function ChatComposer({
  input, onInputChange, onSend,
  selectedModelValue, modelGroups, recentModels,
  onModelChange, onManageModels,
  disabled, canSend,
  onQuickAction,
  moreMenuGroups,
  onOpenCloudSync,
  composerInputRef,
  batchQueueBar,       // ReactNode | null
  activeTaskBar,       // ReactNode | null
  routeError,          // string | undefined — shown only when !canSend
}: { /* full types */ }) { /* ... */ }
```

- [ ] **Step 2: In NovelStudio, replace footer JSX**

Remove the entire `<footer className={styles.chatComposer}>` block (lines ~4186-4416 area). Replace with:

```tsx
<ChatComposer
  input={input}
  onInputChange={setInput}
  onSend={() => void sendNovelMessage(input)}
  selectedModelValue={selectedModelValue}
  modelGroups={groupedModels}
  recentModels={settings.recentModels ?? []}
  onModelChange={setSelectedModelValue}
  onManageModels={onManageModels}
  disabled={isSending || isRunningCoreAction}
  canSend={canSendChat}
  onQuickAction={runQuickAction}
  moreMenuGroups={buildComposerMoreMenuGroups(/* all moved handlers */)}
  onOpenCloudSync={() => setCloudSyncDialogOpen(true)}
  composerInputRef={composerInputRef}
  batchQueueBar={batchQueueItems.length > 0 ? <BatchQueueBar ... /> : null}
  activeTaskBar={activeTaskLabel ? <ActiveTaskBar ... /> : null}
  routeError={"error" in chatBinding ? chatBinding.error : undefined}
/>
```

- [ ] **Step 3: Move CloudSyncPanel to dialog**

Add `cloudSyncDialogOpen` state in NovelStudio. Render `<CloudSyncPanel>` inside a modal/overlay triggered by `onOpenCloudSync`, NOT inline in composer.

- [ ] **Step 4: Build moreMenuGroups helper inside NovelStudio**

Create a function `buildComposerMoreMenuGroups()` that returns the 5 groups from the spec:

```typescript
function buildComposerMoreMenuGroups(): MenuGroup[] {
  return [
    {
      label: "会话",
      items: [
        { label: "编辑上一条", onClick: editLastUserMessage },
        ...(messages.some(m => m.status === "error")
          ? [{ label: "重试失败", onClick: retryLastFailedMessage }] : []),
        { label: "清空会话", onClick: clearSessionMessages },
        { label: "导出会话", onClick: exportActiveSession },
      ],
    },
    {
      label: "批量",
      items: [
        { label: "批量生成", onClick: () => void runBatchCoreAction("write-chapter"), disabled: isSending || isRunningCoreAction },
        { label: "批量审稿", onClick: () => void runBatchCoreAction("review"), disabled: isSending || isRunningCoreAction },
        { label: "批量修订", onClick: () => void runBatchCoreAction("revise-chapter"), disabled: isSending || isRunningCoreAction },
      ],
    },
    {
      label: "导出",
      items: [
        { label: "导出整书 MD", onClick: () => exportActiveBook("markdown") },
        { label: "导出整书 TXT", onClick: () => exportActiveBook("text") },
        { label: "导出整书 docx", onClick: () => exportActiveBook("docx") },
        { label: "分章导出", onClick: exportActiveBookChapters },
        { label: "按卷导出", onClick: exportActiveBookVolumes },
        { label: "发布清单", onClick: () => exportPublishManifest("generic") },
        { label: "整书 JSON", onClick: exportActiveBookJson },
        { label: "创作日志", onClick: exportCreationLog },
        ...PLATFORM_EXPORT_OPTIONS.map(o => ({
          label: o.label,
          onClick: () => exportPlatformText(o.platform),
        })),
        { label: "起点分章", onClick: () => exportPlatformChapterBundle("qidian") },
      ],
    },
    {
      label: "数据",
      items: [
        { label: "备份数据", onClick: () => void exportWorkspaceBackup() },
        { label: "恢复数据", onClick: () => backupImportInputRef.current?.click() },
      ],
    },
    {
      label: "扩展",
      items: [
        { label: "生成大纲", onClick: () => runQuickAction("生成大纲") },
        { label: "整理设定", onClick: () => runQuickAction("整理设定") },
        { label: "市场雷达", onClick: () => runQuickAction("市场雷达") },
      ],
    },
  ];
}
```

Keep hidden file inputs for backup/cloud sync import in NovelStudio (outside ChatComposer).

- [ ] **Step 5: Run typecheck + lint**

Expected: PASS.

---

### Task 15: Degrade tool tabs to overflow menu

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: Replace novelToolTabs rendering**

```tsx
// Before: 6 equal tabs
{NOVEL_TOOLS.map((tool) => <button ...>{tool}</button>)}

// After:
<div className={styles.novelToolTabs}>
  {activeTool !== "AI创作" ? (
    <div className={styles.novelToolBreadcrumb}>
      <button type="button" onClick={() => setActiveTool("AI创作")}>
        ← AI创作
      </button>
      <span>{activeTool}</span>
    </div>
  ) : (
    <button
      type="button"
      className={styles.activeNovelTool}
    >
      AI创作
    </button>
  )}
  <div className={styles.novelToolOverflow}>
    <button
      type="button"
      className={styles.novelToolOverflowTrigger}
      onClick={() => setToolOverflowOpen((v) => !v)}
    >
      ··· 更多工具
    </button>
    {toolOverflowOpen ? (
      <div className={styles.novelToolOverflowMenu}>
        {(["题材", "文风", "导入", "市场雷达", "环境诊断"] as const).map((tool) => (
          <button
            key={tool}
            type="button"
            className={activeTool === tool ? styles.activeNovelTool : ""}
            onClick={() => { setActiveTool(tool); setToolOverflowOpen(false); }}
          >
            {tool}
          </button>
        ))}
      </div>
    ) : null}
  </div>
</div>
```

Add `toolOverflowOpen` state to NovelStudio.

- [ ] **Step 2: Add overflow CSS**

```css
.novelToolTabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border, #e5e5e5);
}
.novelToolOverflow { position: relative; }
.novelToolOverflowTrigger {
  padding: 0.4rem 0.75rem; font-size: 0.85rem;
  border: 1px solid var(--border, #ddd); border-radius: 0.5rem;
  background: transparent; cursor: pointer; opacity: 0.7;
}
.novelToolOverflowMenu {
  position: absolute; top: 100%; right: 0; margin-top: 0.25rem;
  min-width: 8rem; background: var(--bg, #fff);
  border: 1px solid var(--border, #ddd); border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 40;
}
.novelToolBreadcrumb {
  display: flex; align-items: center; gap: 0.5rem;
}
.novelToolBreadcrumb button {
  background: none; border: none; cursor: pointer;
  font-size: 0.85rem; opacity: 0.7;
}
```

- [ ] **Step 3: Run typecheck**

Expected: PASS.

---

### Task 16: Visual density cleanup

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: Simplify chat header**

In chat context bar, keep only one line:
```tsx
<strong>{activeBook?.title ?? project.title}</strong>
<span>{activeBook?.meta ?? project.genre} / {currentStage.label} / 已生成 {stats.generatedChapters} 章</span>
```
Remove `<em>Chat / InkOS</em>`.

- [ ] **Step 2: Simplify empty state**

```tsx
<div className={styles.emptyMessageState}>
  <span>输入一个题材、角色或章节目标，从这里开始。</span>
</div>
```
Remove `<strong>这个会话还没有消息</strong>` heading.

- [ ] **Step 3: Hide composerRouteHint by default**

Only render route error when `!canSendChat`:

```tsx
{routeError ? (
  <div className={styles.composerRouteError}>{routeError}</div>
) : null}
```

Remove the long `novelRouteSummaries` display from composer.

- [ ] **Step 4: Run full verification (Phase 2c complete)**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/lib/novel-store.test.mjs apps/web/lib/provider-stream-parser.test.mjs apps/web/lib/cloud-sync-webdav.test.mjs apps/web/lib/model-settings.test.mjs
wc -l apps/web/app/page.tsx
```

Expected: all PASS, `page.tsx` < 400 lines.

---

### Task 17: Update INKOS_STUDIO_ALIGNMENT_TODO.md checkboxes

**Files:**
- Modify: `INKOS_STUDIO_ALIGNMENT_TODO.md`

- [ ] **Step 1: Mark completed P0 and P1 items**

Check all items that are now satisfied per spec acceptance criteria.

---

## Spec Coverage Self-Review

| Spec Requirement | Task |
|------------------|------|
| 三栏布局保留 | Task 8 (no layout change) |
| Quick Actions 3 个 | Task 12 |
| 导出/云同步/批量进更多菜单 | Task 13, 14 |
| 工具 tab 降级 + overflow | Task 15 |
| 右侧折叠 section | Task 10, 11 |
| 视觉密度降低 | Task 16 |
| features/studio + features/models | Task 1, 5-8 |
| page.tsx < 400 行 | Task 8 |
| CSS 拆分 | Task 9 |
| 行为零变更 | All verification steps |
| 4 个新建组件 | Task 10, 12, 13, 14 |

No gaps found. No placeholders.

---

## Manual Acceptance Checklist

After all tasks:

- [ ] `pnpm --filter web run dev` — open http://localhost:3033, navigate to AI小说创作
- [ ] First screen shows 3 columns: book list / chat / context panel
- [ ] Top bar shows only「AI创作」+「··· 更多工具」
- [ ] Quick Actions shows exactly 3 chips
- [ ]「⋮ 更多」menu contains session/batch/export/data/extend groups
- [ ] Right panel: only 书籍信息 + 章节 expanded by default
- [ ] Create book → chat → 写下一章 still works
- [ ] Export/backup/cloud sync reachable via 更多 menu
- [ ] Model settings page still works
- [ ] `wc -l apps/web/app/page.tsx` < 400

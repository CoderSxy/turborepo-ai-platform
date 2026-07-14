# InkOS Auto Asset Sync (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-merge chapter asset deltas on write, migrate historical `pendingAssetDeltas` on load, and remove everyday「待确认」UI — without building character profiles or the write-chapter audit pipeline.

**Architecture:** Add a focused pure module `novel-asset-auto-sync.ts` that wraps existing `applyNovelChapterAssetDelta` with idempotent safe-merge and pending migration. Wire it into `run-core-action` (new chapters) and `loadNovelWorkspace` (persist migration). Update right-panel summaries/alerts and strip confirm/dismiss UI.

**Tech Stack:** TypeScript, IndexedDB via `novel-store.ts`, Node `node:test` + `--experimental-strip-types`, existing React right-panel components.

**Spec:** [2026-07-14-inkos-auto-asset-sync-design.md](../specs/2026-07-14-inkos-auto-asset-sync-design.md)

---

## File map

| Path | Responsibility |
|------|----------------|
| `apps/web/lib/novel-asset-auto-sync.ts` | Pure `mergeNovelChapterAssetDeltaSafely`, `migratePendingAssetDeltas`, helpers, `countSyncAttentionDiagnostics` |
| `apps/web/lib/novel-asset-auto-sync.test.ts` | Unit tests (TDD) |
| `apps/web/lib/novel-store.ts` | Add `pendingMigration` on `NovelProjectAssets`; preserve in `normalizeNovelProjectAssets` / defaults; call migrate+persist in `loadNovelWorkspace` |
| `apps/web/features/studio/actions/run-core-action.ts` | Replace `queueNovelPendingAssetDelta` with safe merge; update progress copy |
| `apps/web/features/studio/components/right-panel/right-panel-summaries.ts` | Alert counts + character role copy without「待确认」 |
| `apps/web/features/studio/components/right-panel/SidebarCardAlert.tsx` | 「N 需关注」 |
| `apps/web/features/studio/components/right-panel/detail/CharacterDetailView.tsx` | Drop「待确认」display |
| `apps/web/features/studio/components/WorkspaceMoreSections.tsx` | Remove pending confirm UI; list sync diagnostics |
| `apps/web/features/studio/hooks/useNovelBookWorkspace.ts` | Stop exposing confirm/dismiss to UI (or leave unused internals) |
| `apps/web/features/studio/components/NovelBookPanel.tsx` | Remove confirm/dismiss wiring |
| `apps/web/features/studio/components/right-panel/right-panel-summaries.test.ts` | Update expectations |
| `apps/web/package.json` | Register new test file |
| `docs/INKOS_STUDIO_AUTONOMOUS_WRITING_AND_CHARACTER_ALIGNMENT.md` | Optionally track in git (source alignment) |

**Out of scope:** `characterProfiles`, Writer→Auditor pipeline, `manualLocks`, expanding `NovelAssetChangeEvent` before/after schema.

---

## Task 1: Types + failing merge/migrate tests

**Files:**
- Modify: `apps/web/lib/novel-store.ts` (`NovelProjectAssets` + normalize/defaults)
- Create: `apps/web/lib/novel-asset-auto-sync.test.ts`
- Modify: `apps/web/package.json` (`test` script)

- [ ] **Step 1: Extend assets type**

In `NovelProjectAssets` add optional:

```ts
pendingMigration?: {
  schemaVersion: 1;
  migratedAt?: string;
  appliedChapters: number[];
  skippedPendingIds?: string[];
};
```

In `normalizeNovelProjectAssets` and `createDefaultNovelAssets`, preserve/default:

```ts
pendingMigration: assets?.pendingMigration ?? defaultAssets.pendingMigration,
// default: undefined or { schemaVersion: 1, appliedChapters: [] }
```

- [ ] **Step 2: Write failing tests**

Create `apps/web/lib/novel-asset-auto-sync.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NovelChapterAssetDelta, NovelProjectAssets } from "./novel-store.ts";
import {
  countSyncAttentionDiagnostics,
  mergeNovelChapterAssetDeltaSafely,
  migratePendingAssetDeltas,
} from "./novel-asset-auto-sync.ts";

function emptyAssets(overrides: Partial<NovelProjectAssets> = {}): NovelProjectAssets {
  return {
    outline: "",
    outlineNodes: [],
    worldNotes: "",
    characters: "",
    settings: "",
    knowledgeAssets: [],
    pendingAssetDeltas: [],
    contextSelection: {
      includeOutline: true,
      includePreviousSummary: true,
      includeWorld: true,
      includeCharacters: true,
      includeForeshadowing: true,
      includeReviewIssues: false,
      viewpoint: "",
      pacing: "",
      highlights: "",
    },
    genres: [],
    styleSamples: [],
    importedMaterials: [],
    marketRadars: [],
    diagnostics: [],
    ...overrides,
  };
}

function sampleDelta(
  overrides: Partial<NovelChapterAssetDelta> = {},
): NovelChapterAssetDelta {
  return {
    chapterNumber: 1,
    chapterTitle: "雨夜来信",
    summary: "开章",
    characterStates: [{ title: "林照", content: "决定追查档案" }],
    newForeshadowing: ["匿名信来源不明"],
    resolvedForeshadowing: [],
    worldIncrements: ["裂缝档案科存在"],
    ...overrides,
  };
}

describe("mergeNovelChapterAssetDeltaSafely", () => {
  it("applies delta without growing pendingAssetDeltas", () => {
    const before = emptyAssets();
    const result = mergeNovelChapterAssetDeltaSafely(before, sampleDelta(), {
      source: "chapter-pipeline",
    });
    assert.equal(result.pendingAssetDeltas.length, 0);
    assert.ok(result.knowledgeAssets.some((a) => a.category === "character"));
    assert.ok(result.pendingMigration?.appliedChapters.includes(1));
  });

  it("is idempotent for the same chapterNumber", () => {
    const first = mergeNovelChapterAssetDeltaSafely(emptyAssets(), sampleDelta(), {
      source: "chapter-pipeline",
    });
    const characterCount = first.knowledgeAssets.filter(
      (a) => a.category === "character",
    ).length;
    const second = mergeNovelChapterAssetDeltaSafely(first, sampleDelta(), {
      source: "chapter-pipeline",
    });
    assert.equal(
      second.knowledgeAssets.filter((a) => a.category === "character").length,
      characterCount,
    );
    assert.deepEqual(second.pendingMigration?.appliedChapters, [1]);
  });

  it("does not mutate assets for empty delta", () => {
    const before = emptyAssets();
    const empty = sampleDelta({
      summary: "",
      characterStates: [],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      worldIncrements: [],
    });
    const result = mergeNovelChapterAssetDeltaSafely(before, empty, {
      source: "chapter-pipeline",
    });
    assert.equal(result.knowledgeAssets.length, 0);
    assert.equal(result.pendingMigration?.appliedChapters?.length ?? 0, 0);
  });
});

describe("migratePendingAssetDeltas", () => {
  it("applies pending in chapter order and clears successes", () => {
    const assets = emptyAssets({
      pendingAssetDeltas: [
        {
          id: "p2",
          createdAt: "2026-01-02T00:00:00.000Z",
          ...sampleDelta({ chapterNumber: 2, chapterTitle: "二" }),
        },
        {
          id: "p1",
          createdAt: "2026-01-01T00:00:00.000Z",
          ...sampleDelta({ chapterNumber: 1, chapterTitle: "一" }),
        },
      ],
    });
    const result = migratePendingAssetDeltas(assets);
    assert.equal(result.pendingAssetDeltas.length, 0);
    assert.ok(result.pendingMigration?.migratedAt);
    assert.ok(result.pendingMigration?.appliedChapters.includes(1));
    assert.ok(result.pendingMigration?.appliedChapters.includes(2));
  });

  it("does not re-apply already applied chapters on second migrate", () => {
    const once = migratePendingAssetDeltas(
      emptyAssets({
        pendingAssetDeltas: [
          {
            id: "p1",
            createdAt: "2026-01-01T00:00:00.000Z",
            ...sampleDelta(),
          },
        ],
      }),
    );
    const charCount = once.knowledgeAssets.filter(
      (a) => a.category === "character",
    ).length;
    const twice = migratePendingAssetDeltas(once);
    assert.equal(
      twice.knowledgeAssets.filter((a) => a.category === "character").length,
      charCount,
    );
  });
});

describe("countSyncAttentionDiagnostics", () => {
  it("counts failed sync diagnostics only", () => {
    const assets = emptyAssets({
      diagnostics: [
        {
          id: "1",
          label: "同步诊断 · 第 1 章",
          ok: false,
          detail: "merge failed",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          label: "环境",
          ok: false,
          detail: "other",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "3",
          label: "同步诊断 · info",
          ok: true,
          detail: "ok",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(countSyncAttentionDiagnostics(assets), 1);
  });
});
```

- [ ] **Step 3: Register test in `apps/web/package.json`**

Prepend to the `test` script file list:

`lib/novel-asset-auto-sync.test.ts`

- [ ] **Step 4: Run tests — expect FAIL**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
cd apps/web && node --test --experimental-strip-types lib/novel-asset-auto-sync.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` for `./novel-asset-auto-sync.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/novel-store.ts \
  apps/web/lib/novel-asset-auto-sync.test.ts \
  apps/web/package.json
git commit -m "test: add failing auto asset sync coverage"
```

---

## Task 2: Implement safe merge + migrate

**Files:**
- Create: `apps/web/lib/novel-asset-auto-sync.ts`

- [ ] **Step 1: Implement module**

```ts
import {
  applyNovelChapterAssetDelta,
  type NovelChapterAssetDelta,
  type NovelProjectAssets,
} from "./novel-store.ts";

export type AssetSyncSource = "chapter-pipeline" | "migration";

export type MergeAssetDeltaPolicy = {
  source: AssetSyncSource;
};

const SYNC_DIAGNOSTIC_PREFIX = "同步诊断";

function hasDeltaContent(delta: NovelChapterAssetDelta): boolean {
  return Boolean(
    delta.summary.trim() ||
      delta.characterStates.length ||
      delta.newForeshadowing.length ||
      delta.resolvedForeshadowing.length ||
      delta.worldIncrements.length,
  );
}

function withMigration(
  assets: NovelProjectAssets,
  patch: Partial<NonNullable<NovelProjectAssets["pendingMigration"]>>,
): NovelProjectAssets["pendingMigration"] {
  return {
    schemaVersion: 1,
    appliedChapters: [],
    ...assets.pendingMigration,
    ...patch,
    appliedChapters: patch.appliedChapters
      ?? assets.pendingMigration?.appliedChapters
      ?? [],
  };
}

export function countSyncAttentionDiagnostics(
  assets: NovelProjectAssets,
): number {
  return (assets.diagnostics ?? []).filter(
    (item) =>
      !item.ok && item.label.startsWith(SYNC_DIAGNOSTIC_PREFIX),
  ).length;
}

export function mergeNovelChapterAssetDeltaSafely(
  assets: NovelProjectAssets,
  delta: NovelChapterAssetDelta,
  policy: MergeAssetDeltaPolicy,
): NovelProjectAssets {
  if (!hasDeltaContent(delta)) {
    return assets;
  }

  const applied = assets.pendingMigration?.appliedChapters ?? [];
  if (applied.includes(delta.chapterNumber)) {
    return assets;
  }

  try {
    const merged = applyNovelChapterAssetDelta(assets, delta);
    return {
      ...merged,
      pendingMigration: withMigration(merged, {
        appliedChapters: [...applied, delta.chapterNumber],
      }),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "资产合并失败";
    return {
      ...assets,
      diagnostics: [
        {
          id: `sync-diag-${delta.chapterNumber}-${Date.now()}`,
          label: `${SYNC_DIAGNOSTIC_PREFIX} · 第 ${delta.chapterNumber} 章`,
          ok: false,
          detail: `${policy.source}: ${detail}`,
          createdAt: new Date().toISOString(),
        },
        ...(assets.diagnostics ?? []),
      ].slice(0, 50),
    };
  }
}

export function migratePendingAssetDeltas(
  assets: NovelProjectAssets,
): NovelProjectAssets {
  const pending = [...(assets.pendingAssetDeltas ?? [])].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) {
      return a.chapterNumber - b.chapterNumber;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  if (pending.length === 0) {
    if (assets.pendingMigration?.migratedAt) {
      return assets;
    }
    return {
      ...assets,
      pendingMigration: withMigration(assets, {
        migratedAt: new Date().toISOString(),
      }),
    };
  }

  const skipped = new Set(assets.pendingMigration?.skippedPendingIds ?? []);
  let current = assets;
  const remaining = [];

  for (const item of pending) {
    if (skipped.has(item.id)) {
      remaining.push(item);
      continue;
    }
    if (current.pendingMigration?.appliedChapters?.includes(item.chapterNumber)) {
      continue;
    }

    const beforeDiagnostics = current.diagnostics?.length ?? 0;
    const next = mergeNovelChapterAssetDeltaSafely(current, item, {
      source: "migration",
    });
    const addedDiag =
      (next.diagnostics?.length ?? 0) > beforeDiagnostics &&
      !(next.pendingMigration?.appliedChapters ?? []).includes(item.chapterNumber);

    if (addedDiag) {
      remaining.push(item);
      current = {
        ...next,
        pendingMigration: withMigration(next, {
          skippedPendingIds: [
            ...(next.pendingMigration?.skippedPendingIds ?? []),
            item.id,
          ],
        }),
      };
      continue;
    }

    current = next;
  }

  return {
    ...current,
    pendingAssetDeltas: remaining,
    pendingMigration: withMigration(current, {
      migratedAt: new Date().toISOString(),
      skippedPendingIds: current.pendingMigration?.skippedPendingIds,
    }),
  };
}
```

Note: `applyNovelChapterAssetDelta` already writes `assetChangeEvents`; do **not** double-append here. Idempotency uses `pendingMigration.appliedChapters`.

If circular import occurs (`novel-store` later imports this module which imports `novel-store`), keep apply import only from auto-sync → store; load orchestration should import auto-sync from store **without** re-export cycles — prefer `loadNovelWorkspace` dynamic import or move migrate call to a thin `load-novel-workspace-migrated.ts`. Prefer: `loadNovelWorkspace` imports migrate from auto-sync; auto-sync only imports `apply` + types from store (acyclic).

- [ ] **Step 2: Run tests — expect PASS**

```bash
cd apps/web && node --test --experimental-strip-types lib/novel-asset-auto-sync.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/novel-asset-auto-sync.ts
git commit -m "feat: add safe chapter asset merge and pending migration"
```

---

## Task 3: Wire write-chapter to auto-merge

**Files:**
- Modify: `apps/web/features/studio/actions/run-core-action.ts` (write-chapter asset block ~421–467)

- [ ] **Step 1: Replace queue with safe merge**

```ts
import { mergeNovelChapterAssetDeltaSafely } from "../../../lib/novel-asset-auto-sync";
// remove queueNovelPendingAssetDelta import if unused

// inside write-chapter success after buildNovelChapterAssetDelta + upsert chapter:
const beforeAttention = /* count from nextAssets */;
nextAssets = mergeNovelChapterAssetDeltaSafely(nextAssets, {
  ...assetDelta,
  chapterNumber: storedChapter.number,
  chapterTitle: storedChapter.title,
  summary: storedChapter.summary,
}, { source: "chapter-pipeline" });

const attention = countSyncAttentionDiagnostics(nextAssets) - beforeAttention;
updateCoreProgress(
  attention > 0
    ? `章节已完成；${attention} 项同步需关注，详见同步诊断`
    : "已同步：章节摘要、角色状态、世界观、伏笔与大纲",
);
```

Do **not** call `queueNovelPendingAssetDelta`.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web run check-types
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/studio/actions/run-core-action.ts
git commit -m "feat(studio): auto-merge chapter assets after write-chapter"
```

---

## Task 4: Migrate pending on workspace load (persist)

**Files:**
- Modify: `apps/web/lib/novel-store.ts` (`loadNovelWorkspace`)

- [ ] **Step 1: After reading books, migrate + persist dirty assets**

Inside `loadNovelWorkspace`, after `getAllFromStore` books (before or inside `buildNovelWorkspaceSnapshot`):

```ts
import { migratePendingAssetDeltas } from "./novel-asset-auto-sync.ts";

const normalizedBooks = books.map(normalizeStoredNovelBook);
const migratedBooks = [];

for (const book of normalizedBooks) {
  const nextAssets = migratePendingAssetDeltas(book.assets);
  const changed =
    nextAssets !== book.assets &&
    JSON.stringify(nextAssets) !== JSON.stringify(book.assets);

  if (changed) {
    const nextBook = {
      ...book,
      assets: nextAssets,
      updatedAt: new Date().toISOString(),
    };
    await putInStore(db, BOOKS_STORE, nextBook);
    migratedBooks.push(nextBook);
  } else {
    migratedBooks.push(book);
  }
}

return buildNovelWorkspaceSnapshot(
  migratedBooks,
  sessions,
  messages,
  chapters,
  chapterVersions,
  tasks,
);
```

Avoid naive `!==` only: prefer comparing `pendingAssetDeltas` length / `pendingMigration` / diagnostics ids. Minimal: always write if `pendingMigration.migratedAt` newly set or pending length changed.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web run check-types
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/novel-store.ts
git commit -m "feat: migrate pending asset deltas on workspace load"
```

---

## Task 5: Right-panel alert + summaries without「待确认」

**Files:**
- Modify: `apps/web/features/studio/components/right-panel/right-panel-summaries.ts`
- Modify: `apps/web/features/studio/components/right-panel/SidebarCardAlert.tsx`
- Modify: `apps/web/features/studio/components/right-panel/detail/CharacterDetailView.tsx`
- Modify: `apps/web/features/studio/components/right-panel/right-panel-summaries.test.ts`

- [ ] **Step 1: Update failing/updated tests first**

Replace test `"shows pending chapter character states immediately as 待确认"` with behavior that pending is **not** labeled 待确认 — e.g. pending-sourced states appear as normal cards **or** are ignored once migrate owns them. For P1 UI: stop synthesizing `role: "待确认"` from `pendingAssetDeltas` in `buildCharacterStateCards`.

Update any assertion matching `/待确认/`.

- [ ] **Step 2: Change `AssetAlertCounts`**

```ts
export type AssetAlertCounts = {
  syncAttentionCount: number;
  conflictErrors: number;
  conflictWarnings: number;
};

export function buildAssetAlertCounts(
  assets: NovelProjectAssets,
  conflictErrors: number,
  conflictWarnings: number,
): AssetAlertCounts {
  return {
    syncAttentionCount: countSyncAttentionDiagnostics(assets),
    conflictErrors,
    conflictWarnings,
  };
}
```

Update call sites (`BookContextPanel`, `SidebarCardAlert`) for new field name.

- [ ] **Step 3: SidebarCardAlert copy**

```ts
const label =
  syncAttentionCount > 0
    ? `${syncAttentionCount} 需关注`
    : conflictErrors > 0
      ? `${conflictErrors} 冲突`
      : `${conflictWarnings} 提醒`;
```

- [ ] **Step 4: Character detail** — remove硬编码「待确认」`<dd>` when role was pending.

- [ ] **Step 5: Run panel + auto-sync tests**

```bash
pnpm --filter web run test
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(studio): replace pending alerts with sync attention"
```

---

## Task 6: Remove Workspace more / book panel confirm UI

**Files:**
- Modify: `apps/web/features/studio/components/WorkspaceMoreSections.tsx`
- Modify: `apps/web/features/studio/components/NovelBookPanel.tsx`
- Modify: `apps/web/features/studio/hooks/useNovelBookWorkspace.ts`

- [ ] **Step 1: Remove pending list + confirm/ignore/edit buttons** from `WorkspaceMoreSections`. Keep `assetChangeEvents` timeline. Optionally render sync diagnostics (`!ok && label.startsWith("同步诊断")`) under a「同步诊断」heading.

- [ ] **Step 2: Remove props/callbacks** for confirm/dismiss from `NovelBookPanel` and stop returning them from workspace hook public API (or leave functions but unused — prefer delete UI surface completely).

- [ ] **Step 3: check-types + lint**

```bash
pnpm --filter web run check-types
pnpm --filter web run lint
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(studio): remove pending asset confirmation UI"
```

---

## Task 7: Verification + docs checkboxes

**Files:**
- Modify: `docs/superpowers/specs/2026-07-14-inkos-auto-asset-sync-design.md` §9 checkboxes
- Optionally add: `docs/INKOS_STUDIO_AUTONOMOUS_WRITING_AND_CHARACTER_ALIGNMENT.md` (currently untracked)

- [ ] **Step 1: Full verify**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
```

Expected: all green.

- [ ] **Step 2: Mark §9 checkboxes** when behavior matches.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-14-inkos-auto-asset-sync-design.md \
  docs/INKOS_STUDIO_AUTONOMOUS_WRITING_AND_CHARACTER_ALIGNMENT.md
git commit -m "docs: mark P1 auto asset sync acceptance items"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Safe merge, no new pending | 1–3 |
| Idempotent same chapter | 1–2 |
| Load-time migrate + persist | 4 |
| Diagnostics / 需关注 | 2, 5 |
| Remove 待确认 UI | 5–6 |
| Progress copy | 3 |
| Tests + commands | 1, 7 |

---

## Handoff

Plan saved to `docs/superpowers/plans/2026-07-14-inkos-auto-asset-sync.md`.

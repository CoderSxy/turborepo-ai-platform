# InkOS P1 Sync, Atomic Commit, Character Profiles + Writing Pipeline Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all four P1 items in one serial delivery: stable asset-sync identity, atomic completed-write persistence, full character profiles/right-panel rendering, and a Writer→Auditor→Reviser→Re-auditor chapter pipeline.

**Architecture:** First make merge/migration pure and persistence atomic. Then make `assets.characterProfiles` the character authority and migrate legacy data into it. Finally, run every write through an explicit task state machine; only its final validated version may enter the atomic commit API.

**Spec:** [2026-07-14-inkos-p1-sync-identity-commit-design.md](../specs/2026-07-14-inkos-p1-sync-identity-commit-design.md)

**Supersedes:** the P1-1/P1-2 portion of [2026-07-14-inkos-auto-asset-sync.md](2026-07-14-inkos-auto-asset-sync.md). Retain its right-panel UI work; replace only its chapter-number identity and split write persistence.

---

## File map

| Path | Responsibility |
| --- | --- |
| `apps/web/lib/novel-store.ts` | v2 migration types/normalizer; cross-store commit API |
| `apps/web/lib/novel-asset-auto-sync.ts` | Canonical delta/hash, syncId merge result, safe migration |
| `apps/web/lib/novel-asset-auto-sync.test.ts` | Identity, migration, retry, and duplicate tests |
| `apps/web/lib/*commit*.test.ts` | Real IndexedDB transaction success/rollback tests |
| `apps/web/features/studio/actions/writing/commit-write-chapter-result.ts` | Typed adapter that builds final commit payload |
| `apps/web/features/studio/actions/writing/run-write-chapter-pipeline.ts` | Writer/audit/revise/re-audit/fact-sync state machine |
| `apps/web/features/studio/actions/run-core-action.ts` | Call one commit API; publish UI success only after it resolves |
| `apps/web/features/studio/actions/**/*.test.*` | Write-action ordering and failed commit tests |
| `apps/web/features/studio/components/right-panel/*` | All-character profile list, detail, diagnostics, and state history |

**Out of scope:** global ordinary-chat changes, unrelated right-panel sections, a brand-new model-provider abstraction, and a normal user-confirmation workflow. Exceptional sync diagnostics remain available, but they must not block ordinary chapter generation.

## Verification command

Run after each executable-code task:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
pnpm --filter web run check-types
pnpm --filter web run lint
node --experimental-strip-types --test apps/web/lib/novel-asset-auto-sync.test.ts
```

---

# Batch 1 — Sync identity and v2 migration metadata

## Task 1: Normalize migration metadata before changing merge behavior

**Files:**

- Modify: `apps/web/lib/novel-store.ts`
- Modify: `apps/web/lib/novel-asset-auto-sync.test.ts`

- [ ] **Step 1: Audit all v1 call sites**

Search for `pendingMigration`, `appliedChapters`, `skippedPendingIds`, and `mergeNovelChapterAssetDeltaSafely`. Record every read/write. No merge or migration path may retain a chapter-number short-circuit after Batch 1.

- [ ] **Step 2: Define backwards-compatible metadata**

Add explicit v1/v2 stored types. Normalized assets must always contain v2 metadata:

```ts
type NovelPendingMigrationV2 = {
  schemaVersion: 2;
  appliedSyncIds: string[];
  legacyAppliedChapters: number[];
  skippedPendingIds: string[];
  migratedAt?: string;
  retrySchemaVersion?: number;
};
```

Do not delete unknown future fields during normalization.

- [ ] **Step 3: Add one normalizer**

Implement `normalizePendingMigration` and use it from `normalizeNovelProjectAssets` and auto-sync helpers. A v1 `appliedChapters` value must move intact into `legacyAppliedChapters`; it must never seed `appliedSyncIds`.

- [ ] **Step 4: Write failing tests**

Add assertions that:

1. v1 metadata upgrades to v2 while preserving all old chapter numbers.
2. A pending delta whose chapter appears in old `appliedChapters` is not discarded.
3. Default assets contain empty v2 arrays.
4. Normalization is idempotent.

- [ ] **Step 5: Implement, run tests, then commit**

```bash
git add apps/web/lib/novel-store.ts apps/web/lib/novel-asset-auto-sync.test.ts
git commit -m "feat(studio): normalize asset sync migration metadata v2"
```

---

## Task 2: Add deterministic `syncId` and structured merge results

**Status:** DONE (`1120be0`)

**Files:**

- Modify: `apps/web/lib/novel-asset-auto-sync.ts`
- Modify: `apps/web/lib/novel-asset-auto-sync.test.ts`
- Modify: `apps/web/lib/novel-store.ts` if types require it

- [x] **Step 1: Write failing tests**

Cover all cases:

1. Merging the same `syncId` twice produces one asset change/event.
2. Two different `syncId` values for one chapter both apply.
3. Reordered equivalent delta collections produce the same canonical hash.
4. Changed delta content produces a different hash.
5. Empty/summary-only pending returns `needs-attention`, retains the source pending at migration level, and writes one stable diagnostic.

- [x] **Step 2: Implement pure identity helpers**

Create helpers with no timestamps/randomness:

```ts
canonicalizeNovelChapterAssetDelta(delta): CanonicalDelta
stableHashCanonicalDelta(delta): string
createChapterPipelineSyncId({ chapterId, chapterVersionId, delta }): string
createLegacyPendingSyncId(pending): string // legacy:${pending.id}
```

Normalize whitespace and deterministically sort independent arrays without mutating the input delta.

- [x] **Step 3: Replace the merge API**

```ts
type MergeAssetDeltaResult = {
  status: "applied" | "skipped" | "needs-attention";
  assets: NovelProjectAssets;
  syncId: string;
};
```

Rules:

- only `appliedSyncIds` decides idempotency;
- `applied` appends exactly one syncId and one set of change events;
- `skipped` returns input assets unchanged;
- `needs-attention` upserts diagnostic id `sync-diag:${syncId}` and never uses `Date.now()`;
- `legacyAppliedChapters` is audit-only and must not skip a delta.

- [x] **Step 4: Update callers**

Every caller must branch on `result.status`. Remove inference based on `appliedChapters`, pending length, or diagnostics length.

- [x] **Step 5: Verify and commit**

```bash
git add apps/web/lib/novel-asset-auto-sync.ts apps/web/lib/novel-asset-auto-sync.test.ts apps/web/lib/novel-store.ts
git commit -m "fix(studio): key asset sync by stable delta identity"
```

---

# Batch 2 — Lossless historical migration

## Task 3: Rewrite pending migration around `syncId`

**Files:**

- Modify: `apps/web/lib/novel-asset-auto-sync.ts`
- Modify: `apps/web/lib/novel-asset-auto-sync.test.ts`
- Modify: `apps/web/lib/novel-store.ts` if workspace persistence needs an explicit changed result

- [ ] **Step 1: Add failing migration tests**

Use real-shaped `NovelPendingAssetDelta` data:

1. Two pending ids for chapter 3 containing unique facts both persist after migration.
2. Previously applied `legacy:p1` is removed without reapplying; `legacy:p2` for the same chapter still applies.
3. Empty/invalid delta remains pending and gets one diagnostic even across repeated loads.
4. Merge exception keeps the exact pending id in `remaining` and does not multiply diagnostics.
5. A changed payload, schema retry version, or explicit retry makes an old skipped item eligible again; success clears its skipped id and diagnostic.

- [ ] **Step 2: Implement deterministic migration**

Sort by chapter number, `createdAt`, then id. For each delta derive `legacy:${id}`, call structured merge, remove only `applied`/already-applied items, retain every `needs-attention` item, and set `migratedAt` without claiming unresolved work completed.

`skippedPendingIds` only suppresses duplicate work during one load. It must not become a permanent no-retry list.

- [ ] **Step 3: Persist only genuine changes**

Return an explicit `changed` flag from migration or deep-compare relevant assets. Do not depend only on pending array length: successful merge can change knowledge assets, long text, change events, diagnostics, and v2 metadata.

- [ ] **Step 4: Run old-book fixture test and commit**

```bash
git add apps/web/lib/novel-asset-auto-sync.ts apps/web/lib/novel-asset-auto-sync.test.ts apps/web/lib/novel-store.ts
git commit -m "fix(studio): preserve every historical pending asset delta"
```

---

# Batch 3 — Atomic completed-write persistence

## Task 4: Add one cross-store IndexedDB commit API

**Status:** DONE (`bdcf3e8`)

**Files:**

- Modify: `apps/web/lib/novel-store.ts`
- Create: a focused IndexedDB commit test beside existing novel-store tests
- Modify: `apps/web/package.json` if test registration is required

- [x] **Step 1: Reuse the existing DB helpers**

Inspect `openNovelDb`, store constants, request wrappers, and `transactionDone`. Do not create another storage abstraction. Confirm these stores exist in the schema: chapters, chapterVersions, books, tasks, messages.

- [x] **Step 2: Add strict commit input**

```ts
type CommitWriteChapterResultInput = {
  bookId: string;
  book: StoredNovelBook;
  finalChapter: StoredNovelChapter;
  finalChapterVersion: StoredNovelChapterVersion;
  completedTask: StoredNovelTask;
  finalAssistantMessage: StoredNovelMessage;
};
```

`completedTask` and `finalAssistantMessage` are mandatory. Validate book/chapter/task ownership, version→chapter linkage, final non-streaming message/session linkage, final content hash/version source, and final `syncId` before opening the transaction.

- [x] **Step 3: Write failing real-IndexedDB tests**

Prove that:

1. success writes chapter, version, book assets, completed task, and final assistant message exactly once;
2. request failure or transaction abort leaves all five stores unchanged;
3. retry with the same stable ids does not duplicate versions/events;
4. cross-book input rejects before any store mutation.

Do not mock `transaction()`; use the project’s IndexedDB test setup.

- [x] **Step 4: Implement `commitWriteChapterResult`**

Open exactly one `readwrite` transaction over:

```ts
[CHAPTERS_STORE, CHAPTER_VERSIONS_STORE, BOOKS_STORE, TASKS_STORE, MESSAGES_STORE]
```

Issue all `put`s inside it and await request completion plus `transactionDone(tx)`. A request error must reject/abort the transaction. Expose no success result until the transaction commits.

- [x] **Step 5: Verify and commit**

```bash
git add apps/web/lib/novel-store.ts apps/web/lib/*commit*test* apps/web/package.json
git commit -m "feat(studio): atomically commit completed chapter writes"
```

---

## Task 5: Route `write-chapter` through that single commit point

**Status:** DONE (`85e37de`)

**Files:**

- Create: `apps/web/features/studio/actions/writing/commit-write-chapter-result.ts`
- Modify: `apps/web/features/studio/actions/run-core-action.ts`
- Create/Modify: focused write-action tests

- [x] **Step 1: Write failing action tests**

Assert that:

1. no active chapter, success toast/progress, completed task, or final message appears before commit resolves;
2. commit rejection produces error task/message state and never publishes “第 N 章已保存”;
3. success calls commit once with chapter, version, assets, task, and message sharing chapter/version/sync identity;
4. write-chapter no longer uses separate chapter/book/task/message success persistence APIs.

- [x] **Step 2: Build final artifacts only in memory**

For `write-chapter`:

1. preallocate stable `chapterId` and `chapterVersionId`;
2. extract summary/assets from final generated content;
3. create `syncId` from chapter/version + canonical delta;
4. merge assets in memory and synchronize outline nodes in memory;
5. construct completed task and non-streaming final assistant message in memory.

Do not call `upsertStoredNovelChapter` in this path.

- [x] **Step 3: Commit, then update UI**

Call `commitWriteChapterResult` once. Only after it resolves may the code set active chapter, update `latestChapters`, emit “已同步 / 已保存”, refresh workspace, and show success toast. Do not separately persist task/message afterward.

- [x] **Step 4: Define cancellation boundary**

Before commit: honor abort and persist no final assets. From `committing` until transaction completion: ignore/disable cancellation, then either complete or roll back. A cancelled task must never later report success.

- [x] **Step 5: Verify and commit**

```bash
git add apps/web/features/studio/actions/writing/commit-write-chapter-result.ts apps/web/features/studio/actions/run-core-action.ts apps/web/features/studio/actions
git commit -m "refactor(studio): commit write chapter results atomically"
```

---

# Batch 4 — Recovery and cleanup

## Task 6: Test reload behavior and remove obsolete success writes

**Status:** DONE

**Files:**

- Modify: `apps/web/features/studio/actions/run-core-action.ts`
- Modify: `apps/web/lib/novel-store.ts` / tests as required

- [x] **Step 1: Add recovery tests**

1. Reload after success: task is not `running`, message is not `streaming`, and chapter/assets appear once.
2. Abort before commit: no final chapter/version/book assets/final message persists.
3. Transaction abort: no partial state persists; retry produces one clean result.
4. After failure, the next write targets the original next chapter.

- [x] **Step 2: Remove obsolete write success paths**

In the write-chapter branch remove direct success-path calls to `upsertStoredNovelChapter`, final `updateStoredNovelBook`, final `finishStoredNovelTask`, and standalone final `persistMessage`. Retain them only for unrelated review/revise actions.

- [x] **Step 3: Verify identity search**

```bash
rg -n "appliedChapters|appliedSyncIds|legacyAppliedChapters|queueNovelPendingAssetDelta" apps/web/lib apps/web/features/studio
```

Only normalization/audit logic may read `legacyAppliedChapters`; no merge/migration early return may use it.

- [x] **Step 4: Run complete checks and manual acceptance**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
```

Manual acceptance: migrate an old book with two same-chapter deltas; generate and reload after a normal chapter; force a transaction failure in the test harness and verify the next attempt targets the same chapter.

- [x] **Step 5: Commit**

```bash
git add apps/web/lib apps/web/features/studio docs/superpowers
git commit -m "test(studio): cover sync migration and atomic write recovery"
```

---

# Batch 5 — Structured character profiles and complete right-panel roles

## Task 7: Add `characterProfiles`, migration, and idempotent state merge

**Precondition:** Batches 1–4 are green. Do not start this task while sync identity or atomic commit is failing.

**Files:**

- Modify: `apps/web/lib/novel-store.ts`
- Modify: `apps/web/lib/novel-asset-auto-sync.ts`
- Create/Modify: profile migration and merge tests

- [ ] **Step 1: Write failing profile tests**

Cover:

1. New-book initialization creates a protagonist profile from `project.protagonist`.
2. Legacy data migrates in fixed order: existing profiles → character knowledge assets → characters Markdown → protagonist.
3. A six-character legacy book produces six stable profile ids; no missing data is invented.
4. Applying one chapter `syncId` twice does not append duplicate state history.
5. A manual lock preserves locked role/relationship/current-state fields while unrelated state fields still synchronize.

- [ ] **Step 2: Define the authoritative model**

Add `NovelCharacterProfile` to `NovelProjectAssets.characterProfiles`. It must include stable `id`, name/aliases, tier, narrative role, traits, motivations, goals, relationships, current state, state history, source, and `manualLocks` as defined by the spec.

Use a single normalizer/migration helper. Existing Markdown, `knowledgeAssets(category === "character")`, and `project.protagonist` are compatibility inputs only; they are not read by new UI code once migration finishes.

- [ ] **Step 3: Extend chapter asset facts**

Change the chapter fact extractor to emit structured character state changes. Resolve profile by id, exact name, then alias. If unresolved, create a new profile only when the generated change includes a credible name; never turn headings such as “角色状态追踪” into a character.

- [ ] **Step 4: Merge safely**

For a chapter pipeline sync, update only `currentState` and append a state-history record that carries chapter id/number and the same `syncId` identity from Batch 1. Do not overwrite manual locks. Emit a stable needs-attention diagnostic for a lock conflict while allowing all independent fields to merge.

- [ ] **Step 5: Preserve old read/export compatibility**

Keep existing long-text/knowledge-asset data readable. If exporting legacy Markdown is required by current screens, derive it from profiles; do not maintain two independently editable sources of truth.

- [ ] **Step 6: Verify and commit**

```bash
git add apps/web/lib/novel-store.ts apps/web/lib/novel-asset-auto-sync.ts apps/web/lib/*character*test*
git commit -m "feat(studio): add structured character profile assets"
```

---

## Task 8: Rebuild the role section around all character profiles

**Status:** DONE (`01de35c`)

**Files:**

- Modify: `apps/web/features/studio/components/right-panel/right-panel-summaries.ts`
- Modify: `apps/web/features/studio/components/right-panel/CharactersSection.tsx`
- Modify: `apps/web/features/studio/components/right-panel/detail/CharacterDetailView.tsx`
- Modify: right-panel tests and CSS only as needed

- [x] **Step 1: Write component/view-model tests**

Assert that six profiles yield six visible list entries; current-chapter characters sort first but all others remain visible; no role row contains “待确认”; and the detail view exposes role, current state, relationships, source, and chronological history.

- [x] **Step 2: Replace temporary card builder**

Implement `buildCharacterProfilesView`. Retire `ParsedCharacter` / `buildCharacterStateCards(..., limit = 4)` as the right-panel authority. Do not parse Markdown inside React components.

- [x] **Step 3: Implement compact list and complete detail**

`CharactersSection` groups protagonist, major, and minor roles. Each compact row shows name, narrative role, state summary, and last synchronized chapter. `CharacterDetailView` exposes the full profile and an explicit manual edit action. Current chapter ordering is a sort preference only, not a filter.

- [x] **Step 4: Wire manual edits**

Manual profile edit writes `source: manual` and exact locks. Show synchronization diagnostics in the detail/diagnostics entry, not as a default confirmation badge.

- [x] **Step 5: Verify and commit**

```bash
git add apps/web/features/studio/components/right-panel apps/web/features/studio/studio.module.css
git commit -m "feat(studio): render complete synchronized character profiles"
```

---

# Batch 6 — One-click quality-controlled writing pipeline

## Task 9: Add task state machine, structured audit, and pipeline tests

**Status:** DONE (uncommitted)

**Precondition:** Character profiles and atomic commit are green. The pipeline must not bypass either.

**Files:**

- Create: `apps/web/features/studio/actions/writing/run-write-chapter-pipeline.ts`
- Modify: `apps/web/features/studio/actions/types.ts`
- Modify: task/checkpoint persistence in `apps/web/lib/novel-store.ts`
- Create: pipeline unit tests

- [x] **Step 1: Write failing pipeline tests**

Cover the sequence Writer → Auditor → optional Reviser → Re-auditor → facts → validation → commit. Include: audit schema failure retries once then becomes `completed_with_attention`; a critical issue triggers at most configured revisions; only the final selected version reaches asset extraction; cancellation before commit persists no final data.

- [x] **Step 2: Add explicit task stages**

Persist the state enum from the spec: `queued`, `preparing_context`, `planning`, `drafting`, `auditing`, `revising`, `reauditing`, `extracting_facts`, `syncing_assets`, `validating_state`, `committing`, terminal states. Store stage timeline, attempt counts, audit reference, version ids, and failure detail in the task/checkpoint model.

- [x] **Step 3: Build structured audit parser and thresholds**

Add a `ChapterAudit` parser/validator with total score, dimension scores, severity, evidence, and suggestions. Configure blocking rules (critical issue/minimum score) and max revision attempts (default 1, allowed 0–2). A parse failure must never become an implicit pass.

- [x] **Step 4: Implement pipeline stages without UI coupling**

`preparing_context` loads profiles and canonical assets; `planning` creates internal intent; `drafting` produces a candidate version; `auditing` evaluates it; `revising` changes only blocking concerns; `reauditing` validates revision; `extracting_facts` acts only on the chosen final version; `syncing_assets` uses stable syncId; `validating_state` prepares the atomic commit input.

- [x] **Step 5: Reuse manual actions**

Route manual review/revise through shared Auditor/Reviser and version/audit types. They may skip the full write pipeline, but must not create a parallel review schema.

- [x] **Step 6: Verify and commit**

```bash
git add apps/web/features/studio/actions/writing apps/web/features/studio/actions/types.ts apps/web/lib/novel-store.ts
git commit -m "feat(studio): add quality controlled write chapter pipeline"
```

---

## Task 10: Connect the pipeline to Agent UI and atomic completion

**Files:**

- Modify: `apps/web/features/studio/actions/run-core-action.ts`
- Modify: task progress/message components and chapter detail views
- Modify/Create: integration tests

- [ ] **Step 1: Replace write-chapter branch orchestration**

For `write-chapter`, `run-core-action.ts` only starts/resumes `runWriteChapterPipeline`, forwards stage events, and owns cancellation. It must not call Writer then persist directly. The pipeline’s `committing` stage must invoke the Batch 3 commit API exactly once.

- [ ] **Step 2: Render a compact, expandable task timeline**

Show context readiness, draft word count, audit total/dimensions, revision count, re-audit outcome, sync outcome, and final save. Keep audit issues/details collapsed by default; do not dump raw warnings into chapter prose.

- [ ] **Step 3: Implement terminal behavior**

`completed` displays successful final save. `completed_with_attention` stores best final version plus audit report and allows the next chapter unless state validation failed. `failed`/`cancelled` do not synchronize final assets. Stage terminal status, final assistant message, and chapter version must be written by the same Batch 3 transaction on successful terminals.

- [ ] **Step 4: Add integration/recovery tests**

Test a successful no-revision write, a critical-issue auto-revision, unrepaired-but-saveable attention, parser failure, cancellation, model failure, refresh after commit, and prevention of writing the next chapter when state validation failed.

- [ ] **Step 5: Run full checks and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
git add apps/web/features/studio apps/web/lib docs/superpowers
git commit -m "feat(studio): complete audited automatic chapter writing"
```

---

## Final acceptance checklist

- [ ] Auto-sync never uses chapter number as its idempotency key.
- [ ] Same-chapter historical deltas with different identities are all preserved/applied exactly once.
- [ ] v1 metadata upgrades to v2 without deleting unknown pending data.
- [ ] Sync diagnostics have stable ids and do not multiply on reload.
- [ ] One successful write commits chapter, version, book/assets, task, and final message in one IndexedDB transaction.
- [ ] Failed/aborted commits leave no partial chapter or asset state.
- [ ] UI success and “已保存” occur only after transaction commit.
- [ ] Right panel shows all character profiles, their roles and synchronized state histories, not four temporary cards.
- [ ] Locked manual character fields remain intact while safe generated changes still synchronize.
- [ ] One “写下一章” runs writer, structured audit, optional bounded revision, re-audit, fact synchronization, validation, and one atomic commit.
- [ ] Audit parsing failures and unresolved critical issues have explicit terminal states; they never masquerade as successful audits.
- [ ] Typecheck, lint, focused tests, transaction tests, and manual acceptance all pass.

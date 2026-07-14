import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NovelChapterAssetDelta, NovelProjectAssets } from "./novel-store.ts";
import { normalizePendingMigration } from "./novel-store.ts";
import {
  canonicalizeNovelChapterAssetDelta,
  countSyncAttentionDiagnostics,
  createChapterPipelineSyncId,
  createLegacyPendingSyncId,
  mergeNovelChapterAssetDeltaSafely,
  migratePendingAssetDeltas,
  stableHashCanonicalDelta,
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
    pendingMigration: { schemaVersion: 1, appliedChapters: [] },
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

describe("normalizePendingMigration", () => {
  it("upgrades v1 to v2 preserving chapter numbers in legacyAppliedChapters", () => {
    const result = normalizePendingMigration({
      schemaVersion: 1,
      appliedChapters: [1, 2, 3],
      skippedPendingIds: ["p1"],
      migratedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(result.schemaVersion, 2);
    assert.deepEqual(result.legacyAppliedChapters, [1, 2, 3]);
    assert.deepEqual(result.appliedSyncIds, []);
    assert.deepEqual(result.skippedPendingIds, ["p1"]);
    assert.equal(result.migratedAt, "2026-01-01T00:00:00.000Z");
    assert.deepEqual(result.appliedChapters, [1, 2, 3]);
  });

  it("does not put chapter numbers into appliedSyncIds", () => {
    const result = normalizePendingMigration({
      schemaVersion: 1,
      appliedChapters: [5, 10],
    });
    assert.deepEqual(result.appliedSyncIds, []);
    for (const chapter of [5, 10]) {
      assert.ok(!result.appliedSyncIds.includes(String(chapter)));
    }
  });

  it("default assets contain empty v2 arrays", () => {
    const result = normalizePendingMigration(undefined);
    assert.equal(result.schemaVersion, 2);
    assert.deepEqual(result.appliedSyncIds, []);
    assert.deepEqual(result.legacyAppliedChapters, []);
    assert.deepEqual(result.skippedPendingIds, []);
  });

  it("normalization is idempotent", () => {
    const once = normalizePendingMigration({
      schemaVersion: 1,
      appliedChapters: [1],
      skippedPendingIds: ["x"],
    });
    const twice = normalizePendingMigration(once);
    assert.deepEqual(twice, once);
  });
});

describe("canonical identity helpers", () => {
  it("reordered equivalent arrays produce the same canonical hash", () => {
    const left = canonicalizeNovelChapterAssetDelta(
      sampleDelta({
        newForeshadowing: ["b", "a"],
        worldIncrements: ["z", "y"],
        characterStates: [
          { title: "乙", content: "状态 B" },
          { title: "甲", content: "状态 A" },
        ],
      }),
    );
    const right = canonicalizeNovelChapterAssetDelta(
      sampleDelta({
        newForeshadowing: ["a", "b"],
        worldIncrements: ["y", "z"],
        characterStates: [
          { title: "甲", content: "状态 A" },
          { title: "乙", content: "状态 B" },
        ],
      }),
    );
    assert.deepEqual(left, right);
    assert.equal(
      stableHashCanonicalDelta(left),
      stableHashCanonicalDelta(right),
    );
  });

  it("changed delta content produces a different hash", () => {
    const base = canonicalizeNovelChapterAssetDelta(sampleDelta());
    const changed = canonicalizeNovelChapterAssetDelta(
      sampleDelta({ summary: "不同的摘要" }),
    );
    assert.notEqual(
      stableHashCanonicalDelta(base),
      stableHashCanonicalDelta(changed),
    );
  });

  it("createChapterPipelineSyncId is deterministic for equivalent deltas", () => {
    const delta = sampleDelta({ newForeshadowing: ["b", "a"] });
    const first = createChapterPipelineSyncId({
      chapterId: "book-1-chapter-0001",
      chapterVersionId: "book-1-chapter-0001",
      delta,
    });
    const second = createChapterPipelineSyncId({
      chapterId: "book-1-chapter-0001",
      chapterVersionId: "book-1-chapter-0001",
      delta: sampleDelta({ newForeshadowing: ["a", "b"] }),
    });
    assert.equal(first, second);
  });

  it("createLegacyPendingSyncId uses pending id", () => {
    assert.equal(createLegacyPendingSyncId({ id: "p1" }), "legacy:p1");
  });
});

describe("mergeNovelChapterAssetDeltaSafely", () => {
  it("applies delta once for the same syncId", () => {
    const syncId = "chapter-1:version-1:abc12345";
    const before = emptyAssets();
    const first = mergeNovelChapterAssetDeltaSafely(before, sampleDelta(), {
      source: "chapter-pipeline",
      syncId,
    });
    const characterCount = first.assets.knowledgeAssets.filter(
      (asset) => asset.category === "character",
    ).length;
    const second = mergeNovelChapterAssetDeltaSafely(
      first.assets,
      sampleDelta(),
      { source: "chapter-pipeline", syncId },
    );

    assert.equal(first.status, "applied");
    assert.equal(second.status, "skipped");
    assert.equal(second.assets, first.assets);
    assert.equal(
      second.assets.knowledgeAssets.filter(
        (asset) => asset.category === "character",
      ).length,
      characterCount,
    );
    assert.deepEqual(first.assets.pendingMigration?.appliedSyncIds, [syncId]);
  });

  it("applies two different syncIds for the same chapter", () => {
    const deltaA = sampleDelta({
      characterStates: [{ title: "林照", content: "追查档案" }],
      newForeshadowing: [],
      worldIncrements: [],
    });
    const deltaB = sampleDelta({
      characterStates: [{ title: "沈砚", content: "收到匿名信" }],
      newForeshadowing: [],
      worldIncrements: [],
    });
    const first = mergeNovelChapterAssetDeltaSafely(emptyAssets(), deltaA, {
      source: "chapter-pipeline",
      syncId: "sync-a",
    });
    const second = mergeNovelChapterAssetDeltaSafely(
      first.assets,
      deltaB,
      { source: "chapter-pipeline", syncId: "sync-b" },
    );

    assert.equal(first.status, "applied");
    assert.equal(second.status, "applied");
    assert.deepEqual(second.assets.pendingMigration?.appliedSyncIds, [
      "sync-a",
      "sync-b",
    ]);
    assert.equal(
      second.assets.knowledgeAssets.filter(
        (asset) => asset.category === "character",
      ).length,
      2,
    );
  });

  it("returns needs-attention for empty or summary-only delta", () => {
    const syncId = "legacy:p-empty";
    const empty = sampleDelta({
      summary: "summary only",
      characterStates: [],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      worldIncrements: [],
    });
    const before = emptyAssets();
    const result = mergeNovelChapterAssetDeltaSafely(before, empty, {
      source: "migration",
      syncId,
    });

    assert.equal(result.status, "needs-attention");
    assert.deepEqual(result.assets.pendingMigration, before.pendingMigration);
    assert.equal(result.assets.knowledgeAssets.length, before.knowledgeAssets.length);
    assert.equal(countSyncAttentionDiagnostics(result.assets), 1);
    assert.equal(result.assets.diagnostics?.[0]?.id, `sync-diag:${syncId}`);
  });

  it("upserts one stable diagnostic for repeated needs-attention", () => {
    const syncId = "legacy:p-empty";
    const empty = sampleDelta({
      summary: "summary only",
      characterStates: [],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      worldIncrements: [],
    });
    const first = mergeNovelChapterAssetDeltaSafely(emptyAssets(), empty, {
      source: "migration",
      syncId,
    });
    const second = mergeNovelChapterAssetDeltaSafely(first.assets, empty, {
      source: "migration",
      syncId,
    });

    assert.equal(first.status, "needs-attention");
    assert.equal(second.status, "needs-attention");
    assert.equal(countSyncAttentionDiagnostics(second.assets), 1);
    assert.equal(second.assets.diagnostics?.[0]?.id, `sync-diag:${syncId}`);
  });
});

describe("migratePendingAssetDeltas", () => {
  it("applies pending in chapter order and records appliedSyncIds", () => {
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
    assert.deepEqual(result.pendingMigration?.appliedSyncIds, [
      "legacy:p1",
      "legacy:p2",
    ]);
  });

  it("applies two pending ids for the same chapter", () => {
    const assets = emptyAssets({
      pendingAssetDeltas: [
        {
          id: "p1",
          createdAt: "2026-01-01T00:00:00.000Z",
          ...sampleDelta({
            characterStates: [{ title: "林照", content: "追查档案" }],
            newForeshadowing: [],
            worldIncrements: [],
          }),
        },
        {
          id: "p2",
          createdAt: "2026-01-02T00:00:00.000Z",
          ...sampleDelta({
            characterStates: [{ title: "沈砚", content: "收到匿名信" }],
            newForeshadowing: [],
            worldIncrements: [],
          }),
        },
      ],
    });
    const result = migratePendingAssetDeltas(assets);

    assert.equal(result.pendingAssetDeltas.length, 0);
    assert.deepEqual(result.pendingMigration?.appliedSyncIds, [
      "legacy:p1",
      "legacy:p2",
    ]);
    assert.equal(
      result.knowledgeAssets.filter((asset) => asset.category === "character")
        .length,
      2,
    );
  });

  it("does not skip pending when chapter is only in legacyAppliedChapters", () => {
    const assets = emptyAssets({
      pendingMigration: normalizePendingMigration({
        schemaVersion: 1,
        appliedChapters: [1],
      }),
      pendingAssetDeltas: [
        {
          id: "p1",
          createdAt: "2026-01-01T00:00:00.000Z",
          ...sampleDelta(),
        },
      ],
    });
    const result = migratePendingAssetDeltas(assets);

    assert.equal(result.pendingAssetDeltas.length, 0);
    assert.deepEqual(result.pendingMigration?.legacyAppliedChapters, [1]);
    assert.deepEqual(result.pendingMigration?.appliedSyncIds, ["legacy:p1"]);
  });

  it("keeps summary-only pending with one stable diagnostic", () => {
    const emptyContentPending = {
      id: "p-empty",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...sampleDelta({
        summary: "summary only",
        characterStates: [],
        newForeshadowing: [],
        resolvedForeshadowing: [],
        worldIncrements: [],
      }),
    };
    const assets = emptyAssets({
      pendingAssetDeltas: [emptyContentPending],
    });
    const result = migratePendingAssetDeltas(assets);

    assert.equal(result.pendingAssetDeltas.length, 1);
    assert.equal(result.pendingAssetDeltas[0]?.id, "p-empty");
    assert.deepEqual(result.pendingMigration?.appliedSyncIds, []);
    assert.ok(result.pendingMigration?.skippedPendingIds?.includes("p-empty"));
    assert.equal(countSyncAttentionDiagnostics(result), 1);
    assert.equal(
      result.diagnostics?.[0]?.id,
      "sync-diag:legacy:p-empty",
    );
  });

  it("does not re-apply already applied syncIds on second migrate", () => {
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
      (asset) => asset.category === "character",
    ).length;
    const twice = migratePendingAssetDeltas(once);

    assert.equal(
      twice.knowledgeAssets.filter((asset) => asset.category === "character")
        .length,
      charCount,
    );
    assert.deepEqual(twice.pendingMigration?.appliedSyncIds, ["legacy:p1"]);
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

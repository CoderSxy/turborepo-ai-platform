import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NovelChapterAssetDelta, NovelProjectAssets } from "./novel-store.ts";
import { normalizePendingMigration } from "./novel-store.ts";
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
    assert.equal(result, before);
    assert.equal(result.pendingMigration, before.pendingMigration);
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

  it("keeps pending item when chapter was not applied after merge attempt", () => {
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
    assert.ok(!result.pendingMigration?.appliedChapters.includes(1));
    assert.ok(result.pendingMigration?.skippedPendingIds?.includes("p-empty"));
    assert.ok(result.pendingMigration?.migratedAt);
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

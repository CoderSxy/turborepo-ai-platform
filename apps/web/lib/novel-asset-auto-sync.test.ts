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

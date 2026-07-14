import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NovelProjectAssets } from "../../../../lib/novel-store.ts";
import {
  buildCharacterStateCards,
  pickCharactersForChapterPreview,
} from "./right-panel-summaries.ts";

function emptyAssets(
  overrides: Partial<NovelProjectAssets> = {},
): NovelProjectAssets {
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

describe("buildCharacterStateCards", () => {
  it("shows protagonist fallback for a new book with plain-text characters", () => {
    const assets = emptyAssets({
      characters: "林照，档案修复师，习惯把真相藏进备份。",
      knowledgeAssets: [
        {
          id: "asset-character-1",
          category: "character",
          title: "主角",
          content: "林照，档案修复师，习惯把真相藏进备份。",
          status: "active",
          tags: ["主角"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const cards = buildCharacterStateCards(
      assets,
      { protagonist: "林照，档案修复师，习惯把真相藏进备份。" },
      null,
    );

    assert.ok(cards.length >= 1);
    assert.equal(cards[0]?.name === "林照" || cards[0]?.name === "主角", true);
    assert.match(cards[0]?.current ?? "", /档案修复师/);
  });

  it("does not surface pending deltas as 待确认 cards", () => {
    const assets = emptyAssets({
      characters: "林照，档案修复师。",
      pendingAssetDeltas: [
        {
          id: "pending-1",
          createdAt: "2026-01-02T00:00:00.000Z",
          chapterNumber: 1,
          chapterTitle: "雨夜来信",
          summary: "开章",
          characterStates: [
            { title: "林照", content: "决定追查裂缝档案" },
            { title: "沈雪", content: "首次现身寄来匿名信" },
          ],
          newForeshadowing: [],
          resolvedForeshadowing: [],
          worldIncrements: [],
        },
      ],
    });

    const cards = buildCharacterStateCards(
      assets,
      { protagonist: "林照，档案修复师。" },
      1,
    );

    const labels = cards.flatMap((card) => [card.role, card.tags, card.current]);
    assert.equal(labels.some((label) => /待确认/.test(label ?? "")), false);
    assert.equal(cards.some((card) => card.pending === true), false);
  });

  it("reads confirmed knowledgeAssets character cards", () => {
    const assets = emptyAssets({
      knowledgeAssets: [
        {
          id: "c1",
          category: "character",
          title: "林照",
          content: "档案修复师，正在追查裂缝。",
          status: "active",
          tags: ["主角"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const cards = buildCharacterStateCards(assets, { protagonist: "" }, null);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.name, "林照");
    assert.equal(cards[0]?.role, "主角");
    assert.match(cards[0]?.current ?? "", /追查裂缝/);
  });

  it("parses matrix markdown and ignores 角色状态追踪 section heading", () => {
    const assets = emptyAssets({
      characters: [
        "## 林照",
        "- **定位**: 主角",
        "- **标签**: 档案",
        "- **当前**: 仍在修复备份",
        "",
        "## 角色状态追踪",
        "- 林照：决定追查裂缝档案",
        "- 沈雪：寄出匿名信",
      ].join("\n"),
    });

    const cards = buildCharacterStateCards(assets, { protagonist: "" }, null);
    const names = cards.map((card) => card.name);

    assert.ok(names.includes("林照"));
    assert.ok(names.includes("沈雪"));
    assert.equal(names.includes("角色状态追踪"), false);
  });

  it("pickCharactersForChapterPreview uses the unified builder", () => {
    const assets = emptyAssets({
      outlineNodes: [
        {
          id: "outline-1",
          chapterNumber: 1,
          title: "雨夜来信",
          summary: "开章",
          characters: "林照",
          beats: "",
        },
      ],
      knowledgeAssets: [
        {
          id: "c1",
          category: "character",
          title: "林照",
          content: "决定追查裂缝档案。",
          status: "active",
          tags: ["主角"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const preview = pickCharactersForChapterPreview(assets, 1);
    assert.equal(preview.length, 1);
    assert.equal(preview[0]?.name, "林照");
    assert.equal(preview[0]?.role, "主角");
  });
});

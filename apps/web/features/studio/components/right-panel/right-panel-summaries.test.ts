import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStableCharacterProfileId } from "../../../../lib/novel-character-profiles.ts";
import type { NovelCharacterProfile, NovelProjectAssets } from "../../../../lib/novel-store.ts";
import {
  buildCharacterDetailViewModel,
  buildCharacterProfilesView,
} from "./right-panel-summaries.ts";

function profile(
  input: Partial<NovelCharacterProfile> & Pick<NovelCharacterProfile, "name" | "tier">,
): NovelCharacterProfile {
  return {
    id: input.id ?? createStableCharacterProfileId(input.name),
    name: input.name,
    aliases: input.aliases ?? [],
    tier: input.tier,
    narrativeRole: input.narrativeRole ?? "",
    coreTraits: input.coreTraits ?? [],
    motivations: input.motivations ?? [],
    goals: input.goals ?? [],
    relationships: input.relationships ?? [],
    currentState: input.currentState ?? {
      summary: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    stateHistory: input.stateHistory ?? [],
    manualLocks: input.manualLocks ?? [],
    source: input.source ?? "migration",
  };
}

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
    characterProfiles: [],
    ...overrides,
  };
}

const sixProfiles = [
  profile({
    name: "林照",
    tier: "protagonist",
    narrativeRole: "主角",
    currentState: { summary: "追查裂缝档案", chapterNumber: 3, updatedAt: "2026-01-03T00:00:00.000Z" },
  }),
  profile({
    name: "沈雪",
    tier: "major",
    narrativeRole: "匿名信提供者",
    currentState: { summary: "寄出匿名信", chapterNumber: 3, updatedAt: "2026-01-03T00:00:00.000Z" },
  }),
  profile({
    name: "苏晚",
    tier: "major",
    narrativeRole: "旧同事",
    currentState: { summary: "阻止调取备份", chapterNumber: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
  }),
  profile({
    name: "韩策",
    tier: "minor",
    narrativeRole: "监视者",
    currentState: { summary: "暗中监视档案室", chapterNumber: 3, updatedAt: "2026-01-03T00:00:00.000Z" },
  }),
  profile({
    name: "顾长安",
    tier: "minor",
    narrativeRole: "线人",
    currentState: { summary: "提供旧案线索", chapterNumber: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
  }),
  profile({
    name: "周明",
    tier: "minor",
    narrativeRole: "保安",
    currentState: { summary: "值班中", chapterNumber: 2, updatedAt: "2026-01-02T00:00:00.000Z" },
  }),
];

describe("buildCharacterProfilesView", () => {
  it("shows all six profiles without a four-item cap", () => {
    const assets = emptyAssets({
      characterProfiles: sixProfiles,
      outlineNodes: [
        {
          id: "outline-3",
          chapterNumber: 3,
          title: "雨夜来信",
          summary: "开章",
          characters: "沈雪,韩策",
          beats: "",
        },
      ],
    });

    const view = buildCharacterProfilesView(assets, 3);

    assert.equal(view.totalCount, 6);
    assert.equal(view.allRows.length, 6);
    assert.equal(
      view.groups.reduce((count, group) => count + group.rows.length, 0),
      6,
    );
  });

  it("sorts current-chapter characters first within each tier group without hiding others", () => {
    const assets = emptyAssets({
      characterProfiles: sixProfiles,
      outlineNodes: [
        {
          id: "outline-3",
          chapterNumber: 3,
          title: "雨夜来信",
          summary: "开章",
          characters: "沈雪,韩策",
          beats: "",
        },
      ],
    });

    const view = buildCharacterProfilesView(assets, 3);
    const majorGroup = view.groups.find((group) => group.tier === "major");
    const minorGroup = view.groups.find((group) => group.tier === "minor");

    assert.deepEqual(
      majorGroup?.rows.map((row) => row.profile.name),
      ["沈雪", "苏晚"],
    );
    assert.deepEqual(
      minorGroup?.rows.map((row) => row.profile.name),
      ["韩策", "顾长安", "周明"],
    );
    assert.equal(view.allRows.length, 6);
  });

  it("does not label role rows as 待确认 for pending deltas", () => {
    const assets = emptyAssets({
      characterProfiles: sixProfiles,
      pendingAssetDeltas: [
        {
          id: "pending-1",
          createdAt: "2026-01-02T00:00:00.000Z",
          chapterNumber: 3,
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

    const view = buildCharacterProfilesView(assets, 3);
    const labels = view.allRows.flatMap((row) => [
      row.narrativeRole,
      row.stateSummary,
    ]);

    assert.equal(labels.some((label) => /待确认/.test(label)), false);
  });
});

describe("buildCharacterDetailViewModel", () => {
  it("exposes role, current state, relationships, source, and chronological history", () => {
    const assets = emptyAssets({
      characterProfiles: [
        profile({
          name: "林照",
          tier: "protagonist",
          narrativeRole: "主角",
          coreTraits: ["冷静"],
          motivations: ["追查真相"],
          goals: ["修复档案"],
          relationships: [
            {
              targetName: "沈雪",
              label: "旧识",
              state: "互有戒备",
            },
          ],
          currentState: {
            summary: "决定追查裂缝档案",
            chapterNumber: 3,
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
          stateHistory: [
            {
              chapterNumber: 2,
              summary: "收到匿名信",
              changes: ["收到匿名信"],
              source: "chapter-pipeline",
              createdAt: "2026-01-02T00:00:00.000Z",
            },
            {
              chapterNumber: 3,
              summary: "决定追查裂缝档案",
              changes: ["开始追查"],
              source: "chapter-pipeline",
              createdAt: "2026-01-03T00:00:00.000Z",
            },
          ],
          source: "chapter-pipeline",
        }),
      ],
      diagnostics: [
        {
          id: "char-lock-diag:character-林照:sync-1",
          label: "角色同步 · 林照",
          ok: false,
          detail: "定位字段已人工锁定",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const detail = buildCharacterDetailViewModel(assets, "林照");

    assert.ok(detail);
    assert.equal(detail.profile.narrativeRole, "主角");
    assert.equal(detail.profile.currentState.summary, "决定追查裂缝档案");
    assert.equal(detail.profile.relationships.length, 1);
    assert.equal(detail.sourceLabel, "章节同步");
    assert.deepEqual(
      detail.stateHistory.map((entry) => entry.chapterNumber),
      [2, 3],
    );
    assert.equal(detail.diagnostics.length, 1);
    assert.match(detail.diagnostics[0]?.detail ?? "", /人工锁定/);
  });
});

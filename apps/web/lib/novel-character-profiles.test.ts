import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelChapterAssetDelta, NovelProjectAssets } from "./novel-store.ts";
import { applyNovelChapterAssetDelta, normalizeNovelProjectAssets } from "./novel-store.ts";
import { mergeNovelChapterAssetDeltaSafely } from "./novel-asset-auto-sync.ts";
import {
  createStableCharacterProfileId,
  isCredibleCharacterName,
  migrateCharacterProfiles,
  normalizeCharacterProfiles,
} from "./novel-character-profiles.ts";

const demoProject: InkosNovelProject = {
  title: "测试书",
  genre: "悬疑",
  platform: "通用",
  language: "zh",
  targetChapters: 10,
  chapterWordCount: 3000,
  premise: "测试前提",
  protagonist: "林照，档案修复师，习惯把真相藏进备份。",
  world: "近未来城市",
  currentStage: "chapter-plan",
  chapters: [],
};

function baseAssets(overrides: Partial<NovelProjectAssets> = {}): NovelProjectAssets {
  return normalizeNovelProjectAssets(demoProject, {
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
    pendingMigration: {
      schemaVersion: 2,
      appliedSyncIds: [],
      legacyAppliedChapters: [],
      skippedPendingIds: [],
    },
    ...overrides,
  });
}

describe("character profile foundation init", () => {
  it("creates a protagonist profile from project.protagonist for new books", () => {
    const profiles = normalizeCharacterProfiles(demoProject, undefined, {
      characterProfiles: [],
      knowledgeAssets: [],
      characters: "",
    });

    assert.equal(profiles.length, 1);
    assert.equal(profiles[0]?.name, "林照");
    assert.equal(profiles[0]?.tier, "protagonist");
    assert.equal(profiles[0]?.id, createStableCharacterProfileId("林照"));
    assert.equal(profiles[0]?.source, "foundation");
    assert.match(profiles[0]?.narrativeRole ?? "", /档案修复师/);
  });
});

describe("character profile legacy migration", () => {
  function legacyAssets(
    overrides: Partial<
      Pick<NovelProjectAssets, "characterProfiles" | "knowledgeAssets" | "characters">
    > = {},
  ) {
    return {
      characterProfiles: overrides.characterProfiles ?? [],
      knowledgeAssets: overrides.knowledgeAssets ?? [],
      characters: overrides.characters ?? "",
    };
  }

  it("migrates in fixed order: profiles → knowledge assets → markdown → protagonist", () => {
    const existingProfile = {
      id: createStableCharacterProfileId("顾长安"),
      name: "顾长安",
      aliases: [],
      tier: "major" as const,
      narrativeRole: "已有档案定位",
      coreTraits: ["冷静"],
      motivations: [],
      goals: [],
      relationships: [],
      currentState: {
        summary: "已有状态",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      stateHistory: [],
      manualLocks: [],
      source: "migration" as const,
    };

    const assets = legacyAssets({
      characterProfiles: [existingProfile],
      knowledgeAssets: [
        {
          id: "ka-lin",
          category: "character",
          title: "林照",
          content: "档案修复师，追查缺失三年。",
          status: "active",
          tags: ["角色"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "ka-shen",
          category: "character",
          title: "沈砚",
          content: "匿名信提供者。",
          status: "active",
          tags: ["角色"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      characters: [
        "## 苏晚",
        "- **定位**: 旧同事",
        "- **当前**: 阻止调取备份",
        "",
        "## 角色状态追踪",
        "- 角色状态追踪：不应成为角色",
        "- 韩策：暗中监视档案室",
      ].join("\n"),
    });

    const profiles = migrateCharacterProfiles(demoProject, assets);

    const byName = new Map(profiles.map((profile) => [profile.name, profile]));

    assert.equal(byName.get("顾长安")?.narrativeRole, "已有档案定位");
    assert.equal(byName.get("林照")?.narrativeRole, "档案修复师，追查缺失三年。");
    assert.equal(byName.get("沈砚")?.narrativeRole, "匿名信提供者。");
    assert.equal(byName.get("苏晚")?.narrativeRole, "旧同事");
    assert.equal(byName.get("苏晚")?.currentState.summary, "阻止调取备份");
    assert.equal(byName.get("韩策")?.currentState.summary, "暗中监视档案室");
    assert.equal(byName.has("角色状态追踪"), false);
  });

  it("produces six stable profile ids for a six-character legacy book without inventing data", () => {
    const legacyProject: InkosNovelProject = {
      ...demoProject,
      protagonist: "林照，档案修复师。",
    };
    const assets = legacyAssets({
      knowledgeAssets: [
        {
          id: "k1",
          category: "character",
          title: "林照",
          content: "主角描述",
          status: "active",
          tags: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "k2",
          category: "character",
          title: "沈砚",
          content: "配角 A",
          status: "active",
          tags: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "k3",
          category: "character",
          title: "苏晚",
          content: "配角 B",
          status: "active",
          tags: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      characters: [
        "## 顾长安",
        "- **定位**: 调查员",
        "",
        "## 韩策",
        "- **定位**: 公司安保",
        "",
        "## 角色状态追踪",
        "- 秦声：证人",
      ].join("\n"),
    });

    const profiles = migrateCharacterProfiles(legacyProject, assets);

    assert.equal(profiles.length, 6);
    const names = profiles
      .map((profile) => profile.name)
      .sort((left, right) => left.localeCompare(right, "zh-CN"));
    assert.deepEqual(names, ["林照", "沈砚", "苏晚", "顾长安", "韩策", "秦声"].sort(
      (left, right) => left.localeCompare(right, "zh-CN"),
    ));

    for (const profile of profiles) {
      assert.equal(profile.id, createStableCharacterProfileId(profile.name));
      assert.equal(profile.motivations.length, 0);
      assert.equal(profile.goals.length, 0);
      assert.equal(profile.relationships.length, 0);
    }

    assert.equal(profiles.find((profile) => profile.name === "林照")?.tier, "protagonist");
    assert.equal(profiles.find((profile) => profile.name === "秦声")?.currentState.summary, "证人");
    assert.equal(
      profiles.find((profile) => profile.name === "顾长安")?.narrativeRole,
      "调查员",
    );
  });
});

describe("character profile chapter sync", () => {
  it("does not append duplicate state history when the same chapter syncId merges twice", () => {
    const profileId = createStableCharacterProfileId("林照");
    const assets = baseAssets({
      characterProfiles: [
        {
          id: profileId,
          name: "林照",
          aliases: [],
          tier: "protagonist",
          narrativeRole: "档案修复师",
          coreTraits: [],
          motivations: [],
          goals: [],
          relationships: [],
          currentState: {
            summary: "初始状态",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          stateHistory: [],
          manualLocks: [],
          source: "foundation",
        },
      ],
    });

    const delta: NovelChapterAssetDelta = {
      chapterNumber: 2,
      chapterTitle: "缺页档案",
      summary: "林照发现空白页。",
      characterStates: [{ title: "林照", content: "决定追查空白档案。" }],
      characterStateChanges: [
        {
          characterId: profileId,
          characterName: "林照",
          summary: "决定追查空白档案。",
          changes: ["决定追查空白档案。"],
        },
      ],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      worldIncrements: [],
    };

    const syncId = "chapter-2:version-2:abc12345";
    const first = mergeNovelChapterAssetDeltaSafely(assets, delta, {
      source: "chapter-pipeline",
      syncId,
    });
    assert.equal(first.status, "applied");

    const historyAfterFirst =
      first.assets.characterProfiles?.find((profile) => profile.id === profileId)
        ?.stateHistory ?? [];
    assert.equal(historyAfterFirst.length, 1);
    assert.equal(historyAfterFirst[0]?.syncId, syncId);

    const second = mergeNovelChapterAssetDeltaSafely(first.assets, delta, {
      source: "chapter-pipeline",
      syncId,
    });
    assert.equal(second.status, "skipped");

    const historyAfterSecond =
      second.assets.characterProfiles?.find((profile) => profile.id === profileId)
        ?.stateHistory ?? [];
    assert.equal(historyAfterSecond.length, 1);
  });

  it("preserves manual locks while unrelated fields still synchronize", () => {
    const profileId = createStableCharacterProfileId("林照");
    const assets = baseAssets({
      characterProfiles: [
        {
          id: profileId,
          name: "林照",
          aliases: ["小林"],
          tier: "protagonist",
          narrativeRole: "人工锁定定位",
          coreTraits: ["谨慎"],
          motivations: [],
          goals: [],
          relationships: [
            {
              targetName: "沈砚",
              label: "同盟",
              state: "互不信任",
            },
          ],
          currentState: {
            summary: "人工锁定状态",
            location: "档案室",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          stateHistory: [],
          manualLocks: ["narrativeRole", "relationships", "currentState"],
          source: "manual",
        },
      ],
    });

    const delta: NovelChapterAssetDelta = {
      chapterNumber: 3,
      chapterTitle: "备份人",
      summary: "林照见到证人。",
      characterStates: [{ title: "林照", content: "情绪紧张，目标转向证人。" }],
      characterStateChanges: [
        {
          characterId: profileId,
          characterName: "林照",
          summary: "情绪紧张，目标转向证人。",
          emotional: "紧张",
          objective: "找到证人",
          changes: ["情绪紧张", "目标转向证人"],
        },
      ],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      worldIncrements: ["裂缝会放大记忆噪声。"],
    };

    const syncId = "chapter-3:version-3:def67890";
    const result = applyNovelChapterAssetDelta(assets, delta, {
      syncId,
      source: "chapter-pipeline",
    });

    const profile = result.characterProfiles?.find((item) => item.id === profileId);
    assert.ok(profile);
    assert.equal(profile.narrativeRole, "人工锁定定位");
    assert.equal(profile.currentState.summary, "人工锁定状态");
    assert.equal(profile.currentState.location, "档案室");
    assert.equal(profile.relationships[0]?.state, "互不信任");
    assert.deepEqual(profile.coreTraits, ["谨慎", "紧张"]);

    const lockDiagnostic = result.diagnostics?.find((item) =>
      item.id.startsWith(`char-lock-diag:${profileId}:`),
    );
    assert.ok(lockDiagnostic);
    assert.equal(lockDiagnostic.ok, false);
  });
});

describe("isCredibleCharacterName", () => {
  it("rejects section headings such as 角色状态追踪", () => {
    assert.equal(isCredibleCharacterName("角色状态追踪"), false);
    assert.equal(isCredibleCharacterName("林照"), true);
  });
});

import type { InkosNovelProject } from "@repo/inkos-adapter";
import { countSyncAttentionDiagnostics } from "#lib/novel-asset-auto-sync";
import type {
  NovelCharacterProfile,
  NovelCharacterProfileTier,
  NovelCharacterStateHistoryEntry,
  NovelProjectAssets,
} from "../../../../lib/novel-store";

type MatrixCharacter = {
  name: string;
  role: string;
  tags: string;
  current: string;
};

const TIER_LABELS: Record<NovelCharacterProfileTier, string> = {
  protagonist: "主角",
  major: "主要角色",
  minor: "次要角色",
};

const SOURCE_LABELS: Record<NovelCharacterProfile["source"], string> = {
  foundation: "基础设定",
  "chapter-pipeline": "章节同步",
  manual: "人工编辑",
  migration: "历史迁移",
};

export function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

export function parseCharacterMatrix(markdown: string): MatrixCharacter[] {
  if (!markdown.trim()) {
    return [];
  }

  const characters: MatrixCharacter[] = [];
  const sections = markdown.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0]?.trim() ?? "";
    if (!name) {
      continue;
    }

    const fields: Record<string, string> = {};
    for (let index = 1; index < lines.length; index += 1) {
      const match = lines[index]?.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        fields[match[1]!] = match[2]!.trim();
      }
    }

    characters.push({
      name,
      role: fields["定位"] ?? fields["Role"] ?? "",
      tags: fields["标签"] ?? fields["Tags"] ?? "",
      current: fields["当前"] ?? fields["Current"] ?? fields["状态"] ?? "",
    });
  }

  return characters;
}

export function buildWorldSummaryText(
  project: Pick<InkosNovelProject, "world">,
  assets: Pick<NovelProjectAssets, "worldNotes">,
): string {
  const fromNotes = extractStoryBibleSection(assets.worldNotes, /世界观|world/i);
  if (fromNotes) {
    return fromNotes;
  }
  if (project.world.trim()) {
    return project.world.trim();
  }
  if (assets.worldNotes.trim()) {
    return assets.worldNotes.trim().split("\n\n")[0] ?? "";
  }
  return "";
}

export function buildCharacterSummaryText(
  project: Pick<InkosNovelProject, "protagonist">,
  assets: Pick<NovelProjectAssets, "characters" | "characterProfiles">,
): { protagonist: string; supporting: string; supportingCount: number } {
  const protagonistFromProfiles =
    assets.characterProfiles?.find((profile) => profile.tier === "protagonist")
      ?.name ?? "";

  const protagonist =
    extractStoryBibleSection(assets.characters, /主角|protagonist/i) ||
    project.protagonist.trim() ||
    protagonistFromProfiles ||
    parseCharacterMatrix(assets.characters).find((item) =>
      /主角|protagonist/i.test(item.role),
    )?.name ||
    "";

  const supporting =
    extractStoryBibleSection(assets.characters, /配角|supporting|cast/i) || "";

  const supportingCount = supporting
    ? supporting.split("\n").filter((line) => line.trim().startsWith("-")).length ||
      1
    : Math.max(
        (assets.characterProfiles?.length ?? 0) - (protagonist ? 1 : 0),
        parseCharacterMatrix(assets.characters).length - (protagonist ? 1 : 0),
        0,
      );

  return { protagonist, supporting, supportingCount };
}

function extractStoryBibleSection(content: string, pattern: RegExp): string {
  if (!content.trim()) {
    return "";
  }

  const sections = content.split(/^##\s+/m);
  for (const section of sections) {
    if (!pattern.test(section)) {
      continue;
    }
    return section.replace(/^[^\n]+\n/, "").trim().split("\n\n")[0] ?? "";
  }

  return "";
}

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

export function getCurrentChapterCharacterNames(
  assets: NovelProjectAssets,
  chapterNumber: number | null,
): string[] {
  if (!chapterNumber) {
    return [];
  }

  const names = new Set<string>();
  const outlineNode = assets.outlineNodes.find(
    (node) => node.chapterNumber === chapterNumber,
  );

  if (outlineNode?.characters.trim()) {
    for (const name of outlineNode.characters.split(/[,，、/|]/)) {
      const trimmed = name.trim();
      if (trimmed) {
        names.add(trimmed);
      }
    }
  }

  for (const delta of assets.pendingAssetDeltas) {
    if (delta.chapterNumber !== chapterNumber) {
      continue;
    }
    for (const state of delta.characterStates) {
      if (state.title.trim()) {
        names.add(state.title.trim());
      }
    }
  }

  return [...names];
}

export type CharacterProfileRowView = {
  profile: NovelCharacterProfile;
  narrativeRole: string;
  stateSummary: string;
  lastSyncedChapter: number | null;
  isCurrentChapter: boolean;
};

export type CharacterProfileGroupView = {
  tier: NovelCharacterProfileTier;
  label: string;
  rows: CharacterProfileRowView[];
};

export type CharacterProfilesView = {
  groups: CharacterProfileGroupView[];
  allRows: CharacterProfileRowView[];
  totalCount: number;
  summaryText: string;
};

export type CharacterDetailViewModel = {
  profile: NovelCharacterProfile;
  sourceLabel: string;
  stateHistory: NovelCharacterStateHistoryEntry[];
  diagnostics: NonNullable<NovelProjectAssets["diagnostics"]>;
};

function getLastSyncedChapter(profile: NovelCharacterProfile): number | null {
  if (profile.currentState.chapterNumber !== undefined) {
    return profile.currentState.chapterNumber;
  }

  const latestHistory = profile.stateHistory.at(-1);
  return latestHistory?.chapterNumber ?? null;
}

function isProfileInCurrentChapter(
  profile: NovelCharacterProfile,
  chapterNames: string[],
): boolean {
  if (chapterNames.length === 0) {
    return false;
  }

  return chapterNames.some(
    (name) =>
      profile.name === name ||
      profile.name.includes(name) ||
      name.includes(profile.name) ||
      profile.aliases.includes(name),
  );
}

function sortProfileRows(rows: CharacterProfileRowView[]): CharacterProfileRowView[] {
  return rows.slice().sort((left, right) => {
    if (left.isCurrentChapter !== right.isCurrentChapter) {
      return left.isCurrentChapter ? -1 : 1;
    }
    return left.profile.name.localeCompare(right.profile.name, "zh-CN");
  });
}

export function formatLastSyncedChapter(chapter: number | null): string {
  return chapter !== null ? `已同步至第 ${chapter} 章` : "尚未同步";
}

export function buildCharacterProfilesView(
  assets: NovelProjectAssets,
  activeChapterNumber: number | null,
): CharacterProfilesView {
  const profiles = assets.characterProfiles ?? [];
  const chapterNames = getCurrentChapterCharacterNames(
    assets,
    activeChapterNumber,
  );

  const allRows: CharacterProfileRowView[] = profiles.map((profile) => ({
    profile,
    narrativeRole: profile.narrativeRole.trim(),
    stateSummary: profile.currentState.summary.trim() || "暂无状态",
    lastSyncedChapter: getLastSyncedChapter(profile),
    isCurrentChapter: isProfileInCurrentChapter(profile, chapterNames),
  }));

  const groups = (["protagonist", "major", "minor"] as const)
    .map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      rows: sortProfileRows(allRows.filter((row) => row.profile.tier === tier)),
    }))
    .filter((group) => group.rows.length > 0);

  let summaryText = "暂无角色";
  if (chapterNames.length > 0) {
    const label = chapterNames.slice(0, 2).join("、");
    summaryText = chapterNames.length > 2 ? `${label} 等` : label;
  } else if (allRows.length > 0) {
    summaryText = `${allRows.length} 位角色`;
  }

  return {
    groups,
    allRows,
    totalCount: allRows.length,
    summaryText,
  };
}

export function buildCharactersSectionSummary(
  assets: NovelProjectAssets,
  chapterNumber: number | null,
): string {
  return buildCharacterProfilesView(assets, chapterNumber).summaryText;
}

export function findCharacterProfileByName(
  assets: NovelProjectAssets,
  characterName: string,
): NovelCharacterProfile | null {
  const profiles = assets.characterProfiles ?? [];
  return (
    profiles.find(
      (profile) =>
        profile.name === characterName ||
        profile.name.includes(characterName) ||
        characterName.includes(profile.name) ||
        profile.aliases.includes(characterName),
    ) ?? null
  );
}

function sortStateHistoryChronologically(
  history: NovelCharacterStateHistoryEntry[],
): NovelCharacterStateHistoryEntry[] {
  return history.slice().sort((left, right) => {
    if (left.chapterNumber !== right.chapterNumber) {
      return left.chapterNumber - right.chapterNumber;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function getCharacterProfileDiagnostics(
  assets: NovelProjectAssets,
  profile: NovelCharacterProfile,
): NonNullable<NovelProjectAssets["diagnostics"]> {
  return (assets.diagnostics ?? []).filter(
    (item) =>
      item.id.startsWith(`char-lock-diag:${profile.id}:`) ||
      item.label === `角色同步 · ${profile.name}`,
  );
}

export function buildCharacterDetailViewModel(
  assets: NovelProjectAssets,
  characterName: string,
): CharacterDetailViewModel | null {
  const profile = findCharacterProfileByName(assets, characterName);
  if (!profile) {
    return null;
  }

  return {
    profile,
    sourceLabel: SOURCE_LABELS[profile.source],
    stateHistory: sortStateHistoryChronologically(profile.stateHistory),
    diagnostics: getCharacterProfileDiagnostics(assets, profile),
  };
}

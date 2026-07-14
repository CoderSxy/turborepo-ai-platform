import type { InkosNovelProject } from "@repo/inkos-adapter";
import { countSyncAttentionDiagnostics } from "#lib/novel-asset-auto-sync";
import type { NovelProjectAssets } from "../../../../lib/novel-store";

export type ParsedCharacter = {
  name: string;
  role: string;
  tags: string;
  current: string;
  pending?: boolean;
  chapterNumber?: number;
  chapterTitle?: string;
};

const META_CHARACTER_SECTION_NAMES = new Set([
  "角色状态追踪",
  "章节世界观增量",
  "世界观",
  "伏笔池",
]);

export function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

export function parseCharacterMatrix(markdown: string): ParsedCharacter[] {
  if (!markdown.trim()) {
    return [];
  }

  const characters: ParsedCharacter[] = [];
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
  assets: Pick<NovelProjectAssets, "characters">,
): { protagonist: string; supporting: string; supportingCount: number } {
  const protagonist =
    extractStoryBibleSection(assets.characters, /主角|protagonist/i) ||
    project.protagonist.trim() ||
    parseCharacterMatrix(assets.characters).find((item) =>
      /主角|protagonist/i.test(item.role),
    )?.name ||
    "";

  const supporting =
    extractStoryBibleSection(assets.characters, /配角|supporting|cast/i) || "";

  const supportingCount = supporting
    ? supporting.split("\n").filter((line) => line.trim().startsWith("-")).length ||
      1
    : Math.max(parseCharacterMatrix(assets.characters).length - (protagonist ? 1 : 0), 0);

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

function extractProtagonistName(protagonist: string): string {
  const normalized = protagonist.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^([^\s，,：:]{1,12})/);
  return match?.[1]?.trim() ?? "";
}

function parseCharacterTrackingLines(content: string): Array<{
  characterName: string;
  content: string;
  chapterNumber?: number;
  chapterTitle?: string;
}> {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const entries: Array<{
    characterName: string;
    content: string;
    chapterNumber?: number;
    chapterTitle?: string;
  }> = [];
  let currentChapterNumber: number | undefined;
  let currentChapterTitle: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("##")) {
      continue;
    }

    const chapterMatch = line.match(/^第\s*(\d+)\s*章[《「](.+?)[》」]/);
    if (chapterMatch) {
      currentChapterNumber = Number(chapterMatch[1]);
      currentChapterTitle = chapterMatch[2]?.trim();
      continue;
    }

    const normalized = line.replace(/^[-*]\s*/, "").trim();
    if (normalized.startsWith("**")) {
      continue;
    }

    const splitIndex = normalized.search(/[：:]/);
    if (splitIndex <= 0) {
      continue;
    }

    const characterName = normalized.slice(0, splitIndex).trim();
    const stateContent = normalized.slice(splitIndex + 1).trim();
    if (
      !characterName ||
      !stateContent ||
      META_CHARACTER_SECTION_NAMES.has(characterName) ||
      characterName.length > 24
    ) {
      continue;
    }

    entries.push({
      characterName,
      content: stateContent,
      chapterNumber: currentChapterNumber,
      chapterTitle: currentChapterTitle,
    });
  }

  return entries;
}

function upsertCharacterCard(
  map: Map<string, ParsedCharacter>,
  card: ParsedCharacter,
  options?: { preferIncoming?: boolean },
) {
  const key = card.name.trim();
  if (!key || META_CHARACTER_SECTION_NAMES.has(key)) {
    return;
  }

  const existing = map.get(key);
  if (!existing) {
    map.set(key, card);
    return;
  }

  const preferIncoming = options?.preferIncoming === true;
  map.set(key, {
    name: key,
    role: preferIncoming
      ? card.role || existing.role
      : existing.role || card.role,
    tags: preferIncoming
      ? card.tags || existing.tags
      : existing.tags || card.tags,
    current: preferIncoming
      ? card.current || existing.current
      : existing.current || card.current,
    pending: preferIncoming
      ? Boolean(card.pending) || Boolean(existing.pending)
      : Boolean(existing.pending) || Boolean(card.pending),
    chapterNumber: preferIncoming
      ? card.chapterNumber ?? existing.chapterNumber
      : existing.chapterNumber ?? card.chapterNumber,
    chapterTitle: preferIncoming
      ? card.chapterTitle ?? existing.chapterTitle
      : existing.chapterTitle ?? card.chapterTitle,
  });
}

/**
 * Unified character-card source for the right panel.
 * Priority: knowledgeAssets → matrix/tracking text → protagonist fallback.
 */
export function buildCharacterStateCards(
  assets: NovelProjectAssets,
  project: Pick<InkosNovelProject, "protagonist">,
  activeChapterNumber: number | null,
  limit = 4,
): ParsedCharacter[] {
  const cards = new Map<string, ParsedCharacter>();

  for (const asset of assets.knowledgeAssets ?? []) {
    if (asset.category !== "character" || !asset.title.trim()) {
      continue;
    }

    const isProtagonistAsset = asset.title === "主角" || asset.tags.includes("主角");
    const inferredName =
      asset.title === "主角"
        ? extractProtagonistName(asset.content) ||
          extractProtagonistName(project.protagonist) ||
          "主角"
        : asset.title.trim();

    upsertCharacterCard(cards, {
      name: inferredName,
      role: isProtagonistAsset ? "主角" : asset.tags[0] ?? "",
      tags: asset.tags.filter((tag) => tag !== "主角").join("、"),
      current: asset.content.trim(),
    });
  }

  for (const character of parseCharacterMatrix(assets.characters)) {
    if (
      character.name === "角色状态追踪" ||
      META_CHARACTER_SECTION_NAMES.has(character.name)
    ) {
      continue;
    }
    upsertCharacterCard(cards, character);
  }

  for (const entry of parseCharacterTrackingLines(assets.characters)) {
    upsertCharacterCard(cards, {
      name: entry.characterName,
      role: "",
      tags: entry.chapterNumber ? `第 ${entry.chapterNumber} 章` : "",
      current: entry.content,
      chapterNumber: entry.chapterNumber,
      chapterTitle: entry.chapterTitle,
    });
  }

  if (cards.size === 0 && project.protagonist.trim()) {
    const name = extractProtagonistName(project.protagonist) || "主角";
    upsertCharacterCard(cards, {
      name,
      role: "主角",
      tags: "",
      current: project.protagonist.trim(),
    });
  }

  const ranked = [...cards.values()];
  const chapterNames = getCurrentChapterCharacterNames(
    assets,
    activeChapterNumber,
  );

  if (chapterNames.length > 0) {
    const matched = ranked.filter((character) =>
      chapterNames.some(
        (name) => character.name.includes(name) || name.includes(character.name),
      ),
    );
    if (matched.length > 0) {
      return matched.slice(0, limit);
    }
  }

  ranked.sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  );

  return ranked.slice(0, limit);
}

export function buildCharactersSectionSummary(
  assets: NovelProjectAssets,
  chapterNumber: number | null,
  project?: Pick<InkosNovelProject, "protagonist">,
): string {
  const characters = buildCharacterStateCards(
    assets,
    project ?? { protagonist: "" },
    chapterNumber,
    8,
  );
  const chapterNames = getCurrentChapterCharacterNames(assets, chapterNumber);

  if (chapterNames.length > 0) {
    const label = chapterNames.slice(0, 2).join("、");
    return chapterNames.length > 2 ? `${label} 等` : label;
  }

  if (characters.length > 0) {
    return `${characters.length} 位角色`;
  }

  return "暂无角色";
}

export function pickCharactersForChapterPreview(
  assets: NovelProjectAssets,
  chapterNumber: number | null,
  limit = 4,
  project?: Pick<InkosNovelProject, "protagonist">,
): ParsedCharacter[] {
  return buildCharacterStateCards(
    assets,
    project ?? { protagonist: "" },
    chapterNumber,
    limit,
  );
}

import {
  buildNovelKnowledgeSummary,
  type NovelKnowledgeAsset,
  type NovelProjectAssets,
} from "../../../../lib/novel-store";
import { parseCharacterMatrix } from "./right-panel-summaries";

export type CoreFileKey =
  | "worldNotes"
  | "outline"
  | "settings"
  | "characters"
  | "stateCards"
  | "foreshadowingPool"
  | "subplots"
  | "romanceArc";

export type CoreFileDefinition = {
  key: CoreFileKey;
  label: string;
  readOnly?: boolean;
  getContent: (assets: NovelProjectAssets) => string;
  isPresent: (assets: NovelProjectAssets) => boolean;
  applySave: (assets: NovelProjectAssets, content: string) => NovelProjectAssets;
};

function extractMarkdownSection(markdown: string, pattern: RegExp): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  for (const section of normalized.split(/^## /m).slice(1)) {
    const lines = section.split("\n");
    const title = lines[0]?.trim() ?? "";
    if (!pattern.test(title)) {
      continue;
    }
    return lines.slice(1).join("\n").trim();
  }

  return "";
}

function buildStateCardsContent(assets: NovelProjectAssets): string {
  const fromMatrix = parseCharacterMatrix(assets.characters)
    .filter((character) => character.current.trim())
    .map((character) => `- **${character.name}**：${character.current}`)
    .join("\n");
  const fromAssets = formatKnowledgeAssetsByCategory(
    assets.knowledgeAssets,
    "character",
  );

  return [fromMatrix, fromAssets].filter(Boolean).join("\n\n");
}

function buildSubplotsContent(assets: NovelProjectAssets): string {
  const fromOutline = extractMarkdownSection(assets.outline, /支线|subplot/i);
  if (fromOutline) {
    return fromOutline;
  }

  const nodes = assets.outlineNodes ?? [];
  if (nodes.length === 0) {
    return "";
  }

  return nodes
    .map(
      (node) =>
        `- 第 ${node.chapterNumber} 章《${node.title}》：${node.goal || node.conflict || "暂无目标"}`,
    )
    .join("\n");
}

function buildRomanceArcContent(assets: NovelProjectAssets): string {
  const fromOutline = extractMarkdownSection(assets.outline, /感情线|情感线|romance/i);
  if (fromOutline) {
    return fromOutline;
  }

  const fromCharacters = extractMarkdownSection(assets.characters, /感情线|情感线|romance/i);
  if (fromCharacters) {
    return fromCharacters;
  }

  return formatKnowledgeAssetsByTag(assets.knowledgeAssets, /感情|情感|romance/i);
}

function formatKnowledgeAssetsByCategory(
  assets: NovelKnowledgeAsset[],
  category: NovelKnowledgeAsset["category"],
): string {
  return assets
    .filter((asset) => asset.category === category)
    .map((asset) => `- **${asset.title}**：${asset.content}`)
    .join("\n");
}

function formatKnowledgeAssetsByTag(
  assets: NovelKnowledgeAsset[],
  pattern: RegExp,
): string {
  return assets
    .filter(
      (asset) =>
        pattern.test(asset.title) ||
        asset.tags.some((tag) => pattern.test(tag)),
    )
    .map((asset) => `- **${asset.title}**：${asset.content}`)
    .join("\n");
}

function readOnlyDefinition(
  key: CoreFileKey,
  label: string,
  getContent: (assets: NovelProjectAssets) => string,
  isPresent: (assets: NovelProjectAssets) => boolean,
): CoreFileDefinition {
  return {
    key,
    label,
    readOnly: true,
    getContent,
    isPresent,
    applySave: (assets) => assets,
  };
}

export const CORE_FILE_DEFINITIONS: CoreFileDefinition[] = [
  {
    key: "worldNotes",
    label: "世界观设定",
    getContent: (assets) => assets.worldNotes,
    isPresent: (assets) => assets.worldNotes.trim().length > 0,
    applySave: (assets, content) => ({ ...assets, worldNotes: content }),
  },
  {
    key: "outline",
    label: "卷纲",
    getContent: (assets) => assets.outline,
    isPresent: (assets) => assets.outline.trim().length > 0,
    applySave: (assets, content) => ({ ...assets, outline: content }),
  },
  {
    key: "settings",
    label: "叙事规则",
    getContent: (assets) => assets.settings,
    isPresent: (assets) => assets.settings.trim().length > 0,
    applySave: (assets, content) => ({ ...assets, settings: content }),
  },
  readOnlyDefinition(
    "stateCards",
    "状态卡",
    buildStateCardsContent,
    (assets) => buildStateCardsContent(assets).trim().length > 0,
  ),
  readOnlyDefinition(
    "foreshadowingPool",
    "伏笔池",
    (assets) => buildNovelKnowledgeSummary(assets, ["foreshadowing"]),
    (assets) =>
      (assets.knowledgeAssets ?? []).some(
        (asset) => asset.category === "foreshadowing",
      ),
  ),
  readOnlyDefinition(
    "subplots",
    "支线",
    buildSubplotsContent,
    (assets) => buildSubplotsContent(assets).trim().length > 0,
  ),
  readOnlyDefinition(
    "romanceArc",
    "感情线",
    buildRomanceArcContent,
    (assets) => buildRomanceArcContent(assets).trim().length > 0,
  ),
  {
    key: "characters",
    label: "角色矩阵",
    getContent: (assets) => assets.characters,
    isPresent: (assets) => assets.characters.trim().length > 0,
    applySave: (assets, content) => ({ ...assets, characters: content }),
  },
];

export function getCoreFileDefinition(key: CoreFileKey): CoreFileDefinition {
  const definition = CORE_FILE_DEFINITIONS.find((item) => item.key === key);
  if (!definition) {
    throw new Error(`Unknown core file key: ${key}`);
  }
  return definition;
}

export function listPresentCoreFiles(assets: NovelProjectAssets): CoreFileDefinition[] {
  return CORE_FILE_DEFINITIONS.filter((item) => item.isPresent(assets));
}

import type { InkosCoreAction } from "@repo/inkos-adapter";
import type {
  NovelKnowledgeAsset,
  NovelKnowledgeAssetCategory,
  NovelPlatformId,
} from "../../../lib/novel-store";
import type { NovelTool } from "./studio-types";

export const INKOS_CORE_ACTION_LABELS: Record<InkosCoreAction, string> = {
  outline: "生成大纲",
  settings: "整理设定",
  "write-chapter": "写下一章",
  "revise-chapter": "修订本章",
  review: "审稿",
  radar: "市场雷达",
  diagnostics: "环境诊断",
};

export const QUICK_CORE_ACTIONS: Partial<Record<string, InkosCoreAction>> = {
  写下一章: "write-chapter",
  审稿: "review",
  修订本章: "revise-chapter",
  生成大纲: "outline",
  整理设定: "settings",
  市场雷达: "radar",
};

export const KNOWLEDGE_ASSET_LABELS: Record<NovelKnowledgeAssetCategory, string> = {
  world: "世界观",
  character: "角色",
  foreshadowing: "伏笔",
  location: "地点",
  faction: "势力",
  item: "物品",
  term: "术语",
};

export const KNOWLEDGE_ASSET_STATUS_LABELS: Record<
  NovelKnowledgeAsset["status"],
  string
> = {
  active: "生效",
  draft: "草稿",
  resolved: "已归档",
};

export const FORESHADOWING_STATUS_LABELS: Record<
  NovelKnowledgeAsset["status"],
  string
> = {
  active: "已埋设",
  draft: "推进中",
  resolved: "已回收",
};

export const PLATFORM_EXPORT_OPTIONS: Array<{
  platform: Exclude<NovelPlatformId, "generic">;
  label: string;
}> = [
  { platform: "qidian", label: "起点 TXT" },
  { platform: "fanqie", label: "番茄 TXT" },
  { platform: "zongheng", label: "纵横 TXT" },
  { platform: "jjwxc", label: "晋江 TXT" },
  { platform: "feilu", label: "飞卢 TXT" },
];

export const NOVEL_TOOLS: NovelTool[] = [
  "AI创作",
  "题材",
  "文风",
  "导入",
  "市场雷达",
  "环境诊断",
];

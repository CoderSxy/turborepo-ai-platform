import type { CoreFileKey } from "../core-file-keys.ts";
import type { DetailTarget } from "./types.ts";

export function resolveDetailTitle(
  target: DetailTarget,
  coreFileLabel: (key: CoreFileKey) => string,
): string {
  switch (target.type) {
    case "chapter":
      return "章节详情";
    case "core-file":
      return coreFileLabel(target.fileKey);
    case "character":
      return target.characterName;
    case "outline":
      return "卷纲与章节计划";
    default:
      return "详情";
  }
}

import type { CoreFileKey } from "../core-file-keys";

export type DetailTarget =
  | { type: "chapter"; chapterId: string }
  | { type: "core-file"; fileKey: CoreFileKey }
  | { type: "character"; characterName: string }
  | { type: "outline" };

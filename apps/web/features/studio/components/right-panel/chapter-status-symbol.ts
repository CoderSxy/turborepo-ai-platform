import type { InkosChapterStatus } from "@repo/inkos-adapter";

export function getChapterStatusSymbol(
  status: InkosChapterStatus,
  generated: boolean,
): string {
  if (status === "approved") {
    return "✓";
  }
  if (status === "planned" || !generated) {
    return "○";
  }
  return "●";
}

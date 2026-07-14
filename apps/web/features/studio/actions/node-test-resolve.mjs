const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  const isRelative =
    specifier.startsWith("./") || specifier.startsWith("../");

  if (isRelative && !EXTENSIONS.some((ext) => specifier.endsWith(ext))) {
    for (const ext of [".ts", ".tsx", ".js"]) {
      try {
        return await nextResolve(specifier + ext, context);
      } catch {
        // try next extension
      }
    }
  }

  if (
    specifier.endsWith("/lib/novel-store") ||
    specifier.endsWith("/lib/model-settings") ||
    specifier.endsWith("/lib/novel-asset-auto-sync") ||
    specifier.endsWith("/lib/novel-character-profiles")
  ) {
    const alias = specifier.endsWith("/lib/novel-store")
      ? "#lib/novel-store"
      : specifier.endsWith("/lib/model-settings")
        ? "#lib/model-settings"
        : specifier.endsWith("/lib/novel-asset-auto-sync")
          ? "#lib/novel-asset-auto-sync"
          : "#lib/novel-character-profiles";
    return nextResolve(alias, context);
  }

  return nextResolve(specifier, context);
}

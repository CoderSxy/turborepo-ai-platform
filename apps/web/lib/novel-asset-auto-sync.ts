import {
  applyNovelChapterAssetDelta,
  type NovelChapterAssetDelta,
  type NovelProjectAssets,
} from "./novel-store.ts";

export type AssetSyncSource = "chapter-pipeline" | "migration";

export type MergeAssetDeltaPolicy = {
  source: AssetSyncSource;
};

const SYNC_DIAGNOSTIC_PREFIX = "同步诊断";

function hasDeltaContent(delta: NovelChapterAssetDelta): boolean {
  return (
    delta.characterStates.length > 0 ||
    delta.newForeshadowing.length > 0 ||
    delta.resolvedForeshadowing.length > 0 ||
    delta.worldIncrements.length > 0
  );
}

function withMigration(
  assets: NovelProjectAssets,
  patch: Partial<NonNullable<NovelProjectAssets["pendingMigration"]>>,
): NovelProjectAssets["pendingMigration"] {
  return {
    schemaVersion: 1,
    appliedChapters: [],
    ...assets.pendingMigration,
    ...patch,
    appliedChapters:
      patch.appliedChapters ??
      assets.pendingMigration?.appliedChapters ??
      [],
  };
}

export function countSyncAttentionDiagnostics(
  assets: NovelProjectAssets,
): number {
  return (assets.diagnostics ?? []).filter(
    (item) => !item.ok && item.label.startsWith(SYNC_DIAGNOSTIC_PREFIX),
  ).length;
}

export function mergeNovelChapterAssetDeltaSafely(
  assets: NovelProjectAssets,
  delta: NovelChapterAssetDelta,
  policy: MergeAssetDeltaPolicy,
): NovelProjectAssets {
  if (!hasDeltaContent(delta)) {
    return assets;
  }

  const applied = assets.pendingMigration?.appliedChapters ?? [];
  if (applied.includes(delta.chapterNumber)) {
    return assets;
  }

  try {
    const merged = applyNovelChapterAssetDelta(assets, delta);
    return {
      ...merged,
      pendingMigration: withMigration(merged, {
        appliedChapters: [...applied, delta.chapterNumber],
      }),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "资产合并失败";
    return {
      ...assets,
      diagnostics: [
        {
          id: `sync-diag-${delta.chapterNumber}-${Date.now()}`,
          label: `${SYNC_DIAGNOSTIC_PREFIX} · 第 ${delta.chapterNumber} 章`,
          ok: false,
          detail: `${policy.source}: ${detail}`,
          createdAt: new Date().toISOString(),
        },
        ...(assets.diagnostics ?? []),
      ].slice(0, 50),
    };
  }
}

export function migratePendingAssetDeltas(
  assets: NovelProjectAssets,
): NovelProjectAssets {
  const pending = [...(assets.pendingAssetDeltas ?? [])].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) {
      return a.chapterNumber - b.chapterNumber;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  if (pending.length === 0) {
    if (assets.pendingMigration?.migratedAt) {
      return assets;
    }
    return {
      ...assets,
      pendingMigration: withMigration(assets, {
        migratedAt: new Date().toISOString(),
      }),
    };
  }

  const skipped = new Set(assets.pendingMigration?.skippedPendingIds ?? []);
  let current = assets;
  const remaining = [];

  for (const item of pending) {
    if (skipped.has(item.id)) {
      remaining.push(item);
      continue;
    }
    if (current.pendingMigration?.appliedChapters?.includes(item.chapterNumber)) {
      continue;
    }

    const beforeDiagnostics = current.diagnostics?.length ?? 0;
    const next = mergeNovelChapterAssetDeltaSafely(current, item, {
      source: "migration",
    });
    const addedDiag =
      (next.diagnostics?.length ?? 0) > beforeDiagnostics &&
      !(next.pendingMigration?.appliedChapters ?? []).includes(
        item.chapterNumber,
      );

    if (addedDiag) {
      remaining.push(item);
      current = {
        ...next,
        pendingMigration: withMigration(next, {
          skippedPendingIds: [
            ...(next.pendingMigration?.skippedPendingIds ?? []),
            item.id,
          ],
        }),
      };
      continue;
    }

    current = next;
  }

  return {
    ...current,
    pendingAssetDeltas: remaining,
    pendingMigration: withMigration(current, {
      migratedAt: new Date().toISOString(),
      skippedPendingIds: current.pendingMigration?.skippedPendingIds,
    }),
  };
}

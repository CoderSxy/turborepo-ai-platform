import {
  applyNovelChapterAssetDelta,
  normalizePendingMigration,
  type NovelChapterAssetDelta,
  type NovelPendingAssetDelta,
  type NovelPendingMigrationV2,
  type NovelProjectAssets,
} from "#lib/novel-store";

export type AssetSyncSource = "chapter-pipeline" | "migration";

export type MergeAssetDeltaPolicy = {
  source: AssetSyncSource;
  syncId: string;
};

export type CanonicalNovelChapterAssetDelta = {
  chapterNumber: number;
  chapterTitle: string;
  summary: string;
  characterStates: Array<{ title: string; content: string }>;
  newForeshadowing: string[];
  resolvedForeshadowing: string[];
  worldIncrements: string[];
};

export type MergeAssetDeltaResult = {
  status: "applied" | "skipped" | "needs-attention";
  assets: NovelProjectAssets;
  syncId: string;
};

const SYNC_DIAGNOSTIC_PREFIX = "同步诊断";
const STABLE_DIAGNOSTIC_CREATED_AT = "1970-01-01T00:00:00.000Z";

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function canonicalizeNovelChapterAssetDelta(
  delta: NovelChapterAssetDelta,
): CanonicalNovelChapterAssetDelta {
  return {
    chapterNumber: delta.chapterNumber,
    chapterTitle: normalizeWhitespace(delta.chapterTitle),
    summary: normalizeWhitespace(delta.summary),
    characterStates: [...delta.characterStates]
      .map((state) => ({
        title: normalizeWhitespace(state.title),
        content: normalizeWhitespace(state.content),
      }))
      .sort(
        (left, right) =>
          left.title.localeCompare(right.title) ||
          left.content.localeCompare(right.content),
      ),
    newForeshadowing: [...delta.newForeshadowing]
      .map(normalizeWhitespace)
      .sort((left, right) => left.localeCompare(right)),
    resolvedForeshadowing: [...delta.resolvedForeshadowing]
      .map(normalizeWhitespace)
      .sort((left, right) => left.localeCompare(right)),
    worldIncrements: [...delta.worldIncrements]
      .map(normalizeWhitespace)
      .sort((left, right) => left.localeCompare(right)),
  };
}

export function stableHashCanonicalDelta(
  delta: CanonicalNovelChapterAssetDelta,
): string {
  const json = JSON.stringify(delta);
  let hash = 5381;

  for (let index = 0; index < json.length; index += 1) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createChapterPipelineSyncId(input: {
  chapterId: string;
  chapterVersionId: string;
  delta: NovelChapterAssetDelta;
}): string {
  const canonical = canonicalizeNovelChapterAssetDelta(input.delta);
  const hash = stableHashCanonicalDelta(canonical);
  return `${input.chapterId}:${input.chapterVersionId}:${hash}`;
}

export function createLegacyPendingSyncId(
  pending: Pick<NovelPendingAssetDelta, "id">,
): string {
  return `legacy:${pending.id}`;
}

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
  patch: Partial<NovelPendingMigrationV2>,
): NovelProjectAssets["pendingMigration"] {
  return normalizePendingMigration({
    ...assets.pendingMigration,
    ...patch,
    schemaVersion: 2,
    appliedSyncIds:
      patch.appliedSyncIds ?? assets.pendingMigration.appliedSyncIds ?? [],
  });
}

function upsertSyncDiagnostic(
  assets: NovelProjectAssets,
  syncId: string,
  chapterNumber: number,
  detail: string,
): NovelProjectAssets {
  const diagnosticId = `sync-diag:${syncId}`;
  const existing = (assets.diagnostics ?? []).find(
    (item) => item.id === diagnosticId,
  );
  const diagnostic = {
    id: diagnosticId,
    label: `${SYNC_DIAGNOSTIC_PREFIX} · 第 ${chapterNumber} 章`,
    ok: false,
    detail,
    createdAt: existing?.createdAt ?? STABLE_DIAGNOSTIC_CREATED_AT,
  };

  return {
    ...assets,
    diagnostics: [
      diagnostic,
      ...(assets.diagnostics ?? []).filter((item) => item.id !== diagnosticId),
    ].slice(0, 50),
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
): MergeAssetDeltaResult {
  const { syncId } = policy;
  const appliedSyncIds = assets.pendingMigration?.appliedSyncIds ?? [];

  if (appliedSyncIds.includes(syncId)) {
    return { status: "skipped", assets, syncId };
  }

  if (!hasDeltaContent(delta)) {
    return {
      status: "needs-attention",
      assets: upsertSyncDiagnostic(
        assets,
        syncId,
        delta.chapterNumber,
        `${policy.source}: 章节资产增量无实质内容（仅摘要或空增量）`,
      ),
      syncId,
    };
  }

  try {
    const merged = applyNovelChapterAssetDelta(assets, delta);
    return {
      status: "applied",
      assets: {
        ...merged,
        pendingMigration: withMigration(merged, {
          appliedSyncIds: [...appliedSyncIds, syncId],
        }),
      },
      syncId,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "资产合并失败";
    return {
      status: "needs-attention",
      assets: upsertSyncDiagnostic(
        assets,
        syncId,
        delta.chapterNumber,
        `${policy.source}: ${detail}`,
      ),
      syncId,
    };
  }
}

export function migratePendingAssetDeltas(
  assets: NovelProjectAssets,
): NovelProjectAssets {
  const pending = [...(assets.pendingAssetDeltas ?? [])].sort((left, right) => {
    if (left.chapterNumber !== right.chapterNumber) {
      return left.chapterNumber - right.chapterNumber;
    }
    return left.createdAt.localeCompare(right.createdAt);
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
  const remaining: NovelPendingAssetDelta[] = [];

  for (const item of pending) {
    if (skipped.has(item.id)) {
      remaining.push(item);
      continue;
    }

    const syncId = createLegacyPendingSyncId(item);
    if (current.pendingMigration?.appliedSyncIds?.includes(syncId)) {
      continue;
    }

    const result = mergeNovelChapterAssetDeltaSafely(current, item, {
      source: "migration",
      syncId,
    });

    switch (result.status) {
      case "applied":
      case "skipped":
        current = result.assets;
        break;
      case "needs-attention":
        remaining.push(item);
        current = {
          ...result.assets,
          pendingMigration: withMigration(result.assets, {
            skippedPendingIds: [
              ...(result.assets.pendingMigration?.skippedPendingIds ?? []),
              item.id,
            ],
          }),
        };
        break;
    }
  }

  const skippedPendingIds = current.pendingMigration?.skippedPendingIds;
  return {
    ...current,
    pendingAssetDeltas: remaining,
    pendingMigration: withMigration(current, {
      migratedAt: new Date().toISOString(),
      ...(skippedPendingIds !== undefined ? { skippedPendingIds } : {}),
    }),
  };
}

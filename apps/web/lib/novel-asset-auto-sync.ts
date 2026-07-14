import {
  applyNovelChapterAssetDelta,
  normalizePendingMigration,
  type NovelChapterAssetDelta,
  type NovelPendingAssetDelta,
  type NovelPendingMigrationV2,
  type NovelProjectAssets,
} from "#lib/novel-store";
export { createStableCharacterProfileId } from "#lib/novel-character-profiles";

export type AssetSyncSource = "chapter-pipeline" | "migration";

export type MergeAssetDeltaPolicy = {
  source: AssetSyncSource;
  syncId: string;
  chapterId?: string;
};

export type CanonicalNovelChapterAssetDelta = {
  chapterNumber: number;
  chapterTitle: string;
  summary: string;
  characterStates: Array<{ title: string; content: string }>;
  characterStateChanges: Array<{
    characterId?: string;
    characterName?: string;
    summary: string;
    location?: string;
    physical?: string;
    emotional?: string;
    knowledge?: string;
    objective?: string;
    changes?: string[];
  }>;
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

type ApplyNovelChapterAssetDelta = typeof applyNovelChapterAssetDelta;

let testApplyDeltaOverride: ApplyNovelChapterAssetDelta | null = null;

/** @internal Test hook for merge failure simulation. */
export function setTestApplyDeltaOverride(
  override: ApplyNovelChapterAssetDelta | null,
): void {
  testApplyDeltaOverride = override;
}

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
    characterStateChanges: [...(delta.characterStateChanges ?? [])]
      .map((change) => ({
        ...(change.characterId
          ? { characterId: normalizeWhitespace(change.characterId) }
          : {}),
        ...(change.characterName
          ? { characterName: normalizeWhitespace(change.characterName) }
          : {}),
        summary: normalizeWhitespace(change.summary),
        ...(change.location
          ? { location: normalizeWhitespace(change.location) }
          : {}),
        ...(change.physical
          ? { physical: normalizeWhitespace(change.physical) }
          : {}),
        ...(change.emotional
          ? { emotional: normalizeWhitespace(change.emotional) }
          : {}),
        ...(change.knowledge
          ? { knowledge: normalizeWhitespace(change.knowledge) }
          : {}),
        ...(change.objective
          ? { objective: normalizeWhitespace(change.objective) }
          : {}),
        ...(change.changes
          ? {
              changes: [...change.changes]
                .map(normalizeWhitespace)
                .sort((left, right) => left.localeCompare(right)),
            }
          : {}),
      }))
      .sort((left, right) => {
        const leftKey = `${left.characterId ?? ""}:${left.characterName ?? ""}:${left.summary}`;
        const rightKey = `${right.characterId ?? ""}:${right.characterName ?? ""}:${right.summary}`;
        return leftKey.localeCompare(rightKey);
      }),
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
    (delta.characterStateChanges?.length ?? 0) > 0 ||
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

function hasSyncDiagnostic(
  assets: NovelProjectAssets,
  syncId: string,
): boolean {
  const diagnosticId = `sync-diag:${syncId}`;
  return (assets.diagnostics ?? []).some((item) => item.id === diagnosticId);
}

function shouldSkipEmptyContentRetry(
  assets: NovelProjectAssets,
  delta: NovelChapterAssetDelta,
  syncId: string,
  retrySchemaVersion: number,
): boolean {
  if (hasDeltaContent(delta) || retrySchemaVersion > 0) {
    return false;
  }
  return hasSyncDiagnostic(assets, syncId);
}

export function novelAssetMigrationChanged(
  before: NovelProjectAssets,
  after: NovelProjectAssets,
): boolean {
  if (
    before.pendingAssetDeltas.length !== after.pendingAssetDeltas.length ||
    before.worldNotes !== after.worldNotes ||
    before.characters !== after.characters
  ) {
    return true;
  }

  return (
    JSON.stringify(before.pendingMigration) !==
      JSON.stringify(after.pendingMigration) ||
    JSON.stringify(before.knowledgeAssets) !==
      JSON.stringify(after.knowledgeAssets) ||
    JSON.stringify(before.assetChangeEvents) !==
      JSON.stringify(after.assetChangeEvents) ||
    JSON.stringify(before.diagnostics) !== JSON.stringify(after.diagnostics) ||
    JSON.stringify(before.characterProfiles) !==
      JSON.stringify(after.characterProfiles)
  );
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
    const applyOptions = {
      syncId,
      chapterId: policy.chapterId,
      source: policy.source,
    };
    const applyDelta =
      testApplyDeltaOverride ?? applyNovelChapterAssetDelta;
    const merged = applyDelta(assets, delta, applyOptions);
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
    const createdAtCompare = left.createdAt.localeCompare(right.createdAt);
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }
    return left.id.localeCompare(right.id);
  });

  if (pending.length === 0) {
    if (assets.pendingMigration?.migratedAt) {
      return assets;
    }
    const next = {
      ...assets,
      pendingMigration: withMigration(assets, {
        migratedAt: new Date().toISOString(),
        skippedPendingIds: [],
      }),
    };
    return novelAssetMigrationChanged(assets, next) ? next : assets;
  }

  const retrySchemaVersion = assets.pendingMigration?.retrySchemaVersion ?? 0;
  let current = assets;
  const remaining: NovelPendingAssetDelta[] = [];

  for (const item of pending) {
    const syncId = createLegacyPendingSyncId(item);
    if (current.pendingMigration?.appliedSyncIds?.includes(syncId)) {
      continue;
    }

    if (
      shouldSkipEmptyContentRetry(current, item, syncId, retrySchemaVersion)
    ) {
      remaining.push(item);
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
        current = result.assets;
        break;
    }
  }

  const next = {
    ...current,
    pendingAssetDeltas: remaining,
    pendingMigration: withMigration(current, {
      migratedAt: new Date().toISOString(),
      skippedPendingIds: [],
    }),
  };

  return novelAssetMigrationChanged(assets, next) ? next : assets;
}

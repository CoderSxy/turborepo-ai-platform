import type { InkosNovelProject } from "@repo/inkos-adapter";
import type {
  NovelCharacterProfile,
  NovelCharacterProfileManualLock,
  NovelCharacterProfileSource,
  NovelCharacterProfileTier,
  NovelCharacterStateChange,
  NovelChapterAssetDelta,
  NovelProjectAssets,
} from "#lib/novel-store";

const META_CHARACTER_SECTION_NAMES = new Set([
  "角色状态追踪",
  "章节世界观增量",
  "世界观",
  "伏笔池",
  "未命名角色",
]);

const EMPTY_STATE_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const STABLE_DIAGNOSTIC_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function createStableCharacterProfileId(name: string): string {
  return `character-${name.trim().replace(/\s+/g, "-")}`;
}

export function isCredibleCharacterName(name: string): boolean {
  const normalized = name.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 24) {
    return false;
  }
  if (META_CHARACTER_SECTION_NAMES.has(normalized)) {
    return false;
  }
  if (/^[-*]/.test(normalized) || /\*+/.test(normalized)) {
    return false;
  }
  return true;
}

function extractProtagonistName(protagonist?: string): string {
  const normalized = (protagonist ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  const match = normalized.match(/^([^\s，,：:]{1,12})/);
  return match?.[1]?.trim() ?? "";
}

function emptyCurrentState(
  summary = "",
  updatedAt = EMPTY_STATE_UPDATED_AT,
): NovelCharacterProfile["currentState"] {
  return { summary, updatedAt };
}

function createProfileSkeleton(input: {
  name: string;
  tier?: NovelCharacterProfileTier;
  narrativeRole?: string;
  coreTraits?: string[];
  currentStateSummary?: string;
  source: NovelCharacterProfileSource;
}): NovelCharacterProfile {
  return {
    id: createStableCharacterProfileId(input.name),
    name: input.name,
    aliases: [],
    tier: input.tier ?? "minor",
    narrativeRole: input.narrativeRole ?? "",
    coreTraits: input.coreTraits ?? [],
    motivations: [],
    goals: [],
    relationships: [],
    currentState: emptyCurrentState(input.currentStateSummary ?? ""),
    stateHistory: [],
    manualLocks: [],
    source: input.source,
  };
}

type ProfileMap = Map<string, NovelCharacterProfile>;

function upsertProfile(
  map: ProfileMap,
  profile: NovelCharacterProfile,
  options?: { preferExisting?: boolean },
): void {
  const existing = map.get(profile.id);
  if (!existing) {
    map.set(profile.id, profile);
    return;
  }

  const preferExisting = options?.preferExisting === true;
  map.set(profile.id, {
    ...existing,
    name: preferExisting ? existing.name : profile.name || existing.name,
    aliases: preferExisting
      ? existing.aliases
      : [...new Set([...existing.aliases, ...profile.aliases])],
    tier:
      preferExisting && existing.tier !== "minor"
        ? existing.tier
        : profile.tier !== "minor"
          ? profile.tier
          : existing.tier,
    narrativeRole: preferExisting
      ? existing.narrativeRole || profile.narrativeRole
      : profile.narrativeRole || existing.narrativeRole,
    coreTraits: preferExisting
      ? existing.coreTraits.length > 0
        ? existing.coreTraits
        : profile.coreTraits
      : profile.coreTraits.length > 0
        ? profile.coreTraits
        : existing.coreTraits,
    motivations:
      existing.motivations.length > 0 ? existing.motivations : profile.motivations,
    goals: existing.goals.length > 0 ? existing.goals : profile.goals,
    relationships:
      existing.relationships.length > 0
        ? existing.relationships
        : profile.relationships,
    currentState: {
      ...existing.currentState,
      summary:
        preferExisting && existing.currentState.summary
          ? existing.currentState.summary
          : profile.currentState.summary || existing.currentState.summary,
      location: existing.currentState.location ?? profile.currentState.location,
      physical: existing.currentState.physical ?? profile.currentState.physical,
      emotional: existing.currentState.emotional ?? profile.currentState.emotional,
      knowledge: existing.currentState.knowledge ?? profile.currentState.knowledge,
      objective: existing.currentState.objective ?? profile.currentState.objective,
      chapterNumber:
        existing.currentState.chapterNumber ?? profile.currentState.chapterNumber,
      chapterId: existing.currentState.chapterId ?? profile.currentState.chapterId,
      updatedAt: existing.currentState.updatedAt || profile.currentState.updatedAt,
    },
    stateHistory:
      existing.stateHistory.length > 0 ? existing.stateHistory : profile.stateHistory,
    manualLocks: existing.manualLocks,
    source: existing.source,
  });
}

function parseCharacterMatrixProfiles(
  markdown: string | undefined,
  source: NovelCharacterProfileSource,
): NovelCharacterProfile[] {
  if (!(markdown ?? "").trim()) {
    return [];
  }

  const profiles: NovelCharacterProfile[] = [];
  const sections = (markdown ?? "").split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0]?.trim() ?? "";
    if (!isCredibleCharacterName(name)) {
      continue;
    }

    const fields: Record<string, string> = {};
    for (let index = 1; index < lines.length; index += 1) {
      const match = lines[index]?.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        fields[match[1]!] = match[2]!.trim();
      }
    }

    const role = fields["定位"] ?? fields["Role"] ?? "";
    const tags = fields["标签"] ?? fields["Tags"] ?? "";
    const current =
      fields["当前"] ?? fields["Current"] ?? fields["状态"] ?? fields["State"] ?? "";

    profiles.push(
      createProfileSkeleton({
        name,
        tier: /主角|protagonist/i.test(role) ? "protagonist" : "major",
        narrativeRole: role,
        coreTraits: tags
          ? tags.split(/[、，,/|]+/).map((item) => item.trim()).filter(Boolean)
          : [],
        currentStateSummary: current,
        source,
      }),
    );
  }

  return profiles;
}

function parseCharacterTrackingProfiles(
  markdown: string | undefined,
  source: NovelCharacterProfileSource,
): NovelCharacterProfile[] {
  const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const profiles = new Map<string, NovelCharacterProfile>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("##")) {
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
      !isCredibleCharacterName(characterName) ||
      !stateContent ||
      /^(无|暂无|没有|无新增|无变化)[。.!！\s]*$/.test(stateContent)
    ) {
      continue;
    }

    const id = createStableCharacterProfileId(characterName);
    const existing = profiles.get(id);
    profiles.set(
      id,
      existing
        ? {
            ...existing,
            currentState: {
              ...existing.currentState,
              summary: stateContent,
            },
          }
        : createProfileSkeleton({
            name: characterName,
            currentStateSummary: stateContent,
            source,
          }),
    );
  }

  return [...profiles.values()];
}

function profilesFromKnowledgeAssets(
  assets: NovelProjectAssets,
  project: Pick<InkosNovelProject, "protagonist">,
): NovelCharacterProfile[] {
  const protagonistName = extractProtagonistName(project.protagonist);
  const profiles: NovelCharacterProfile[] = [];

  for (const asset of assets.knowledgeAssets ?? []) {
    if (asset.category !== "character") {
      continue;
    }

    let name = asset.title.trim();
    if (name === "主角" || name === "protagonist") {
      name = protagonistName;
    }
    if (!isCredibleCharacterName(name)) {
      continue;
    }

    profiles.push(
      createProfileSkeleton({
        name,
        tier: name === protagonistName ? "protagonist" : "major",
        narrativeRole: asset.content.trim(),
        source: "migration",
      }),
    );
  }

  return profiles;
}

function profileFromProtagonist(project: Pick<InkosNovelProject, "protagonist">): NovelCharacterProfile | null {
  const protagonist = project.protagonist ?? "";
  const name = extractProtagonistName(protagonist);
  if (!isCredibleCharacterName(name)) {
    return null;
  }

  const narrativeRole = protagonist
    .replace(/\s+/g, " ")
    .trim()
    .slice(name.length)
    .replace(/^[，,：:\s]+/, "")
    .trim();

  return createProfileSkeleton({
    name,
    tier: "protagonist",
    narrativeRole,
    source: "foundation",
  });
}

export function normalizeCharacterProfile(profile: NovelCharacterProfile): NovelCharacterProfile {
  return {
    ...profile,
    id: profile.id || createStableCharacterProfileId(profile.name),
    name: profile.name.trim(),
    aliases: [...new Set((profile.aliases ?? []).map((item) => item.trim()).filter(Boolean))],
    tier: profile.tier ?? "minor",
    narrativeRole: profile.narrativeRole ?? "",
    coreTraits: profile.coreTraits ?? [],
    motivations: profile.motivations ?? [],
    goals: profile.goals ?? [],
    relationships: profile.relationships ?? [],
    currentState: {
      ...emptyCurrentState(),
      ...profile.currentState,
      summary: profile.currentState?.summary ?? "",
      updatedAt: profile.currentState?.updatedAt ?? EMPTY_STATE_UPDATED_AT,
    },
    stateHistory: (profile.stateHistory ?? []).map((entry) => ({
      ...entry,
      changes: entry.changes ?? [],
    })),
    manualLocks: profile.manualLocks ?? [],
    source: profile.source ?? "migration",
  };
}

export function migrateCharacterProfiles(
  project: InkosNovelProject,
  assets: Pick<
    NovelProjectAssets,
    "characterProfiles" | "knowledgeAssets" | "characters"
  >,
): NovelCharacterProfile[] {
  const map: ProfileMap = new Map();

  for (const profile of assets.characterProfiles ?? []) {
    const normalized = normalizeCharacterProfile(profile);
    if (isCredibleCharacterName(normalized.name)) {
      map.set(normalized.id, normalized);
    }
  }

  for (const profile of profilesFromKnowledgeAssets(assets as NovelProjectAssets, project)) {
    upsertProfile(map, profile, { preferExisting: true });
  }

  for (const profile of parseCharacterMatrixProfiles(assets.characters ?? "", "migration")) {
    upsertProfile(map, profile, { preferExisting: true });
  }

  for (const profile of parseCharacterTrackingProfiles(assets.characters ?? "", "migration")) {
    upsertProfile(map, profile, { preferExisting: true });
  }

  const protagonistProfile = profileFromProtagonist(project);
  if (protagonistProfile) {
    upsertProfile(map, protagonistProfile, { preferExisting: true });
  }

  return [...map.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  );
}

export function normalizeCharacterProfiles(
  project: InkosNovelProject,
  profiles: NovelCharacterProfile[] | undefined,
  assets: Pick<
    NovelProjectAssets,
    "characterProfiles" | "knowledgeAssets" | "characters"
  >,
): NovelCharacterProfile[] {
  if (profiles && profiles.length > 0) {
    return profiles
      .map(normalizeCharacterProfile)
      .filter((profile) => isCredibleCharacterName(profile.name));
  }

  return migrateCharacterProfiles(project, assets);
}

export function deriveCharactersMarkdownFromProfiles(
  profiles: NovelCharacterProfile[],
): string {
  const sections = profiles
    .slice()
    .sort((left, right) => {
      const tierOrder = { protagonist: 0, major: 1, minor: 2 };
      const tierDiff = tierOrder[left.tier] - tierOrder[right.tier];
      if (tierDiff !== 0) {
        return tierDiff;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    })
    .map((profile) => {
      const lines = [`## ${profile.name}`];
      if (profile.narrativeRole) {
        lines.push(`- **定位**: ${profile.narrativeRole}`);
      }
      if (profile.coreTraits.length > 0) {
        lines.push(`- **标签**: ${profile.coreTraits.join("、")}`);
      }
      if (profile.currentState.summary) {
        lines.push(`- **当前**: ${profile.currentState.summary}`);
      }
      return lines.join("\n");
    });

  const trackingLines = profiles.flatMap((profile) => {
    const latest = profile.stateHistory.at(-1);
    if (!latest?.summary && !profile.currentState.summary) {
      return [];
    }
    const chapterPrefix =
      latest?.chapterNumber !== undefined
        ? `第 ${latest.chapterNumber} 章`
        : profile.currentState.chapterNumber !== undefined
          ? `第 ${profile.currentState.chapterNumber} 章`
          : "";
    const summary = latest?.summary || profile.currentState.summary;
    return [`${chapterPrefix}${chapterPrefix ? "：" : ""}${profile.name}：${summary}`.replace(/^：/, "")];
  });

  if (trackingLines.length > 0) {
    sections.push(["## 角色状态追踪", ...trackingLines.map((line) => `- ${line}`)].join("\n"));
  }

  return sections.join("\n\n");
}

function resolveProfile(
  profiles: NovelCharacterProfile[],
  change: NovelCharacterStateChange,
): NovelCharacterProfile | undefined {
  if (change.characterId) {
    const byId = profiles.find((profile) => profile.id === change.characterId);
    if (byId) {
      return byId;
    }
  }

  const name = change.characterName?.trim();
  if (name) {
    const exact = profiles.find((profile) => profile.name === name);
    if (exact) {
      return exact;
    }
    const byAlias = profiles.find((profile) => profile.aliases.includes(name));
    if (byAlias) {
      return byAlias;
    }
  }

  return undefined;
}

function buildLockConflictDiagnosticId(profileId: string, syncId: string): string {
  return `char-lock-diag:${profileId}:${syncId}`;
}

export function applyCharacterStateChangesToProfiles(input: {
  profiles: NovelCharacterProfile[];
  changes: NovelCharacterStateChange[];
  delta: Pick<NovelChapterAssetDelta, "chapterNumber" | "chapterTitle">;
  syncId: string;
  chapterId?: string;
  source: "chapter-pipeline" | "migration";
  now: string;
  diagnostics?: NovelProjectAssets["diagnostics"];
}): {
  profiles: NovelCharacterProfile[];
  diagnostics: NovelProjectAssets["diagnostics"];
} {
  let profiles = input.profiles.map(normalizeCharacterProfile);
  let diagnostics = [...(input.diagnostics ?? [])];
  const lockedFieldsByProfile = new Map<string, NovelCharacterProfileManualLock[]>();

  for (const change of input.changes) {
    let profile = resolveProfile(profiles, change);
    const credibleName = change.characterName?.trim();

    if (!profile) {
      if (!credibleName || !isCredibleCharacterName(credibleName)) {
        continue;
      }
      profile = createProfileSkeleton({
        name: credibleName,
        source: input.source === "migration" ? "migration" : "chapter-pipeline",
      });
      profiles.push(profile);
    }

    const locks = new Set(profile.manualLocks);
    const wouldUpdateCurrentState =
      Boolean(change.summary) ||
      Boolean(change.location) ||
      Boolean(change.physical) ||
      Boolean(change.emotional) ||
      Boolean(change.knowledge) ||
      Boolean(change.objective);

    const lockConflicts: NovelCharacterProfileManualLock[] = [];
    if (locks.has("currentState") && wouldUpdateCurrentState) {
      lockConflicts.push("currentState");
    }

    const nextProfile: NovelCharacterProfile = { ...profile };

    if (!locks.has("currentState") && wouldUpdateCurrentState) {
      nextProfile.currentState = {
        ...profile.currentState,
        chapterId: input.chapterId ?? profile.currentState.chapterId,
        chapterNumber: input.delta.chapterNumber,
        location: change.location ?? profile.currentState.location,
        physical: change.physical ?? profile.currentState.physical,
        emotional: change.emotional ?? profile.currentState.emotional,
        knowledge: change.knowledge ?? profile.currentState.knowledge,
        objective: change.objective ?? profile.currentState.objective,
        summary: change.summary || profile.currentState.summary,
        updatedAt: input.now,
      };
    }

    const alreadySynced = profile.stateHistory.some(
      (entry) => entry.syncId === input.syncId,
    );
    if (!alreadySynced && change.summary.trim()) {
      nextProfile.stateHistory = [
        ...profile.stateHistory,
        {
          chapterId: input.chapterId,
          chapterNumber: input.delta.chapterNumber,
          summary: change.summary,
          changes: change.changes?.length
            ? change.changes
            : [change.summary],
          source: input.source,
          syncId: input.syncId,
          createdAt: input.now,
        },
      ];
    }

    if (lockConflicts.length > 0) {
      lockedFieldsByProfile.set(profile.id, lockConflicts);
      const diagnosticId = buildLockConflictDiagnosticId(profile.id, input.syncId);
      const detail = `角色「${profile.name}」字段 ${lockConflicts.join("、")} 已人工锁定，自动同步已跳过冲突字段。`;
      const existing = diagnostics.find((item) => item.id === diagnosticId);
      diagnostics = [
        {
          id: diagnosticId,
          label: `角色同步 · ${profile.name}`,
          ok: false,
          detail,
          createdAt: existing?.createdAt ?? STABLE_DIAGNOSTIC_CREATED_AT,
        },
        ...diagnostics.filter((item) => item.id !== diagnosticId),
      ].slice(0, 50);
    }

    profiles = profiles.map((item) => (item.id === profile!.id ? nextProfile : item));
  }

  return { profiles, diagnostics };
}

export function buildCharacterStateChangesFromLegacyStates(
  states: Array<{ title: string; content: string }>,
  profiles: NovelCharacterProfile[],
): NovelCharacterStateChange[] {
  return states.flatMap((state) => {
    const name = state.title.trim();
    if (!isCredibleCharacterName(name)) {
      return [];
    }

    const profile = profiles.find((item) => item.name === name);
    return [
      {
        characterId: profile?.id,
        characterName: name,
        summary: state.content.trim(),
        changes: state.content.trim() ? [state.content.trim()] : [],
      },
    ];
  });
}

export type ManualCharacterProfileEdit = {
  narrativeRole?: string;
  coreTraits?: string[];
  motivations?: string[];
  goals?: string[];
  relationships?: NovelCharacterProfile["relationships"];
  currentStateSummary?: string;
};

export function applyManualCharacterProfileEdit(
  profiles: NovelCharacterProfile[],
  profileId: string,
  edit: ManualCharacterProfileEdit,
  now: string,
): NovelCharacterProfile[] {
  return profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile;
    }

    const locks = new Set(profile.manualLocks);
    const next: NovelCharacterProfile = { ...profile, source: "manual" };

    if (
      edit.narrativeRole !== undefined &&
      edit.narrativeRole !== profile.narrativeRole
    ) {
      next.narrativeRole = edit.narrativeRole;
      locks.add("narrativeRole");
    }

    if (
      edit.coreTraits !== undefined &&
      JSON.stringify(edit.coreTraits) !== JSON.stringify(profile.coreTraits)
    ) {
      next.coreTraits = edit.coreTraits;
      locks.add("coreTraits");
    }

    if (edit.motivations !== undefined) {
      next.motivations = edit.motivations;
    }

    if (edit.goals !== undefined) {
      next.goals = edit.goals;
    }

    if (
      edit.relationships !== undefined &&
      JSON.stringify(edit.relationships) !== JSON.stringify(profile.relationships)
    ) {
      next.relationships = edit.relationships;
      locks.add("relationships");
    }

    if (
      edit.currentStateSummary !== undefined &&
      edit.currentStateSummary !== profile.currentState.summary
    ) {
      next.currentState = {
        ...profile.currentState,
        summary: edit.currentStateSummary,
        updatedAt: now,
      };
      locks.add("currentState");
    }

    next.manualLocks = [...locks];
    return next;
  });
}

export function parseStructuredCharacterStateChanges(
  content: string,
  profiles: NovelCharacterProfile[] = [],
): NovelCharacterStateChange[] {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return lines.flatMap((line) => {
    if (/^(无|暂无|没有|无新增|无变化)[。.!！\s]*$/.test(line)) {
      return [];
    }

    const splitIndex = line.search(/[：:]/);
    if (splitIndex <= 0) {
      return [];
    }

    const name = line.slice(0, splitIndex).trim();
    const remainder = line.slice(splitIndex + 1).trim();
    if (!isCredibleCharacterName(name) || !remainder) {
      return [];
    }

    const profile =
      profiles.find((item) => item.name === name) ??
      profiles.find((item) => item.aliases.includes(name));

    const fieldMatch = remainder.match(
      /^(?:位置|location)[：:]\s*([^|｜]+)(?:[|｜]\s*|$)/i,
    );

    return [
      {
        characterId: profile?.id,
        characterName: name,
        summary: fieldMatch ? remainder.replace(fieldMatch[0], "").trim() || remainder : remainder,
        location: fieldMatch?.[1]?.trim(),
        changes: [remainder],
      },
    ];
  });
}

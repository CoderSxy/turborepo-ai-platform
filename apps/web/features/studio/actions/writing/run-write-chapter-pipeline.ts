import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  createChapterPipelineSyncId,
  mergeNovelChapterAssetDeltaSafely,
} from "#lib/novel-asset-auto-sync";
import {
  buildNovelChapterAssetDelta,
  buildNovelWriteChapterInstruction,
  reconcileNovelReviewHistory,
  syncNovelOutlineNodesFromChapters,
  syncNovelProjectChapterPlan,
  validateCommitWriteChapterResultInput,
  type CommitWriteChapterResultInput,
  type NovelChapterReview,
  type NovelChapterReviewIssue,
  type NovelChapterReviewIssueSeverity,
  type NovelChapterWriteTarget,
  type NovelProjectAssets,
  type StoredNovelBook,
  type StoredNovelChapter,
  type StoredNovelTask,
  type StoredNovelTaskCheckpoint,
  type WriteChapterPipelineCheckpointState,
  type WriteChapterPipelineStage,
} from "#lib/novel-store";
import { extractGeneratedChapter } from "../../helpers/novel-helpers";
import type {
  ChapterAudit,
  ChapterAuditDimension,
  ChapterAuditDimensionKey,
  ChapterAuditIssueSeverity,
  ChapterAuditParseResult,
  WriteChapterDraftVersion,
  WriteChapterPipelineAdapters,
  WriteChapterPipelineConfig,
  WriteChapterPipelineContext,
  WriteChapterPipelineInput,
  WriteChapterPipelineResult,
  WriteChapterPipelineStageUpdate,
} from "../types";
import {
  assertCanCommitWriteChapter,
  buildInMemoryChapterVersion,
  buildInMemoryStoredChapter,
  buildWriteChapterCommitInput,
  preallocateWriteChapterIds,
} from "./commit-write-chapter-result";
import { buildWriteChapterPipelineTimelineView } from "./write-chapter-pipeline-timeline";

export const CHAPTER_AUDIT_DIMENSION_KEYS: readonly ChapterAuditDimensionKey[] =
  [
    "continuity",
    "character",
    "plot",
    "style",
    "pacing",
    "foreshadowing",
    "length",
  ] as const;

export const DEFAULT_WRITE_CHAPTER_PIPELINE_CONFIG: WriteChapterPipelineConfig =
  {
    minTotalScore: 70,
    minDimensionScore: 60,
    maxRevisionAttempts: 1,
  };

const CATEGORY_TO_DIMENSION: Record<string, ChapterAuditDimensionKey> = {
  continuity: "continuity",
  character: "character",
  plot: "plot",
  style: "style",
  pacing: "pacing",
  foreshadowing: "foreshadowing",
  length: "length",
  logic: "continuity",
  "review-notes": "plot",
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeIssueSeverity(value: string): ChapterAuditIssueSeverity {
  if (/critical|严重|error|阻断|不通过/i.test(value)) {
    return "critical";
  }

  if (/warning|警告|风险/i.test(value)) {
    return "warning";
  }

  return "info";
}

function createEmptyDimensions(): ChapterAuditDimension[] {
  return CHAPTER_AUDIT_DIMENSION_KEYS.map((key) => ({
    key,
    score: 100,
    issues: [],
  }));
}

function normalizeChapterAudit(input: Partial<ChapterAudit>): ChapterAudit {
  const dimensionsByKey = new Map<ChapterAuditDimensionKey, ChapterAuditDimension>(
    createEmptyDimensions().map((dimension) => [dimension.key, dimension]),
  );

  for (const dimension of input.dimensions ?? []) {
    if (!CHAPTER_AUDIT_DIMENSION_KEYS.includes(dimension.key)) {
      continue;
    }

    dimensionsByKey.set(dimension.key, {
      key: dimension.key,
      score: clampScore(dimension.score),
      issues: (dimension.issues ?? []).map((issue) => ({
        severity: normalizeIssueSeverity(issue.severity),
        evidence: issue.evidence.trim(),
        suggestion: issue.suggestion.trim(),
      })),
    });
  }

  const dimensions = CHAPTER_AUDIT_DIMENSION_KEYS.map(
    (key) => dimensionsByKey.get(key)!,
  );
  const totalScore =
    input.totalScore === undefined
      ? clampScore(
          dimensions.reduce((sum, dimension) => sum + dimension.score, 0) /
            dimensions.length,
        )
      : clampScore(input.totalScore);

  return {
    totalScore,
    dimensions,
  };
}

function extractJsonAuditPayload(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) {
    return fenced;
  }

  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    return raw.slice(objectStart, objectEnd + 1);
  }

  return null;
}

function parseChapterAuditFromMarkdown(raw: string): ChapterAuditParseResult {
  const scoreMatch =
    raw.match(/评分[：:\s]*(\d{1,3})/) ?? raw.match(/score[：:\s]*(\d{1,3})/i);
  const totalScore = scoreMatch?.[1]
    ? clampScore(Number(scoreMatch[1]))
    : undefined;
  const dimensions = createEmptyDimensions();
  const issueLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      /(^[-*\d.]+\s*)?(严重|警告|建议|问题|critical|warning|info|\[critical\]|\[warning\])/i.test(
        line,
      ),
    );

  if (issueLines.length === 0 && totalScore === undefined) {
    return { ok: false, error: "No structured audit content found." };
  }

  for (const line of issueLines) {
    const cleaned = line.replace(/^[-*\d.]+\s*/, "");
    const severity = normalizeIssueSeverity(cleaned);
    const categoryMatch = cleaned.match(
      /(?:\[([^\]]+)\]|(continuity|character|plot|style|pacing|foreshadowing|length|logic|人物|情节|节奏|文风|伏笔|连续|字数))/i,
    );
    const category = categoryMatch?.[1] ?? categoryMatch?.[2] ?? "plot";
    const dimensionKey =
      CATEGORY_TO_DIMENSION[category.toLowerCase()] ??
      CATEGORY_TO_DIMENSION[category] ??
      "plot";
    const evidence =
      cleaned
        .replace(/^(严重|警告|建议|问题|critical|warning|info)[：:\s-]*/i, "")
        .split(/\n\s*建议[：:]/)[0]
        ?.trim() || cleaned;
    const suggestion =
      cleaned.match(/建议[：:]\s*(.+)$/)?.[1]?.trim() ??
      line.match(/建议[：:]\s*(.+)$/)?.[1]?.trim() ??
      "";
    const dimension = dimensions.find((item) => item.key === dimensionKey)!;
    dimension.issues.push({ severity, evidence, suggestion });
    if (severity === "critical") {
      dimension.score = Math.min(dimension.score, 40);
    } else if (severity === "warning") {
      dimension.score = Math.min(dimension.score, 70);
    }
  }

  return {
    ok: true,
    audit: normalizeChapterAudit({
      totalScore,
      dimensions,
    }),
  };
}

export function parseChapterAudit(raw: string): ChapterAuditParseResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: "Audit output was empty." };
  }

  const jsonPayload = extractJsonAuditPayload(trimmed);

  if (jsonPayload) {
    try {
      const parsed = JSON.parse(jsonPayload) as Partial<ChapterAudit>;
      if (
        typeof parsed.totalScore !== "number" &&
        !Array.isArray(parsed.dimensions)
      ) {
        return { ok: false, error: "Audit JSON missing required fields." };
      }

      return {
        ok: true,
        audit: normalizeChapterAudit(parsed),
      };
    } catch {
      return { ok: false, error: "Audit JSON could not be parsed." };
    }
  }

  return parseChapterAuditFromMarkdown(trimmed);
}

export function evaluateAuditBlocking(
  audit: ChapterAudit,
  config: WriteChapterPipelineConfig,
): { blocking: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (audit.totalScore < config.minTotalScore) {
    reasons.push(
      `总分 ${audit.totalScore} 低于阈值 ${config.minTotalScore}`,
    );
  }

  for (const dimension of audit.dimensions) {
    if (dimension.score < config.minDimensionScore) {
      reasons.push(
        `${dimension.key} 维度得分 ${dimension.score} 低于阈值 ${config.minDimensionScore}`,
      );
    }

    for (const issue of dimension.issues) {
      if (issue.severity === "critical") {
        reasons.push(`存在 critical 问题：${issue.evidence}`);
      }
    }
  }

  return {
    blocking: reasons.length > 0,
    reasons,
  };
}

export function createInitialWriteChapterPipelineCheckpoint(
  now: string,
): WriteChapterPipelineCheckpointState {
  return {
    stage: "queued",
    stageTimeline: [{ stage: "queued", enteredAt: now }],
    revisionAttempts: 0,
    auditParseAttempts: 0,
    draftVersionIds: [],
  };
}

export function advanceWriteChapterPipelineStage(
  checkpoint: WriteChapterPipelineCheckpointState,
  stage: WriteChapterPipelineStage,
  now: string,
  detail?: string,
): WriteChapterPipelineCheckpointState {
  if (checkpoint.stage === stage) {
    return {
      ...checkpoint,
      failureDetail: detail ?? checkpoint.failureDetail,
    };
  }

  return {
    ...checkpoint,
    stage,
    failureDetail: detail ?? checkpoint.failureDetail,
    stageTimeline: [
      ...checkpoint.stageTimeline,
      {
        stage,
        enteredAt: now,
        detail,
      },
    ],
  };
}

export function buildWriteChapterPipelineTaskCheckpoint(input: {
  checkpoint: WriteChapterPipelineCheckpointState;
  progressMessages: string[];
  assistantMessageId: string;
  now: string;
}): StoredNovelTaskCheckpoint {
  return {
    progressMessages: input.progressMessages,
    savedAt: input.now,
    assistantMessageId: input.assistantMessageId,
    pipeline: input.checkpoint,
  };
}

export function applyWriteChapterPipelineTaskUpdate(
  task: StoredNovelTask,
  update: WriteChapterPipelineStageUpdate,
  now: string,
): StoredNovelTask {
  return {
    ...task,
    pipelineStage: update.stage,
    syncId: update.checkpoint.syncId ?? task.syncId,
    chapterVersionId: update.checkpoint.chapterVersionId ?? task.chapterVersionId,
    auditId: update.checkpoint.auditId ?? task.auditId,
    checkpoint: buildWriteChapterPipelineTaskCheckpoint({
      checkpoint: update.checkpoint,
      progressMessages: task.checkpoint?.progressMessages ?? [],
      assistantMessageId: task.checkpoint?.assistantMessageId ?? "",
      now,
    }),
  };
}

function assertPipelineNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}

function resolvePipelineConfig(
  input?: Partial<WriteChapterPipelineConfig>,
): WriteChapterPipelineConfig {
  const maxRevisionAttempts = Math.min(
    2,
    Math.max(0, input?.maxRevisionAttempts ?? DEFAULT_WRITE_CHAPTER_PIPELINE_CONFIG.maxRevisionAttempts),
  );

  return {
    minTotalScore:
      input?.minTotalScore ?? DEFAULT_WRITE_CHAPTER_PIPELINE_CONFIG.minTotalScore,
    minDimensionScore:
      input?.minDimensionScore ??
      DEFAULT_WRITE_CHAPTER_PIPELINE_CONFIG.minDimensionScore,
    maxRevisionAttempts,
  };
}

function buildPipelineContext(input: {
  book: StoredNovelBook;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  task: StoredNovelTask;
  intent?: string;
}): WriteChapterPipelineContext {
  return {
    bookId: input.book.id,
    project: input.book.project,
    assets: input.book.assets,
    chapters: input.chapters,
    target: input.target,
    intent: input.intent,
    taskId: input.task.id,
  };
}

function createDraftVersion(input: {
  id: string;
  content: string;
  source: WriteChapterDraftVersion["source"];
  now: string;
}): WriteChapterDraftVersion {
  return {
    id: input.id,
    content: input.content,
    source: input.source,
    createdAt: input.now,
  };
}

function createAuditId(taskId: string, attempt: number, now: string): string {
  return `${taskId}-audit-${attempt}-${now.replace(/[^0-9]/g, "")}`;
}

const AUDIT_DIMENSION_TO_ISSUE_TYPE: Record<
  ChapterAuditDimensionKey,
  NonNullable<NovelChapterReviewIssue["type"]>
> = {
  continuity: "continuity",
  character: "character",
  plot: "plot",
  style: "style",
  pacing: "pacing",
  foreshadowing: "plot",
  length: "other",
};

function mapAuditIssueSeverity(
  severity: ChapterAuditIssueSeverity,
): NovelChapterReviewIssueSeverity {
  if (severity === "critical") {
    return "error";
  }

  return severity;
}

export function convertChapterAuditToNovelReview(input: {
  audit: ChapterAudit;
  auditId: string;
  terminal: "completed" | "completed_with_attention";
  attentionReason?: string;
  now: string;
}): NovelChapterReview {
  const hasCritical = input.audit.dimensions.some((dimension) =>
    dimension.issues.some((issue) => issue.severity === "critical"),
  );
  const verdict =
    input.terminal === "completed_with_attention" || hasCritical
      ? "needs-revision"
      : "approved";
  const issues = input.audit.dimensions.flatMap((dimension, dimensionIndex) =>
    dimension.issues.map((issue, issueIndex) => ({
      id: `${input.auditId}-${dimension.key}-${dimensionIndex + 1}-${issueIndex + 1}`,
      severity: mapAuditIssueSeverity(issue.severity),
      type: AUDIT_DIMENSION_TO_ISSUE_TYPE[dimension.key],
      title: issue.evidence.slice(0, 80) || `${dimension.key} 问题`,
      detail: issue.evidence,
      suggestion: issue.suggestion || undefined,
      resolved: false,
    })),
  );
  const summary =
    input.attentionReason?.trim() ||
    `总分 ${input.audit.totalScore}，${issues.length} 项审核问题。`;

  return {
    id: input.auditId,
    verdict,
    score: input.audit.totalScore,
    summary,
    issues,
    createdAt: input.now,
  };
}

function attachChapterAuditReview(input: {
  chapter: StoredNovelChapter;
  audit: ChapterAudit | null;
  auditId: string;
  terminal: "completed" | "completed_with_attention";
  attentionReason?: string;
  now: string;
}): StoredNovelChapter {
  if (!input.audit) {
    return input.chapter;
  }

  const nextReview = convertChapterAuditToNovelReview({
    audit: input.audit,
    auditId: input.auditId,
    terminal: input.terminal,
    attentionReason: input.attentionReason,
    now: input.now,
  });
  const reviews = reconcileNovelReviewHistory(input.chapter.reviews ?? [], nextReview);

  return {
    ...input.chapter,
    reviews,
    activeReviewId: nextReview.id,
  };
}

export type ValidateWriteChapterStateResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateWriteChapterState(input: {
  generatedChapter: NonNullable<ReturnType<typeof extractGeneratedChapter>>;
  target: NovelChapterWriteTarget;
  assets: NovelProjectAssets;
}): ValidateWriteChapterStateResult {
  const { generatedChapter, target, assets } = input;

  if (!generatedChapter.content.trim()) {
    return { ok: false, reason: "章节正文为空。" };
  }

  if (!generatedChapter.title.trim()) {
    return { ok: false, reason: "章节标题为空。" };
  }

  if (generatedChapter.number !== target.number) {
    return {
      ok: false,
      reason: `章节序号 ${generatedChapter.number} 与目标 ${target.number} 不一致。`,
    };
  }

  const profileIds = new Set(
    (assets.characterProfiles ?? []).map((profile) => profile.id),
  );
  const delta = buildNovelChapterAssetDelta({
    chapterNumber: generatedChapter.number,
    chapterTitle: generatedChapter.title,
    content: generatedChapter.content,
    existingSummary: generatedChapter.summary,
    characterProfiles: assets.characterProfiles,
  });

  for (const change of delta.characterStateChanges ?? []) {
    if (change.characterId && !profileIds.has(change.characterId)) {
      return {
        ok: false,
        reason: `角色状态变更引用了未知 profile id：${change.characterId}`,
      };
    }
  }

  return { ok: true };
}

function buildCommitArtifacts(input: {
  book: StoredNovelBook;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  task: StoredNovelTask;
  sessionId: string;
  assistantMessageId: string;
  label: string;
  startedAt: string;
  selectedVersion: WriteChapterDraftVersion;
  project: InkosNovelProject;
  nextAssets: NovelProjectAssets;
  latestChapters: StoredNovelChapter[];
  chapterId: string;
  chapterVersionId: string;
  syncId: string;
  auditId: string;
  progressMessages: string[];
  terminal: "completed" | "completed_with_attention";
  attentionReason?: string;
  audit: ChapterAudit | null;
  auditParseFailed?: boolean;
  checkpoint: WriteChapterPipelineCheckpointState;
  contextSummary?: string;
  syncStatus?: "applied" | "needs-attention";
  now: string;
}): CommitWriteChapterResultInput {
  const generatedChapter = extractGeneratedChapter({
    bookId: input.book.id,
    content: input.selectedVersion.content,
    project: input.project,
    target: input.target,
  });

  if (!generatedChapter) {
    throw new Error("未能从最终版本解析章节内容。");
  }

  const assetDelta = buildNovelChapterAssetDelta({
    chapterNumber: generatedChapter.number,
    chapterTitle: generatedChapter.title,
    content: input.selectedVersion.content,
    existingSummary: generatedChapter.summary,
    characterProfiles: input.nextAssets.characterProfiles,
  });
  const existingChapter =
    input.chapters.find((chapter) => chapter.id === input.chapterId) ?? null;
  const storedChapter = attachChapterAuditReview({
    chapter: buildInMemoryStoredChapter({
      generatedChapter,
      chapterId: input.chapterId,
      existingChapter,
      summaryOverride: assetDelta.summary || generatedChapter.summary,
      now: input.now,
    }),
    audit: input.audit,
    auditId: input.auditId,
    terminal: input.terminal,
    attentionReason: input.attentionReason,
    now: input.now,
  });
  const nextProject = syncNovelProjectChapterPlan(input.project, storedChapter);
  const chapterVersion = buildInMemoryChapterVersion({
    chapter: storedChapter,
    chapterVersionId: input.chapterVersionId,
    now: input.now,
    versionNote:
      input.selectedVersion.source === "revision"
        ? "InkOS ReviserAgent 修订章节"
        : "InkOS WriterAgent 生成章节",
  });
  chapterVersion.reviewId = storedChapter.activeReviewId;
  const savedProgressMessage = `第 ${storedChapter.number} 章《${storedChapter.title}》已保存`;
  const progressForCommit = [...input.progressMessages, savedProgressMessage];
  const taskStatus =
    input.terminal === "completed_with_attention"
      ? "completed_with_attention"
      : "success";
  const pipelineSummary =
    input.terminal === "completed_with_attention"
      ? input.attentionReason || "已生成，建议查看审核问题。"
      : undefined;
  const pipelineTimeline = buildWriteChapterPipelineTimelineView({
    checkpoint: input.checkpoint,
    audit: input.audit,
    auditParseFailed: input.auditParseFailed,
    draftContent: input.selectedVersion.content,
    contextSummary: input.contextSummary,
    syncStatus: input.syncStatus,
    terminal: input.terminal,
    attentionReason: input.attentionReason,
  });

  return buildWriteChapterCommitInput({
    bookSnapshot: {
      id: input.book.id,
      archived: input.book.archived,
      sortIndex: input.book.sortIndex,
      createdAt: input.book.createdAt,
    },
    nextProject,
    nextAssets: {
      ...input.nextAssets,
      outlineNodes: syncNovelOutlineNodesFromChapters(
        input.nextAssets.outlineNodes,
        input.latestChapters.some((chapter) => chapter.id === storedChapter.id)
          ? input.latestChapters.map((chapter) =>
              chapter.id === storedChapter.id ? storedChapter : chapter,
            )
          : [...input.latestChapters, storedChapter],
        nextProject,
      ),
    },
    storedChapter,
    chapterVersion,
    runningTask: input.task,
    sessionId: input.sessionId,
    label: input.label,
    assistantMessageId: input.assistantMessageId,
    progressMessages: progressForCommit,
    resultContent: input.selectedVersion.content,
    completionSummary: savedProgressMessage,
    startedAt: input.startedAt,
    now: input.now,
    taskStatus,
    pipelineSummary,
    syncId: input.syncId,
    chapterVersionId: input.chapterVersionId,
    auditId: input.auditId,
    pipelineStage: input.terminal,
    pipelineTimeline,
    attentionReason: input.attentionReason,
    terminal: input.terminal,
  });
}

export async function runWriteChapterPipeline(
  input: WriteChapterPipelineInput,
): Promise<WriteChapterPipelineResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const config = resolvePipelineConfig(input.config);
  const progressMessages: string[] = [];
  let checkpoint = createInitialWriteChapterPipelineCheckpoint(now());
  const versions = new Map<string, WriteChapterDraftVersion>();
  const { chapterId, chapterVersionId } = preallocateWriteChapterIds(
    input.book.id,
    input.target.number,
    input.task.id,
  );

  checkpoint = {
    ...checkpoint,
    chapterVersionId,
    syncId: undefined,
  };

  const emitStage = (
    stage: WriteChapterPipelineStage,
    detail?: string,
    progressMessage?: string,
  ) => {
    checkpoint = advanceWriteChapterPipelineStage(
      checkpoint,
      stage,
      now(),
      detail,
    );

    if (progressMessage) {
      progressMessages.push(progressMessage);
    }

    input.onStageChange?.({
      stage,
      detail,
      checkpoint,
      progressMessage,
    });
  };

  try {
    emitStage(
      "preparing_context",
      undefined,
      `正在准备第 ${input.target.number} 章《${input.target.title}》`,
    );
    assertPipelineNotCancelled(input.signal);

    if (!input.book.project.title.trim()) {
      throw new Error("书籍标题缺失，无法开始写作。");
    }

    const context = buildPipelineContext({
      book: input.book,
      chapters: input.chapters,
      target: input.target,
      task: input.task,
    });

    emitStage("planning");
    assertPipelineNotCancelled(input.signal);
    const intent = await input.adapters.planChapter(context);
    checkpoint = { ...checkpoint, chapterIntent: intent };

    emitStage("drafting");
    assertPipelineNotCancelled(input.signal);
    const draftContent = await input.adapters.draftChapter({
      ...context,
      intent,
    });
    const draftVersion = createDraftVersion({
      id: `${chapterVersionId}-draft`,
      content: draftContent,
      source: "draft",
      now: now(),
    });
    versions.set(draftVersion.id, draftVersion);
    checkpoint = {
      ...checkpoint,
      draftVersionIds: [...checkpoint.draftVersionIds, draftVersion.id],
      selectedVersionId: draftVersion.id,
    };

    let selectedVersion = draftVersion;
    let auditRaw = "";
    let parsedAudit: ChapterAudit | null = null;
    let auditParseFailed = false;
    let attentionReason: string | undefined;

    const runAuditStage = async (
      stage: "auditing" | "reauditing",
      content: string,
    ) => {
      emitStage(stage);
      assertPipelineNotCancelled(input.signal);

      let lastRaw = "";
      let lastParsed: ChapterAudit | null = null;
      let parseFailed = false;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        checkpoint = {
          ...checkpoint,
          auditParseAttempts: checkpoint.auditParseAttempts + 1,
        };
        lastRaw = await input.adapters.auditChapter({
          ...context,
          intent,
          content,
          attempt,
        });
        const parsed = parseChapterAudit(lastRaw);

        if (parsed.ok) {
          lastParsed = parsed.audit;
          parseFailed = false;
          break;
        }

        parseFailed = true;

        if (attempt === 2) {
          attentionReason =
            attentionReason ??
            "审核报告无法解析，已保存最佳版本并标记需关注。";
        }
      }

      auditRaw = lastRaw;
      parsedAudit = lastParsed;
      auditParseFailed = parseFailed;
      checkpoint = {
        ...checkpoint,
        auditId: createAuditId(input.task.id, checkpoint.auditParseAttempts, now()),
      };

      return {
        raw: lastRaw,
        audit: lastParsed,
        parseFailed,
      };
    };

    let auditResult = await runAuditStage("auditing", selectedVersion.content);
    let blocking =
      auditResult.audit !== null
        ? evaluateAuditBlocking(auditResult.audit, config)
        : { blocking: false, reasons: [] as string[] };

    if (auditResult.parseFailed) {
      blocking = { blocking: false, reasons: [] };
    }

    while (
      !auditResult.parseFailed &&
      blocking.blocking &&
      checkpoint.revisionAttempts < config.maxRevisionAttempts
    ) {
      emitStage("revising", blocking.reasons.join("；"));
      assertPipelineNotCancelled(input.signal);
      checkpoint = {
        ...checkpoint,
        revisionAttempts: checkpoint.revisionAttempts + 1,
      };
      const revisedContent = await input.adapters.reviseChapter({
        ...context,
        intent,
        content: selectedVersion.content,
        audit: auditResult.audit,
        auditRaw: auditResult.raw,
      });
      const revisedVersion = createDraftVersion({
        id: `${chapterVersionId}-revision-${checkpoint.revisionAttempts}`,
        content: revisedContent,
        source: "revision",
        now: now(),
      });
      versions.set(revisedVersion.id, revisedVersion);
      selectedVersion = revisedVersion;
      checkpoint = {
        ...checkpoint,
        draftVersionIds: [...checkpoint.draftVersionIds, revisedVersion.id],
        selectedVersionId: revisedVersion.id,
      };

      auditResult = await runAuditStage("reauditing", selectedVersion.content);
      blocking =
        auditResult.audit !== null
          ? evaluateAuditBlocking(auditResult.audit, config)
          : { blocking: false, reasons: [] };

      if (auditResult.parseFailed) {
        blocking = { blocking: false, reasons: [] };
      }
    }

    if (
      !auditResult.parseFailed &&
      blocking.blocking &&
      checkpoint.revisionAttempts >= config.maxRevisionAttempts
    ) {
      attentionReason =
        attentionReason ??
        `仍有阻塞问题未完全修复：${blocking.reasons.join("；")}`;
    }

    const terminal: "completed" | "completed_with_attention" =
      auditParseFailed || attentionReason
        ? "completed_with_attention"
        : "completed";

    emitStage("extracting_facts");
    assertPipelineNotCancelled(input.signal);

    const extractionProject = syncNovelProjectChapterPlan(
      input.book.project,
      extractGeneratedChapter({
        bookId: input.book.id,
        content: selectedVersion.content,
        project: input.book.project,
        target: input.target,
      }) ?? {
        bookId: input.book.id,
        number: input.target.number,
        title: input.target.title,
        content: selectedVersion.content,
        summary: "",
        status: "ready-for-review",
        wordCount: 0,
      },
    );
    const assetDelta = buildNovelChapterAssetDelta({
      chapterNumber: input.target.number,
      chapterTitle: input.target.title,
      content: selectedVersion.content,
      characterProfiles: input.book.assets.characterProfiles,
    });
    const mergeDelta = {
      ...assetDelta,
      chapterNumber: input.target.number,
      chapterTitle: input.target.title,
    };
    const syncId = createChapterPipelineSyncId({
      chapterId,
      chapterVersionId,
      delta: mergeDelta,
    });
    checkpoint = { ...checkpoint, syncId };

    emitStage("syncing_assets");
    assertPipelineNotCancelled(input.signal);
    const mergeResult = mergeNovelChapterAssetDeltaSafely(
      input.book.assets,
      mergeDelta,
      { source: "chapter-pipeline", syncId, chapterId },
    );
    let nextAssets = mergeResult.assets;
    const generatedChapter = extractGeneratedChapter({
      bookId: input.book.id,
      content: selectedVersion.content,
      project: extractionProject,
      target: input.target,
    });

    if (!generatedChapter) {
      throw new Error("未能从最终版本解析章节内容。");
    }

    const storedChapter = buildInMemoryStoredChapter({
      generatedChapter,
      chapterId,
      existingChapter:
        input.chapters.find((chapter) => chapter.id === chapterId) ?? null,
      summaryOverride: assetDelta.summary || generatedChapter.summary,
      now: now(),
    });
    const latestChapters = input.chapters.some(
      (chapter) => chapter.id === storedChapter.id,
    )
      ? input.chapters.map((chapter) =>
          chapter.id === storedChapter.id ? storedChapter : chapter,
        )
      : [...input.chapters, storedChapter];
    nextAssets = {
      ...nextAssets,
      outlineNodes: syncNovelOutlineNodesFromChapters(
        nextAssets.outlineNodes,
        latestChapters,
        extractionProject,
      ),
    };

    emitStage("validating_state");
    assertPipelineNotCancelled(input.signal);
    const validation = validateWriteChapterState({
      generatedChapter,
      target: input.target,
      assets: nextAssets,
    });

    if (!validation.ok) {
      emitStage("failed", validation.reason);
      return {
        terminal: "failed",
        checkpoint,
        progressMessages,
        errorMessage: validation.reason,
      };
    }

    if (input.signal) {
      assertCanCommitWriteChapter(input.signal);
    }
    emitStage("committing");

    const commitInput = buildCommitArtifacts({
      book: input.book,
      chapters: input.chapters,
      target: input.target,
      task: input.task,
      sessionId: input.sessionId,
      assistantMessageId: input.assistantMessageId,
      label: input.label,
      startedAt: input.startedAt,
      selectedVersion,
      project: extractionProject,
      nextAssets,
      latestChapters,
      chapterId,
      chapterVersionId,
      syncId,
      auditId: checkpoint.auditId ?? createAuditId(input.task.id, 1, now()),
      progressMessages: [
        ...progressMessages,
        mergeResult.status === "needs-attention"
          ? "章节已完成；同步需关注，详见同步诊断"
          : "已同步：章节摘要、角色状态、世界观、伏笔与大纲",
      ],
      terminal,
      attentionReason,
      audit: parsedAudit,
      auditParseFailed,
      checkpoint,
      syncStatus:
        mergeResult.status === "needs-attention" ? "needs-attention" : "applied",
      now: now(),
    });

    validateCommitWriteChapterResultInput(commitInput);
    emitStage(terminal, attentionReason);

    return {
      terminal,
      taskStatus:
        terminal === "completed_with_attention"
          ? "completed_with_attention"
          : "success",
      commitInput,
      checkpoint,
      progressMessages: [
        ...progressMessages,
        `第 ${input.target.number} 章《${input.target.title}》已保存`,
      ],
      selectedVersion,
      audit: parsedAudit,
      auditRaw,
      attentionReason,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      emitStage("cancelled", "任务已取消。");
      return {
        terminal: "cancelled",
        checkpoint,
        progressMessages,
        errorMessage: "任务已取消，未写入最终数据。",
      };
    }

    const message =
      error instanceof Error ? error.message : "写作流水线执行失败。";
    emitStage("failed", message);

    return {
      terminal: "failed",
      checkpoint,
      progressMessages,
      errorMessage: message,
    };
  }
}

export function buildDefaultWriteChapterPipelineAdapters(input: {
  writeInstruction: string;
  streamAction: (
    action: "write-chapter" | "review" | "revise-chapter",
    instruction: string,
    content?: string,
  ) => Promise<string>;
}): WriteChapterPipelineAdapters {
  return {
    planChapter: async (context) => {
      return [
        `第 ${context.target.number} 章《${context.target.title}》`,
        context.target.focus,
      ]
        .filter(Boolean)
        .join("：");
    },
    draftChapter: async () =>
      input.streamAction("write-chapter", input.writeInstruction),
    auditChapter: async (context) => {
      const instruction =
        context.attempt >= 2
          ? `${context.content}\n\n请仅以结构化 JSON 重新输出审核报告，勿输出解释性散文`
          : context.content;
      return input.streamAction("review", instruction, context.content);
    },
    reviseChapter: async (context) =>
      input.streamAction(
        "revise-chapter",
        [
          `## 原章节正文\n${context.content}`,
          `## 审稿意见\n${context.auditRaw}`,
        ].join("\n\n"),
        context.content,
      ),
  };
}

export function buildWriteChapterInstructionForPipeline(input: {
  book: StoredNovelBook;
  chapters: StoredNovelChapter[];
  target: NovelChapterWriteTarget;
  userInstruction?: string;
  contextSelection?: import("#lib/novel-store").NovelContextSelection;
}): string {
  return buildNovelWriteChapterInstruction({
    project: input.book.project,
    assets: input.book.assets,
    chapters: input.chapters,
    target: input.target,
    userInstruction: input.userInstruction,
    contextSelectionOverride: input.contextSelection,
  });
}

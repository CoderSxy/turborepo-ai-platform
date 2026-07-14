import type { InkosCoreAction } from "@repo/inkos-adapter";
import {
  appendStoredNovelTaskLog,
  buildNovelRecoverableErrorNotice,
  clearStoredNovelTaskCheckpoint,
  finishStoredNovelTask,
  updateStoredNovelTaskPipelineCheckpoint,
  type NovelChapterWriteTarget,
  type StoredNovelTask,
} from "#lib/novel-store";
import {
  formatCoreTaskErrorMessage,
  streamInkosCoreAction,
} from "../../helpers/inkos-stream";
import { resolveCoreActionModelBinding } from "../../helpers/model-binding";
import { studioMessagesToChatMessages } from "../runtime/message-parts";
import type { ChapterAudit, RunCoreActionOptions, StudioActionContext } from "../types";
import type { NovelBookEntry, ReadyModelBinding } from "../../state/studio-types";
import type { StudioMessage } from "../../store/types";
import {
  buildErrorPart,
  buildWriteChapterFinalAssistantParts,
  buildProgressPartFromMessages,
  completeProgressPart,
} from "../../store/slices/message/parts-builder";
import {
  assertCanCommitWriteChapter,
  buildFinalWriteChapterAssistantMessage,
  commitWriteChapterResultForStudio,
} from "./commit-write-chapter-result";
import {
  applyWriteChapterPipelineTaskUpdate,
  buildDefaultWriteChapterPipelineAdapters,
  buildWriteChapterInstructionForPipeline,
  runWriteChapterPipeline,
} from "./run-write-chapter-pipeline";
import {
  buildWriteChapterPipelineTimelineView,
  type WriteChapterPipelineTimelineView,
} from "./write-chapter-pipeline-timeline";
import {
  resolveDefaultWriteChapterSelection,
  summarizeContextSelection,
} from "../write-chapter";
import { setActiveCoreProgress } from "../core-task-state";

type WriteChapterCoreActionInput = {
  ctx: StudioActionContext;
  activeBook: NovelBookEntry;
  requestSessionId: string;
  writeTarget: NovelChapterWriteTarget;
  runningTask: StoredNovelTask;
  taskId: string;
  assistantMessageId: string;
  label: string;
  startedAt: string;
  progressMessages: string[];
  abortController: AbortController;
  bindingResult: ReadyModelBinding;
  options?: RunCoreActionOptions;
  userInstruction?: string;
  visibleMessages: StudioMessage[];
  isResume: boolean;
};

function resolveSyncStatusFromProgress(
  progressMessages: string[],
): WriteChapterPipelineTimelineView["syncStatus"] | undefined {
  const syncMessage = [...progressMessages]
    .reverse()
    .find(
      (message) =>
        message.includes("已同步：") || message.includes("同步需关注"),
    );

  if (!syncMessage) {
    return undefined;
  }

  return syncMessage.includes("同步需关注") ? "needs-attention" : "applied";
}

function updateWriteChapterAssistantProgress(input: {
  store: ReturnType<StudioActionContext["getState"]>;
  requestSessionId: string;
  assistantMessageId: string;
  label: string;
  startedAt: string;
  progressMessages: string[];
  pipelineTimeline?: WriteChapterPipelineTimelineView;
  streaming?: boolean;
}) {
  input.store.updateMessage(
    input.requestSessionId,
    input.assistantMessageId,
    (item) => ({
      ...item,
      parts: [
        buildProgressPartFromMessages(input.label, input.progressMessages, {
          status: "running",
          startedAt: input.startedAt,
          pipelineTimeline: input.pipelineTimeline,
        }),
      ],
      streaming: input.streaming ?? true,
    }),
  );
}

async function persistPipelineStageCheckpoint(input: {
  taskId: string;
  runningTask: StoredNovelTask;
  assistantMessageId: string;
  progressMessages: string[];
  checkpoint: import("#lib/novel-store").WriteChapterPipelineCheckpointState;
  now: string;
}) {
  await updateStoredNovelTaskPipelineCheckpoint(input.taskId, {
    progressMessages: [...input.progressMessages],
    savedAt: input.now,
    assistantMessageId: input.assistantMessageId,
    pipeline: input.checkpoint,
  }).catch(() => undefined);

  return applyWriteChapterPipelineTaskUpdate(
    input.runningTask,
    {
      stage: input.checkpoint.stage,
      checkpoint: input.checkpoint,
    },
    input.now,
  );
}

export async function runWriteChapterCoreAction(
  input: WriteChapterCoreActionInput,
): Promise<boolean> {
  const {
    ctx,
    activeBook,
    requestSessionId,
    writeTarget,
    runningTask,
    taskId,
    assistantMessageId,
    label,
    startedAt,
    progressMessages,
    abortController,
    bindingResult,
    options,
    userInstruction,
    visibleMessages,
    isResume,
  } = input;
  const store = ctx.getState();
  const project = activeBook.project;
  let currentTask = runningTask;
  let latestDraftContent = "";
  let latestAudit: ChapterAudit | null = null;
  let latestAuditParseFailed = false;
  let latestSyncStatus: WriteChapterPipelineTimelineView["syncStatus"];
  let contextSummary = "";
  let checkpointWriteChain = Promise.resolve();
  let commitStarted = false;

  const enqueuePipelineStageCheckpoint = (update: {
    checkpoint: import("#lib/novel-store").WriteChapterPipelineCheckpointState;
  }) => {
    if (commitStarted) {
      return;
    }

    const now = new Date().toISOString();
    checkpointWriteChain = checkpointWriteChain.then(async () => {
      if (commitStarted) {
        return;
      }

      currentTask = await persistPipelineStageCheckpoint({
        taskId,
        runningTask: currentTask,
        assistantMessageId,
        progressMessages,
        checkpoint: update.checkpoint,
        now,
      });
    });
    void checkpointWriteChain;
  };

  if (!isResume) {
    progressMessages.push(
      `正在准备第 ${writeTarget.number} 章《${writeTarget.title}》`,
    );
    const selection =
      options?.contextSelectionOverride ??
      resolveDefaultWriteChapterSelection(activeBook, project);
    contextSummary = summarizeContextSelection(selection);
    const contextCount =
      contextSummary === "无额外上下文"
        ? 0
        : contextSummary.split("、").length;
    progressMessages.push(
      contextCount > 0
        ? `已带入 ${contextCount} 项上下文：${contextSummary}`
        : "未带入额外上下文",
    );
  } else {
    contextSummary = summarizeContextSelection(
      options?.contextSelectionOverride ??
        resolveDefaultWriteChapterSelection(activeBook, project),
    );
  }

  setActiveCoreProgress([...progressMessages]);

  const updateCoreProgress = (message: string) => {
    progressMessages.push(message);
    setActiveCoreProgress([...progressMessages]);
    void appendStoredNovelTaskLog(taskId, message);
    updateWriteChapterAssistantProgress({
      store,
      requestSessionId,
      assistantMessageId,
      label,
      startedAt,
      progressMessages,
      pipelineTimeline: buildWriteChapterPipelineTimelineView({
        checkpoint: currentTask.checkpoint?.pipeline ?? {
          stage: "queued",
          stageTimeline: [],
          revisionAttempts: 0,
          auditParseAttempts: 0,
          draftVersionIds: [],
        },
        audit: latestAudit,
        auditParseFailed: latestAuditParseFailed,
        draftContent: latestDraftContent,
        contextSummary,
        syncStatus: latestSyncStatus,
      }),
    });
  };

  updateWriteChapterAssistantProgress({
    store,
    requestSessionId,
    assistantMessageId,
    label,
    startedAt,
    progressMessages,
    pipelineTimeline: buildWriteChapterPipelineTimelineView({
      checkpoint: currentTask.checkpoint?.pipeline ?? {
        stage: "preparing_context",
        stageTimeline: [],
        revisionAttempts: 0,
        auditParseAttempts: 0,
        draftVersionIds: [],
      },
      contextSummary,
    }),
  });

  const writeInstruction = buildWriteChapterInstructionForPipeline({
    book: {
      id: activeBook.id,
      title: activeBook.title,
      genre: activeBook.project.genre,
      premise: activeBook.project.premise,
      project: activeBook.project,
      assets: activeBook.assets,
      archived: activeBook.archived,
      sortIndex: activeBook.sortIndex,
      createdAt: startedAt,
      updatedAt: startedAt,
    },
    chapters: activeBook.chapters,
    target: writeTarget,
    userInstruction: userInstruction || undefined,
    contextSelection: options?.contextSelectionOverride,
  });

  const streamPipelineAction = async (
    action: Extract<InkosCoreAction, "write-chapter" | "review" | "revise-chapter">,
    instruction: string,
  ) => {
    const actionBinding =
      action === "write-chapter"
        ? bindingResult
        : resolveCoreActionModelBinding(ctx.settings, action);

    if ("error" in actionBinding) {
      throw new Error(actionBinding.error);
    }

    const coreMessages = visibleMessages.filter(
      (message) => message.id !== assistantMessageId,
    );
    const result = await streamInkosCoreAction(
      action,
      actionBinding.provider,
      actionBinding.model,
      project,
      activeBook.assets,
      studioMessagesToChatMessages(coreMessages),
      () => undefined,
      instruction,
      abortController.signal,
      {
        temperature: actionBinding.temperature,
        maxTokens: actionBinding.maxTokens,
      },
    );

    if (!result.ok) {
      throw new Error(result.message || "InkOS Core 执行失败。");
    }

    return result.content ?? result.message ?? "";
  };

  const adapters = buildDefaultWriteChapterPipelineAdapters({
    writeInstruction,
    streamAction: streamPipelineAction,
  });

  const pipelineResult = await runWriteChapterPipeline({
    book: {
      id: activeBook.id,
      title: activeBook.title,
      genre: activeBook.project.genre,
      premise: activeBook.project.premise,
      project: activeBook.project,
      assets: activeBook.assets,
      archived: activeBook.archived,
      sortIndex: activeBook.sortIndex,
      createdAt: startedAt,
      updatedAt: startedAt,
    },
    chapters: activeBook.chapters,
    target: writeTarget,
    task: currentTask,
    sessionId: requestSessionId,
    assistantMessageId,
    label,
    startedAt,
    contextSelection: options?.contextSelectionOverride,
    userInstruction: userInstruction || undefined,
    adapters,
    signal: abortController.signal,
    onStageChange: (update) => {
      if (update.progressMessage) {
        updateCoreProgress(update.progressMessage);
      } else if (update.stage === "drafting") {
        updateCoreProgress("正在生成章节草稿…");
      } else if (update.stage === "auditing") {
        updateCoreProgress("正在进行结构化审核…");
      } else if (update.stage === "revising") {
        updateCoreProgress(
          update.detail
            ? `正在自动修订：${update.detail}`
            : "正在根据审核意见自动修订…",
        );
      } else if (update.stage === "reauditing") {
        updateCoreProgress("正在复审修订结果…");
      } else if (update.stage === "extracting_facts") {
        updateCoreProgress("正在提取章节事实增量…");
      } else if (update.stage === "syncing_assets") {
        updateCoreProgress("正在同步角色、世界观与伏笔…");
      } else if (update.stage === "validating_state") {
        updateCoreProgress("正在校验章节与资产状态…");
      } else if (update.stage === "committing") {
        updateCoreProgress("正在保存，请勿关闭…");
      }

      enqueuePipelineStageCheckpoint(update);
    },
  });

  if (
    pipelineResult.terminal === "completed" ||
    pipelineResult.terminal === "completed_with_attention"
  ) {
    latestDraftContent = pipelineResult.selectedVersion.content;
    latestAudit = pipelineResult.audit;
    latestAuditParseFailed =
      pipelineResult.audit === null &&
      Boolean(pipelineResult.attentionReason?.includes("无法解析"));
    latestSyncStatus = resolveSyncStatusFromProgress(
      pipelineResult.progressMessages,
    );

    assertCanCommitWriteChapter(abortController.signal);
    commitStarted = true;
    await checkpointWriteChain;
    await commitWriteChapterResultForStudio(pipelineResult.commitInput);

    const savedProgressMessage = `第 ${pipelineResult.commitInput.finalChapter.number} 章《${pipelineResult.commitInput.finalChapter.title}》已保存`;
    const progressForCommit = [...pipelineResult.progressMessages];
    const commitNow = new Date().toISOString();
    const pipelineTimeline = buildWriteChapterPipelineTimelineView({
      checkpoint: pipelineResult.checkpoint,
      audit: pipelineResult.audit,
      auditParseFailed: latestAuditParseFailed,
      draftContent: pipelineResult.selectedVersion.content,
      contextSummary,
      syncStatus: latestSyncStatus,
      terminal: pipelineResult.terminal,
      attentionReason: pipelineResult.attentionReason,
    });
    const finalAssistantMessage = buildFinalWriteChapterAssistantMessage({
      assistantMessageId,
      sessionId: requestSessionId,
      label,
      progressMessages: progressForCommit,
      resultContent: pipelineResult.selectedVersion.content,
      completionSummary: savedProgressMessage,
      startedAt,
      now: commitNow,
    });
    finalAssistantMessage.studio.parts = buildWriteChapterFinalAssistantParts({
      label,
      progressMessages: progressForCommit,
      resultContent: pipelineResult.selectedVersion.content,
      startedAt,
      completionSummary: savedProgressMessage,
      pipelineTimeline,
      attentionReason: pipelineResult.attentionReason,
      terminal: pipelineResult.terminal,
    });

    store.setActiveChapter(pipelineResult.commitInput.finalChapter.id);
    setActiveCoreProgress([...progressForCommit]);
    store.updateMessage(requestSessionId, assistantMessageId, (item) => ({
      ...item,
      parts: finalAssistantMessage.studio.parts,
      streaming: false,
      createdAt: finalAssistantMessage.studio.createdAt,
    }));
    await clearStoredNovelTaskCheckpoint(taskId).catch(() => undefined);
    await ctx.refreshWorkspace();

    const notifyMessage =
      pipelineResult.terminal === "completed_with_attention"
        ? pipelineResult.attentionReason || savedProgressMessage
        : savedProgressMessage;

    ctx.trackModelCall(
      bindingResult,
      label,
      "success",
      startedAt,
      commitNow,
      { latencyMs: Date.now() - Date.parse(startedAt) },
    );
    ctx.notify(
      notifyMessage,
      pipelineResult.terminal === "completed_with_attention"
        ? "warning"
        : "success",
    );
    return true;
  }

  const failureNow = new Date().toISOString();
  const isCancelled = pipelineResult.terminal === "cancelled";
  const errorMessage =
    pipelineResult.terminal === "failed" || pipelineResult.terminal === "cancelled"
      ? pipelineResult.errorMessage ||
        (isCancelled ? "任务已取消，未写入最终数据。" : "写作流水线执行失败。")
      : "写作流水线执行失败。";
  const pipelineTimeline = buildWriteChapterPipelineTimelineView({
    checkpoint: pipelineResult.checkpoint,
    contextSummary,
    terminal: pipelineResult.terminal,
    attentionReason: pipelineResult.checkpoint.attentionReason,
  });
  const assistantMessage: StudioMessage = {
    id: assistantMessageId,
    role: "assistant",
    status: isCancelled ? "sent" : "error",
    parts: [
      completeProgressPart(
        buildProgressPartFromMessages(label, progressMessages, {
          status: isCancelled ? "paused" : "error",
          startedAt,
          pipelineTimeline,
        }),
        {
          status: isCancelled ? "paused" : "error",
          summary: errorMessage,
        },
      ),
      buildErrorPart(
        `${label}${isCancelled ? "已取消" : "失败"}`,
        errorMessage,
        isCancelled
          ? "可重新发起写下一章。"
          : "请检查章节计划与上下文后重试。",
      ),
    ],
    createdAt: failureNow,
  };

  await finishStoredNovelTask(
    taskId,
    isCancelled ? "cancelled" : "error",
    formatCoreTaskErrorMessage(buildNovelRecoverableErrorNotice(new Error(errorMessage))),
  ).catch(() => undefined);

  await ctx.refreshWorkspace().catch(() => undefined);
  store.updateMessage(requestSessionId, assistantMessageId, () => assistantMessage);

  ctx.trackModelCall(
    bindingResult,
    label,
    isCancelled ? "cancelled" : "error",
    startedAt,
    failureNow,
    {
      latencyMs: Date.now() - Date.parse(startedAt),
      errorMessage,
    },
  );
  ctx.notify(errorMessage, isCancelled ? "warning" : "error");
  return false;
}

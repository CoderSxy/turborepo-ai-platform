import type { InkosCoreAction } from "@repo/inkos-adapter";
import {
  appendStoredNovelMessage,
  appendStoredNovelTaskLog,
  applyNovelMarketRadarToAssets,
  buildNovelChapterAssetDelta,
  buildNovelLocalEnvironmentDiagnostics,
  buildNovelRecoverableErrorNotice,
  buildNovelReviseChapterInstruction,
  buildNovelWriteChapterInstruction,
  clearStoredNovelTaskCheckpoint,
  createStoredNovelTask,
  deriveNovelReviewStatus,
  finishStoredNovelTask,
  markNovelReviewIssuesResolved,
  mergeNovelDiagnostics,
  parseNovelReviewNotes,
  pauseStoredNovelTaskWithCheckpoint,
  reconcileNovelReviewHistory,
  selectNextNovelChapterTarget,
  startStoredNovelTask,
  syncNovelOutlineNodesFromChapters,
  syncNovelProjectChapterPlan,
  updateStoredNovelBook,
  updateStoredNovelChapter,
  upsertStoredNovelChapter,
  type NovelProjectAssets,
} from "../../../lib/novel-store";
import {
  createChapterPipelineSyncId,
  mergeNovelChapterAssetDeltaSafely,
} from "../../../lib/novel-asset-auto-sync";
import {
  extractGeneratedChapter,
  extractRevisedChapterContent,
} from "../helpers/novel-helpers";
import {
  formatCoreTaskErrorMessage,
  streamInkosCoreAction,
} from "../helpers/inkos-stream";
import { resolveCoreActionModelBinding } from "../helpers/model-binding";
import { INKOS_CORE_ACTION_LABELS } from "../state/studio-constants";
import { toStoredMessage } from "../persistence/message-bridge";
import { getStudioTaskGuard } from "./runtime/task-guard";
import { studioMessagesToChatMessages } from "./runtime/message-parts";
import type { RunCoreActionOptions, StudioActionContext } from "./types";
import {
  clearCoreTaskTrackingState,
  consumeCoreTaskPauseRequest,
  getActiveCoreAssistantMessageId,
  getActiveCoreProgress,
  getActiveCoreTaskId,
  requestCoreTaskPause,
  setActiveCoreAssistantMessageId,
  setActiveCoreProgress,
  setActiveCoreTaskId,
} from "./core-task-state";
import {
  buildErrorPart,
  buildFinalAssistantParts,
  buildPausedAssistantMessage,
  buildProgressPartFromMessages,
  buildTextPart,
  completeProgressPart,
} from "../store/slices/message/parts-builder";
import type { StudioMessage } from "../store/types";
import {
  resolveDefaultWriteChapterSelection,
  summarizeContextSelection,
} from "./write-chapter";

export {
  clearCoreTaskTrackingState,
  consumeCoreTaskPauseRequest,
  isCoreTaskPauseRequested,
  resetCoreTaskState,
} from "./core-task-state";

export async function pauseActiveCoreTask(ctx: StudioActionContext) {
  const taskId = getActiveCoreTaskId();

  requestCoreTaskPause();

  if (taskId) {
    await persistPausedCoreTaskCheckpoint(
      ctx,
      taskId,
      getActiveCoreAssistantMessageId(),
      getActiveCoreProgress(),
      { refresh: false },
    );
  }

  const state = ctx.getState();
  state.runningTask?.abortController.abort();
  state.finishTask();
  ctx.notify("任务已暂停，可从任务日志继续。", "warning");
}

async function persistMessage(sessionId: string, message: StudioMessage) {
  const stored = toStoredMessage(message, sessionId);
  await appendStoredNovelMessage(sessionId, {
    id: stored.id,
    role: stored.role,
    content: stored.content,
    status: stored.status,
  });
}

async function persistPausedCoreTaskCheckpoint(
  ctx: StudioActionContext,
  taskId: string,
  assistantMessageId: string,
  progressMessages: string[],
  options?: { refresh?: boolean },
) {
  if (!taskId) {
    return;
  }

  await pauseStoredNovelTaskWithCheckpoint(taskId, {
    progressMessages: [...progressMessages],
    savedAt: new Date().toISOString(),
    assistantMessageId: assistantMessageId || undefined,
  }).catch(() => undefined);

  if (options?.refresh !== false) {
    await ctx.refreshWorkspace().catch(() => undefined);
  }
}

export async function runCoreAction(
  ctx: StudioActionContext,
  action: InkosCoreAction,
  options?: RunCoreActionOptions,
): Promise<boolean> {
  const store = ctx.getState();
  const guard = getStudioTaskGuard(store.runningTask);

  if (!guard.canStart) {
    ctx.notify(guard.message, "warning");
    return false;
  }

  if (!store.activeSessionId) {
    ctx.notify("请先创建或选择一个会话。", "warning");
    return false;
  }

  const bindingResult = resolveCoreActionModelBinding(ctx.settings, action);
  if ("error" in bindingResult) {
    ctx.notify(bindingResult.error, "warning");
    return false;
  }

  const activeBook =
    store.books.find((book) => book.id === store.activeBookId) ?? null;
  const project = activeBook?.project ?? null;

  if (!activeBook || !project) {
    ctx.notify("请先创建一本书籍。", "warning");
    return false;
  }

  const activeChapter =
    activeBook.chapters.find((chapter) => chapter.id === store.activeChapterId) ??
    activeBook.chapters.at(-1) ??
    null;

  const resumeTask = options?.resumeTask;
  const checkpoint = resumeTask?.checkpoint;
  const isResume = Boolean(checkpoint);
  const label =
    options?.labelOverride ??
    resumeTask?.label ??
    INKOS_CORE_ACTION_LABELS[action];
  const requestSessionId = store.activeSessionId;

  if (options?.targetStoredChapter) {
    store.setActiveChapter(options.targetStoredChapter.id);
  }

  const progressMessages: string[] = isResume
    ? [...(checkpoint?.progressMessages ?? []), "从断点重新发起 Agent 调用。"]
    : [];
  const assistantMessageId =
    isResume && checkpoint?.assistantMessageId
      ? checkpoint.assistantMessageId
      : `assistant-core-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const pendingAssistantMessage: StudioMessage = {
    id: assistantMessageId,
    role: "assistant",
    parts: [
      buildProgressPartFromMessages(label, progressMessages, {
        status: "running",
        startedAt,
      }),
    ],
    streaming: true,
    createdAt: startedAt,
  };
  const userMessage: StudioMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    parts: [buildTextPart(label)],
    createdAt: new Date().toISOString(),
  };
  const sessionMessages = store.messagesBySessionId[requestSessionId] ?? [];
  const visibleMessages = isResume
    ? sessionMessages.some((item) => item.id === assistantMessageId)
      ? sessionMessages.map((item) =>
          item.id === assistantMessageId ? pendingAssistantMessage : item,
        )
      : [...sessionMessages, pendingAssistantMessage]
    : [...sessionMessages, userMessage, pendingAssistantMessage];

  store.setMessagesForSession(requestSessionId, visibleMessages);
  const abortController = new AbortController();
  let taskId = "";
  let latestChapters = [...activeBook.chapters];

  store.startTask({
    kind: "core",
    label,
    action,
    status: "running",
    abortController,
    assistantMessageId,
  });

  try {
    const task = options?.existingTaskId
      ? await startStoredNovelTask(options.existingTaskId)
      : await createStoredNovelTask({
          bookId: activeBook.id,
          sessionId: requestSessionId,
          action,
          label,
          targetChapterId: options?.targetStoredChapter?.id,
          targetChapterNumber:
            options?.targetStoredChapter?.number ??
            options?.targetChapter?.number,
          targetChapterTitle:
            options?.targetStoredChapter?.title ?? options?.targetChapter?.title,
        });
    if (!task) {
      throw new Error("队列任务不存在，无法执行。");
    }
    taskId = task.id;
    setActiveCoreTaskId(taskId);
    setActiveCoreAssistantMessageId(assistantMessageId);
    setActiveCoreProgress([...progressMessages]);
    store.startTask({
      kind: "core",
      label,
      action,
      status: "running",
      abortController,
      taskId,
      assistantMessageId,
    });

    if (!isResume) {
      await persistMessage(requestSessionId, userMessage);
    }

    const writeTarget =
      action === "write-chapter"
        ? (options?.targetChapter ??
          selectNextNovelChapterTarget(project, activeBook.chapters))
        : null;
    const reviewTarget =
      action === "review"
        ? (options?.targetStoredChapter ?? activeChapter)
        : null;
    const reviseTarget =
      action === "revise-chapter"
        ? (options?.targetStoredChapter ?? activeChapter)
        : null;

    if (action === "revise-chapter" && !reviseTarget) {
      throw new Error("请先选择一个已生成章节，再根据审稿意见修订。");
    }

    const userInstruction = store.input.trim();
    if (userInstruction) {
      store.setInput("");
    }

    if (action === "write-chapter" && writeTarget && !isResume) {
      progressMessages.push(
        `正在准备第 ${writeTarget.number} 章《${writeTarget.title}》`,
      );
      const selection =
        options?.contextSelectionOverride ??
        resolveDefaultWriteChapterSelection(activeBook, project);
      const contextSummary = summarizeContextSelection(selection);
      const contextCount = contextSummary === "无额外上下文" ? 0 : contextSummary.split("、").length;
      progressMessages.push(
        contextCount > 0
          ? `已带入 ${contextCount} 项上下文：${contextSummary}`
          : "未带入额外上下文",
      );
      setActiveCoreProgress([...progressMessages]);
      store.updateMessage(requestSessionId, assistantMessageId, (item) => ({
        ...item,
        parts: [
          buildProgressPartFromMessages(label, progressMessages, {
            status: "running",
            startedAt,
          }),
        ],
        streaming: true,
      }));
    }

    const coreInstruction =
      action === "review" && reviewTarget
        ? [
            userInstruction,
            `请审稿当前选中章节：第 ${reviewTarget.number} 章《${reviewTarget.title}》。`,
            `章节摘要：${reviewTarget.summary || "暂无摘要"}`,
            `章节正文：\n${reviewTarget.content}`,
          ]
            .filter(Boolean)
            .join("\n\n")
        : action === "write-chapter" && writeTarget
          ? buildNovelWriteChapterInstruction({
              project,
              assets: activeBook.assets,
              chapters: activeBook.chapters,
              target: writeTarget,
              userInstruction: userInstruction || undefined,
              contextSelectionOverride: options?.contextSelectionOverride,
            })
          : userInstruction || undefined;
    const resolvedCoreInstruction =
      action === "revise-chapter" && reviseTarget
        ? buildNovelReviseChapterInstruction({
            project,
            assets: activeBook.assets,
            chapter: reviseTarget,
            selectedIssueIds: options?.selectedIssueIds,
            userInstruction: userInstruction || undefined,
          })
        : coreInstruction;

    const updateCoreProgress = (message: string) => {
      progressMessages.push(message);
      setActiveCoreProgress([...progressMessages]);
      if (taskId) {
        void appendStoredNovelTaskLog(taskId, message);
      }
      store.updateMessage(requestSessionId, assistantMessageId, (item) => ({
        ...item,
        parts: [
          buildProgressPartFromMessages(label, progressMessages, {
            status: "running",
            startedAt,
          }),
        ],
        streaming: true,
      }));
    };

    const coreMessages = visibleMessages.filter(
      (message) => message.id !== assistantMessageId,
    );
    const result = await streamInkosCoreAction(
      action,
      bindingResult.provider,
      bindingResult.model,
      project,
      activeBook.assets,
      studioMessagesToChatMessages(coreMessages),
      (event) => {
        if (event.type === "progress") {
          updateCoreProgress(event.message);
        }
      },
      resolvedCoreInstruction,
      abortController.signal,
      {
        temperature: bindingResult.temperature,
        maxTokens: bindingResult.maxTokens,
      },
    );

    if (!result.ok) {
      throw new Error(result.message || "InkOS Core 执行失败。");
    }

    updateCoreProgress("正在写回 IndexedDB。");
    let nextProject = result.project ?? project;
    let nextAssets: NovelProjectAssets = {
      ...activeBook.assets,
      ...result.assetsPatch,
    };

    if (action === "radar") {
      nextAssets = applyNovelMarketRadarToAssets(
        nextAssets,
        nextAssets.marketRadars,
        nextProject,
      );
    }

    if (action === "diagnostics") {
      const localChecks = buildNovelLocalEnvironmentDiagnostics({
        project: nextProject,
        assets: nextAssets,
        chapters: activeBook.chapters,
      });
      nextAssets = {
        ...nextAssets,
        diagnostics: mergeNovelDiagnostics(
          [...localChecks, ...(nextAssets.diagnostics ?? [])],
          activeBook.assets.diagnostics,
        ),
      };
    }

    if (action === "write-chapter") {
      const generatedChapter = extractGeneratedChapter({
        bookId: activeBook.id,
        content: result.content ?? result.message ?? "",
        project: nextProject,
        target: writeTarget ?? undefined,
      });

      if (generatedChapter) {
        updateCoreProgress("正在提取章节摘要、角色状态、伏笔和世界观增量。");
        const assetDelta = buildNovelChapterAssetDelta({
          chapterNumber: generatedChapter.number,
          chapterTitle: generatedChapter.title,
          content: result.content ?? result.message ?? "",
          existingSummary: generatedChapter.summary,
        });
        const storedChapter = await upsertStoredNovelChapter({
          ...generatedChapter,
          summary: assetDelta.summary || generatedChapter.summary,
          versionSource: "generation",
          versionNote: "InkOS WriterAgent 生成章节",
        });
        nextProject = syncNovelProjectChapterPlan(nextProject, storedChapter);
        const mergeDelta = {
          ...assetDelta,
          chapterNumber: storedChapter.number,
          chapterTitle: storedChapter.title,
          summary: storedChapter.summary,
        };
        // TODO(Task 5): preallocate chapterVersionId before upsert for stable syncId.
        const chapterVersionId = storedChapter.id;
        const syncId = createChapterPipelineSyncId({
          chapterId: storedChapter.id,
          chapterVersionId,
          delta: mergeDelta,
        });
        const mergeResult = mergeNovelChapterAssetDeltaSafely(
          nextAssets,
          mergeDelta,
          { source: "chapter-pipeline", syncId },
        );
        nextAssets = mergeResult.assets;
        updateCoreProgress(
          mergeResult.status === "needs-attention"
            ? "章节已完成；同步需关注，详见同步诊断"
            : "已同步：章节摘要、角色状态、世界观、伏笔与大纲",
        );
        store.setActiveChapter(storedChapter.id);
        latestChapters = latestChapters.some(
          (chapter) => chapter.id === storedChapter.id,
        )
          ? latestChapters.map((chapter) =>
              chapter.id === storedChapter.id ? storedChapter : chapter,
            )
          : [...latestChapters, storedChapter];
        updateCoreProgress(
          `第 ${storedChapter.number} 章《${storedChapter.title}》已保存`,
        );
      }
    }

    if (action === "review" && reviewTarget) {
      const reviewContent = result.content ?? result.message ?? "";
      const structuredReview = parseNovelReviewNotes(reviewContent);
      const nextReviews = reconcileNovelReviewHistory(
        reviewTarget.reviews ?? [],
        structuredReview,
      );
      const nextStatus = deriveNovelReviewStatus(reviewContent);

      const reviewedChapter = await updateStoredNovelChapter(
        reviewTarget.id,
        {
          reviewNotes: reviewContent,
          reviews: nextReviews,
          activeReviewId: structuredReview.id,
          status: nextStatus,
        },
        {
          versionSource: "review",
          versionNote: "InkOS ContinuityAuditor 审稿结果",
          versionReviewId: structuredReview.id,
        },
      );
      if (reviewedChapter) {
        nextProject = syncNovelProjectChapterPlan(nextProject, reviewedChapter);
        latestChapters = latestChapters.map((chapter) =>
          chapter.id === reviewedChapter.id ? reviewedChapter : chapter,
        );
      }
    }

    if (action === "revise-chapter" && reviseTarget) {
      const revisedContent = extractRevisedChapterContent(
        result.content ?? result.message ?? "",
      );
      const revisionVersionId = `revision-${Date.now()}`;
      const nextReviews =
        options?.selectedIssueIds && options.selectedIssueIds.length > 0
          ? markNovelReviewIssuesResolved(
              reviseTarget.reviews ?? [],
              options.selectedIssueIds,
              revisionVersionId,
            )
          : reviseTarget.reviews;

      const revisedChapter = await updateStoredNovelChapter(
        reviseTarget.id,
        {
          content: revisedContent,
          reviews: nextReviews,
          status: "ready-for-review",
        },
        {
          versionSource: "revision",
          versionNote: "InkOS ReviserAgent 根据审稿意见修订",
          revisedFromReviewId: reviseTarget.activeReviewId,
        },
      );
      if (revisedChapter) {
        nextProject = syncNovelProjectChapterPlan(nextProject, revisedChapter);
        latestChapters = latestChapters.map((chapter) =>
          chapter.id === revisedChapter.id ? revisedChapter : chapter,
        );
        updateCoreProgress("正在自动复审修订结果。");
        const reviewInstruction = [
          "请复审刚刚修订后的章节，重点判断选中审稿问题是否已经解决。",
          `复审章节：第 ${revisedChapter.number} 章《${revisedChapter.title}》。`,
          `章节摘要：${revisedChapter.summary || "暂无摘要"}`,
          `章节正文：\n${revisedChapter.content}`,
        ].join("\n\n");

        const rereviewBinding = resolveCoreActionModelBinding(ctx.settings, "review");
        if ("error" in rereviewBinding) {
          updateCoreProgress(`自动复审跳过：${rereviewBinding.error}`);
        } else {
          const rereviewResult = await streamInkosCoreAction(
            "review",
            rereviewBinding.provider,
            rereviewBinding.model,
            nextProject,
            nextAssets,
            studioMessagesToChatMessages(coreMessages),
            (event) => {
              if (event.type === "progress") {
                updateCoreProgress(event.message);
              }
            },
            reviewInstruction,
            abortController.signal,
            {
              temperature: rereviewBinding.temperature,
              maxTokens: rereviewBinding.maxTokens,
            },
          );

          if (rereviewResult.ok) {
            const reviewContent =
              rereviewResult.content ?? rereviewResult.message ?? "";
            const structuredReview = parseNovelReviewNotes(reviewContent);
            const nextReviewHistory = reconcileNovelReviewHistory(
              revisedChapter.reviews ?? [],
              structuredReview,
            );
            const nextStatus = deriveNovelReviewStatus(reviewContent);
            const rereviewedChapter = await updateStoredNovelChapter(
              revisedChapter.id,
              {
                reviewNotes: reviewContent,
                reviews: nextReviewHistory,
                activeReviewId: structuredReview.id,
                status: nextStatus,
              },
              {
                versionSource: "review",
                versionNote: "InkOS 自动复审修订结果",
                versionReviewId: structuredReview.id,
              },
            );

            if (rereviewedChapter) {
              nextProject = syncNovelProjectChapterPlan(
                nextProject,
                rereviewedChapter,
              );
              latestChapters = latestChapters.map((chapter) =>
                chapter.id === rereviewedChapter.id ? rereviewedChapter : chapter,
              );
            }
            updateCoreProgress("自动复审完成，结果已写回章节。");
          } else {
            updateCoreProgress(
              `自动复审未完成：${rereviewResult.message || "模型未返回复审结果。"}`,
            );
          }
        }
      }
    }

    nextAssets = {
      ...nextAssets,
      outlineNodes: syncNovelOutlineNodesFromChapters(
        nextAssets.outlineNodes,
        latestChapters,
        nextProject,
      ),
    };
    await updateStoredNovelBook(activeBook.id, {
      title: nextProject.title,
      genre: nextProject.genre,
      premise: nextProject.premise,
      project: nextProject,
      assets: nextAssets,
    });

    const completionSummary =
      action === "write-chapter" && writeTarget
        ? progressMessages.find((message) => message.includes("已保存")) ??
          `第 ${writeTarget.number} 章已保存`
        : progressMessages.at(-1) ?? "任务完成。";

    const assistantMessage: StudioMessage = {
      id: assistantMessageId,
      role: "assistant",
      parts: buildFinalAssistantParts(
        label,
        progressMessages,
        result.content || result.message || "",
        { startedAt, summary: completionSummary },
      ),
      createdAt: new Date().toISOString(),
    };

    await persistMessage(requestSessionId, assistantMessage);
    if (taskId) {
      await finishStoredNovelTask(taskId, "success");
      await clearStoredNovelTaskCheckpoint(taskId).catch(() => undefined);
    }
    await ctx.refreshWorkspace();
    store.updateMessage(requestSessionId, assistantMessageId, () => assistantMessage);
    ctx.trackModelCall(
      bindingResult,
      label,
      "success",
      startedAt,
      new Date().toISOString(),
      { latencyMs: Date.now() - Date.parse(startedAt) },
    );
    ctx.notify(result.message ?? "任务完成。", "success");
    return true;
  } catch (error) {
    if (consumeCoreTaskPauseRequest()) {
      const pausedProgress =
        getActiveCoreProgress().length > 0
          ? getActiveCoreProgress()
          : progressMessages;
      const pausedAssistantMessage = buildPausedAssistantMessage(
        assistantMessageId,
        label,
        pausedProgress,
        { startedAt },
      );

      const resolvedTaskId = taskId || getActiveCoreTaskId();
      await persistPausedCoreTaskCheckpoint(
        ctx,
        resolvedTaskId,
        assistantMessageId,
        pausedProgress,
        { refresh: false },
      );

      await persistMessage(requestSessionId, pausedAssistantMessage).catch(
        () => undefined,
      );
      await ctx.refreshWorkspace().catch(() => undefined);
      store.updateMessage(
        requestSessionId,
        assistantMessageId,
        () => pausedAssistantMessage,
      );
      return false;
    }

    const errorNotice = buildNovelRecoverableErrorNotice(error);
    const isAbortError = errorNotice.category === "cancelled";
    ctx.trackModelCall(
      bindingResult,
      label,
      isAbortError ? "cancelled" : "error",
      startedAt,
      new Date().toISOString(),
      {
        latencyMs: Date.now() - Date.parse(startedAt),
        errorMessage: errorNotice.detail || errorNotice.title,
      },
    );
    const assistantMessage: StudioMessage = {
      id: assistantMessageId,
      role: "assistant",
      status: isAbortError ? "sent" : "error",
      parts: [
        completeProgressPart(
          buildProgressPartFromMessages(label, progressMessages, {
            status: isAbortError ? "paused" : "error",
            startedAt,
            paused: isAbortError,
          }),
          {
            status: isAbortError ? "paused" : "error",
            summary: errorNotice.title,
          },
        ),
        buildErrorPart(
          `${label}${isAbortError ? "已取消" : "失败"}`,
          errorNotice.detail,
          errorNotice.recoveryAction,
        ),
      ],
      createdAt: new Date().toISOString(),
    };
    const taskErrorMessage = formatCoreTaskErrorMessage(errorNotice);

    await persistMessage(requestSessionId, assistantMessage).catch(
      () => undefined,
    );
    if (taskId) {
      await finishStoredNovelTask(
        taskId,
        isAbortError ? "cancelled" : "error",
        taskErrorMessage,
      ).catch(() => undefined);
    }
    await ctx.refreshWorkspace().catch(() => undefined);
    store.updateMessage(requestSessionId, assistantMessageId, () => assistantMessage);
    ctx.notify(errorNotice.title, isAbortError ? "warning" : "error");
    return false;
  } finally {
    clearCoreTaskTrackingState();
    store.finishTask();
  }
}

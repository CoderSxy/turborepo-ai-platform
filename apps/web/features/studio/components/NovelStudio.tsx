"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  INKOS_STATUS_LABELS,
  buildInkosPromptPreview,
  createDemoInkosProject,
  getCurrentStage,
  type InkosCoreAction,
  type InkosNovelProject,
} from "@repo/inkos-adapter";
import styles from "../studio.module.css";
import {
  MODEL_SUGGESTIONS,
  appendModelCallLog,
  formatModelPickerValue,
  getDefaultChatModelSelection,
  getDefaultWritingModelSelection,
  type LocalModelSettings,
  type ModelCallLog,
} from "../../../lib/model-settings";
import { isProviderConnected } from "../../models/state/model-page-types";
import {
  appendStoredNovelMessage,
  appendNovelPublicationEvent,
  buildNovelBatchQueueReport,
  buildNovelBookExportMarkdown,
  buildNovelBookExportJson,
  buildNovelBookExportText,
  buildNovelDocxDocumentModel,
  buildNovelChapterContextPreview,
  buildNovelChapterExportBundle,
  buildNovelCreationLogExportMarkdown,
  buildNovelLocalEnvironmentDiagnostics,
  buildNovelPlatformExportBundle,
  buildNovelPlatformExportText,
  buildNovelPublishManifest,
  buildNovelPublishValidationReport,
  buildNovelStyleConstraintsFromAssets,
  buildNovelTaskResumePreview,
  selectNextNovelChapterTarget,
  buildNovelVolumeExportBundle,
  buildNovelWorkspaceBackupPayload,
  clearStoredNovelSessionMessages,
  computeNovelWorkspaceFingerprint,
  createStoredNovelBook,
  createStoredNovelSession,
  deriveNovelChapterProgress,
  deleteStoredNovelBook,
  deleteStoredNovelChapter,
  deleteStoredNovelSession,
  exportNovelWorkspaceBackup,
  exportNovelCloudSyncPackage,
  formatNovelChapterVersionSource,
  getNovelPlatformProfile,
  importNovelWorkspaceMerge,
  loadNovelCloudSyncState,
  loadNovelWorkspace,
  mergeNovelChapterPlan,
  mergeNovelDiagnostics,
  mergeNovelWorkspacePayloads,
  moveNovelBatchQueueItem,
  parseNovelCloudSyncPackage,
  pauseStoredNovelTask,
  restoreNovelWorkspaceBackup,
  restoreStoredNovelChapterVersion,
  saveNovelCloudSyncState,
  skipNovelBatchQueueItem,
  skipStoredNovelTask,
  syncNovelProjectChapterPlan,
  updateStoredNovelBook,
  updateStoredNovelChapter,
  updateStoredNovelMessage,
  updateStoredNovelSession,
  upsertStoredNovelChapter,
  createDefaultNovelCloudSyncWebDavSettings,
  loadNovelCloudSyncWebDavSettings,
  saveNovelCloudSyncWebDavSettings,
  type NovelBatchQueueItem,
  type NovelCloudSyncPackage,
  type NovelCloudSyncState,
  type NovelCloudSyncWebDavSettings,
  type NovelChapterWriteTarget,
  type NovelContextSelection,
  type NovelImportedChapter,
  type NovelPlatformId,
  type NovelProjectAssets,
  type NovelPublishValidationReport,
  type NovelWorkspaceMergeReport,
  type NovelWorkspaceSnapshot,
  type StoredNovelChapter,
  type StoredNovelChapterVersion,
} from "../../../lib/novel-store";
import {
  downloadNovelCloudSyncWebDav,
  testNovelCloudSyncWebDav,
  uploadNovelCloudSyncWebDav,
} from "../../../lib/cloud-sync-webdav";
import {
  downloadTextFile,
  downloadBytesFile,
  createNovelBookDocxFile,
} from "../helpers/export-helpers";
import {
  toNovelBookEntries,
  createWelcomeNovelMessages,
  createNovelProject,
} from "../helpers/novel-helpers";
import {
  isModelPickerValueAvailable,
  resolveChatModelBinding,
} from "../helpers/model-binding";
import {
  QUICK_CORE_ACTIONS,
  PLATFORM_EXPORT_OPTIONS,
} from "../state/studio-constants";
import type {
  AppDialogState,
  AppToastState,
  NovelBookEntry,
  NovelTool,
  ModelPickerGroup,
  ReadyModelBinding,
} from "../state/studio-types";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatMessage } from "./chat/ChatMessage";
import type { MenuGroup } from "./chat/ComposerMoreMenu";
import { useStudioStore } from "../store/store";
import {
  useActiveMessages,
  useIsTaskRunning,
  useRunningTaskLabel,
} from "../store/selectors";
import { fromStoredMessagesBySession, toStoredMessage } from "../persistence/message-bridge";
import { dispatchStudioAction } from "../actions/dispatch";
import { resolveDefaultWriteChapterSelection } from "../actions/write-chapter";
import { sendMessage } from "../actions/send-message";
import { runCoreAction, pauseActiveCoreTask, resetCoreTaskState } from "../actions/run-core-action";
import { runBatchCoreAction } from "../actions/run-batch-action";
import type { StudioAction, StudioActionContext } from "../actions/types";
import {
  flattenPartsToContent,
  getMessageTextContent,
} from "../actions/runtime/message-parts";
import { AppDialog } from "./dialogs/AppDialog";
import { AppToast } from "./dialogs/AppToast";
import { CloudSyncPanel } from "./dialogs/CloudSyncPanel";
import { CloudSyncMergeDialog } from "./dialogs/CloudSyncMergeDialog";
import { PublishValidationDialog } from "./dialogs/PublishValidationDialog";
import { CreateBookPanel } from "./CreateBookPanel";
import { NovelBookList } from "./NovelBookList";
import { NovelToolPanel } from "./NovelToolPanel";
import { NovelBookPanel } from "./NovelBookPanel";
import { WriteChapterOptionsSheet } from "./writing/WriteChapterOptionsSheet";

type WritingSheetState =
  | { mode: "once"; target: NovelChapterWriteTarget }
  | { mode: "defaults" }
  | null;

export function NovelStudio({
  settings,
  onManageModels,
  onSettingsChange,
}: {
  settings: LocalModelSettings;
  onManageModels: () => void;
  onSettingsChange: (settings: LocalModelSettings) => void;
}) {
  const [chapterVersionsById, setChapterVersionsById] = useState<
    Record<string, StoredNovelChapterVersion[]>
  >({});
  const books = useStudioStore((state) => state.books);
  const activeBookId = useStudioStore((state) => state.activeBookId);
  const activeSessionId = useStudioStore((state) => state.activeSessionId);
  const activeChapterId = useStudioStore((state) => state.activeChapterId);
  const input = useStudioStore((state) => state.input);
  const selectedModelValue = useStudioStore((state) => state.selectedModelValue);
  const isNovelStoreLoading = useStudioStore((state) => state.isLoading);
  const novelStoreError = useStudioStore((state) => state.error);
  const setInput = useStudioStore((state) => state.setInput);
  const setActiveBook = useStudioStore((state) => state.setActiveBook);
  const setActiveSession = useStudioStore((state) => state.setActiveSession);
  const setActiveChapter = useStudioStore((state) => state.setActiveChapter);
  const setSelectedModel = useStudioStore((state) => state.setSelectedModel);
  const setLoading = useStudioStore((state) => state.setLoading);
  const setError = useStudioStore((state) => state.setError);
  const setBooks = useStudioStore((state) => state.setBooks);
  const patchBook = useStudioStore((state) => state.patchBook);
  const setMessagesForSession = useStudioStore((state) => state.setMessagesForSession);
  const abortTask = useStudioStore((state) => state.abortTask);
  const runningTask = useStudioStore((state) => state.runningTask);
  const isTaskRunning = useIsTaskRunning();
  const activeTaskLabel = useRunningTaskLabel();
  const messages = useActiveMessages();
  const [activeTool, setActiveTool] = useState<NovelTool>("AI创作");
  const [toolOverflowOpen, setToolOverflowOpen] = useState(false);
  const [cloudSyncDialogOpen, setCloudSyncDialogOpen] = useState(false);
  const [creatingBook, setCreatingBook] = useState(true);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [showArchivedBooks, setShowArchivedBooks] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [dialog, setDialog] = useState<AppDialogState | null>(null);
  const [dialogInput, setDialogInput] = useState("");
  const [toast, setToast] = useState<AppToastState | null>(null);
  const [publishValidation, setPublishValidation] = useState<{
    report: NovelPublishValidationReport;
    onProceed: () => void;
  } | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<NovelCloudSyncState>(() =>
    loadNovelCloudSyncState(),
  );
  const [mergePreview, setMergePreview] = useState<{
    remote: NovelCloudSyncPackage;
    report: NovelWorkspaceMergeReport;
    resolutions: Record<string, "local" | "remote">;
  } | null>(null);
  const [webDavSettings, setWebDavSettings] =
    useState<NovelCloudSyncWebDavSettings>(() =>
      loadNovelCloudSyncWebDavSettings(),
    );
  const [webDavBusy, setWebDavBusy] = useState<
    "test" | "upload" | "download" | null
  >(null);
  const bookSearchInputRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const backupImportInputRef = useRef<HTMLInputElement | null>(null);
  const cloudSyncImportInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogResolverRef = useRef<
    ((value: string | boolean | null) => void) | null
  >(null);
  const groupedModels = useMemo<ModelPickerGroup[]>(
    () =>
      settings.providers
        .filter(isProviderConnected)
        .map((provider) => {
          const models = Array.from(
            new Set([
              ...(provider.availableModels ?? []),
              ...(MODEL_SUGGESTIONS[provider.id] ?? []),
            ]),
          );

          return {
            service: provider.id,
            label: provider.name,
            models: models.map((model) => ({ id: model, name: model })),
          };
        })
        .filter((group) => group.models.length > 0),
    [settings.providers],
  );
  const [batchQueueItems, setBatchQueueItems] = useState<NovelBatchQueueItem[]>([]);
  const [batchQueueActiveIndex, setBatchQueueActiveIndex] = useState(-1);
  const [batchQueuePaused, setBatchQueuePaused] = useState(false);
  const [batchQueueTaskIds, setBatchQueueTaskIds] = useState<string[]>([]);
  const batchQueueItemsRef = useRef<NovelBatchQueueItem[]>([]);
  const batchQueuePausedRef = useRef(false);
  const batchQueueTaskIdsByItemRef = useRef<Record<string, string>>({});
  const [writingSheet, setWritingSheet] = useState<WritingSheetState>(null);
  const visibleBooks = useMemo(() => {
    const query = bookSearchQuery.trim().toLowerCase();

    return books.filter((book) => {
      const matchesArchived = showArchivedBooks ? book.archived : !book.archived;
      const matchesQuery =
        !query ||
        book.title.toLowerCase().includes(query) ||
        book.meta.toLowerCase().includes(query) ||
        book.project.premise.toLowerCase().includes(query);

      return matchesArchived && matchesQuery;
    });
  }, [bookSearchQuery, books, showArchivedBooks]);
  const activeBook =
    books.find((book) => book.id === activeBookId) ?? visibleBooks[0] ?? books[0];
  const activeChapterRows = activeBook
    ? mergeNovelChapterPlan(activeBook.project, activeBook.chapters)
    : [];
  const activeChapterRow =
    activeChapterRows.find((chapter) => chapter.key === activeChapterId) ??
    activeChapterRows.at(-1) ??
    null;
  const activeChapter = activeChapterRow?.chapter ?? null;
  const project = activeBook?.project ?? null;
  const currentStage = project ? getCurrentStage(project) : null;
  const stats =
    project && activeBook
      ? deriveNovelChapterProgress(
          activeBook.chapters,
          project.targetChapters ?? 120,
        )
      : null;
  const promptPreview =
    project && activeBook
      ? buildNovelChapterContextPreview({
          project,
          assets: activeBook.assets,
          chapters: activeBook.chapters,
          selectedChapterId: activeChapter?.id,
        })
        : project
        ? buildInkosPromptPreview(project)
        : "";
  const chatBinding = useMemo(
    () => resolveChatModelBinding(settings, selectedModelValue),
    [settings, selectedModelValue],
  );
  const canSendChat = !("error" in chatBinding);
  const isRunningCoreAction = runningTask?.kind === "core";

  const batchQueueRuntime = useMemo(
    () => ({
      items: batchQueueItems,
      activeIndex: batchQueueActiveIndex,
      paused: batchQueuePaused,
      taskIds: batchQueueTaskIds,
      taskIdsByItem: batchQueueTaskIdsByItemRef.current,
      itemsRef: batchQueueItemsRef,
      pausedRef: batchQueuePausedRef,
      taskIdsByItemRef: batchQueueTaskIdsByItemRef,
      setItems: setBatchQueueItems,
      setActiveIndex: setBatchQueueActiveIndex,
      setPaused: setBatchQueuePaused,
      setTaskIds: setBatchQueueTaskIds,
    }),
    [
      batchQueueActiveIndex,
      batchQueueItems,
      batchQueuePaused,
      batchQueueTaskIds,
    ],
  );

  function buildComposerMoreMenuGroups(): MenuGroup[] {
    return [
      {
        label: "会话",
        items: [
          { label: "编辑上一条", onClick: editLastUserMessage },
          ...(messages.some((m) => m.status === "error")
            ? [{ label: "重试失败", onClick: retryLastFailedMessage }]
            : []),
          { label: "清空会话", onClick: () => void clearSessionMessages() },
          { label: "导出会话", onClick: exportActiveSession },
        ],
      },
      {
        label: "批量",
        items: [
          {
            label: "批量生成",
            onClick: () =>
              void runBatchCoreAction(actionCtx, "write-chapter", batchQueueRuntime),
            disabled: isTaskRunning,
          },
          {
            label: "批量审稿",
            onClick: () =>
              void runBatchCoreAction(actionCtx, "review", batchQueueRuntime),
            disabled: isTaskRunning,
          },
          {
            label: "批量修订",
            onClick: () =>
              void runBatchCoreAction(actionCtx, "revise-chapter", batchQueueRuntime),
            disabled: isTaskRunning,
          },
        ],
      },
      {
        label: "导出",
        items: [
          { label: "导出整书 MD", onClick: () => exportActiveBook("markdown") },
          { label: "导出整书 TXT", onClick: () => exportActiveBook("text") },
          { label: "导出整书 docx", onClick: () => exportActiveBook("docx") },
          { label: "分章导出", onClick: exportActiveBookChapters },
          { label: "按卷导出", onClick: exportActiveBookVolumes },
          { label: "发布清单", onClick: () => exportPublishManifest("generic") },
          { label: "整书 JSON", onClick: exportActiveBookJson },
          { label: "创作日志", onClick: exportCreationLog },
          ...PLATFORM_EXPORT_OPTIONS.map((o) => ({
            label: o.label,
            onClick: () => exportPlatformText(o.platform),
          })),
          { label: "起点分章", onClick: () => exportPlatformChapterBundle("qidian") },
        ],
      },
      {
        label: "数据",
        items: [
          { label: "备份数据", onClick: () => void exportWorkspaceBackup() },
          {
            label: "恢复数据",
            onClick: () => backupImportInputRef.current?.click(),
          },
        ],
      },
      {
        label: "扩展",
        items: [
          { label: "生成大纲", onClick: () => runExtendedCommand("生成大纲") },
          { label: "整理设定", onClick: () => runExtendedCommand("整理设定") },
          { label: "市场雷达", onClick: () => runExtendedCommand("市场雷达") },
        ],
      },
    ];
  }

  const trackModelCall = useCallback(
    (
      binding: ReadyModelBinding,
      label: string,
      status: ModelCallLog["status"],
      startedAt: string,
      endedAt: string,
      options?: { latencyMs?: number; errorMessage?: string },
    ) => {
      onSettingsChange(
        appendModelCallLog(settings, {
          routeKey: binding.routeKey,
          label,
          providerId: binding.provider.id,
          providerName: binding.provider.name,
          model: binding.model,
          status,
          latencyMs: options?.latencyMs,
          startedAt,
          endedAt,
          errorMessage: options?.errorMessage,
        }),
      );
    },
    [onSettingsChange, settings],
  );

  function applyNovelSnapshot(snapshot: NovelWorkspaceSnapshot) {
    const loadedBooks = toNovelBookEntries(
      snapshot.books,
      snapshot.sessionsByBookId,
      snapshot.chaptersByBookId,
      snapshot.tasksByBookId,
    );

    useStudioStore.getState().hydrateFromSnapshot({
      books: loadedBooks,
      messagesBySessionId: fromStoredMessagesBySession(
        snapshot.messagesBySessionId,
      ),
      activeBookId: useStudioStore.getState().activeBookId,
      activeSessionId: useStudioStore.getState().activeSessionId,
    });
    setChapterVersionsById(snapshot.chapterVersionsByChapterId);
    setSelectedBookIds((current) =>
      current.filter((bookId) => loadedBooks.some((book) => book.id === bookId)),
    );
    setCreatingBook(loadedBooks.length === 0);
  }

  function showToast(
    message: string,
    tone: AppToastState["tone"] = "success",
  ) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2600);
  }

  const refreshNovelWorkspace = useCallback(async () => {
    const snapshot = await loadNovelWorkspace();
    applyNovelSnapshot(snapshot);
    setError("");
  }, [setError]);

  const actionCtx = useMemo<StudioActionContext>(
    () => ({
      getState: useStudioStore.getState,
      settings,
      onSettingsChange,
      notify: showToast,
      trackModelCall,
      refreshWorkspace: refreshNovelWorkspace,
    }),
    [
      settings,
      onSettingsChange,
      refreshNovelWorkspace,
      trackModelCall,
    ],
  );

  function handleStudioAction(action: StudioAction) {
    if (action.type === "write-chapter" && !action.source) {
      dispatchStudioAction(actionCtx, { ...action, source: "quick-action" });
      return;
    }
    if (
      (action.type === "review" || action.type === "revise-chapter") &&
      !action.source
    ) {
      dispatchStudioAction(actionCtx, { ...action, source: "quick-action" });
      return;
    }
    dispatchStudioAction(actionCtx, action);
  }

  function handleWriteChapterQuickAction() {
    dispatchStudioAction(actionCtx, {
      type: "write-chapter",
      source: "quick-action",
    });
  }

  function openAdvancedWriteChapterOptions() {
    if (!activeBook || !project) {
      showToast("请先创建一本书籍。", "warning");
      return;
    }

    setWritingSheet({
      mode: "once",
      target: selectNextNovelChapterTarget(project, activeBook.chapters),
    });
  }

  function openDefaultWriteChapterPreferences() {
    if (!activeBook || !project) {
      showToast("请先创建一本书籍。", "warning");
      return;
    }

    setWritingSheet({ mode: "defaults" });
  }

  function closeWritingSheet() {
    setWritingSheet(null);
  }

  async function saveDefaultWritingPreferences(
    selection: NovelContextSelection,
  ) {
    if (!activeBook) {
      return;
    }

    const nextSelection = structuredClone(selection);

    await updateStoredNovelBook(activeBook.id, {
      assets: {
        ...activeBook.assets,
        contextSelection: nextSelection,
      },
    });
    patchBook(activeBook.id, (book) => ({
      ...book,
      assets: {
        ...book.assets,
        contextSelection: nextSelection,
      },
    }));
    closeWritingSheet();
    showToast("已保存为默认写作偏好");
    await refreshNovelWorkspace().catch(() => undefined);
  }

  function startAdvancedWriteChapter(selection: NovelContextSelection) {
    if (!writingSheet || writingSheet.mode !== "once") {
      return;
    }

    const target = writingSheet.target;
    closeWritingSheet();
    dispatchStudioAction(actionCtx, {
      type: "write-chapter",
      source: "advanced",
      target,
      contextSelection: structuredClone(selection),
    });
  }

  const writingSheetInitialValue =
    activeBook && project
      ? resolveDefaultWriteChapterSelection(activeBook, project)
      : null;
  const writingSheetDerivedStyleConstraints =
    activeBook && project
      ? buildNovelStyleConstraintsFromAssets(activeBook.assets, project)
      : "";

  function runExtendedCommand(command: string) {
    const coreAction = QUICK_CORE_ACTIONS[command];

    if (coreAction === "write-chapter") {
      dispatchStudioAction(actionCtx, {
        type: "write-chapter",
        source: "composer",
      });
      return;
    }
    if (coreAction === "review") {
      dispatchStudioAction(actionCtx, { type: "review", source: "composer" });
      return;
    }
    if (coreAction === "revise-chapter") {
      dispatchStudioAction(actionCtx, {
        type: "revise-chapter",
        source: "composer",
      });
      return;
    }

    if (coreAction) {
      void runCoreAction(actionCtx, coreAction);
      return;
    }

    void sendMessage(actionCtx, command);
  }

  function cancelActiveTask() {
    abortTask();
    resetCoreTaskState();
    showToast("任务已取消。", "warning");
  }

  async function pauseActiveTask() {
    await pauseActiveCoreTask(actionCtx);
  }

  async function toggleBatchQueuePaused() {
    const nextPaused = !batchQueuePausedRef.current;

    batchQueuePausedRef.current = nextPaused;
    setBatchQueuePaused(nextPaused);
    if (nextPaused) {
      const pendingTaskIds = batchQueueItemsRef.current
        .slice(Math.max(0, batchQueueActiveIndex + 1))
        .map((item) => batchQueueTaskIdsByItemRef.current[item.id])
        .filter((taskId): taskId is string => Boolean(taskId));

      await Promise.all(
        pendingTaskIds.map((taskId) => pauseStoredNovelTask(taskId)),
      ).catch(() => undefined);
      await refreshNovelWorkspace().catch(() => undefined);
    }
    showToast(nextPaused ? "队列会在当前任务结束后暂停。" : "队列已继续。");
  }

  function moveBatchQueueItem(itemId: string, direction: "up" | "down") {
    const activeItem = batchQueueItemsRef.current[batchQueueActiveIndex];
    if (activeItem?.id === itemId) {
      showToast("正在执行的队列项不能重排。", "warning");
      return;
    }

    const nextItems = moveNovelBatchQueueItem(
      batchQueueItemsRef.current,
      itemId,
      direction,
    );
    batchQueueItemsRef.current = nextItems;
    setBatchQueueItems(nextItems);
  }

  async function skipBatchQueueItem(itemId: string) {
    const activeItem = batchQueueItemsRef.current[batchQueueActiveIndex];
    if (activeItem?.id === itemId) {
      showToast("正在执行的队列项请用取消任务处理。", "warning");
      return;
    }

    const taskId = batchQueueTaskIdsByItemRef.current[itemId];
    if (taskId) {
      await skipStoredNovelTask(taskId).catch(() => undefined);
    }
    const nextItems = skipNovelBatchQueueItem(batchQueueItemsRef.current, itemId);
    batchQueueItemsRef.current = nextItems;
    setBatchQueueItems(nextItems);
    await refreshNovelWorkspace().catch(() => undefined);
    showToast("队列项已跳过。");
  }

  function exportBatchQueueReport() {
    if (!activeBook || batchQueueTaskIds.length === 0) {
      showToast("暂无可导出的批量任务报告。", "warning");
      return;
    }

    const selected = activeBook.tasks.filter((task) =>
      batchQueueTaskIds.includes(task.id),
    );
    const report = buildNovelBatchQueueReport(selected);

    downloadTextFile(
      `${activeBook.title}-批量任务报告.md`,
      report.markdown,
      "text/markdown;charset=utf-8",
    );
    showToast("批量任务报告已导出。");
  }

  function closeDialog(value: string | boolean | null) {
    dialogResolverRef.current?.(value);
    dialogResolverRef.current = null;
    setDialog(null);
    setDialogInput("");
  }

  function requestPrompt(options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }): Promise<string | null> {
    setDialogInput(options.initialValue ?? "");
    setDialog({
      kind: "prompt",
      ...options,
    });

    return new Promise((resolve) => {
      dialogResolverRef.current = (value) =>
        resolve(typeof value === "string" ? value : null);
    });
  }

  function requestConfirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    setDialog({
      kind: "confirm",
      ...options,
    });

    return new Promise((resolve) => {
      dialogResolverRef.current = (value) => resolve(value === true);
    });
  }

  function requestAlert(options: {
    title: string;
    message: string;
    confirmLabel?: string;
  }): Promise<void> {
    setDialog({
      kind: "alert",
      ...options,
    });

    return new Promise((resolve) => {
      dialogResolverRef.current = () => resolve();
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const snapshot = await loadNovelWorkspace();

        if (cancelled) {
          return;
        }

        applyNovelSnapshot(snapshot);
        setError("");
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "本地创作库加载失败。",
          );
          setCreatingBook(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [setError, setLoading]);

  useEffect(() => {
    if (
      selectedModelValue &&
      isModelPickerValueAvailable(selectedModelValue, groupedModels)
    ) {
      return;
    }

    const recent = settings.recentModels?.[0];
    if (recent) {
      const recentValue = formatModelPickerValue(recent.providerId, recent.model);
      if (isModelPickerValueAvailable(recentValue, groupedModels)) {
        setSelectedModel(recentValue);
        return;
      }
    }

    const chatDefault = getDefaultChatModelSelection(settings);
    if (chatDefault && isModelPickerValueAvailable(chatDefault, groupedModels)) {
      setSelectedModel(chatDefault);
      return;
    }

    const writerDefault = getDefaultWritingModelSelection(settings);
    if (
      writerDefault &&
      isModelPickerValueAvailable(writerDefault, groupedModels)
    ) {
      setSelectedModel(writerDefault);
      return;
    }

    const firstGroup = groupedModels[0];
    const firstModel = firstGroup?.models[0];

    if (firstGroup && firstModel) {
      setSelectedModel(`${firstGroup.service}::${firstModel.id}`);
    }
  }, [groupedModels, selectedModelValue, settings, setSelectedModel]);

  useEffect(() => {
    if (!activeBook) {
      setActiveChapter("");
      return;
    }

    const chapterRows = mergeNovelChapterPlan(activeBook.project, activeBook.chapters);

    if (chapterRows.some((chapter) => chapter.key === activeChapterId)) {
      return;
    }

    setActiveChapter(chapterRows.at(-1)?.key ?? "");
  }, [activeBook, activeChapterId, setActiveChapter]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (dialog) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog(dialog.kind === "confirm" ? false : null);
        }
        return;
      }

      if (event.key === "Escape" && selectedBookIds.length > 0) {
        event.preventDefault();
        setSelectedBookIds([]);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        composerInputRef.current?.focus();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        bookSearchInputRef.current?.focus();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreatingBook(true);
        setActiveTool("AI创作");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog, selectedBookIds.length]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toolOverflowOpen) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      const overflow = document.querySelector(`.${styles.novelToolOverflow}`);
      if (overflow && !overflow.contains(target)) {
        setToolOverflowOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [toolOverflowOpen]);

  async function createBook(inputValue: {
    title: string;
    genre: string;
    premise: string;
  }) {
    try {
      const project = createNovelProject(inputValue);
      const persisted = await createStoredNovelBook({
        title: project.title,
        genre: project.genre,
        premise: project.premise,
        project,
      });
      const bookId = persisted.book.id;
      const sessionId = persisted.session.id;
      const initialMessages = createWelcomeNovelMessages(sessionId);
      const nextBook: NovelBookEntry = {
        id: bookId,
        title: project.title,
        meta: project.genre,
        project,
        assets: persisted.book.assets,
        archived: persisted.book.archived,
        sortIndex: persisted.book.sortIndex,
        chapters: [],
        tasks: [],
        sessions: [
          {
            id: sessionId,
            title: "新会话",
            summary: persisted.session.summary,
            age: "刚刚",
          },
        ],
      };

      await Promise.all(
        initialMessages.map((message) => {
          const stored = toStoredMessage(message, sessionId);
          return appendStoredNovelMessage(sessionId, {
            id: stored.id,
            role: stored.role,
            content: stored.content,
            status: stored.status,
          });
        }),
      );

      setBooks([nextBook, ...useStudioStore.getState().books]);
      setActiveBook(bookId);
      setActiveSession(sessionId);
      setMessagesForSession(sessionId, initialMessages);
      setCreatingBook(false);
      setActiveTool("AI创作");
      setError("");
      showToast("书籍已创建。");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "创建书籍失败。",
      );
      showToast("创建书籍失败。", "error");
    }
  }

  async function createSession(bookId: string) {
    try {
      const persisted = await createStoredNovelSession(bookId, []);
      const sessionId = persisted.session.id;
      const initialMessages = createWelcomeNovelMessages(sessionId);

      await Promise.all(
        initialMessages.map((message) => {
          const stored = toStoredMessage(message, sessionId);
          return appendStoredNovelMessage(sessionId, {
            id: stored.id,
            role: stored.role,
            content: stored.content,
            status: stored.status,
          });
        }),
      );

      patchBook(bookId, (book) => ({
        ...book,
        sessions: [
          {
            id: sessionId,
            title: "新会话",
            summary: persisted.session.summary,
            age: "刚刚",
          },
          ...book.sessions,
        ],
      }));
      setActiveBook(bookId);
      setActiveSession(sessionId);
      setMessagesForSession(sessionId, initialMessages);
      setError("");
      showToast("会话已创建。");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "创建会话失败。",
      );
      showToast("创建会话失败。", "error");
    }
  }

  async function renameBook(bookId: string) {
    const book = books.find((item) => item.id === bookId);
    const nextTitle = await requestPrompt({
      title: "重命名书籍",
      message: "输入新的书名。",
      initialValue: book?.title ?? "",
      confirmLabel: "保存",
    });

    if (!book || !nextTitle?.trim()) {
      return;
    }

    const project = { ...book.project, title: nextTitle.trim() };
    await updateStoredNovelBook(bookId, {
      title: nextTitle.trim(),
      project,
    });
    await refreshNovelWorkspace();
    showToast("书籍名称已更新。");
  }

  async function archiveBook(bookId: string) {
    const book = books.find((item) => item.id === bookId);

    if (!book) {
      return;
    }

    await updateStoredNovelBook(bookId, { archived: !book.archived });
    await refreshNovelWorkspace();
    showToast(book.archived ? "书籍已还原。" : "书籍已归档。");
  }

  async function removeBook(bookId: string) {
    const book = books.find((item) => item.id === bookId);

    if (
      !book ||
      !(await requestConfirm({
        title: "删除书籍",
        message: `删除《${book.title}》及其所有会话？这个操作无法撤销。`,
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }

    await deleteStoredNovelBook(bookId);
    await refreshNovelWorkspace();
    setSelectedBookIds((current) => current.filter((id) => id !== bookId));
    showToast("书籍已删除。", "warning");
  }

  async function moveBook(bookId: string, direction: -1 | 1) {
    const currentIndex = visibleBooks.findIndex((book) => book.id === bookId);
    const targetBook = visibleBooks[currentIndex + direction];

    if (currentIndex < 0 || !targetBook) {
      return;
    }

    const currentBook = visibleBooks[currentIndex]!;

    await Promise.all([
      updateStoredNovelBook(currentBook.id, { sortIndex: targetBook.sortIndex }),
      updateStoredNovelBook(targetBook.id, { sortIndex: currentBook.sortIndex }),
    ]);
    await refreshNovelWorkspace();
    showToast("书籍排序已更新。");
  }

  async function renameSession(sessionId: string) {
    const session = books
      .flatMap((book) => book.sessions)
      .find((item) => item.id === sessionId);
    const nextTitle = await requestPrompt({
      title: "重命名会话",
      message: "输入新的会话名。",
      initialValue: session?.title ?? "",
      confirmLabel: "保存",
    });

    if (!session || !nextTitle?.trim()) {
      return;
    }

    await updateStoredNovelSession(sessionId, { title: nextTitle.trim() });
    await refreshNovelWorkspace();
    showToast("会话名称已更新。");
  }

  async function removeSession(bookId: string, sessionId: string) {
    const book = books.find((item) => item.id === bookId);

    if (!book || book.sessions.length <= 1) {
      await requestAlert({
        title: "不能删除会话",
        message: "至少保留一个会话。",
      });
      return;
    }

    if (
      !(await requestConfirm({
        title: "删除会话",
        message: "删除这个会话及其全部消息？这个操作无法撤销。",
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }

    await deleteStoredNovelSession(sessionId);
    await refreshNovelWorkspace();
    showToast("会话已删除。", "warning");
  }

  async function clearSessionMessages() {
    if (
      !activeSessionId ||
      !(await requestConfirm({
        title: "清空会话",
        message: "清空当前会话的所有消息？会保留一条新的欢迎提示。",
        confirmLabel: "清空",
        danger: true,
      }))
    ) {
      return;
    }

    await clearStoredNovelSessionMessages(activeSessionId);
    const initialMessages = createWelcomeNovelMessages(activeSessionId);
    await Promise.all(
      initialMessages.map((message) => {
        const stored = toStoredMessage(message, activeSessionId);
        return appendStoredNovelMessage(activeSessionId, {
          id: stored.id,
          role: stored.role,
          content: stored.content,
          status: stored.status,
        });
      }),
    );
    await refreshNovelWorkspace();
    showToast("当前会话已清空。", "warning");
  }

  async function editLastUserMessage() {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const nextContent = await requestPrompt({
      title: "编辑上一条用户消息",
      initialValue: lastUserMessage
        ? getMessageTextContent(lastUserMessage)
        : "",
      multiline: true,
      confirmLabel: "保存",
    });

    if (!lastUserMessage || !nextContent?.trim()) {
      return;
    }

    await updateStoredNovelMessage(lastUserMessage.id, {
      content: nextContent.trim(),
    });
    useStudioStore.getState().updateMessage(
      activeSessionId,
      lastUserMessage.id,
      (message) => ({
        ...message,
        parts: [{ type: "text", content: nextContent.trim() }],
      }),
    );
    showToast("上一条消息已更新。");
  }

  function exportActiveSession() {
    if (!activeBook || !activeSessionId) {
      return;
    }

    const session = activeBook.sessions.find((item) => item.id === activeSessionId);
    const content = [
      `# ${activeBook.title} / ${session?.title ?? "会话"}`,
      "",
      ...messages.map(
        (message) =>
          `## ${message.role === "user" ? "你" : "InkOS"}\n\n${flattenPartsToContent(message.parts)}`,
      ),
    ].join("\n\n");

    downloadTextFile(
      `${activeBook.title}-${session?.title ?? "session"}.md`,
      content,
      "text/markdown;charset=utf-8",
    );
    showToast("会话已导出。");
  }

  async function recordExportPublicationEvent(
    platform: NovelPlatformId,
    note: string,
  ) {
    if (!activeBook) {
      return;
    }

    await updateStoredNovelBook(activeBook.id, {
      assets: appendNovelPublicationEvent(activeBook.assets, {
        action: "exported",
        platform,
        note,
      }),
    });
    await refreshNovelWorkspace();
  }

  function openPublishValidation(
    platform: NovelPlatformId,
    onProceed: () => void | Promise<void>,
  ) {
    if (!activeBook) {
      return;
    }

    const report = buildNovelPublishValidationReport({
      title: activeBook.title,
      platform,
      chapters: activeBook.chapters,
      project: activeBook.project,
    });

    setPublishValidation({
      report,
      onProceed: () => {
        setPublishValidation(null);
        void onProceed();
      },
    });
  }

  function exportActiveBookDocx() {
    if (!activeBook) {
      return;
    }

    downloadBytesFile(
      `${activeBook.title}-整本书.docx`,
      createNovelBookDocxFile(
        buildNovelDocxDocumentModel({
          title: activeBook.title,
          genre: activeBook.meta,
          premise: activeBook.project.premise,
          chapters: activeBook.chapters,
        }),
      ),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    void recordExportPublicationEvent("generic", "整本书 docx 导出");
    showToast("整本书已导出。");
  }

  function exportActiveBook(format: "markdown" | "text" | "docx") {
    if (!activeBook) {
      return;
    }

    const chapters = activeBook.chapters;

    if (format === "markdown") {
      downloadTextFile(
        `${activeBook.title}-整本书.md`,
        buildNovelBookExportMarkdown({
          title: activeBook.title,
          genre: activeBook.meta,
          premise: activeBook.project.premise,
          chapters,
        }),
        "text/markdown;charset=utf-8",
      );
    } else if (format === "text") {
      downloadTextFile(
        `${activeBook.title}-整本书.txt`,
        buildNovelBookExportText({ title: activeBook.title, chapters }),
        "text/plain;charset=utf-8",
      );
    } else {
      openPublishValidation("generic", exportActiveBookDocx);
      return;
    }

    showToast("整本书已导出。");
  }

  function exportActiveBookChapters() {
    if (!activeBook) {
      return;
    }

    const bundle = buildNovelChapterExportBundle(activeBook.chapters);

    if (bundle.length === 0) {
      showToast("暂无可导出的章节正文。", "warning");
      return;
    }

    bundle.forEach((file) => {
      downloadTextFile(file.filename, file.content, "text/markdown;charset=utf-8");
    });
    showToast(`已导出 ${bundle.length} 个章节 Markdown。`);
  }

  function exportActiveBookVolumes() {
    if (!activeBook) {
      return;
    }

    const bundle = buildNovelVolumeExportBundle({
      title: activeBook.title,
      chapters: activeBook.chapters,
      outlineNodes: activeBook.assets.outlineNodes,
    });

    if (bundle.length === 0) {
      showToast("暂无可导出的卷内容。", "warning");
      return;
    }

    bundle.forEach((file) => {
      downloadTextFile(file.filename, file.content, "text/markdown;charset=utf-8");
    });
    showToast(`已导出 ${bundle.length} 个卷 Markdown。`);
  }

  function exportCreationLog() {
    if (!activeBook) {
      return;
    }

    downloadTextFile(
      `${activeBook.title}-创作日志.md`,
      buildNovelCreationLogExportMarkdown({
        bookTitle: activeBook.title,
        tasks: activeBook.tasks,
      }),
      "text/markdown;charset=utf-8",
    );
    showToast("创作日志已导出。");
  }

  function exportPlatformText(platform: Exclude<NovelPlatformId, "generic">) {
    if (!activeBook) {
      return;
    }

    const profile = getNovelPlatformProfile(platform);

    openPublishValidation(platform, () => {
      downloadTextFile(
        `${activeBook.title}-${platform}.txt`,
        buildNovelPlatformExportText({
          title: activeBook.title,
          platform,
          chapters: activeBook.chapters,
          genre: activeBook.meta,
          premise: activeBook.project.premise,
        }),
        "text/plain;charset=utf-8",
      );
      void recordExportPublicationEvent(platform, `${profile.label} TXT 导出`);
      showToast(`${profile.label} 格式文本已导出。`);
    });
  }

  function exportPlatformChapterBundle(
    platform: Exclude<NovelPlatformId, "generic">,
  ) {
    if (!activeBook) {
      return;
    }

    const profile = getNovelPlatformProfile(platform);

    openPublishValidation(platform, () => {
      const bundle = buildNovelPlatformExportBundle({
        title: activeBook.title,
        platform,
        chapters: activeBook.chapters,
      });

      if (bundle.length === 0) {
        showToast("暂无可导出的章节正文。", "warning");
        return;
      }

      bundle.forEach((file) => {
        downloadTextFile(file.filename, file.content, "text/plain;charset=utf-8");
      });
      void recordExportPublicationEvent(
        platform,
        `${profile.label} 分章 TXT 导出（${bundle.length} 章）`,
      );
      showToast(`已导出 ${bundle.length} 个 ${profile.label} 分章 TXT。`);
    });
  }

  function exportPublishManifest(platform: NovelPlatformId) {
    if (!activeBook) {
      return;
    }

    const report = buildNovelPublishValidationReport({
      title: activeBook.title,
      platform,
      chapters: activeBook.chapters,
      project: activeBook.project,
    });

    downloadTextFile(
      `${activeBook.title}-发布清单.md`,
      buildNovelPublishManifest({
        title: activeBook.title,
        genre: activeBook.meta,
        premise: activeBook.project.premise,
        platform,
        chapters: activeBook.chapters,
        validation: report,
      }),
      "text/markdown;charset=utf-8",
    );
    void recordExportPublicationEvent(platform, "发布清单 Markdown 导出");
    showToast("发布清单已导出。");
  }

  function exportActiveBookJson() {
    if (!activeBook) {
      return;
    }

    downloadTextFile(
      `${activeBook.title}-整本书.json`,
      buildNovelBookExportJson({
        title: activeBook.title,
        genre: activeBook.meta,
        premise: activeBook.project.premise,
        project: activeBook.project,
        assets: activeBook.assets,
        chapters: activeBook.chapters,
      }),
      "application/json;charset=utf-8",
    );
    void recordExportPublicationEvent("generic", "整本书 JSON 导出");
    showToast("整本书 JSON 已导出。");
  }

  async function exportCloudSyncPackage() {
    const payload = await exportNovelCloudSyncPackage({
      deviceId: cloudSyncState.deviceId,
      deviceLabel: cloudSyncState.deviceLabel,
      modelSettings: settings,
    });

    downloadTextFile(
      `sxy-cloud-sync-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );

    const nextState: NovelCloudSyncState = {
      ...cloudSyncState,
      lastExportedAt: new Date().toISOString(),
    };
    saveNovelCloudSyncState(nextState);
    setCloudSyncState(nextState);
    showToast("云端同步包已导出，可通过网盘或文件在另一设备导入合并。");
  }

  async function importCloudSyncFromFile(file: File) {
    try {
      const raw = await file.text();
      const remote = parseNovelCloudSyncPackage(raw);
      const snapshot = await loadNovelWorkspace();
      const local = buildNovelWorkspaceBackupPayload(snapshot, settings);
      const report = mergeNovelWorkspacePayloads(local, remote);
      const resolutions = Object.fromEntries(
        report.conflicts.map((conflict) => [conflict.entityId, conflict.resolution]),
      );

      setMergePreview({
        remote,
        report,
        resolutions,
      });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "导入同步包失败。",
        "error",
      );
    } finally {
      if (cloudSyncImportInputRef.current) {
        cloudSyncImportInputRef.current.value = "";
      }
    }
  }

  async function applyCloudSyncMerge() {
    if (!mergePreview) {
      return;
    }

    const snapshot = await loadNovelWorkspace();
    const local = buildNovelWorkspaceBackupPayload(snapshot, settings);
    const report = mergeNovelWorkspacePayloads(
      local,
      mergePreview.remote,
      mergePreview.resolutions,
    );

    try {
      await importNovelWorkspaceMerge(report.merged);

      const nextState: NovelCloudSyncState = {
        ...cloudSyncState,
        lastImportedAt: new Date().toISOString(),
        lastMergeAt: new Date().toISOString(),
        lastRemoteFingerprint: computeNovelWorkspaceFingerprint(report.merged),
      };
      saveNovelCloudSyncState(nextState);
      setCloudSyncState(nextState);
      setMergePreview(null);
      await refreshNovelWorkspace();
      showToast(report.summary);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "合并同步失败。",
        "error",
      );
    }
  }

  function updateCloudSyncDeviceLabel(deviceLabel: string) {
    const nextState = { ...cloudSyncState, deviceLabel };
    saveNovelCloudSyncState(nextState);
    setCloudSyncState(nextState);
  }

  function updateWebDavSettings(
    patch: Partial<NovelCloudSyncWebDavSettings>,
  ) {
    const nextSettings = { ...webDavSettings, ...patch };
    setWebDavSettings(nextSettings);
    saveNovelCloudSyncWebDavSettings(nextSettings);
  }

  async function testWebDavConnection() {
    setWebDavBusy("test");

    try {
      const result = await testNovelCloudSyncWebDav(webDavSettings);
      showToast(result.message, result.ok ? "success" : "error");
    } finally {
      setWebDavBusy(null);
    }
  }

  async function uploadCloudSyncToWebDav() {
    setWebDavBusy("upload");

    try {
      const payload = await exportNovelCloudSyncPackage({
        deviceId: cloudSyncState.deviceId,
        deviceLabel: cloudSyncState.deviceLabel,
        modelSettings: settings,
      });
      const result = await uploadNovelCloudSyncWebDav(
        webDavSettings,
        JSON.stringify(payload, null, 2),
      );

      if (!result.ok) {
        showToast(result.message, "error");
        return;
      }

      const now = new Date().toISOString();
      const nextState: NovelCloudSyncState = {
        ...cloudSyncState,
        lastExportedAt: now,
        lastWebDavUploadAt: now,
        lastRemoteFingerprint: payload.fingerprint,
      };
      saveNovelCloudSyncState(nextState);
      setCloudSyncState(nextState);
      showToast(result.message);
    } finally {
      setWebDavBusy(null);
    }
  }

  async function downloadCloudSyncFromWebDav() {
    setWebDavBusy("download");

    try {
      const result = await downloadNovelCloudSyncWebDav(webDavSettings);

      if (!result.ok || !result.payload) {
        showToast(result.message, "error");
        return;
      }

      const remote = parseNovelCloudSyncPackage(result.payload);
      const snapshot = await loadNovelWorkspace();
      const local = buildNovelWorkspaceBackupPayload(snapshot, settings);
      const report = mergeNovelWorkspacePayloads(local, remote);
      const resolutions = Object.fromEntries(
        report.conflicts.map((conflict) => [conflict.entityId, conflict.resolution]),
      );

      const nextState: NovelCloudSyncState = {
        ...cloudSyncState,
        lastWebDavDownloadAt: new Date().toISOString(),
      };
      saveNovelCloudSyncState(nextState);
      setCloudSyncState(nextState);
      setMergePreview({
        remote,
        report,
        resolutions,
      });
      showToast("已从 WebDAV 拉取同步包，请确认合并预览。");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "WebDAV 拉取失败。",
        "error",
      );
    } finally {
      setWebDavBusy(null);
    }
  }

  function resetWebDavSettings() {
    const nextSettings = createDefaultNovelCloudSyncWebDavSettings();
    setWebDavSettings(nextSettings);
    saveNovelCloudSyncWebDavSettings(nextSettings);
    showToast("WebDAV 配置已重置。");
  }

  function toggleMergeConflictResolution(entityId: string) {
    setMergePreview((current) => {
      if (!current) {
        return current;
      }

      const conflict = current.report.conflicts.find(
        (item) => item.entityId === entityId,
      );

      if (!conflict) {
        return current;
      }

      return {
        ...current,
        resolutions: {
          ...current.resolutions,
          [entityId]:
            current.resolutions[entityId] === "local" ? "remote" : "local",
        },
      };
    });
  }

  async function exportWorkspaceBackup() {
    const payload = await exportNovelWorkspaceBackup(settings);

    downloadTextFile(
      `sxy-creative-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    showToast("本地创作库备份已导出，模型 Key 已脱敏。");
  }

  async function restoreWorkspaceBackupFromFile(file: File) {
    if (
      !(await requestConfirm({
        title: "恢复本地备份",
        message:
          "恢复会替换当前浏览器里的书籍、会话、消息、章节、版本和任务日志。模型 Key 不会从备份恢复。继续吗？",
        confirmLabel: "恢复",
        danger: true,
      }))
    ) {
      return;
    }

    try {
      const raw = await file.text();
      const payload = await restoreNovelWorkspaceBackup(raw);

      await refreshNovelWorkspace();
      showToast(`已恢复备份：${payload.books.length} 本书籍。`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "恢复备份失败。",
        "error",
      );
    } finally {
      if (backupImportInputRef.current) {
        backupImportInputRef.current.value = "";
      }
    }
  }

  async function bulkArchiveBooks(archived: boolean) {
    const selectedBooks = books.filter((book) => selectedBookIds.includes(book.id));

    if (selectedBooks.length === 0) {
      return;
    }

    await Promise.all(
      selectedBooks.map((book) =>
        updateStoredNovelBook(book.id, {
          archived,
        }),
      ),
    );
    await refreshNovelWorkspace();
    setSelectedBookIds([]);
    showToast(archived ? "已批量归档书籍。" : "已批量还原书籍。");
  }

  async function bulkDeleteBooks() {
    const selectedBooks = books.filter((book) => selectedBookIds.includes(book.id));

    if (selectedBooks.length === 0) {
      return;
    }

    const confirmed = await requestConfirm({
      title: "批量删除书籍",
      message: `删除选中的 ${selectedBooks.length} 本书籍及其全部会话？这个操作无法撤销。`,
      confirmLabel: "批量删除",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    await Promise.all(selectedBooks.map((book) => deleteStoredNovelBook(book.id)));
    await refreshNovelWorkspace();
    setSelectedBookIds([]);
    showToast("已批量删除书籍。", "warning");
  }

  function toggleBookSelection(bookId: string) {
    setSelectedBookIds((current) =>
      current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId],
    );
  }

  function toggleVisibleBookSelection() {
    const visibleIds = visibleBooks.map((book) => book.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((bookId) => selectedBookIds.includes(bookId));

    setSelectedBookIds((current) =>
      allVisibleSelected
        ? current.filter((bookId) => !visibleIds.includes(bookId))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function retryLastFailedMessage() {
    let failedIndex = -1;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.status === "error") {
        failedIndex = index;
        break;
      }
    }
    const previousUser = messages
      .slice(0, failedIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (previousUser) {
      void sendMessage(actionCtx, getMessageTextContent(previousUser));
    }
  }

  async function updateActiveProject(
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) {
    if (!activeBook) {
      return;
    }

    const project = {
      ...activeBook.project,
      ...updates,
    };

    await updateStoredNovelBook(activeBook.id, {
      title: project.title,
      genre: project.genre,
      premise: project.premise,
      project,
      ...(assets ? { assets } : {}),
    });
    await refreshNovelWorkspace();
  }

  async function importProcessedNovelChapters(chapters: NovelImportedChapter[]) {
    if (!activeBook || chapters.length === 0) {
      return;
    }

    for (const chapter of chapters) {
      await upsertStoredNovelChapter({
        bookId: activeBook.id,
        number: chapter.number,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
        status: "approved",
        wordCount: chapter.wordCount,
        versionSource: "manual-edit",
        versionNote: "导入章节",
      });
    }

    await refreshNovelWorkspace();
  }

  async function runLocalEnvironmentDiagnostics() {
    if (!activeBook || !project) {
      return;
    }

    const localChecks = buildNovelLocalEnvironmentDiagnostics({
      project,
      assets: activeBook.assets,
      chapters: activeBook.chapters,
    });

    await updateActiveProject({}, {
      ...activeBook.assets,
      diagnostics: mergeNovelDiagnostics(
        localChecks,
        activeBook.assets.diagnostics,
      ),
    });
    showToast("本地环境诊断已完成。");
  }

  async function saveChapterDraft(
    chapter: StoredNovelChapter,
    updates: Pick<StoredNovelChapter, "content" | "summary">,
  ) {
    const updatedChapter = await updateStoredNovelChapter(
      chapter.id,
      updates,
      {
        versionSource: "manual-edit",
        versionNote: "章节编辑器保存",
      },
    );
    if (activeBook && updatedChapter) {
      await updateStoredNovelBook(activeBook.id, {
        project: syncNovelProjectChapterPlan(
          activeBook.project,
          updatedChapter,
        ),
      });
    }
    await refreshNovelWorkspace();
    showToast("章节已保存，版本记录已更新。");
  }

  async function updateChapterStatus(
    chapter: StoredNovelChapter,
    status: StoredNovelChapter["status"],
  ) {
    const updatedChapter = await updateStoredNovelChapter(
      chapter.id,
      { status },
      {
        versionSource: "status-change",
        versionNote: `状态改为 ${INKOS_STATUS_LABELS[status]}`,
      },
    );
    if (activeBook && updatedChapter) {
      await updateStoredNovelBook(activeBook.id, {
        project: syncNovelProjectChapterPlan(
          activeBook.project,
          updatedChapter,
        ),
      });
    }
    await refreshNovelWorkspace();
    showToast("章节状态已更新。");
  }

  async function updateChapterPublicationStatus(
    chapter: StoredNovelChapter,
    publicationStatus: NonNullable<StoredNovelChapter["publicationStatus"]>,
  ) {
    const publishedAt =
      publicationStatus === "published" ? new Date().toISOString() : undefined;

    await updateStoredNovelChapter(
      chapter.id,
      {
        publicationStatus,
        ...(publishedAt ? { publishedAt } : {}),
      },
      { skipVersion: true },
    );

    if (activeBook) {
      await updateStoredNovelBook(activeBook.id, {
        assets: appendNovelPublicationEvent(activeBook.assets, {
          action:
            publicationStatus === "published" ? "marked-published" : "marked-ready",
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
        }),
      });
    }

    await refreshNovelWorkspace();
    showToast("章节发布状态已更新。");
  }

  async function removeChapter(chapter: StoredNovelChapter) {
    if (
      !(await requestConfirm({
        title: "删除章节",
        message: `删除第 ${chapter.number} 章《${chapter.title}》？这个操作无法撤销。`,
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }

    await deleteStoredNovelChapter(chapter.id);
    await refreshNovelWorkspace();
    showToast("章节已删除。", "warning");
  }

  async function restoreChapterVersion(version: StoredNovelChapterVersion) {
    if (
      !(await requestConfirm({
        title: "恢复章节版本",
        message: `恢复第 ${version.number} 章《${version.title}》到 ${formatNovelChapterVersionSource(version.source)} 版本？当前正文会保存为新的恢复记录。`,
        confirmLabel: "恢复",
      }))
    ) {
      return;
    }

    const restoredChapter = await restoreStoredNovelChapterVersion(version.id);

    if (restoredChapter) {
      if (activeBook) {
        await updateStoredNovelBook(activeBook.id, {
          project: syncNovelProjectChapterPlan(
            activeBook.project,
            restoredChapter,
          ),
        });
      }
      setActiveChapter(restoredChapter.id);
      await refreshNovelWorkspace();
      showToast("章节版本已恢复。");
    } else {
      showToast("没有找到这个章节版本。", "error");
    }
  }

  return (
    <div className={styles.novelChatShell}>
      <section className={styles.novelToolTabs} aria-label='AI 小说创作工具'>
        {activeTool !== "AI创作" ? (
          <div className={styles.novelToolBreadcrumb}>
            <button type="button" onClick={() => setActiveTool("AI创作")}>
              ← AI创作
            </button>
            <span>{activeTool}</span>
          </div>
        ) : (
          <button type="button" className={styles.activeNovelTool}>
            AI创作
          </button>
        )}
        <div className={styles.novelToolOverflow}>
          <button
            type="button"
            className={styles.novelToolOverflowTrigger}
            onClick={() => setToolOverflowOpen((v) => !v)}
          >
            ··· 更多工具
          </button>
          {toolOverflowOpen ? (
            <div className={styles.novelToolOverflowMenu}>
              {(["题材", "文风", "导入", "市场雷达", "环境诊断"] as const).map(
                (tool) => (
                  <button
                    key={tool}
                    type="button"
                    className={activeTool === tool ? styles.activeNovelTool : ""}
                    onClick={() => {
                      setActiveTool(tool);
                      setToolOverflowOpen(false);
                    }}
                  >
                    {tool}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>
      </section>

      {activeTool === "AI创作" && isNovelStoreLoading ? (
        <section className={styles.createBookScreen}>
          <div className={styles.createBookBox}>
            <span>SXY InkOS</span>
            <h2>正在加载本地创作库</h2>
            <p>书籍、会话和历史消息会从浏览器 IndexedDB 恢复。</p>
          </div>
        </section>
      ) : activeTool === "AI创作" && (creatingBook || books.length === 0) ? (
        <CreateBookPanel
          modelGroups={groupedModels}
          selectedModelValue={selectedModelValue}
          hasBooks={books.length > 0}
          errorMessage={novelStoreError}
          onCancel={() => setCreatingBook(false)}
          onCreate={createBook}
          onManageModels={onManageModels}
          onModelChange={setSelectedModel}
        />
      ) : activeTool === "AI创作" && activeBook && project && currentStage && stats ? (
        <section className={styles.novelChatLayout}>
          <NovelBookList
            books={visibleBooks}
            activeBookId={activeBookId}
            activeSessionId={activeSessionId}
            searchQuery={bookSearchQuery}
            selectedBookIds={selectedBookIds}
            showArchived={showArchivedBooks}
            totalBooks={books.length}
            searchInputRef={bookSearchInputRef}
            onBulkArchive={() => void bulkArchiveBooks(true)}
            onBulkDelete={() => void bulkDeleteBooks()}
            onBulkRestore={() => void bulkArchiveBooks(false)}
            onClearSelection={() => setSelectedBookIds([])}
            onCreateBook={() => setCreatingBook(true)}
            onCreateSession={createSession}
            onArchiveBook={(bookId) => void archiveBook(bookId)}
            onBookSelect={(bookId) => {
              const nextBook = books.find((book) => book.id === bookId);
              setActiveBook(bookId);
              setActiveSession(nextBook?.sessions[0]?.id ?? "");
            }}
            onDeleteBook={(bookId) => void removeBook(bookId)}
            onMoveBook={(bookId, direction) => void moveBook(bookId, direction)}
            onRenameBook={(bookId) => void renameBook(bookId)}
            onRenameSession={(sessionId) => void renameSession(sessionId)}
            onSelectAllVisible={toggleVisibleBookSelection}
            onSelectBook={toggleBookSelection}
            onDeleteSession={(bookId, sessionId) =>
              void removeSession(bookId, sessionId)
            }
            onSearchQueryChange={setBookSearchQuery}
            onSessionSelect={(bookId, sessionId) => {
              setActiveBook(bookId);
              setActiveSession(sessionId);
            }}
            onShowArchivedChange={setShowArchivedBooks}
          />

          <section className={styles.chatSurface}>
            <header className={styles.chatContextBar}>
              <div>
                <strong>{activeBook?.title ?? project.title}</strong>
                <span>
                  {activeBook?.meta ?? project.genre} / {currentStage.label} / 已生成{" "}
                  {stats.generatedChapters} 章
                </span>
              </div>
            </header>

            <div className={styles.messageList}>
              {messages.length === 0 ? (
                <div className={styles.emptyMessageState}>
                  <span>输入一个题材、角色或章节目标，从这里开始。</span>
                </div>
              ) : null}
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>

            <ChatComposer
              input={input}
              onInputChange={setInput}
              onSend={() => void sendMessage(actionCtx, input)}
              selectedModelValue={selectedModelValue}
              modelGroups={groupedModels}
              recentModels={settings.recentModels ?? []}
              onModelChange={setSelectedModel}
              onManageModels={onManageModels}
              disabled={isTaskRunning}
              canSend={canSendChat}
              onQuickAction={handleStudioAction}
              onWriteChapter={handleWriteChapterQuickAction}
              onOpenAdvancedOptions={openAdvancedWriteChapterOptions}
              onEditDefaultPreferences={openDefaultWriteChapterPreferences}
              moreMenuGroups={buildComposerMoreMenuGroups()}
              onOpenCloudSync={() => setCloudSyncDialogOpen(true)}
              composerInputRef={composerInputRef}
              batchQueueBar={
                batchQueueItems.length > 0 ? (
                  <div className={styles.batchQueueBar}>
                    <div>
                      <span>
                        队列 {Math.max(0, batchQueueActiveIndex + 1)} /{" "}
                        {batchQueueItems.length}
                      </span>
                      <strong>
                        {batchQueueItems[batchQueueActiveIndex]?.label ??
                          "队列等待中"}
                      </strong>
                      {batchQueuePaused ? (
                        <em>已暂停，当前任务结束后停住</em>
                      ) : null}
                    </div>
                    <div className={styles.batchQueueActions}>
                      <button onClick={() => void toggleBatchQueuePaused()}>
                        {batchQueuePaused ? "继续队列" : "暂停队列"}
                      </button>
                      <button onClick={exportBatchQueueReport}>完成报告</button>
                    </div>
                    <div className={styles.batchQueueList}>
                      {batchQueueItems.map((item, index) => (
                        <article
                          key={item.id}
                          className={
                            index === batchQueueActiveIndex
                              ? styles.activeBatchQueueItem
                              : ""
                          }
                        >
                          <span>{item.label}</span>
                          <div>
                            <button
                              disabled={index <= batchQueueActiveIndex + 1}
                              onClick={() => moveBatchQueueItem(item.id, "up")}
                            >
                              上移
                            </button>
                            <button
                              disabled={index <= batchQueueActiveIndex}
                              onClick={() => moveBatchQueueItem(item.id, "down")}
                            >
                              下移
                            </button>
                            <button
                              disabled={index <= batchQueueActiveIndex}
                              onClick={() => void skipBatchQueueItem(item.id)}
                            >
                              跳过
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null
              }
              activeTaskBar={
                activeTaskLabel ? (
                  <div className={styles.activeTaskBar}>
                    <span>正在执行：{activeTaskLabel}</span>
                    {isRunningCoreAction ? (
                      <button onClick={() => void pauseActiveTask()}>暂停</button>
                    ) : null}
                    <button onClick={cancelActiveTask}>取消任务</button>
                  </div>
                ) : null
              }
              routeError={
                !canSendChat && "error" in chatBinding
                  ? chatBinding.error
                  : undefined
              }
            />
            <input
              ref={backupImportInputRef}
              type='file'
              accept='application/json,.json'
              className={styles.hiddenFileInput}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void restoreWorkspaceBackupFromFile(file);
                }
              }}
            />
            <input
              ref={cloudSyncImportInputRef}
              type='file'
              accept='application/json,.json'
              className={styles.hiddenFileInput}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importCloudSyncFromFile(file);
                }
              }}
            />
          </section>

          <NovelBookPanel
            project={project}
            assets={activeBook.assets}
            chapters={activeBook.chapters}
            chapterVersions={
              activeChapter
                ? chapterVersionsById[activeChapter.id] ?? []
                : []
            }
            tasks={activeBook.tasks}
            activeChapterId={activeChapterRow?.key ?? ""}
            stats={stats}
            promptPreview={promptPreview}
            onChapterSelect={setActiveChapter}
            onChapterDraftSave={saveChapterDraft}
            onChapterStatusChange={updateChapterStatus}
            onChapterPublicationStatusChange={updateChapterPublicationStatus}
            onChapterDelete={removeChapter}
            onChapterVersionRestore={restoreChapterVersion}
            onGenerateChapter={async (target) => {
              dispatchStudioAction(actionCtx, {
                type: "write-chapter",
                source: "chapter-panel",
                target,
              });
            }}
            onReviseChapter={async (selectedIssueIds) => {
              await runCoreAction(actionCtx, "revise-chapter", { selectedIssueIds });
            }}
            onRetryTask={(task) => {
              if (task.sessionId !== activeSessionId) {
                setActiveSession(task.sessionId);
              }
              const action = task.action as InkosCoreAction;
              const row = activeChapterRows.find(
                (chapter) => chapter.number === task.targetChapterNumber,
              );
              const resumePreview = buildNovelTaskResumePreview(task);
              void runCoreAction(actionCtx, action, {
                targetChapter:
                  action === "write-chapter" && row
                    ? {
                        number: row.number,
                        title: row.title,
                        focus: row.focus,
                        targetWords: row.targetWords,
                        reason: row.generated ? "append" : "planned",
                      }
                    : undefined,
                targetStoredChapter:
                  action === "review" || action === "revise-chapter"
                    ? row?.chapter
                    : undefined,
                existingTaskId:
                  task.status === "queued" || task.status === "paused"
                    ? task.id
                    : undefined,
                resumeTask: resumePreview.canResume ? task : undefined,
                labelOverride: task.label,
              });
            }}
            onProjectChange={updateActiveProject}
            onRequestPrompt={requestPrompt}
            onRequestConfirm={requestConfirm}
            onShowToast={showToast}
          />
        </section>
      ) : activeTool !== "AI创作" ? (
        <NovelToolPanel
          tool={activeTool}
          book={activeBook ?? null}
          project={project ?? createDemoInkosProject()}
          isRunningCoreAction={isRunningCoreAction}
          onProjectChange={updateActiveProject}
          onRunCoreAction={async (action) => {
            await runCoreAction(actionCtx, action);
          }}
          onImportChapters={importProcessedNovelChapters}
          onRunLocalDiagnostics={() => void runLocalEnvironmentDiagnostics()}
          onRequestPrompt={requestPrompt}
          onNotify={showToast}
        />
      ) : (
        <CreateBookPanel
          modelGroups={groupedModels}
          selectedModelValue={selectedModelValue}
          hasBooks={books.length > 0}
          errorMessage={novelStoreError}
          onCancel={() => setCreatingBook(false)}
          onCreate={createBook}
          onManageModels={onManageModels}
          onModelChange={setSelectedModel}
        />
      )}
      <AppDialog
        dialog={dialog}
        inputValue={dialogInput}
        onCancel={() => closeDialog(dialog?.kind === "confirm" ? false : null)}
        onConfirm={() =>
          closeDialog(dialog?.kind === "prompt" ? dialogInput : true)
        }
        onInputChange={setDialogInput}
      />
      <AppToast toast={toast} />
      {publishValidation ? (
        <PublishValidationDialog
          report={publishValidation.report}
          onClose={() => setPublishValidation(null)}
          onProceed={publishValidation.onProceed}
        />
      ) : null}
      {mergePreview ? (
        <CloudSyncMergeDialog
          remoteLabel={mergePreview.remote.deviceLabel}
          report={mergePreview.report}
          resolutions={mergePreview.resolutions}
          onClose={() => setMergePreview(null)}
          onToggleResolution={toggleMergeConflictResolution}
          onConfirm={() => void applyCloudSyncMerge()}
        />
      ) : null}
      {cloudSyncDialogOpen ? (
        <div
          className={styles.dialogOverlay}
          role="presentation"
          onClick={() => setCloudSyncDialogOpen(false)}
        >
          <section
            className={styles.appDialog}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>云同步设置</h2>
              <p>本地文件导出 / WebDAV 自动同步</p>
            </header>
            <CloudSyncPanel
              state={cloudSyncState}
              webDavSettings={webDavSettings}
              webDavBusy={webDavBusy}
              onDeviceLabelChange={updateCloudSyncDeviceLabel}
              onExport={() => void exportCloudSyncPackage()}
              onImportClick={() => cloudSyncImportInputRef.current?.click()}
              onWebDavSettingsChange={updateWebDavSettings}
              onWebDavTest={() => void testWebDavConnection()}
              onWebDavUpload={() => void uploadCloudSyncToWebDav()}
              onWebDavDownload={() => void downloadCloudSyncFromWebDav()}
              onWebDavReset={resetWebDavSettings}
            />
            <footer>
              <button type="button" onClick={() => setCloudSyncDialogOpen(false)}>
                关闭
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {writingSheet && writingSheetInitialValue ? (
        <WriteChapterOptionsSheet
          open
          mode={writingSheet.mode}
          target={writingSheet.mode === "once" ? writingSheet.target : undefined}
          initialValue={writingSheetInitialValue}
          derivedStyleConstraints={writingSheetDerivedStyleConstraints}
          onClose={closeWritingSheet}
          onStartGenerate={startAdvancedWriteChapter}
          onSaveDefaults={(selection) =>
            void saveDefaultWritingPreferences(selection)
          }
        />
      ) : null}
    </div>
  );
}

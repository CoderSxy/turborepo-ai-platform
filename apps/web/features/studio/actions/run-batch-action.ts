import {
  buildNovelBatchQueueItems,
  createStoredNovelTask,
  finishStoredNovelTask,
  mergeNovelChapterPlan,
} from "../../../lib/novel-store";
import { getStudioTaskGuard } from "./runtime/task-guard";
import { resolveCoreActionModelBinding } from "../helpers/model-binding";
import type { StudioActionContext } from "./types";
import { runCoreAction } from "./run-core-action";
import type { InkosCoreAction } from "@repo/inkos-adapter";
import type { NovelBatchQueueAction, NovelBatchQueueItem } from "../../../lib/novel-store";

export type BatchQueueRuntime = {
  items: NovelBatchQueueItem[];
  activeIndex: number;
  paused: boolean;
  taskIds: string[];
  taskIdsByItem: Record<string, string>;
  itemsRef: { current: NovelBatchQueueItem[] };
  pausedRef: { current: boolean };
  taskIdsByItemRef: { current: Record<string, string> };
  setItems: (items: NovelBatchQueueItem[]) => void;
  setActiveIndex: (index: number) => void;
  setPaused: (paused: boolean) => void;
  setTaskIds: (taskIds: string[]) => void;
};

export async function runBatchCoreAction(
  ctx: StudioActionContext,
  action: NovelBatchQueueAction,
  queue: BatchQueueRuntime,
): Promise<void> {
  const store = ctx.getState();
  const guard = getStudioTaskGuard(store.runningTask);

  if (!guard.canStart) {
    ctx.notify(guard.message, "warning");
    return;
  }

  const activeBook =
    store.books.find((book) => book.id === store.activeBookId) ?? null;

  if (!activeBook || !store.activeSessionId) {
    ctx.notify("请先选择书籍和会话。", "warning");
    return;
  }

  const bindingResult = resolveCoreActionModelBinding(ctx.settings, action);
  if ("error" in bindingResult) {
    ctx.notify(bindingResult.error, "warning");
    return;
  }

  const activeChapterRows = mergeNovelChapterPlan(
    activeBook.project,
    activeBook.chapters,
  );
  const queueItems = buildNovelBatchQueueItems(activeChapterRows, action);

  if (queueItems.length === 0) {
    ctx.notify(
      action === "write-chapter"
        ? "没有待生成的计划章节。"
        : action === "review"
          ? "没有待审稿章节。"
          : "没有带未解决审稿问题的章节。",
      "warning",
    );
    return;
  }

  queue.setItems(queueItems);
  queue.itemsRef.current = queueItems;
  queue.setActiveIndex(0);
  queue.setPaused(false);
  queue.pausedRef.current = false;
  ctx.notify(`已加入队列：${queueItems.length} 个任务。`, "success");

  const queuedTasks = await Promise.all(
    queueItems.map((item) =>
      createStoredNovelTask({
        bookId: activeBook.id,
        sessionId: store.activeSessionId,
        action: item.action,
        label: item.label,
        status: "queued",
        targetChapterId: item.chapter?.id,
        targetChapterNumber: item.number,
        targetChapterTitle: item.title,
      }),
    ),
  );
  const taskIdsByItem = Object.fromEntries(
    queueItems.map((item, index) => [item.id, queuedTasks[index]?.id ?? ""]),
  );
  queue.taskIdsByItemRef.current = taskIdsByItem;
  queue.setTaskIds(queuedTasks.map((task) => task.id));
  await ctx.refreshWorkspace();

  let index = 0;

  while (index < queue.itemsRef.current.length) {
    while (queue.pausedRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const item = queue.itemsRef.current[index];
    if (!item) {
      index += 1;
      continue;
    }
    queue.setActiveIndex(index);
    const ok = await runCoreAction(ctx, item.action as InkosCoreAction, {
      targetChapter: item.target,
      targetStoredChapter: item.chapter,
      existingTaskId: taskIdsByItem[item.id],
      labelOverride: item.label,
    });

    if (!ok) {
      const pendingItems = queue.itemsRef.current.slice(index + 1);
      await Promise.all(
        pendingItems
          .map((pendingItem) => taskIdsByItem[pendingItem.id])
          .filter((taskId): taskId is string => Boolean(taskId))
          .map((taskId) =>
            finishStoredNovelTask(
              taskId,
              "cancelled",
              "批量任务已停止，尚未执行。",
            ),
          ),
      );
      queue.setActiveIndex(-1);
      queue.setItems([]);
      ctx.notify(`批量任务停在：${item.label}`, "error");
      await ctx.refreshWorkspace().catch(() => undefined);
      return;
    }

    index += 1;
  }

  queue.setActiveIndex(-1);
  queue.itemsRef.current = [];
  queue.setItems([]);
  queue.setPaused(false);
  queue.pausedRef.current = false;
  await ctx.refreshWorkspace();
  ctx.notify("批量任务已完成。", "success");
}

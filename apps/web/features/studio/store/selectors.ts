import { useMemo } from "react";
import { getStudioTaskGuard } from "../actions/runtime/task-guard";
import type { StudioMessage } from "./types";
import { useStudioStore } from "./store";

const EMPTY_MESSAGES: StudioMessage[] = [];
const IDLE_TASK_GUARD = { canStart: true, message: "" } as const;

export function useActiveBook() {
  return useStudioStore((state) =>
    state.books.find((book) => book.id === state.activeBookId) ?? null,
  );
}

export function useActiveMessages() {
  return useStudioStore(
    (state) =>
      state.messagesBySessionId[state.activeSessionId] ?? EMPTY_MESSAGES,
  );
}

export function useIsTaskRunning() {
  return useStudioStore((state) => state.runningTask !== null);
}

export function useCanStartTask() {
  const runningTask = useStudioStore((state) => state.runningTask);
  return useMemo(
    () => (runningTask ? getStudioTaskGuard(runningTask) : IDLE_TASK_GUARD),
    [runningTask],
  );
}

export function useRunningTaskLabel() {
  return useStudioStore((state) => state.runningTask?.label ?? "");
}

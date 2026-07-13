import { getStudioTaskGuard } from "../actions/runtime/task-guard";
import { useStudioStore } from "./store";

export function useActiveBook() {
  return useStudioStore((state) =>
    state.books.find((book) => book.id === state.activeBookId) ?? null,
  );
}

export function useActiveMessages() {
  return useStudioStore(
    (state) => state.messagesBySessionId[state.activeSessionId] ?? [],
  );
}

export function useIsTaskRunning() {
  return useStudioStore((state) => state.runningTask !== null);
}

export function useCanStartTask() {
  const runningTask = useStudioStore((state) => state.runningTask);
  return getStudioTaskGuard(runningTask);
}

export function useRunningTaskLabel() {
  return useStudioStore((state) => state.runningTask?.label ?? "");
}

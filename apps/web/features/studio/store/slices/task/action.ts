import type { StateCreator } from "zustand";
import type { StudioStore } from "../../types";
import { initialTaskState } from "./initialState";

export const createTaskSlice: StateCreator<
  StudioStore,
  [],
  [],
  Pick<StudioStore, keyof typeof initialTaskState | "startTask" | "pauseTask" | "finishTask" | "abortTask">
> = (set, get) => ({
  ...initialTaskState,
  startTask: (runningTask) => set({ runningTask }),
  pauseTask: () =>
    set((state) =>
      state.runningTask
        ? { runningTask: { ...state.runningTask, status: "paused" } }
        : {},
    ),
  finishTask: () => set({ runningTask: null }),
  abortTask: () => {
    get().runningTask?.abortController.abort();
    set({ runningTask: null });
  },
});

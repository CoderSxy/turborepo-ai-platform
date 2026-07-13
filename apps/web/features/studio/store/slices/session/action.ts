import type { StateCreator } from "zustand";
import type { StudioStore } from "../../types";
import { initialSessionState } from "./initialState";

export const createSessionSlice: StateCreator<
  StudioStore,
  [],
  [],
  Pick<
    StudioStore,
    keyof typeof initialSessionState | "setActiveSession" | "setInput" | "setSelectedModel"
  >
> = (set) => ({
  ...initialSessionState,
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setInput: (input) => set({ input }),
  setSelectedModel: (selectedModelValue) => set({ selectedModelValue }),
});

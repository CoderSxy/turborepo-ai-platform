import type { StateCreator } from "zustand";
import type { StudioStore } from "../../types";
import { initialMessageState } from "./initialState";

export const createMessageSlice: StateCreator<
  StudioStore,
  [],
  [],
  Pick<
    StudioStore,
    | keyof typeof initialMessageState
    | "setMessagesForSession"
    | "appendMessage"
    | "updateMessage"
    | "clearSessionMessages"
  >
> = (set) => ({
  ...initialMessageState,
  setMessagesForSession: (sessionId, messages) =>
    set((state) => ({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: messages,
      },
    })),
  appendMessage: (sessionId, message) =>
    set((state) => ({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: [...(state.messagesBySessionId[sessionId] ?? []), message],
      },
    })),
  updateMessage: (sessionId, messageId, updater) =>
    set((state) => ({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: (state.messagesBySessionId[sessionId] ?? []).map((message) =>
          message.id === messageId ? updater(message) : message,
        ),
      },
    })),
  clearSessionMessages: (sessionId) =>
    set((state) => ({
      messagesBySessionId: {
        ...state.messagesBySessionId,
        [sessionId]: [],
      },
    })),
});

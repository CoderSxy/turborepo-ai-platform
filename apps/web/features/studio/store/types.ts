import type { InkosCoreAction } from "@repo/inkos-adapter";
import type { NovelBookEntry } from "../state/studio-types";
import type { WriteChapterPipelineTimelineView } from "./pipeline-timeline-types";

export type ProgressPartStatus = "running" | "completed" | "error" | "paused";

export type StudioMessagePart =
  | { type: "text"; content: string }
  | {
      type: "progress";
      label: string;
      steps: Array<{ message: string; at: number }>;
      paused?: boolean;
      status?: ProgressPartStatus;
      startedAt?: string;
      completedAt?: string;
      summary?: string;
      pipelineTimeline?: WriteChapterPipelineTimelineView;
    }
  | {
      type: "tool";
      label: string;
      status: "running" | "completed" | "error";
      detail?: string;
    }
  | { type: "error"; title: string; detail: string; recovery?: string }
  | { type: "result"; title: string; content: string };

export type StudioMessage = {
  id: string;
  role: "user" | "assistant";
  parts: StudioMessagePart[];
  streaming?: boolean;
  status?: "sent" | "error";
  createdAt: string;
};

export type StudioBookRuntime = NovelBookEntry;

export type StudioTaskRuntime = {
  kind: "chat" | "core" | "batch";
  label: string;
  action?: InkosCoreAction;
  status: "running" | "paused" | "error";
  abortController: AbortController;
  taskId?: string;
  assistantMessageId?: string;
};

export type BookSliceState = {
  books: StudioBookRuntime[];
  activeBookId: string;
  activeChapterId: string;
  isLoading: boolean;
  error: string;
};

export type SessionSliceState = {
  activeSessionId: string;
  input: string;
  selectedModelValue: string;
};

export type MessageSliceState = {
  messagesBySessionId: Record<string, StudioMessage[]>;
};

export type TaskSliceState = {
  runningTask: StudioTaskRuntime | null;
};

export type StudioState = BookSliceState &
  SessionSliceState &
  MessageSliceState &
  TaskSliceState;

export type BookSliceActions = {
  hydrateFromSnapshot: (input: {
    books: StudioBookRuntime[];
    messagesBySessionId: Record<string, StudioMessage[]>;
    activeBookId?: string;
    activeSessionId?: string;
  }) => void;
  setBooks: (books: StudioBookRuntime[]) => void;
  patchBook: (
    bookId: string,
    patch:
      | Partial<StudioBookRuntime>
      | ((book: StudioBookRuntime) => StudioBookRuntime),
  ) => void;
  setActiveBook: (bookId: string) => void;
  setActiveChapter: (chapterId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string) => void;
};

export type SessionSliceActions = {
  setActiveSession: (sessionId: string) => void;
  setInput: (text: string) => void;
  setSelectedModel: (value: string) => void;
};

export type MessageSliceActions = {
  setMessagesForSession: (sessionId: string, messages: StudioMessage[]) => void;
  appendMessage: (sessionId: string, message: StudioMessage) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updater: (message: StudioMessage) => StudioMessage,
  ) => void;
  clearSessionMessages: (sessionId: string) => void;
};

export type TaskSliceActions = {
  startTask: (task: StudioTaskRuntime) => void;
  pauseTask: () => void;
  finishTask: () => void;
  abortTask: () => void;
};

export type StudioStore = StudioState &
  BookSliceActions &
  SessionSliceActions &
  MessageSliceActions &
  TaskSliceActions;

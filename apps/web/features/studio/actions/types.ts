import type { LocalModelSettings, ModelCallLog } from "../../../lib/model-settings";
import type {
  NovelChapterWriteTarget,
  NovelContextSelection,
  StoredNovelChapter,
  StoredNovelTask,
} from "../../../lib/novel-store";
import type { ReadyModelBinding } from "../state/studio-types";
import type { StudioStore } from "../store/types";

export type StudioAction =
  | { type: "send-message"; text: string }
  | { type: "write-chapter" }
  | { type: "review" }
  | { type: "revise-chapter"; selectedIssueIds?: string[] }
  | { type: "abort-task" };

export type StudioActionContext = {
  getState: () => StudioStore;
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
  notify: (message: string, tone: "success" | "warning" | "error") => void;
  trackModelCall: (
    binding: ReadyModelBinding,
    label: string,
    status: ModelCallLog["status"],
    startedAt: string,
    endedAt: string,
    options?: { latencyMs?: number; errorMessage?: string },
  ) => void;
  refreshWorkspace: () => Promise<void>;
  confirmWriteChapter?: (
    opts: unknown,
  ) => Promise<NovelContextSelection | null>;
};

export type RunCoreActionOptions = {
  targetChapter?: NovelChapterWriteTarget;
  targetStoredChapter?: StoredNovelChapter;
  selectedIssueIds?: string[];
  existingTaskId?: string;
  resumeTask?: StoredNovelTask;
  labelOverride?: string;
  contextSelectionOverride?: NovelContextSelection;
};

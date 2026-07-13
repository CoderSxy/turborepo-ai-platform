import type { LocalModelSettings, ModelCallLog } from "../../../lib/model-settings";
import type {
  NovelChapterWriteTarget,
  NovelContextSelection,
  StoredNovelChapter,
  StoredNovelTask,
} from "../../../lib/novel-store";
import type { ReadyModelBinding } from "../state/studio-types";
import type { StudioStore } from "../store/types";

export type StudioActionSource =
  | "composer"
  | "quick-action"
  | "chapter-panel"
  | "advanced"
  | "retry"
  | "batch";

export type WriteChapterConfirmInput = {
  target: NovelChapterWriteTarget;
  initialSelection: NovelContextSelection;
  derivedStyleConstraints: string;
};

export type WriteChapterRequest = {
  target: NovelChapterWriteTarget;
  contextSelection: NovelContextSelection;
  source: StudioActionSource;
};

export type StudioAction =
  | { type: "send-message"; text: string; source?: StudioActionSource }
  | {
      type: "write-chapter";
      source: StudioActionSource;
      target?: NovelChapterWriteTarget;
      contextSelection?: NovelContextSelection;
    }
  | { type: "review"; source?: StudioActionSource }
  | {
      type: "revise-chapter";
      selectedIssueIds?: string[];
      source?: StudioActionSource;
    }
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
  requestWriteChapterConfirm?: (
    input: WriteChapterConfirmInput,
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

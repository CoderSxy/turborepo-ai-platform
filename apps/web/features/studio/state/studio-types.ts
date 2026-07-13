import type {
  InkosCoreAction,
  InkosNovelProject,
  InkosProjectAssetsPatch,
} from "@repo/inkos-adapter";
import type { LocalModelProvider } from "../../../lib/model-settings";
import type {
  NovelProjectAssets,
  StoredNovelChapter,
  StoredNovelTask,
} from "../../../lib/novel-store";

export type NovelChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "sent" | "error";
  streaming?: boolean;
};

export type NovelChatResponse = {
  ok: boolean;
  status: "success" | "error" | "unsupported";
  message: string;
  content?: string;
  latencyMs?: number;
};

export type InkosActionResponse = {
  ok: boolean;
  action: InkosCoreAction;
  message: string;
  content?: string;
  project?: InkosNovelProject;
  assetsPatch?: InkosProjectAssetsPatch;
};

export type InkosActionStreamEvent =
  | {
      type: "progress";
      stage: string;
      message: string;
    }
  | {
      type: "result";
      result: InkosActionResponse;
    }
  | {
      type: "error";
      message: string;
    };

export type ModelPickerGroup = {
  service: string;
  label: string;
  models: Array<{ id: string; name: string }>;
};

export type AppDialogState =
  | {
      kind: "prompt";
      title: string;
      message?: string;
      initialValue?: string;
      multiline?: boolean;
      confirmLabel?: string;
    }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
    }
  | {
      kind: "alert";
      title: string;
      message: string;
      confirmLabel?: string;
    };

export type AppToastState = {
  id: number;
  message: string;
  tone: "success" | "warning" | "error";
};

export type NovelTool =
  | "AI创作"
  | "题材"
  | "文风"
  | "导入"
  | "市场雷达"
  | "环境诊断";

export type NovelBookEntry = {
  id: string;
  title: string;
  meta: string;
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  archived: boolean;
  sortIndex: number;
  chapters: StoredNovelChapter[];
  tasks: StoredNovelTask[];
  sessions: Array<{
    id: string;
    title: string;
    summary: string;
    age: string;
  }>;
};

export type ReadyModelBinding = {
  provider: LocalModelProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  routeKey: string;
};

export type ModelBindingError = { error: string };

export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string };

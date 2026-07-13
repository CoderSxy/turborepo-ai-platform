import {
  createDemoInkosProject,
  type InkosNovelProject,
} from "@repo/inkos-adapter";
import {
  formatNovelRelativeAge,
  type NovelChapterWriteTarget,
  type NovelKnowledgeAssetCategory,
  type NovelPendingAssetDelta,
  type NovelWorkspaceSnapshot,
  type StoredNovelBook,
  type StoredNovelChapter,
  type StoredNovelMessage,
  type StoredNovelSession,
  type StoredNovelTask,
} from "../../../lib/novel-store";
import type { NovelBookEntry, NovelChatMessage } from "../state/studio-types";
import type { StudioMessage } from "../store/types";

const KNOWLEDGE_ASSET_LABELS: Record<NovelKnowledgeAssetCategory, string> = {
  world: "世界观",
  character: "角色",
  foreshadowing: "伏笔",
  location: "地点",
  faction: "势力",
  item: "物品",
  term: "术语",
};

export function toNovelBookEntries(
  books: StoredNovelBook[],
  sessionsByBookId: Record<string, StoredNovelSession[]>,
  chaptersByBookId: Record<string, StoredNovelChapter[]>,
  tasksByBookId: Record<string, StoredNovelTask[]>,
): NovelBookEntry[] {
  return books.map((book) => ({
    id: book.id,
    title: book.title,
    meta: book.genre,
    project: book.project,
    assets: book.assets,
    archived: book.archived,
    sortIndex: book.sortIndex,
    chapters: chaptersByBookId[book.id] ?? [],
    tasks: tasksByBookId[book.id] ?? [],
    sessions: (sessionsByBookId[book.id] ?? []).map((session) => ({
      id: session.id,
      title: session.title,
      summary: session.summary,
      age: formatNovelRelativeAge(session.updatedAt),
    })),
  }));
}

export function toNovelMessagesBySession(
  messagesBySessionId: NovelWorkspaceSnapshot["messagesBySessionId"],
): Record<string, NovelChatMessage[]> {
  return Object.fromEntries(
    Object.entries(messagesBySessionId).map(([sessionId, messages]) => [
      sessionId,
      messages.map((message) => toNovelChatMessage(message)),
    ]),
  );
}

export function toNovelChatMessage(message: StoredNovelMessage): NovelChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
  };
}

export function createWelcomeNovelMessages(sessionId: string): StudioMessage[] {
  return [
    {
      id: `assistant-welcome-${sessionId}`,
      role: "assistant",
      parts: [
        {
          type: "text",
          content:
            "告诉我你想写什么：题材、世界观、主角、核心冲突，或者直接让我写下一章。我会按 InkOS 的创作流程帮你推进。",
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
}

export function createNovelProject(input: {
  title: string;
  genre: string;
  premise: string;
}): InkosNovelProject {
  const demo = createDemoInkosProject();
  const title = input.title.trim();
  const genre = input.genre.trim() || "未设定题材";
  const premise = input.premise.trim();

  return {
    ...demo,
    title,
    genre,
    premise: premise || "等待补充核心设定。",
    protagonist: "等待补充主角设定。",
    world: "等待补充世界观设定。",
    chapters: [],
    currentStage: "foundation",
  };
}

export function extractGeneratedChapter(input: {
  bookId: string;
  content: string;
  project: InkosNovelProject;
  target?: NovelChapterWriteTarget;
}): {
  bookId: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  status: StoredNovelChapter["status"];
  wordCount: number;
} | null {
  const latestChapter =
    input.project.chapters.find(
      (chapter) => chapter.number === input.target?.number,
    ) ??
    [...input.project.chapters].sort(
      (left, right) => right.number - left.number,
    )[0];

  if (!latestChapter && !input.target) {
    return null;
  }

  const rawContent = input.content.trim();
  const headingMatch = rawContent.match(/^#\s+(.+)$/m);
  const title =
    headingMatch?.[1]?.trim() ||
    latestChapter?.title ||
    input.target?.title ||
    "未命名章节";
  const withoutTitle = rawContent.replace(/^#\s+.+\n*/m, "").trim();
  const [bodySection = "", summaryAndRest = ""] = withoutTitle.split(
    /\n##\s+章节摘要\s*\n/,
  );
  const summary =
    summaryAndRest.split(/\n##\s+/)[0]?.trim() ||
    latestChapter?.focus ||
    input.target?.focus ||
    "";
  const chapterContent = bodySection.trim();

  if (!chapterContent) {
    return null;
  }

  return {
    bookId: input.bookId,
    number: latestChapter?.number ?? input.target!.number,
    title,
    content: chapterContent,
    summary,
    status:
      latestChapter?.status && latestChapter.status !== "planned"
        ? latestChapter.status
        : "ready-for-review",
    wordCount: countNovelContentWords(chapterContent),
  };
}

export function countNovelContentWords(content: string): number {
  const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords =
    content
      .replace(/[\u4e00-\u9fff]/g, " ")
      .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;

  return chineseChars + latinWords;
}

export function extractRevisedChapterContent(content: string): string {
  const withoutHeading = content.replace(/^#\s+.+\n*/m, "").trim();
  const [body = ""] = withoutHeading.split(/\n##\s+已处理问题\s*\n/);

  return body.trim() || content.trim();
}

export function reviewSeverityLabel(severity: "info" | "warning" | "error") {
  if (severity === "error") return "严重";
  if (severity === "warning") return "警告";
  return "建议";
}

export function isNovelKnowledgeAssetCategory(
  value: string,
): value is NovelKnowledgeAssetCategory {
  return Object.keys(KNOWLEDGE_ASSET_LABELS).includes(value);
}

export function formatPendingCharacterStates(
  states: NovelPendingAssetDelta["characterStates"],
) {
  return states.map((state) => `${state.title}：${state.content}`).join("\n");
}

export function parsePendingCharacterStates(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", ...rest] = line.split(/[：:]/);

      return {
        title: title.trim() || "未命名角色",
        content: rest.join("：").trim() || line,
      };
    });
}

export function formatPendingAssetLines(items: string[]) {
  return items.join("\n");
}

export function parsePendingAssetLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

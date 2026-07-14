import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  commitWriteChapterResult,
  countNovelWords,
  type CommitWriteChapterResultInput,
  type NovelProjectAssets,
  type StoredNovelBook,
  type StoredNovelChapter,
  type StoredNovelChapterVersion,
  type StoredNovelMessage,
  type StoredNovelTask,
} from "#lib/novel-store";
import { buildFinalAssistantParts, flattenPartsToContent } from "#studio/parts-builder";
import type { StudioMessage } from "../../store/types";

export function preallocateWriteChapterIds(
  bookId: string,
  chapterNumber: number,
  taskId: string,
): { chapterId: string; chapterVersionId: string } {
  const chapterId = `${bookId}-chapter-${String(chapterNumber).padStart(4, "0")}`;
  const suffix = taskId.replace(/[^a-zA-Z0-9]/g, "");

  return {
    chapterId,
    chapterVersionId: `${chapterId}-version-generation-${suffix}`,
  };
}

export function assertCanCommitWriteChapter(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}

export function buildInMemoryStoredChapter(input: {
  generatedChapter: {
    bookId: string;
    number: number;
    title: string;
    content: string;
    summary: string;
    status: StoredNovelChapter["status"];
    wordCount: number;
  };
  chapterId: string;
  existingChapter?: StoredNovelChapter | null;
  summaryOverride?: string;
  now: string;
}): StoredNovelChapter {
  const { generatedChapter, chapterId, existingChapter, summaryOverride, now } =
    input;

  return {
    id: chapterId,
    bookId: generatedChapter.bookId,
    number: generatedChapter.number,
    title: generatedChapter.title,
    content: generatedChapter.content,
    summary: summaryOverride ?? generatedChapter.summary,
    status: generatedChapter.status,
    wordCount:
      generatedChapter.wordCount ?? countNovelWords(generatedChapter.content),
    reviewNotes: existingChapter?.reviewNotes ?? "",
    reviews: existingChapter?.reviews ?? [],
    activeReviewId: existingChapter?.activeReviewId,
    publicationStatus: existingChapter?.publicationStatus ?? "draft",
    publishedAt: existingChapter?.publishedAt,
    createdAt: existingChapter?.createdAt ?? now,
    updatedAt: now,
  };
}

export function buildInMemoryChapterVersion(input: {
  chapter: StoredNovelChapter;
  chapterVersionId: string;
  now: string;
  versionNote?: string;
}): StoredNovelChapterVersion {
  const { chapter, chapterVersionId, now, versionNote } = input;

  return {
    id: chapterVersionId,
    chapterId: chapter.id,
    bookId: chapter.bookId,
    number: chapter.number,
    title: chapter.title,
    content: chapter.content,
    summary: chapter.summary,
    status: chapter.status,
    wordCount: chapter.wordCount,
    reviewNotes: chapter.reviewNotes,
    reviews: chapter.reviews,
    reviewId: chapter.activeReviewId,
    source: "generation",
    note: versionNote ?? "InkOS WriterAgent 生成章节",
    createdAt: now,
  };
}

export function buildCompletedWriteChapterTask(input: {
  task: StoredNovelTask;
  storedChapter: StoredNovelChapter;
  progressMessages: string[];
  now: string;
  status?: Extract<StoredNovelTask["status"], "success" | "completed_with_attention">;
  pipelineSummary?: string;
  syncId?: string;
  chapterVersionId?: string;
  auditId?: string;
  pipelineStage?: StoredNovelTask["pipelineStage"];
}): StoredNovelTask {
  const {
    task,
    storedChapter,
    progressMessages,
    now,
    status = "success",
    pipelineSummary,
    syncId,
    chapterVersionId,
    auditId,
    pipelineStage,
  } = input;
  const seenMessages = new Set(task.logs.map((log) => log.message));
  const progressLogs = progressMessages
    .filter((message) => !seenMessages.has(message))
    .map((message, index) => ({
      id: `${task.id}-progress-${task.logs.length + index + 1}`,
      message,
      createdAt: now,
    }));
  const completionMessage =
    status === "completed_with_attention"
      ? pipelineSummary || "任务完成（需关注）。"
      : "任务完成。";

  return {
    ...task,
    status,
    endedAt: now,
    targetChapterId: storedChapter.id,
    targetChapterNumber: storedChapter.number,
    targetChapterTitle: storedChapter.title,
    syncId,
    chapterVersionId,
    auditId,
    pipelineStage: pipelineStage ?? "completed",
    logs: [
      ...task.logs,
      ...progressLogs,
      {
        id: `${task.id}-complete-${now.replace(/[^0-9]/g, "")}`,
        message: completionMessage,
        createdAt: now,
      },
    ],
  };
}

export function buildFinalWriteChapterAssistantMessage(input: {
  assistantMessageId: string;
  sessionId: string;
  label: string;
  progressMessages: string[];
  resultContent: string;
  completionSummary: string;
  startedAt: string;
  now: string;
}): { stored: StoredNovelMessage; studio: StudioMessage } {
  const studioMessage: StudioMessage = {
    id: input.assistantMessageId,
    role: "assistant",
    parts: buildFinalAssistantParts(
      input.label,
      input.progressMessages,
      input.resultContent,
      {
        startedAt: input.startedAt,
        summary: input.completionSummary,
      },
    ),
    createdAt: input.now,
  };

  return {
    studio: studioMessage,
    stored: {
      id: input.assistantMessageId,
      sessionId: input.sessionId,
      role: "assistant",
      content: flattenPartsToContent(studioMessage.parts),
      createdAt: input.now,
      status: "sent",
    },
  };
}

export type WriteChapterBookSnapshot = {
  id: string;
  archived: boolean;
  sortIndex: number;
  createdAt?: string;
};

export type BuildWriteChapterCommitInputArgs = {
  bookSnapshot: WriteChapterBookSnapshot;
  nextProject: InkosNovelProject;
  nextAssets: NovelProjectAssets;
  storedChapter: StoredNovelChapter;
  chapterVersion: StoredNovelChapterVersion;
  runningTask: StoredNovelTask;
  sessionId: string;
  label: string;
  assistantMessageId: string;
  progressMessages: string[];
  resultContent: string;
  completionSummary: string;
  startedAt: string;
  now: string;
};

export function buildWriteChapterCommitInput(
  args: BuildWriteChapterCommitInputArgs & {
    taskStatus?: Extract<StoredNovelTask["status"], "success" | "completed_with_attention">;
    pipelineSummary?: string;
    syncId?: string;
    chapterVersionId?: string;
    auditId?: string;
    pipelineStage?: StoredNovelTask["pipelineStage"];
  },
): CommitWriteChapterResultInput {
  const book: StoredNovelBook = {
    id: args.bookSnapshot.id,
    title: args.nextProject.title,
    genre: args.nextProject.genre,
    premise: args.nextProject.premise,
    project: args.nextProject,
    assets: args.nextAssets,
    archived: args.bookSnapshot.archived,
    sortIndex: args.bookSnapshot.sortIndex,
    createdAt: args.bookSnapshot.createdAt ?? args.now,
    updatedAt: args.now,
  };

  return {
    bookId: args.bookSnapshot.id,
    book,
    finalChapter: args.storedChapter,
    finalChapterVersion: args.chapterVersion,
    completedTask: buildCompletedWriteChapterTask({
      task: args.runningTask,
      storedChapter: args.storedChapter,
      progressMessages: args.progressMessages,
      now: args.now,
      status: args.taskStatus,
      pipelineSummary: args.pipelineSummary,
      syncId: args.syncId,
      chapterVersionId: args.chapterVersionId,
      auditId: args.auditId,
      pipelineStage: args.pipelineStage,
    }),
    finalAssistantMessage: buildFinalWriteChapterAssistantMessage({
      assistantMessageId: args.assistantMessageId,
      sessionId: args.sessionId,
      label: args.label,
      progressMessages: args.progressMessages,
      resultContent: args.resultContent,
      completionSummary: args.completionSummary,
      startedAt: args.startedAt,
      now: args.now,
    }).stored,
  };
}

export async function commitWriteChapterResultForStudio(
  input: CommitWriteChapterResultInput,
): Promise<void> {
  await commitWriteChapterResult(input);
}

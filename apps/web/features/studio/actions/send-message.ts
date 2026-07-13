import { appendStoredNovelMessage } from "../../../lib/novel-store";
import { toStoredMessage } from "../persistence/message-bridge";
import { getStudioTaskGuard } from "./runtime/task-guard";
import { studioMessagesToChatMessages } from "./runtime/message-parts";
import type { StudioActionContext } from "./types";
import { streamNovelChat } from "../helpers/inkos-stream";
import { resolveChatModelBinding } from "../helpers/model-binding";
import {
  buildTextPart,
  updateTextPartContent,
} from "../store/slices/message/parts-builder";
import type { StudioMessage } from "../store/types";

async function persistMessage(sessionId: string, message: StudioMessage) {
  const stored = toStoredMessage(message, sessionId);
  await appendStoredNovelMessage(sessionId, {
    id: stored.id,
    role: stored.role,
    content: stored.content,
    status: stored.status,
  });
}

export async function sendMessage(
  ctx: StudioActionContext,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  const store = ctx.getState();
  const guard = getStudioTaskGuard(store.runningTask);

  if (!trimmed) {
    return;
  }

  if (!guard.canStart) {
    ctx.notify(guard.message, "warning");
    return;
  }

  const requestSessionId = store.activeSessionId;
  if (!requestSessionId) {
    ctx.notify("请先创建或选择一个会话。", "warning");
    return;
  }

  const userMessage: StudioMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    parts: [buildTextPart(trimmed)],
    createdAt: new Date().toISOString(),
  };
  const assistantMessageId = `assistant-stream-${Date.now()}`;
  const pendingAssistantMessage: StudioMessage = {
    id: assistantMessageId,
    role: "assistant",
    parts: [buildTextPart("InkOS 正在组织回应...")],
    streaming: true,
    createdAt: new Date().toISOString(),
  };
  const sessionMessages = store.messagesBySessionId[requestSessionId] ?? [];
  const nextMessages = [...sessionMessages, userMessage];
  const visibleMessages = [...nextMessages, pendingAssistantMessage];

  store.setMessagesForSession(requestSessionId, visibleMessages);
  store.setInput("");
  const abortController = new AbortController();
  store.startTask({
    kind: "chat",
    label: "聊天回复",
    status: "running",
    abortController,
    assistantMessageId,
  });
  const startedAt = new Date().toISOString();

  try {
    await persistMessage(requestSessionId, userMessage);

    const bindingResult = resolveChatModelBinding(
      ctx.settings,
      store.selectedModelValue,
    );
    if ("error" in bindingResult) {
      throw new Error(bindingResult.error);
    }

    const activeBook =
      store.books.find((book) => book.id === store.activeBookId) ?? null;
    const project = activeBook?.project ?? null;

    if (!project) {
      throw new Error("请先创建一本书籍。");
    }

    let streamedContent = "";
    const updateStreamingMessage = (content: string) => {
      streamedContent = content;
      store.updateMessage(requestSessionId, assistantMessageId, (message) => ({
        ...message,
        parts: message.parts.map((part) =>
          part.type === "text" ? updateTextPartContent(part, content) : part,
        ),
        streaming: true,
      }));
    };

    const content = await streamNovelChat(
      bindingResult.provider,
      bindingResult.model,
      studioMessagesToChatMessages(nextMessages),
      project,
      updateStreamingMessage,
      abortController.signal,
      {
        temperature: bindingResult.temperature,
        maxTokens: bindingResult.maxTokens,
      },
    );

    const assistantMessage: StudioMessage = {
      id: assistantMessageId,
      role: "assistant",
      parts: [
        buildTextPart(content || streamedContent || "模型返回为空。"),
      ],
      createdAt: new Date().toISOString(),
    };

    await persistMessage(requestSessionId, assistantMessage);
    ctx.trackModelCall(
      bindingResult,
      "聊天回复",
      "success",
      startedAt,
      new Date().toISOString(),
      { latencyMs: Date.now() - Date.parse(startedAt) },
    );

    store.updateMessage(requestSessionId, assistantMessageId, () => assistantMessage);
  } catch (error) {
    const isAbortError =
      error instanceof DOMException && error.name === "AbortError";
    const bindingResult = resolveChatModelBinding(
      ctx.settings,
      store.selectedModelValue,
    );
    if (!("error" in bindingResult)) {
      ctx.trackModelCall(
        bindingResult,
        "聊天回复",
        isAbortError ? "cancelled" : "error",
        startedAt,
        new Date().toISOString(),
        {
          latencyMs: Date.now() - Date.parse(startedAt),
          errorMessage:
            error instanceof Error ? error.message : "模型请求失败。",
        },
      );
    }
    const assistantMessage: StudioMessage = {
      id: assistantMessageId,
      role: "assistant",
      status: isAbortError ? "sent" : "error",
      parts: [
        buildTextPart(
          isAbortError
            ? "任务已取消。"
            : error instanceof Error
              ? error.message
              : "模型请求失败，请检查模型配置。",
        ),
      ],
      createdAt: new Date().toISOString(),
    };

    if (requestSessionId) {
      await persistMessage(requestSessionId, assistantMessage).catch(
        () => undefined,
      );
    }

    store.updateMessage(requestSessionId, assistantMessageId, () => assistantMessage);
  } finally {
    store.finishTask();
  }
}

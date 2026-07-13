import type { StoredNovelMessage } from "../../../lib/novel-store";
import type { StudioMessage } from "../store/types";
import {
  flattenPartsToContent,
  isLegacyCoreMarkdown,
} from "#studio/parts-builder";

export function fromStoredMessage(stored: StoredNovelMessage): StudioMessage {
  return {
    id: stored.id,
    role: stored.role,
    parts: [{ type: "text", content: stored.content }],
    status: stored.status,
    createdAt: stored.createdAt,
  };
}

export function toStoredMessage(
  message: StudioMessage,
  sessionId: string,
): StoredNovelMessage {
  return {
    id: message.id,
    sessionId,
    role: message.role,
    content: flattenPartsToContent(message.parts),
    createdAt: message.createdAt,
    status: message.status,
  };
}

export function fromStoredMessagesBySession(
  messagesBySessionId: Record<string, StoredNovelMessage[]>,
): Record<string, StudioMessage[]> {
  return Object.fromEntries(
    Object.entries(messagesBySessionId).map(([sessionId, messages]) => [
      sessionId,
      messages.map(fromStoredMessage),
    ]),
  );
}

export { isLegacyCoreMarkdown };

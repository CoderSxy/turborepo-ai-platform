import type { StoredNovelMessage } from "../../../lib/novel-store";
import type { StudioMessage, StudioMessagePart } from "../store/types";
import {
  flattenPartsToContent,
  isLegacyCoreMarkdown,
} from "#studio/parts-builder";

function hasStructuredParts(parts: StudioMessagePart[]): boolean {
  return parts.some((part) => part.type !== "text");
}

export function fromStoredMessage(stored: StoredNovelMessage): StudioMessage {
  if (stored.parts?.length) {
    return {
      id: stored.id,
      role: stored.role,
      parts: stored.parts as StudioMessagePart[],
      status: stored.status,
      createdAt: stored.createdAt,
    };
  }

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
    ...(hasStructuredParts(message.parts)
      ? { parts: message.parts as StoredNovelMessage["parts"] }
      : {}),
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

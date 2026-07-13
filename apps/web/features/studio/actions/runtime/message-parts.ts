import type { NovelChatMessage } from "../../state/studio-types";
import type { StudioMessage } from "../../store/types";
import {
  flattenPartsToContent,
  isLegacyCoreMarkdown,
} from "../../store/slices/message/parts-builder";

export { flattenPartsToContent, isLegacyCoreMarkdown };

export function studioMessagesToChatMessages(
  messages: StudioMessage[],
): NovelChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: flattenPartsToContent(message.parts),
    status: message.status,
    streaming: message.streaming,
  }));
}

export function getMessageTextContent(message: StudioMessage): string {
  const textPart = message.parts.find((part) => part.type === "text");
  if (textPart?.type === "text") {
    return textPart.content;
  }

  return flattenPartsToContent(message.parts);
}

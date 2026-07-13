"use client";

import type { StudioMessagePart } from "../../store/types";
import { isLegacyCoreMarkdown } from "../../actions/runtime/message-parts";
import { isMeaningfulToolPart } from "../../store/slices/message/parts-builder";
import { MarkdownContent } from "./MarkdownContent";
import { ProgressSteps } from "./ProgressSteps";
import styles from "../../studio.module.css";

export function MessagePartRenderer({
  part,
  siblingParts = [],
}: {
  part: StudioMessagePart;
  siblingParts?: StudioMessagePart[];
}) {
  switch (part.type) {
    case "text":
      if (isLegacyCoreMarkdown(part.content)) {
        return <MarkdownContent content={part.content} />;
      }
      return <MarkdownContent content={part.content} />;
    case "progress":
      return <ProgressSteps part={part} siblingParts={siblingParts} />;
    case "result":
      return (
        <div className={styles.resultBlock}>
          <strong>{part.title}</strong>
          <MarkdownContent content={part.content} />
        </div>
      );
    case "error":
      return (
        <div className={styles.errorBlock}>
          <strong>{part.title}</strong>
          <p>{part.detail}</p>
          {part.recovery ? <p>{part.recovery}</p> : null}
        </div>
      );
    case "tool":
      if (!isMeaningfulToolPart(part)) {
        return null;
      }
      return (
        <div className={styles.toolBlock}>
          <span>{part.label}</span>
          {part.detail ? <pre>{part.detail}</pre> : null}
        </div>
      );
    default:
      return null;
  }
}

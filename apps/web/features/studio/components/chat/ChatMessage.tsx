"use client";

import type { StudioMessage } from "../../store/types";
import { MessagePartRenderer } from "./MessagePartRenderer";
import styles from "../../studio.module.css";

export function ChatMessage({ message }: { message: StudioMessage }) {
  return (
    <article
      className={
        message.status === "error"
          ? styles.errorMessage
          : message.role === "user"
            ? styles.userMessage
            : styles.assistantMessage
      }
    >
      <strong>{message.role === "user" ? "你" : "InkOS"}</strong>
      {message.parts.map((part, index) => (
        <MessagePartRenderer
          key={index}
          part={part}
          siblingParts={message.parts}
        />
      ))}
      {message.streaming ? (
        <span className={styles.typingIndicator}>
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </article>
  );
}

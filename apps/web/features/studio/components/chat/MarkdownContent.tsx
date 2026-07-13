"use client";

import { type ReactNode } from "react";
import styles from "../../studio.module.css";
import type { MarkdownBlock } from "../../state/studio-types";

export function MarkdownContent({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div
      className={
        compact
          ? `${styles.markdownContent} ${styles.markdownContentCompact}`
          : styles.markdownContent
      }
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${Math.min(block.level + 2, 5)}` as
            | "h3"
            | "h4"
            | "h5";

          return <HeadingTag key={index}>{renderInlineMarkdown(block.text)}</HeadingTag>;
        }

        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          return <pre key={index}>{block.code}</pre>;
        }

        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push({ type: "code", code: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      const headingMarks = headingMatch[1] ?? "";
      const headingText = headingMatch[2] ?? "";

      blocks.push({
        type: "heading",
        level: headingMarks.length,
        text: headingText,
      });
      index += 1;
      continue;
    }

    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length) {
        const item = (lines[index] ?? "").trim();
        const itemMatch = item.match(/^([-*]|\d+\.)\s+(.+)$/);

        if (!itemMatch) break;

        items.push(itemMatch[2] ?? "");
        index += 1;
      }

      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      const nextTrimmed = nextLine.trim();

      if (
        !nextTrimmed ||
        nextTrimmed.startsWith("```") ||
        /^(#{1,4})\s+/.test(nextTrimmed) ||
        /^([-*]|\d+\.)\s+/.test(nextTrimmed)
      ) {
        break;
      }

      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: content }];
}

export function renderInlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return part.split("\n").map((line, lineIndex, lineParts) => (
      <FragmentWithBreak
        key={`${index}-${lineIndex}`}
        line={line}
        showBreak={lineIndex < lineParts.length - 1}
      />
    ));
  });
}

export function FragmentWithBreak({
  line,
  showBreak,
}: {
  line: string;
  showBreak: boolean;
}) {
  return (
    <>
      {line}
      {showBreak ? <br /> : null}
    </>
  );
}

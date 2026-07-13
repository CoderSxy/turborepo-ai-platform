"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioMessage } from "../store/types";

const DEFAULT_THRESHOLD_PX = 80;

export function isMessageListNearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = DEFAULT_THRESHOLD_PX,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function getMessageListScrollToken(messages: StudioMessage[]): string {
  const last = messages.at(-1);
  if (!last) {
    return "0";
  }

  let contentLength = 0;
  for (const part of last.parts) {
    switch (part.type) {
      case "text":
        contentLength += part.content.length;
        break;
      case "result":
        contentLength += part.content.length;
        break;
      case "progress":
        contentLength += part.steps.length;
        contentLength += part.summary?.length ?? 0;
        break;
      default:
        break;
    }
  }

  return `${messages.length}:${last.id}:${last.streaming ? 1 : 0}:${contentLength}`;
}

export function useMessageListScroll(scrollToken: string | number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledAwayRef = useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const readNearBottom = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      return true;
    }
    return isMessageListNearBottom(
      element.scrollTop,
      element.scrollHeight,
      element.clientHeight,
    );
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    function handleScroll() {
      const nearBottom = readNearBottom();
      userScrolledAwayRef.current = !nearBottom;
      setShowJumpToLatest(!nearBottom);
    }

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [readNearBottom]);

  useEffect(() => {
    if (userScrolledAwayRef.current) {
      return;
    }

    const element = containerRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [scrollToken]);

  const scrollToLatest = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
    userScrolledAwayRef.current = false;
    setShowJumpToLatest(false);
  }, []);

  return {
    containerRef,
    showJumpToLatest,
    scrollToLatest,
  };
}

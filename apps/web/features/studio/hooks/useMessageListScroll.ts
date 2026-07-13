"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_THRESHOLD_PX = 80;

export function isMessageListNearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = DEFAULT_THRESHOLD_PX,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function useMessageListScroll(
  messageCount: number,
  isStreaming: boolean,
) {
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
  }, [messageCount, isStreaming]);

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

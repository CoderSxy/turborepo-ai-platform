"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

function getEnabledMenuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(
    menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
  ).filter((item) => !(item as HTMLButtonElement).disabled);
}

export function useBookTreeAnchoredMenu({
  open,
  onClose,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function placeMenu() {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 4;
      const viewportPadding = 8;

      let top = anchorRect.bottom + gap;
      if (top + menuRect.height > window.innerHeight - viewportPadding) {
        top = Math.max(
          viewportPadding,
          anchorRect.top - menuRect.height - gap,
        );
      }

      let left = anchorRect.right - menuRect.width;
      left = Math.min(
        Math.max(viewportPadding, left),
        window.innerWidth - menuRect.width - viewportPadding,
      );

      setStyle({
        position: "fixed",
        top,
        left,
        zIndex: 1000,
        visibility: "visible",
      });
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);

    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      const items = menuRef.current
        ? getEnabledMenuItems(menuRef.current)
        : [];
      items[0]?.focus();
    });

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      onCloseRef.current();
    }

    function handleKeyDown(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (!menu) {
        return;
      }

      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        (anchorRef.current ?? previouslyFocused)?.focus();
        return;
      }

      const items = getEnabledMenuItems(menu);
      if (items.length === 0) {
        return;
      }

      const activeIndex = items.indexOf(document.activeElement as HTMLElement);

      if (event.key === "ArrowDown") {
        event.stopPropagation();
        event.preventDefault();
        const next = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
        items[next]?.focus();
        return;
      }

      if (event.key === "ArrowUp") {
        event.stopPropagation();
        event.preventDefault();
        const next =
          activeIndex < 0
            ? items.length - 1
            : (activeIndex - 1 + items.length) % items.length;
        items[next]?.focus();
        return;
      }

      if (event.key === "Home") {
        event.stopPropagation();
        event.preventDefault();
        items[0]?.focus();
        return;
      }

      if (event.key === "End") {
        event.stopPropagation();
        event.preventDefault();
        items[items.length - 1]?.focus();
        return;
      }

      if (event.key === "Tab") {
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        (anchorRef.current ?? previouslyFocused)?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, anchorRef]);

  return { menuRef, style };
}

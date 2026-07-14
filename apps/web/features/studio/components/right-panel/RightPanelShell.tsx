"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  focusInitialElement,
  handleFocusTrapKeyDown,
} from "../../lib/focus-trap";
import styles from "../../studio.module.css";
import { useMediaQuery } from "./use-media-query";
import {
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  useRightPanelWidth,
} from "./use-right-panel-width";

const NARROW_PANEL_QUERY = "(max-width: 1024px)";

export function RightPanelShell({ children }: { children: ReactNode }) {
  const isNarrow = useMediaQuery(NARROW_PANEL_QUERY);
  const { width, setWidth, persistWidth } = useRightPanelWidth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragging = useRef(false);
  const widthRef = useRef(width);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!isNarrow) {
      setDrawerOpen(false);
    }
  }, [isNarrow]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    drawerTriggerRef.current = document.activeElement as HTMLElement | null;
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    if (!isNarrow || !drawerOpen) {
      return;
    }

    const focusRestoreTarget = toggleRef.current ?? drawerTriggerRef.current;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (drawerRef.current) {
        handleFocusTrapKeyDown(drawerRef.current, event);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    const frame = window.requestAnimationFrame(() => {
      if (drawerRef.current) {
        focusInitialElement(drawerRef.current);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      focusRestoreTarget?.focus();
    };
  }, [closeDrawer, drawerOpen, isNarrow]);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragging.current = true;
      const startX = event.clientX;
      const startWidth = widthRef.current;

      function onMove(moveEvent: MouseEvent) {
        if (!dragging.current) {
          return;
        }
        const delta = startX - moveEvent.clientX;
        const nextWidth = Math.min(
          RIGHT_PANEL_MAX_WIDTH,
          Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(startWidth + delta)),
        );
        widthRef.current = nextWidth;
        setWidth(nextWidth);
      }

      function onUp() {
        dragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        persistWidth(widthRef.current);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [persistWidth, setWidth],
  );

  const panelBody = (
    <div className={styles.rightPanelContent}>{children}</div>
  );

  if (isNarrow) {
    return (
      <div className={styles.rightPanelShellNarrowSlot}>
        <button
          ref={toggleRef}
          type="button"
          className={styles.rightPanelToggle}
          onClick={openDrawer}
          aria-expanded={drawerOpen}
          aria-controls="studio-right-panel-drawer"
        >
          上下文
        </button>
        {drawerOpen ? (
          <div
            className={styles.rightPanelDrawerOverlay}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeDrawer();
              }
            }}
          />
        ) : null}
        <aside
          ref={drawerRef}
          id="studio-right-panel-drawer"
          className={`${styles.rightPanelMobileMount} ${
            drawerOpen
              ? styles.rightPanelMobileMountOpen
              : styles.rightPanelMobileMountClosed
          }`}
          role={drawerOpen ? "dialog" : undefined}
          aria-modal={drawerOpen ? true : undefined}
          aria-label={drawerOpen ? "书籍上下文" : undefined}
          aria-hidden={!drawerOpen}
          tabIndex={drawerOpen ? -1 : undefined}
        >
          {drawerOpen ? (
            <header className={styles.rightPanelDrawerHeader}>
              <strong>书籍上下文</strong>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="关闭"
              >
                ×
              </button>
            </header>
          ) : null}
          {panelBody}
        </aside>
      </div>
    );
  }

  return (
    <div className={styles.rightPanelShell} style={{ width }}>
      <div
        className={styles.rightPanelResizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={RIGHT_PANEL_MIN_WIDTH}
        aria-valuemax={RIGHT_PANEL_MAX_WIDTH}
        aria-valuenow={width}
        aria-label="调整右栏宽度"
        onMouseDown={handleResizeStart}
      />
      {panelBody}
    </div>
  );
}

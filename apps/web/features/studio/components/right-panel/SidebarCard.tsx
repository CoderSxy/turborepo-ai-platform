"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import styles from "../../studio.module.css";

const STORAGE_KEY = "sxy-studio-sidebar-sections";

function loadSectionState(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSectionState(state: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function SidebarCard({
  id,
  title,
  defaultOpen = false,
  summary,
  actions,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  summary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const saved = loadSectionState();
    if (id in saved) {
      setOpen(saved[id]!);
    }
  }, [id]);

  const toggle = useCallback(() => {
    setOpen((previous) => {
      const next = !previous;
      saveSectionState({ ...loadSectionState(), [id]: next });
      return next;
    });
  }, [id]);

  return (
    <section className={styles.inkosSidebarCard}>
      <button
        type="button"
        className={styles.inkosSidebarCardHeader}
        onClick={toggle}
        aria-expanded={open}
        aria-label={summary ? `${title}，${summary}` : title}
      >
        <span className={styles.inkosSidebarCardChevron} aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <h2>{title}</h2>
        {!open && summary ? (
          <span className={styles.inkosSidebarCardSummary}>{summary}</span>
        ) : null}
        {actions}
      </button>
      {open ? (
        <div className={styles.inkosSidebarCardBody}>{children}</div>
      ) : null}
    </section>
  );
}

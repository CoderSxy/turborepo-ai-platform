"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import styles from "../../studio.module.css";

const STORAGE_KEY = "sxy-studio-sidebar-sections";

function loadSectionState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSectionState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
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
    setOpen((prev) => {
      const next = !prev;
      const saved = loadSectionState();
      saveSectionState({ ...saved, [id]: next });
      return next;
    });
  }, [id]);

  return (
    <section className={styles.collapsibleSection}>
      <button
        type="button"
        className={styles.collapsibleSectionHeader}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={styles.collapsibleSectionChevron}>
          {open ? "▼" : "▸"}
        </span>
        <h2>{title}</h2>
      </button>
      {open ? (
        <div className={styles.collapsibleSectionBody}>{children}</div>
      ) : null}
    </section>
  );
}

"use client";

import { useRef, useState, useEffect } from "react";
import styles from "../../studio.module.css";

export type MenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export type MenuGroup = {
  label: string;
  items: MenuItem[];
};

export function ComposerMoreMenu({
  groups,
  onOpenCloudSync,
}: {
  groups: MenuGroup[];
  onOpenCloudSync: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={styles.composerMoreMenu} ref={ref}>
      <button
        type="button"
        className={styles.composerMoreTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="更多操作"
      >
        ⋮
      </button>
      {open ? (
        <div className={styles.composerMoreDropdown}>
          {groups.map((group) => (
            <div key={group.label} className={styles.composerMoreGroup}>
              <span className={styles.composerMoreGroupLabel}>{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div className={styles.composerMoreGroup}>
            <span className={styles.composerMoreGroupLabel}>数据</span>
            <button
              type="button"
              onClick={() => {
                onOpenCloudSync();
                setOpen(false);
              }}
            >
              云同步设置
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

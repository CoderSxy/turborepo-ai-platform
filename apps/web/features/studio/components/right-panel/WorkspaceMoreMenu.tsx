"use client";

import type { ReactNode } from "react";
import styles from "../../studio.module.css";

export type WorkspaceMoreGroup = {
  id: string;
  title: string;
  children: ReactNode;
};

export function WorkspaceMoreMenu({ groups }: { groups: WorkspaceMoreGroup[] }) {
  return (
    <div className={styles.workspaceMoreMenu}>
      {groups.map((group) => (
        <section key={group.id} className={styles.workspaceMoreGroup}>
          <h3 className={styles.workspaceMoreGroupTitle}>{group.title}</h3>
          <div className={styles.workspaceMoreGroupBody}>{group.children}</div>
        </section>
      ))}
    </div>
  );
}

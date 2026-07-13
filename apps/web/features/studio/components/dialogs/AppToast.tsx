"use client";

import styles from "../../studio.module.css";
import type { AppToastState } from "../../state/studio-types";

export function AppToast({ toast }: { toast: AppToastState | null }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`${styles.toast} ${styles[`toast_${toast.tone}`]}`}>
      {toast.message}
    </div>
  );
}

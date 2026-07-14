"use client";

import type { ReactNode } from "react";
import styles from "../../../studio.module.css";
import type { CoreFileKey } from "../core-file-keys";
import { resolveDetailTitle } from "./detail-title";
import type { DetailTarget } from "./types";

export function BookContextDetailView({
  detailTarget,
  onBack,
  chapterContent,
  coreFileContent,
  characterContent,
  outlineContent,
  getCoreFileLabel,
}: {
  detailTarget: DetailTarget;
  onBack: () => void;
  chapterContent: ReactNode;
  coreFileContent: ReactNode;
  characterContent: ReactNode;
  outlineContent: ReactNode;
  getCoreFileLabel: (fileKey: CoreFileKey) => string;
}) {
  const body =
    detailTarget.type === "chapter"
      ? chapterContent
      : detailTarget.type === "core-file"
        ? coreFileContent
        : detailTarget.type === "character"
          ? characterContent
          : outlineContent;

  return (
    <div className={styles.bookContextDetailView}>
      <header className={styles.bookContextDetailHeader}>
        <button type="button" onClick={onBack}>
          ← 返回
        </button>
        <strong>
          {resolveDetailTitle(detailTarget, getCoreFileLabel)}
        </strong>
      </header>
      <div className={styles.bookContextDetailBody}>{body}</div>
    </div>
  );
}

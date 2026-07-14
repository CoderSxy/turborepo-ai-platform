"use client";

import { useEffect, useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../../lib/novel-store";
import { MarkdownContent } from "../../chat/MarkdownContent";
import styles from "../../../studio.module.css";
import { getCoreFileDefinition, type CoreFileKey } from "../core-file-keys";

export function CoreFileDetailView({
  fileKey,
  assets,
  project,
  onProjectChange,
}: {
  fileKey: CoreFileKey;
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    nextAssets?: NovelProjectAssets,
  ) => Promise<void>;
}) {
  const definition = getCoreFileDefinition(fileKey);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(definition.getContent(assets));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const definition = getCoreFileDefinition(fileKey);
    setDraft(definition.getContent(assets));
    setEditing(false);
  }, [assets, fileKey]);

  async function handleSave() {
    setSaving(true);
    try {
      await onProjectChange(project, definition.applySave(assets, draft));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.coreFileDetailView}>
      {!definition.readOnly ? (
        <div className={styles.coreFileDetailActions}>
          {editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)}>
                取消
              </button>
              <button
                type="button"
                className={styles.chapterEditorSaveButton}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "保存中" : "保存"}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)}>
              编辑
            </button>
          )}
        </div>
      ) : null}
      {editing ? (
        <textarea
          className={styles.coreFileDetailEditor}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <MarkdownContent content={draft || "暂无内容。"} />
      )}
    </div>
  );
}

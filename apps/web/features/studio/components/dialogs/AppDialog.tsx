"use client";

import styles from "../../studio.module.css";
import type { AppDialogState } from "../../state/studio-types";

export function AppDialog({
  dialog,
  inputValue,
  onCancel,
  onConfirm,
  onInputChange,
}: {
  dialog: AppDialogState | null;
  inputValue: string;
  onCancel: () => void;
  onConfirm: () => void;
  onInputChange: (value: string) => void;
}) {
  if (!dialog) {
    return null;
  }

  return (
    <div className={styles.dialogOverlay} role='presentation'>
      <section
        className={styles.appDialog}
        role={dialog.kind === "alert" ? "alertdialog" : "dialog"}
        aria-modal='true'
        aria-labelledby='app-dialog-title'
      >
        <header>
          <h2 id='app-dialog-title'>{dialog.title}</h2>
          {"message" in dialog && dialog.message ? <p>{dialog.message}</p> : null}
        </header>

        {dialog.kind === "prompt" ? (
          <label className={styles.dialogField}>
            <span>{dialog.multiline ? "内容" : "名称"}</span>
            {dialog.multiline ? (
              <textarea
                rows={6}
                value={inputValue}
                autoFocus
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    onConfirm();
                  }
                }}
              />
            ) : (
              <input
                value={inputValue}
                autoFocus
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onConfirm();
                  }
                }}
              />
            )}
            {dialog.multiline ? <em>⌘ / Ctrl + Enter 保存</em> : null}
          </label>
        ) : null}

        <footer>
          {dialog.kind !== "alert" ? (
            <button onClick={onCancel}>取消</button>
          ) : null}
          <button
            className={dialog.kind === "confirm" && dialog.danger ? styles.dangerButton : styles.primaryButton}
            onClick={onConfirm}
          >
            {dialog.confirmLabel ??
              (dialog.kind === "alert" ? "知道了" : "确认")}
          </button>
        </footer>
      </section>
    </div>
  );
}

"use client";

import { type ReactNode, type RefObject } from "react";
import styles from "../../studio.module.css";
import type { ModelPickerGroup } from "../../state/studio-types";
import type { StudioAction } from "../../actions/types";
import { QuickActions } from "./QuickActions";
import { ModelPicker } from "./ModelPicker";
import { ComposerMoreMenu, type MenuGroup } from "./ComposerMoreMenu";

export function ChatComposer({
  input,
  onInputChange,
  onSend,
  selectedModelValue,
  modelGroups,
  recentModels,
  onModelChange,
  onManageModels,
  disabled,
  canSend,
  onQuickAction,
  moreMenuGroups,
  onOpenCloudSync,
  composerInputRef,
  batchQueueBar,
  activeTaskBar,
  routeError,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  selectedModelValue: string;
  modelGroups: ModelPickerGroup[];
  recentModels: Array<{ providerId: string; model: string }>;
  onModelChange: (value: string) => void;
  onManageModels: () => void;
  disabled: boolean;
  canSend: boolean;
  onQuickAction: (action: StudioAction) => void;
  moreMenuGroups: MenuGroup[];
  onOpenCloudSync: () => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  batchQueueBar: ReactNode | null;
  activeTaskBar: ReactNode | null;
  routeError: string | undefined;
}) {
  return (
    <footer className={styles.chatComposer}>
      <QuickActions disabled={disabled} onAction={onQuickAction} />
      {batchQueueBar}
      {activeTaskBar}
      <textarea
        ref={composerInputRef}
        rows={3}
        value={input}
        placeholder="告诉我你想写什么，或输入：写下一章"
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            onSend();
          }
        }}
      />
      <div className={styles.composerMetaRow}>
        <div className={styles.modelPickerInline}>
          <span>模型</span>
          <ModelPicker
            value={selectedModelValue}
            groups={modelGroups}
            recentModels={recentModels}
            onManageModels={onManageModels}
            onValueChange={onModelChange}
          />
        </div>
        <div className={styles.sendControl}>
          <ComposerMoreMenu
            groups={moreMenuGroups}
            onOpenCloudSync={onOpenCloudSync}
          />
          <span>⌘ / Ctrl + Enter 发送</span>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!input.trim() || disabled || !canSend}
            onClick={onSend}
          >
            {disabled ? "处理中" : "发送"}
          </button>
        </div>
      </div>
      {routeError ? (
        <div className={styles.composerRouteError}>{routeError}</div>
      ) : null}
    </footer>
  );
}

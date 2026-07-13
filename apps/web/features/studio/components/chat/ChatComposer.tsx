"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import styles from "../../studio.module.css";
import type { ModelPickerGroup } from "../../state/studio-types";
import type { StudioAction } from "../../actions/types";
import { QuickActions } from "./QuickActions";
import { ModelPicker } from "./ModelPicker";
import { ComposerMoreMenu, type MenuGroup } from "./ComposerMoreMenu";

const TEXTAREA_MAX_HEIGHT_PX = 200;

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
  onWriteChapter,
  onOpenAdvancedOptions,
  onEditDefaultPreferences,
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
  onWriteChapter: () => void;
  onOpenAdvancedOptions: () => void;
  onEditDefaultPreferences: () => void;
  moreMenuGroups: MenuGroup[];
  onOpenCloudSync: () => void;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  batchQueueBar: ReactNode | null;
  activeTaskBar: ReactNode | null;
  routeError: string | undefined;
}) {
  useEffect(() => {
    const textarea = composerInputRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [composerInputRef, input]);

  function handleSendAttempt() {
    if (!input.trim() || disabled || !canSend) {
      return;
    }
    onSend();
  }

  return (
    <footer className={styles.chatComposer}>
      <QuickActions
        disabled={disabled}
        onAction={onQuickAction}
        onWriteChapter={onWriteChapter}
        onOpenAdvancedOptions={onOpenAdvancedOptions}
        onEditDefaultPreferences={onEditDefaultPreferences}
      />
      <textarea
        ref={composerInputRef}
        rows={3}
        value={input}
        placeholder="告诉我你想写什么，或输入：写下一章"
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return;
          }

          const isEnter = event.key === "Enter";
          const isModifierEnter =
            isEnter && (event.metaKey || event.ctrlKey);
          const isPlainEnter = isEnter && !event.shiftKey && !event.metaKey && !event.ctrlKey;

          if (isPlainEnter || isModifierEnter) {
            event.preventDefault();
            handleSendAttempt();
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
          <span>Enter 发送 · Shift+Enter 换行</span>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!input.trim() || disabled || !canSend}
            onClick={handleSendAttempt}
          >
            {disabled ? "处理中" : "发送"}
          </button>
        </div>
      </div>
      {batchQueueBar}
      {activeTaskBar}
      {routeError ? (
        <div className={styles.composerRouteError}>{routeError}</div>
      ) : null}
    </footer>
  );
}

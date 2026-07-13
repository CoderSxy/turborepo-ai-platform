"use client";

import { useEffect, useState } from "react";
import {
  buildDefaultNovelContextSelection,
  type NovelChapterWriteTarget,
  type NovelContextSelection,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function WriteChapterConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: {
    target: NovelChapterWriteTarget;
    initialSelection: NovelContextSelection;
    derivedStyleConstraints: string;
  } | null;
  onCancel: () => void;
  onConfirm: (selection: NovelContextSelection) => void;
}) {
  const [selection, setSelection] = useState<NovelContextSelection>(
    state?.initialSelection ?? buildDefaultNovelContextSelection({ chapterWordCount: 3000 }),
  );

  useEffect(() => {
    if (state) {
      setSelection({ ...state.initialSelection });
    }
  }, [state]);

  if (!state) {
    return null;
  }

  const contextOptions = [
    ["includeOutline", "章节计划 / 大纲"],
    ["includePreviousSummary", "上一章摘要"],
    ["includeWorld", "世界观"],
    ["includeCharacters", "角色状态"],
    ["includeForeshadowing", "伏笔池"],
    ["includeReviewIssues", "审稿遗留问题"],
  ] as const;

  return (
    <div className={styles.dialogOverlay} role='presentation'>
      <section
        className={`${styles.appDialog} ${styles.writeChapterConfirmDialog}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby='write-chapter-confirm-title'
      >
        <header>
          <h2 id='write-chapter-confirm-title'>写下一章确认</h2>
          <p>
            第 {state.target.number} 章《{state.target.title}》 ·{" "}
            {state.target.focus}
          </p>
        </header>

        <div className={styles.writeChapterConfirmBody}>
          <section>
            <strong>带入上下文</strong>
            <div className={styles.contextSelectorGrid}>
              {contextOptions.map(([key, label]) => (
                <label key={key}>
                  <input
                    type='checkbox'
                    checked={Boolean(selection[key])}
                    onChange={(event) =>
                      setSelection((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <section className={styles.writeChapterConfirmFields}>
            <label>
              目标字数
              <input
                type='number'
                min={500}
                value={selection.targetWords ?? state.target.targetWords}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    targetWords: Math.max(500, Number(event.target.value) || 3000),
                  }))
                }
              />
            </label>
            <label>
              视角
              <input
                value={selection.viewpoint}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    viewpoint: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              节奏
              <input
                value={selection.pacing}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    pacing: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              本章高亮要求
              <textarea
                rows={2}
                value={selection.highlights}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    highlights: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              读者爽点 / 悬疑点
              <textarea
                rows={2}
                value={selection.thrillPoints ?? ""}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    thrillPoints: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              禁用词 / 避免表达
              <textarea
                rows={2}
                value={selection.bannedWords ?? ""}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    bannedWords: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              额外风格约束
              <textarea
                rows={3}
                value={selection.styleConstraints ?? ""}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    styleConstraints: event.target.value,
                  }))
                }
                placeholder={
                  state.derivedStyleConstraints ||
                  "可补充本章额外风格要求"
                }
              />
            </label>
          </section>

          {state.derivedStyleConstraints ? (
            <section className={styles.writeChapterDerivedStyle}>
              <strong>题材 / 文风自动约束</strong>
              <p>{state.derivedStyleConstraints}</p>
            </section>
          ) : null}
        </div>

        <footer>
          <button onClick={onCancel}>取消</button>
          <button
            className={styles.primaryButton}
            onClick={() => onConfirm(selection)}
          >
            开始生成
          </button>
        </footer>
      </section>
    </div>
  );
}

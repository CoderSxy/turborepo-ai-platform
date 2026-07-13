"use client";

import { useState, type ReactNode } from "react";
import type { NovelChapterWriteTarget, NovelContextSelection } from "../../../../lib/novel-store";
import { summarizeContextSelection } from "../../actions/write-chapter";
import styles from "../../studio.module.css";

const CONTEXT_OPTIONS = [
  ["includeOutline", "章节计划 / 大纲"],
  ["includePreviousSummary", "上一章摘要"],
  ["includeWorld", "世界观"],
  ["includeCharacters", "角色状态"],
  ["includeForeshadowing", "伏笔池"],
  ["includeReviewIssues", "审稿遗留问题"],
] as const;

function FoldSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={styles.writingOptionsFold}>
      <button
        type="button"
        className={styles.writingOptionsFoldHeader}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{open ? "▾" : "▸"}</span>
        <strong>{title}</strong>
        {!open && summary ? (
          <span className={styles.writingOptionsFoldSummary}>{summary}</span>
        ) : null}
      </button>
      {open ? <div className={styles.writingOptionsFoldBody}>{children}</div> : null}
    </section>
  );
}

export function WriteChapterOptionsForm({
  value,
  onChange,
  target,
  derivedStyleConstraints,
}: {
  value: NovelContextSelection;
  onChange: (next: NovelContextSelection) => void;
  target?: NovelChapterWriteTarget;
  derivedStyleConstraints?: string;
}) {
  const contextSummary = `已带入：${summarizeContextSelection(value)}`;

  return (
    <div className={styles.writingOptionsForm}>
      {target ? (
        <p className={styles.writingOptionsTarget}>
          第 {target.number} 章《{target.title}》 · {target.focus}
        </p>
      ) : null}

      <section className={styles.writingOptionsFields}>
        <label>
          目标字数
          <input
            type="number"
            min={500}
            value={value.targetWords ?? target?.targetWords ?? 3000}
            onChange={(event) =>
              onChange({
                ...value,
                targetWords: Math.max(500, Number(event.target.value) || 3000),
              })
            }
          />
        </label>
        <label>
          视角
          <input
            value={value.viewpoint}
            onChange={(event) =>
              onChange({ ...value, viewpoint: event.target.value })
            }
          />
        </label>
        <label>
          节奏
          <input
            value={value.pacing}
            onChange={(event) =>
              onChange({ ...value, pacing: event.target.value })
            }
          />
        </label>
        <label>
          额外要求
          <textarea
            rows={2}
            value={value.highlights}
            onChange={(event) =>
              onChange({ ...value, highlights: event.target.value })
            }
            placeholder="本章高亮要求"
          />
        </label>
      </section>

      <FoldSection title="上下文来源" summary={contextSummary}>
        <p className={styles.writingOptionsFoldHint}>{contextSummary}</p>
        <div className={styles.contextSelectorGrid}>
          {CONTEXT_OPTIONS.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(value[key])}
                onChange={(event) =>
                  onChange({ ...value, [key]: event.target.checked })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </FoldSection>

      <FoldSection title="更多约束">
        <div className={styles.writingOptionsFields}>
          <label>
            读者爽点 / 悬疑点
            <textarea
              rows={2}
              value={value.thrillPoints ?? ""}
              onChange={(event) =>
                onChange({ ...value, thrillPoints: event.target.value })
              }
            />
          </label>
          <label>
            禁用词 / 避免表达
            <textarea
              rows={2}
              value={value.bannedWords ?? ""}
              onChange={(event) =>
                onChange({ ...value, bannedWords: event.target.value })
              }
            />
          </label>
          <label>
            额外风格约束
            <textarea
              rows={3}
              value={value.styleConstraints ?? ""}
              onChange={(event) =>
                onChange({ ...value, styleConstraints: event.target.value })
              }
              placeholder={
                derivedStyleConstraints || "可补充本章额外风格要求"
              }
            />
          </label>
        </div>
      </FoldSection>

      {derivedStyleConstraints ? (
        <section className={styles.writeChapterDerivedStyle}>
          <strong>题材 / 文风自动约束</strong>
          <p>{derivedStyleConstraints}</p>
        </section>
      ) : null}
    </div>
  );
}

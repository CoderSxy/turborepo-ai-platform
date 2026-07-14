"use client";

import { useState } from "react";
import type { WriteChapterPipelineTimelineView } from "../../store/pipeline-timeline-types";
import styles from "../../studio.module.css";

const SYNC_STATUS_LABELS = {
  applied: "已同步",
  skipped: "已跳过",
  "needs-attention": "需关注",
} as const;

const RE_AUDIT_LABELS = {
  passed: "复审通过",
  attention: "复审仍有关注项",
  skipped: "未触发复审",
} as const;

const SEVERITY_LABELS = {
  critical: "严重",
  warning: "警告",
  info: "提示",
} as const;

export function WriteChapterPipelineTimeline({
  timeline,
}: {
  timeline: WriteChapterPipelineTimelineView;
}) {
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const issueCount = timeline.auditIssues?.length ?? 0;

  return (
    <div className={styles.pipelineTimeline}>
      {timeline.contextSummary ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>上下文</span>
          <span className={styles.pipelineTimelineValue}>
            {timeline.contextSummary}
          </span>
        </div>
      ) : null}

      {timeline.draftWordCount !== undefined ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>草稿字数</span>
          <span className={styles.pipelineTimelineValue}>
            {timeline.draftWordCount} 字
          </span>
        </div>
      ) : null}

      {timeline.auditParseFailed ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>审核</span>
          <span className={styles.pipelineTimelineValueWarning}>
            报告解析失败，已按需关注处理
          </span>
        </div>
      ) : timeline.auditTotalScore !== undefined ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>审核总分</span>
          <span className={styles.pipelineTimelineValue}>
            {timeline.auditTotalScore}
            {timeline.auditDimensions?.length ? (
              <span className={styles.pipelineTimelineDimensions}>
                {timeline.auditDimensions
                  .map((dimension) => `${dimension.label} ${dimension.score}`)
                  .join(" · ")}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className={styles.pipelineTimelineRow}>
        <span className={styles.pipelineTimelineLabel}>自动修订</span>
        <span className={styles.pipelineTimelineValue}>
          {timeline.revisionCount} 次
        </span>
      </div>

      {timeline.reAuditOutcome ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>复审</span>
          <span
            className={
              timeline.reAuditOutcome === "attention"
                ? styles.pipelineTimelineValueWarning
                : styles.pipelineTimelineValue
            }
          >
            {RE_AUDIT_LABELS[timeline.reAuditOutcome]}
          </span>
        </div>
      ) : null}

      {timeline.syncStatus ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>资产同步</span>
          <span
            className={
              timeline.syncStatus === "needs-attention"
                ? styles.pipelineTimelineValueWarning
                : styles.pipelineTimelineValue
            }
          >
            {SYNC_STATUS_LABELS[timeline.syncStatus]}
          </span>
        </div>
      ) : null}

      {timeline.terminalStage === "completed" ||
      timeline.terminalStage === "completed_with_attention" ? (
        <div className={styles.pipelineTimelineRow}>
          <span className={styles.pipelineTimelineLabel}>最终保存</span>
          <span
            className={
              timeline.terminalStage === "completed_with_attention"
                ? styles.pipelineTimelineValueWarning
                : styles.pipelineTimelineValueSuccess
            }
          >
            {timeline.terminalStage === "completed_with_attention"
              ? "已保存（需关注）"
              : "已保存"}
          </span>
        </div>
      ) : null}

      {timeline.attentionReason ? (
        <p className={styles.pipelineTimelineAttention}>
          {timeline.attentionReason}
        </p>
      ) : null}

      {issueCount > 0 ? (
        <div className={styles.pipelineTimelineIssues}>
          <button
            type="button"
            className={styles.pipelineTimelineIssuesToggle}
            aria-expanded={issuesExpanded}
            onClick={() => setIssuesExpanded((current) => !current)}
          >
            <span>{issuesExpanded ? "▾" : "▸"}</span>
            <span>审核问题（{issueCount}）</span>
          </button>
          {issuesExpanded ? (
            <ul className={styles.pipelineTimelineIssuesList}>
              {timeline.auditIssues?.map((issue, index) => (
                <li key={`${issue.dimensionKey}-${index}`}>
                  <span className={styles.pipelineTimelineIssueSeverity}>
                    [{SEVERITY_LABELS[issue.severity]}]
                  </span>
                  <span className={styles.pipelineTimelineIssueDimension}>
                    {issue.dimensionLabel}
                  </span>
                  <span>{issue.evidence}</span>
                  {issue.suggestion ? (
                    <span className={styles.pipelineTimelineIssueSuggestion}>
                      建议：{issue.suggestion}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

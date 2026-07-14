"use client";

import { INKOS_STATUS_LABELS } from "@repo/inkos-adapter";
import styles from "../studio.module.css";
import {
  buildNovelRecoverableErrorNotice,
  buildNovelTaskResumePreview,
  deriveNovelChapterProgress,
  formatNovelRelativeAge,
  type NovelAssetConflictReport,
  type NovelKnowledgeAsset,
  type NovelOutlineNode,
  type NovelProjectAssets,
  type StoredNovelTask,
} from "../../../lib/novel-store";
import {
  FORESHADOWING_STATUS_LABELS,
  KNOWLEDGE_ASSET_LABELS,
  KNOWLEDGE_ASSET_STATUS_LABELS,
} from "../state/studio-constants";
import { MarkdownContent } from "./chat/MarkdownContent";
import { CollapsibleSection } from "./sidebar/CollapsibleSection";
import { WorkspaceMoreMenu } from "./right-panel/WorkspaceMoreMenu";

export type WorkspaceMoreSectionsProps = {
  stats: ReturnType<typeof deriveNovelChapterProgress>;
  assets: NovelProjectAssets;
  tasks: StoredNovelTask[];
  promptPreview: string;
  assetConflictPreview: NovelAssetConflictReport;
  publicationTimeline: Array<{
    id: string;
    label: string;
    detail: string;
    createdAt: string;
  }>;
  onOpenOutlineEditor: () => void;
  onAddOutlineNode: () => void;
  onSyncOutlineToProject: () => void;
  onEditOutlineNode: (
    node: NovelOutlineNode,
    field: keyof Pick<
      NovelOutlineNode,
      | "title"
      | "volume"
      | "goal"
      | "conflict"
      | "characters"
      | "information"
      | "foreshadowing"
      | "targetWords"
    >,
  ) => void;
  onDeleteOutlineNode: (node: NovelOutlineNode) => void;
  onOpenKnowledgeLibrary: () => void;
  onOpenAssetConflictReport: () => void;
  onCreateKnowledgeAsset: () => void;
  onEditKnowledgeAsset: (
    item: NovelKnowledgeAsset,
    field: keyof Pick<NovelKnowledgeAsset, "title" | "content" | "status" | "tags">,
  ) => void;
  onDeleteKnowledgeAsset: (item: NovelKnowledgeAsset) => void;
  onRetryTask: (task: StoredNovelTask) => void;
};

export function WorkspaceMoreSections({
  stats,
  assets,
  tasks,
  promptPreview,
  assetConflictPreview,
  publicationTimeline,
  onOpenOutlineEditor,
  onAddOutlineNode,
  onSyncOutlineToProject,
  onEditOutlineNode,
  onDeleteOutlineNode,
  onOpenKnowledgeLibrary,
  onOpenAssetConflictReport,
  onCreateKnowledgeAsset,
  onEditKnowledgeAsset,
  onDeleteKnowledgeAsset,
  onRetryTask,
}: WorkspaceMoreSectionsProps) {
  const syncDiagnostics = (assets.diagnostics ?? []).filter(
    (entry) => !entry.ok && entry.label.startsWith("同步诊断"),
  );

  return (
    <WorkspaceMoreMenu
      groups={[
        {
          id: "assets-outline",
          title: "资产与大纲",
          children: (
            <>
              <CollapsibleSection id="book-progress" title="书籍统计">
                <div className={styles.bookProgress}>
                  <span>生成进度</span>
                  <strong>{stats.generatedPercent}%</strong>
                  <em>
                    已生成 {stats.generatedChapters} / {stats.totalChapters} 章
                  </em>
                  <div className={styles.bookProgressMetrics}>
                    <span>已定稿 {stats.approvedChapters} 章</span>
                    <span>待审稿 {stats.readyForReviewChapters} 章</span>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection id="outline" title="大纲与章节计划">
                <div className={styles.contextSectionHeader}>
                  <div>
                    <button type="button" onClick={onOpenOutlineEditor}>
                      打开编辑器
                    </button>
                    <button type="button" onClick={() => void onAddOutlineNode()}>
                      + 章节
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSyncOutlineToProject()}
                    >
                      同步计划
                    </button>
                  </div>
                </div>
                <div className={styles.outlineNodeList}>
                  {assets.outlineNodes.slice(0, 8).map((node) => (
                    <article key={node.id} className={styles.outlineNodeCard}>
                      <div>
                        <strong>
                          {node.chapterNumber}. {node.title}
                        </strong>
                        <span>
                          {node.volume} / {INKOS_STATUS_LABELS[node.status]} /{" "}
                          {node.targetWords} 字
                        </span>
                      </div>
                      <p>{node.goal || node.information || "暂无章节目标。"}</p>
                      <em>
                        {[
                          node.conflict ? `冲突：${node.conflict}` : "",
                          node.characters ? `角色：${node.characters}` : "",
                          node.foreshadowing ? `伏笔：${node.foreshadowing}` : "",
                        ]
                          .filter(Boolean)
                          .join(" / ") || "暂无冲突、角色或伏笔。"}
                      </em>
                      <div>
                        <button
                          type="button"
                          onClick={() => void onEditOutlineNode(node, "title")}
                        >
                          标题
                        </button>
                        <button
                          type="button"
                          onClick={() => void onEditOutlineNode(node, "goal")}
                        >
                          目标
                        </button>
                        <button
                          type="button"
                          onClick={() => void onEditOutlineNode(node, "conflict")}
                        >
                          冲突
                        </button>
                        <button
                          type="button"
                          onClick={() => void onEditOutlineNode(node, "characters")}
                        >
                          角色
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onEditOutlineNode(node, "foreshadowing")
                          }
                        >
                          伏笔
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onEditOutlineNode(node, "targetWords")
                          }
                        >
                          字数
                        </button>
                        <button
                          type="button"
                          className={styles.dangerTextButton}
                          onClick={() => void onDeleteOutlineNode(node)}
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                  {assets.outlineNodes.length === 0 ? (
                    <p className={styles.emptyMiniState}>
                      暂无结构化章节计划，可以从项目 chapters 同步或手动新建。
                    </p>
                  ) : null}
                </div>
              </CollapsibleSection>

              <CollapsibleSection id="assets" title="设定资产">
                <div className={styles.contextSectionHeader}>
                  <div>
                    <button type="button" onClick={onOpenKnowledgeLibrary}>
                      打开资产库
                      {assetConflictPreview.issues.length > 0
                        ? ` (${assetConflictPreview.warningCount + assetConflictPreview.errorCount})`
                        : ""}
                    </button>
                    <button type="button" onClick={onOpenAssetConflictReport}>
                      检测冲突
                    </button>
                    <button
                      type="button"
                      onClick={() => void onCreateKnowledgeAsset()}
                    >
                      + 资产
                    </button>
                  </div>
                </div>
                {assets.assetChangeEvents && assets.assetChangeEvents.length > 0 ? (
                  <div className={styles.assetChangeTimeline}>
                    <strong>资产变更记录</strong>
                    <div className={styles.modelCallLogList}>
                      {assets.assetChangeEvents.slice(0, 6).map((entry) => (
                        <article key={entry.id} className={styles.modelCallLogItem}>
                          <strong>{entry.label}</strong>
                          <span>{entry.detail}</span>
                          <time>{formatNovelRelativeAge(entry.createdAt)}前</time>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                {syncDiagnostics.length > 0 ? (
                  <div className={styles.assetChangeTimeline}>
                    <strong>同步诊断</strong>
                    <div className={styles.modelCallLogList}>
                      {syncDiagnostics.slice(0, 6).map((entry) => (
                        <article key={entry.id} className={styles.modelCallLogItem}>
                          <strong>{entry.label}</strong>
                          <span>{entry.detail}</span>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className={styles.knowledgeAssetList}>
                  {assets.knowledgeAssets.slice(0, 8).map((item) => (
                    <article key={item.id} className={styles.knowledgeAssetCard}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {KNOWLEDGE_ASSET_LABELS[item.category]} /{" "}
                          {item.category === "foreshadowing"
                            ? FORESHADOWING_STATUS_LABELS[item.status]
                            : KNOWLEDGE_ASSET_STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <p>{item.content || "暂无内容。"}</p>
                      {item.tags.length > 0 ? (
                        <em>{item.tags.map((tag) => `#${tag}`).join(" ")}</em>
                      ) : null}
                      <div>
                        <button
                          type="button"
                          onClick={() => void onEditKnowledgeAsset(item, "title")}
                        >
                          标题
                        </button>
                        <button
                          type="button"
                          onClick={() => void onEditKnowledgeAsset(item, "content")}
                        >
                          内容
                        </button>
                        <button
                          type="button"
                          onClick={() => void onEditKnowledgeAsset(item, "tags")}
                        >
                          标签
                        </button>
                        <button
                          type="button"
                          onClick={() => void onEditKnowledgeAsset(item, "status")}
                        >
                          状态
                        </button>
                        <button
                          type="button"
                          className={styles.dangerTextButton}
                          onClick={() => void onDeleteKnowledgeAsset(item)}
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                  {assets.knowledgeAssets.length === 0 ? (
                    <p className={styles.emptyMiniState}>
                      暂无设定资产。建议先添加世界观、角色和伏笔。
                    </p>
                  ) : null}
                </div>
              </CollapsibleSection>
            </>
          ),
        },
        {
          id: "tasks-recovery",
          title: "任务与恢复",
          children: (
            <CollapsibleSection id="tasks" title="任务日志">
              <div className={styles.taskLogList}>
                {tasks.slice(0, 5).map((task) => {
                  const errorNotice = task.errorMessage
                    ? buildNovelRecoverableErrorNotice(task.errorMessage)
                    : null;
                  const resumePreview = buildNovelTaskResumePreview(task);
                  const canRetryTask =
                    task.status === "queued" ||
                    task.status === "paused" ||
                    task.status === "cancelled" ||
                    (task.status === "error" && errorNotice?.canRetry !== false);

                  return (
                    <article key={task.id} className={styles.taskLogCard}>
                      <div>
                        <strong>{task.label}</strong>
                        <span>{task.status}</span>
                      </div>
                      <em>
                        {formatNovelRelativeAge(task.startedAt)}前
                        {task.endedAt
                          ? ` / 结束于 ${formatNovelRelativeAge(task.endedAt)}前`
                          : ""}
                      </em>
                      {task.targetChapterNumber ? (
                        <em>
                          第 {task.targetChapterNumber} 章
                          {task.targetChapterTitle
                            ? ` · ${task.targetChapterTitle}`
                            : ""}
                        </em>
                      ) : null}
                      {resumePreview.canResume ? (
                        <div className={styles.taskRecoveryHint}>
                          <strong>断点已保存</strong>
                          <p>{resumePreview.summary}</p>
                        </div>
                      ) : null}
                      <ul>
                        {task.logs.slice(-4).map((log) => (
                          <li key={log.id}>{log.message}</li>
                        ))}
                      </ul>
                      {errorNotice && task.status !== "paused" ? (
                        <div className={styles.taskRecoveryHint}>
                          <strong>{errorNotice.title}</strong>
                          <p>{errorNotice.detail}</p>
                          <em>{errorNotice.recoveryAction}</em>
                        </div>
                      ) : null}
                      {canRetryTask ? (
                        <button
                          type="button"
                          className={styles.taskRetryButton}
                          onClick={() => onRetryTask(task)}
                        >
                          {task.status === "queued"
                            ? "执行任务"
                            : task.status === "paused"
                              ? "继续执行"
                              : "重试任务"}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
                {tasks.length === 0 ? (
                  <p className={styles.emptyMiniState}>
                    暂无任务日志。写下一章、审稿或修订后会自动记录。
                  </p>
                ) : null}
              </div>
            </CollapsibleSection>
          ),
        },
        {
          id: "publish-export",
          title: "发布与导出",
          children: (
            <CollapsibleSection id="publication" title="发布记录">
              {publicationTimeline.length === 0 ? (
                <p className={styles.emptyMiniState}>暂无发布或导出记录。</p>
              ) : (
                <div className={styles.modelCallLogList}>
                  {publicationTimeline.slice(0, 12).map((entry) => (
                    <article key={entry.id} className={styles.modelCallLogItem}>
                      <strong>{entry.label}</strong>
                      <span>{entry.detail || "—"}</span>
                      <time>{new Date(entry.createdAt).toLocaleString()}</time>
                    </article>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          ),
        },
        {
          id: "diagnostics",
          title: "诊断",
          children: (
            <CollapsibleSection id="preview" title="Prompt 诊断">
              <MarkdownContent content={promptPreview} compact />
            </CollapsibleSection>
          ),
        },
      ]}
    />
  );
}

# InkOS Studio P5 + P6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 创作三栏拆成 `ChatPage`（P5）+ `BookSidebar` + 8 section 组件（P6），`NovelStudio` 瘦身为编排壳，行为零回归。

**Architecture:** ChatPage 直连 `useStudioStore` selectors + `dispatchStudioAction`；BookSidebar 读 store、write 走 NovelStudio 注入 callbacks；section 从 `NovelBookPanel.tsx` 原样搬迁 JSX 与 local state；P5 验证通过后再做 P6。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, CSS Modules, node:test (`--experimental-strip-types`)

**Spec:** `docs/superpowers/specs/2026-07-08-inkos-studio-p5-p6-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/features/studio/store/selectors.ts` | Modify | 新增 input/model/chapter selectors |
| `apps/web/features/studio/components/chat/ToolExecutionSteps.tsx` | Create | tool part 步骤 UI |
| `apps/web/features/studio/components/chat/MessagePartRenderer.tsx` | Modify | tool case 委托 ToolExecutionSteps |
| `apps/web/features/studio/studio.module.css` | Modify | toolSteps 样式 |
| `apps/web/features/studio/components/ChatPage.tsx` | Create | 中间栏编排 |
| `apps/web/features/studio/components/NovelStudio.tsx` | Modify | 组合 ChatPage / BookSidebar |
| `apps/web/features/studio/components/sidebar/BookSidebar.tsx` | Create | 右侧 section 编排 |
| `apps/web/features/studio/components/sidebar/ProgressSection.tsx` | Create | 书籍信息 |
| `apps/web/features/studio/components/sidebar/ChaptersSection.tsx` | Create | 章节列表 |
| `apps/web/features/studio/components/sidebar/ChapterDetailSection.tsx` | Create | 章节详情 + 编辑器 + 版本对比 |
| `apps/web/features/studio/components/sidebar/OutlineSection.tsx` | Create | 大纲与章节计划 |
| `apps/web/features/studio/components/sidebar/AssetsSection.tsx` | Create | 设定资产 + 设定块 |
| `apps/web/features/studio/components/sidebar/ReviewSection.tsx` | Create | 写作上下文 + 审稿 |
| `apps/web/features/studio/components/sidebar/TasksSection.tsx` | Create | 任务日志 |
| `apps/web/features/studio/components/sidebar/ExportSection.tsx` | Create | 发布记录 + 上下文预览 |
| `apps/web/features/studio/components/NovelBookPanel.tsx` | Delete | P6 完成后移除 |
| `INKOS_STUDIO_ALIGNMENT_TODO.md` | Modify | P5/P6 勾选 + P6 Dialog 项标注推迟 |

---

## Verification Commands (run after every task)

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test \
  apps/web/lib/novel-store.test.mjs \
  apps/web/lib/provider-stream-parser.test.mjs \
  apps/web/features/studio/store/slices/message/parts-builder.test.mjs \
  apps/web/features/studio/actions/runtime/message-parts.test.mjs \
  apps/web/features/studio/actions/runtime/task-guard.test.mjs \
  apps/web/features/studio/persistence/message-bridge.test.mjs \
  apps/web/features/studio/store/slices/book/hydrate-active-ids.test.mjs
```

---

## Task 1: 扩展 store selectors

**Files:**
- Modify: `apps/web/features/studio/store/selectors.ts`

- [ ] **Step 1: 添加 input / model / chapter selectors**

在 `selectors.ts` 末尾追加：

```typescript
import { useMemo } from "react";
import { mergeNovelChapterPlan } from "../helpers/novel-helpers";
import { useStudioStore } from "./store";

export function useStudioInput() {
  const input = useStudioStore((s) => s.input);
  const setInput = useStudioStore((s) => s.setInput);
  return [input, setInput] as const;
}

export function useStudioSelectedModel() {
  const value = useStudioStore((s) => s.selectedModelValue);
  const setSelectedModel = useStudioStore((s) => s.setSelectedModel);
  return [value, setSelectedModel] as const;
}

export function useActiveChapter() {
  const activeBook = useActiveBook();
  const activeChapterId = useStudioStore((s) => s.activeChapterId);
  return useMemo(
    () => activeBook?.chapters.find((chapter) => chapter.id === activeChapterId) ?? null,
    [activeBook, activeChapterId],
  );
}

export function useActiveChapterRows() {
  const activeBook = useActiveBook();
  return useMemo(() => {
    if (!activeBook?.project) return [];
    return mergeNovelChapterPlan(activeBook.project, activeBook.chapters);
  }, [activeBook]);
}

export function useActiveChapterRow() {
  const rows = useActiveChapterRows();
  const activeChapterId = useStudioStore((s) => s.activeChapterId);
  return useMemo(
    () => rows.find((row) => row.key === activeChapterId) ?? rows[0] ?? null,
    [rows, activeChapterId],
  );
}
```

- [ ] **Step 2: 运行 verification**

Expected: check-types PASS, lint PASS, tests PASS

---

## Task 2: 新建 ToolExecutionSteps

**Files:**
- Create: `apps/web/features/studio/components/chat/ToolExecutionSteps.tsx`
- Modify: `apps/web/features/studio/components/chat/MessagePartRenderer.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: 创建 ToolExecutionSteps.tsx**

```typescript
"use client";

import type { StudioMessagePart } from "../../store/types";
import styles from "../../studio.module.css";

type ToolPart = Extract<StudioMessagePart, { type: "tool" }>;

const STATUS_LABEL: Record<ToolPart["status"], string> = {
  running: "执行中",
  completed: "已完成",
  error: "失败",
};

export function ToolExecutionSteps({ part }: { part: ToolPart }) {
  return (
    <div className={styles.toolSteps}>
      <div className={styles.toolStepsHeader}>
        <span className={styles.toolStepsLabel}>{part.label}</span>
        <span className={`${styles.toolStepsStatus} ${styles[`toolStatus${part.status}`]}`}>
          {STATUS_LABEL[part.status]}
        </span>
      </div>
      {part.detail ? (
        <details className={styles.toolStepsDetail}>
          <summary>详情</summary>
          <pre>{part.detail}</pre>
        </details>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: MessagePartRenderer 改用 ToolExecutionSteps**

```typescript
import { ToolExecutionSteps } from "./ToolExecutionSteps";

// case "tool":
return <ToolExecutionSteps part={part} />;
```

- [ ] **Step 3: 追加 CSS**

在 `studio.module.css` 添加 `.toolSteps`、`.toolStepsHeader`、`.toolStepsStatus`、`.toolStatusrunning`、`.toolStatuscompleted`、`.toolStatuserror`、`.toolStepsDetail`（参考现有 `.toolBlock` / `.progressSteps` 色调）。

- [ ] **Step 4: 运行 verification**

---

## Task 3: 新建 ChatPage

**Files:**
- Create: `apps/web/features/studio/components/ChatPage.tsx`

- [ ] **Step 1: 创建 ChatPage.tsx**

要点：
- `"use client"`
- 从 `../store/selectors` 导入 `useActiveBook`, `useActiveMessages`, `useStudioInput`, `useStudioSelectedModel`, `useIsTaskRunning`, `useCanStartTask`
- 从 `../actions/dispatch` 导入 `dispatchStudioAction`
- 从 `../actions/send-message` 导入 `sendMessage`（send 按钮用 `sendMessage(actionCtx, input)` 与现 NovelStudio 一致）
- 从 `./chat/ChatMessage`, `./chat/ChatComposer` 导入
- 从 `../helpers/novel-helpers` 导入 `deriveNovelChapterProgress`, `deriveNovelStage`（或项目内等价函数名）
- context bar：`activeBook.title`, `project.genre`, `currentStage.label`, `stats.generatedChapters`
- `canSendChat = input.trim().length > 0 && !isTaskRunning && Boolean(selectedModelValue)`
- `modelGroups`：`useMemo(() => groupModelsFromSettings(settings), [settings])` — 复用 NovelStudio 现有 grouping 逻辑（提取为 import 或复制同一 helper 调用）
- props 类型见 spec `ChatPageProps`

- [ ] **Step 2: 运行 verification**

Expected: check-types PASS（ChatPage 尚未被引用也 OK）

---

## Task 4: NovelStudio 接入 ChatPage（P5 完成）

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`

- [ ] **Step 1: import ChatPage**

```typescript
import { ChatPage } from "./ChatPage";
```

- [ ] **Step 2: 替换 chatSurface 内联块**

将 L2085–~2195 的 `<section className={styles.chatSurface}>…</section>` 替换为：

```tsx
<ChatPage
  actionCtx={actionCtx}
  settings={settings}
  onManageModels={onManageModels}
  moreMenuGroups={buildComposerMoreMenuGroups()}
  onOpenCloudSync={() => setCloudSyncDialogOpen(true)}
  composerInputRef={composerInputRef}
  batchQueueBar={batchQueueItems.length > 0 ? (/* 保留现有 batchQueue JSX */) : null}
  activeTaskBar={activeTaskLabel ? (/* 保留现有 activeTaskBar JSX */) : null}
/>
```

- [ ] **Step 3: 删除 NovelStudio 中不再使用的 chat 相关 import**（若 `ChatMessage` 仅此处使用）

- [ ] **Step 4: 运行 verification + 人工 smoke**

确认：发消息、QuickActions、空状态、context bar、batchQueue bar、pause/abort bar 正常。

- [ ] **Step 5: 更新 TODO P5 勾选**

---

## Task 5: 新建 BookSidebar 空壳 + ProgressSection + ChaptersSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/BookSidebar.tsx`
- Create: `apps/web/features/studio/components/sidebar/ProgressSection.tsx`
- Create: `apps/web/features/studio/components/sidebar/ChaptersSection.tsx`
- Modify: `apps/web/features/studio/components/NovelBookPanel.tsx`

- [ ] **Step 1: 从 NovelBookPanel L1173–1216 剪出 ProgressSection + ChaptersSection**

每个 section 文件：
- 接收 spec 中定义的 props 子集
- 使用现有 `CollapsibleSection` 包裹
- 保留原 `className={styles....}`

- [ ] **Step 2: 创建 BookSidebar.tsx**

```typescript
"use client";

export function BookSidebar(props: BookSidebarProps) {
  const activeBook = useActiveBook();
  if (!activeBook?.project) return null;

  const chapterRows = useMemo(
    () => mergeNovelChapterPlan(activeBook.project, activeBook.chapters),
    [activeBook],
  );
  const stats = useMemo(
    () => deriveNovelChapterProgress(activeBook.project, activeBook.chapters),
    [activeBook],
  );

  return (
    <aside className={styles.bookSidebar}>
      <ProgressSection project={activeBook.project} stats={stats} />
      <ChaptersSection
        chapterRows={chapterRows}
        activeChapterId={props...}
        onChapterSelect={props.onChapterSelect}
        ...
      />
      {/* 其余 section 在后续 task 追加 */}
    </aside>
  );
}
```

- [ ] **Step 3: NovelStudio 暂时 `<BookSidebar ... />` 与 `<NovelBookPanel ... />` 二选一测试，或先只接 BookSidebar 两 section + 暂留 NovelBookPanel 其余（推荐：Task 5 仅建文件，Task 12 再统一切换）**

- [ ] **Step 4: 运行 verification**

---

## Task 6: 提取 ChapterDetailSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/ChapterDetailSection.tsx`
- Modify: `apps/web/features/studio/components/NovelBookPanel.tsx`
- Modify: `apps/web/features/studio/components/sidebar/BookSidebar.tsx`

- [ ] **Step 1: 搬迁 L1219–2004 至 ChapterDetailSection**

连同以下 local state 一并迁入该文件：
- `compareVersionId`, `isChapterEditorOpen`, `chapterEditorContent`, `chapterEditorSummary`
- `isSavingChapterDraft`, `chapterEditorSearch`, `chapterEditorReplacement`, `chapterEditorSearchIndex`
- `compareSearch`, `compareDiffIndex`, `chapterDraftSavedAt`, `hasRestoredLocalDraft`
- 以及章节编辑器相关的 `useEffect` / `useRef`

- [ ] **Step 2: BookSidebar 渲染 `<ChapterDetailSection ... />`**

传入：`activeRow`, `chapterVersions`, `onChapterDraftSave`, `onChapterVersionRestore`, `onChapterStatusChange`, `onShowToast` 等。

- [ ] **Step 3: 从 NovelBookPanel 删除已迁块 + 已迁 state**

- [ ] **Step 4: 运行 verification**

---

## Task 7: 提取 OutlineSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/OutlineSection.tsx`
- Modify: `NovelBookPanel.tsx`, `BookSidebar.tsx`

- [ ] **Step 1: 搬迁 L2007–2075 + outline editor state**（`isOutlineEditorOpen`, `outlineEditorDraft`）

- [ ] **Step 2: BookSidebar 接入；NovelBookPanel 删块**

- [ ] **Step 3: 运行 verification**

---

## Task 8: 提取 AssetsSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/AssetsSection.tsx`
- Modify: `NovelBookPanel.tsx`, `BookSidebar.tsx`

- [ ] **Step 1: 搬迁 L2077–2254（assets）+ L2492–2507（settings）**

连同 state：`isKnowledgeLibraryOpen`, `assetConflictPreview`, `isApplyingConflictFixes` 等。

- [ ] **Step 2: BookSidebar 接入；NovelBookPanel 删块**

- [ ] **Step 3: 运行 verification**

---

## Task 9: 提取 ReviewSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/ReviewSection.tsx`
- Modify: `NovelBookPanel.tsx`, `BookSidebar.tsx`

- [ ] **Step 1: 搬迁 L2256–2403（context section 全部）**

连同 state：`selectedReviewIssueIds`, review filter, `locatedReviewIssue` 等。

- [ ] **Step 2: 传入 `onReviseChapter`, `promptPreview`, `onGenerateChapter` 等 callbacks**

- [ ] **Step 3: 运行 verification**

---

## Task 10: 提取 TasksSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/TasksSection.tsx`
- Modify: `NovelBookPanel.tsx`, `BookSidebar.tsx`

- [ ] **Step 1: 搬迁 L2405–2474**

- [ ] **Step 2: 传入 `tasks`, `onRetryTask`**

- [ ] **Step 3: 运行 verification**

---

## Task 11: 提取 ExportSection

**Files:**
- Create: `apps/web/features/studio/components/sidebar/ExportSection.tsx`
- Modify: `NovelBookPanel.tsx`, `BookSidebar.tsx`

- [ ] **Step 1: 搬迁 L2476–2511（publication + preview）**

- [ ] **Step 2: 传入 `publicationTimeline`, `promptPreview`, `onProjectChange` 等**

- [ ] **Step 3: 运行 verification**

---

## Task 12: NovelStudio 切换 BookSidebar，删除 NovelBookPanel

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Delete: `apps/web/features/studio/components/NovelBookPanel.tsx`

- [ ] **Step 1: 将 `<NovelBookPanel ... />` 替换为 `<BookSidebar ... />`**

props 与现 NovelBookPanel 调用 1:1 映射（L2224–2285）。

- [ ] **Step 2: 确认 NovelBookPanel 无引用后删除文件**

```bash
rg "NovelBookPanel" apps/web
```

Expected: 无匹配

- [ ] **Step 3: 运行 verification + 人工 smoke**

右侧全部 section：展开/折叠、章节编辑、审稿、任务重试、发布预览。

- [ ] **Step 4: 更新 INKOS_STUDIO_ALIGNMENT_TODO.md**

- P5 项全部 `[x]`
- P6 项全部 `[x]`
- P6 中 `ChapterEditorDialog` / `ChapterVersionComparePanel` / `ReviewIssuePanel` 三行改为「推迟至 P6.5」说明

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| selectors 扩展 | Task 1 |
| ToolExecutionSteps | Task 2 |
| ChatPage + store 读 | Task 3–4 |
| BookSidebar + 8 sections | Task 5–11 |
| 删除 NovelBookPanel | Task 12 |
| 零 schema 改动 | 全计划无 novel-store 修改 |
| 默认展开 progress + chapters | Task 5（保留 defaultOpen） |

## Placeholder Scan

无 TBD / TODO / implement later。

---

**Plan complete.** Implementation spec: `docs/superpowers/specs/2026-07-08-inkos-studio-p5-p6-design.md`

# InkOS Studio 对齐 — P5 + P6 设计规格

**日期：** 2026-07-08  
**范围：** P5 拆 ChatPage + P6 拆 BookSidebar  
**状态：** 已确认，待实施

## 背景

P0–P4 已完成：`page.tsx` 降至 ~318 行；模型配置迁入 `features/models/`；`NovelStudio.tsx` 从 ~3200 行降至 ~2385 行；Zustand store + 统一 action runtime + `StudioMessagePart` 渲染已就位。

当前核心问题：

- AI 创作三栏中，**中间 chat 区**仍内联在 `NovelStudio.tsx`（~L2085–2180）：context bar、message list、`ChatComposer` 及大量 props
- **右侧面板** `NovelBookPanel.tsx` 仍 **2550 行**，10 个 `CollapsibleSection` 混在一个文件：章节编辑、审稿、资产、大纲、导出、任务日志
- Chat 子组件（`ChatMessage`、`QuickActions` 等）已部分存在，但缺少 `ChatPage` 编排层和 `ToolExecutionSteps`
- `NovelBookPanel` 通过 20+ props 接收 runtime 数据，与 P3「selector 读 store」方向不一致

本设计覆盖 INKOS_STUDIO_ALIGNMENT_TODO.md 中的 **P5** 和 **P6**，不涉及 P7（novel-store 收敛）、P8（高级功能降噪）。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 实施顺序 | **方案 1 — 先 P5 后 P6** | P5 改动面小、可独立验收；P6 再拆 2550 行 panel |
| P6 拆分深度 | **A — 结构性拆分** | section 独立文件；章节编辑/审稿 UI **暂留 section 内**；不新建 `ChapterEditorDialog` |
| ChatPage 状态 | **A — 直连 store** | `useStudioStore` selectors + `dispatchStudioAction`；NovelStudio 只传 `actionCtx` 与 UI bar |
| BookSidebar 状态 | **A — 读 store + write callbacks** | 展示数据走 selector；持久化/弹窗/IndexedDB 写操作仍由 NovelStudio handlers 注入 |
| chapterVersions | **保持 NovelStudio local state** | 未入 store（P7 范围）；作为 `BookSidebar` 唯一 read prop |
| 行为变更 | **零回归** | 纯结构搬迁；不改 UI 样式、不改 schema、不改 action 语义 |

### 与 TODO 原文的差异

`INKOS_STUDIO_ALIGNMENT_TODO.md` P6 原列「章节编辑器 / 版本对比 / 审稿问题列表独立成 Dialog/Panel」。经确认 **推迟** 至 P6 之后（未来可选 P6.5），P6 只做 section 文件拆分。

## 目标与验收标准

### P5 完成标准

- [ ] 新建 `features/studio/components/ChatPage.tsx`，负责 context bar、消息列表、空状态、`ChatComposer` 组合
- [ ] 新建 `features/studio/components/chat/ToolExecutionSteps.tsx`，从 `MessagePartRenderer` 抽出 tool part 渲染
- [ ] `ChatPage` 通过 store selectors 读 messages / input / model / task 状态；发送与 QuickActions 走 `dispatchStudioAction`
- [ ] `ChatPage` **不**直接读写 IndexedDB，**不**直接调用 InkOS Core
- [ ] `NovelStudio` AI 创作布局改为：`NovelBookList` + `ChatPage` + `BookSidebar`（P6 完成前右侧可暂留 `NovelBookPanel`）
- [ ] 空状态保持轻量一句引导（与 P0 一致）
- [ ] typecheck、lint、现有测试全部通过

### P6 完成标准

- [ ] 新建 `features/studio/components/sidebar/BookSidebar.tsx` 作为 section 编排层
- [ ] 从 `NovelBookPanel.tsx` 拆出 8 个 section 组件（见下表）
- [ ] 删除 `NovelBookPanel.tsx`（内容迁空后移除）
- [ ] `BookSidebar` 读 store；write 操作通过 callbacks（与现 `NovelBookPanel` props 对齐）
- [ ] 默认只展开「书籍信息 + 章节列表」（`defaultOpen` 与现行为一致）
- [ ] 章节编辑、版本对比、审稿列表等功能仍可用（UI 留在 section 内）
- [ ] typecheck、lint、现有测试全部通过

### 量化目标

| 指标 | 当前 | 目标 |
|------|------|------|
| `NovelStudio.tsx` | ~2385 行 | ~1200 行 |
| `NovelBookPanel.tsx` | ~2550 行 | 删除 |
| 新增文件 | — | ~12（ChatPage、ToolExecutionSteps、BookSidebar、8 sections、selectors 扩展） |
| `lib/novel-store.ts` | — | 0 行 schema 改动 |

## 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│ NovelStudio（编排壳：dialog / toast / batchQueue / cloudSync）    │
│  - 构建 actionCtx                                                 │
│  - chapterVersions local state                                    │
│  - 全部 write handlers（saveChapterDraft, updateActiveProject…）  │
└───────┬────────────────────┬─────────────────────┬───────────────┘
        │                    │                     │
        ▼                    ▼                     ▼
┌───────────────┐   ┌────────────────┐   ┌─────────────────────────┐
│ NovelBookList │   │ ChatPage       │   │ BookSidebar             │
│ (左侧，基本不动)│   │ store 读       │   │ store 读 + callbacks 写 │
└───────────────┘   │ dispatch 动作  │   │ 8 × CollapsibleSection  │
                    └───────┬────────┘   └─────────────────────────┘
                            │
                            ▼
                    ┌───────────────────┐
                    │ useStudioStore    │
                    │ selectors.ts      │
                    └───────────────────┘
```

## 目录结构

```
apps/web/features/studio/
  components/
    ChatPage.tsx                          # 新建：中间栏编排
    NovelStudio.tsx                       # 修改：组合三栏，删内联 chat
    NovelBookPanel.tsx                    # P6 完成后删除
    chat/
      ChatMessage.tsx                     # 已有
      ChatComposer.tsx                    # 已有
      QuickActions.tsx                    # 已有
      ModelPicker.tsx                     # 已有
      MessagePartRenderer.tsx             # 修改：tool → ToolExecutionSteps
      ToolExecutionSteps.tsx              # 新建
      ProgressSteps.tsx                   # 已有
    sidebar/
      BookSidebar.tsx                     # 新建
      CollapsibleSection.tsx              # 已有
      ProgressSection.tsx                 # 新建
      ChaptersSection.tsx                 # 新建
      ChapterDetailSection.tsx            # 新建（含编辑器 + 版本对比）
      OutlineSection.tsx                  # 新建
      AssetsSection.tsx                   # 新建（含原 settings 设定块）
      ReviewSection.tsx                   # 新建（自 context section 拆出审稿 UI）
      TasksSection.tsx                    # 新建
      ExportSection.tsx                   # 新建（publication + preview）
  store/
    selectors.ts                          # 扩展
```

## P5 — ChatPage 设计

### 职责边界

| 属于 ChatPage | 留在 NovelStudio |
|---------------|------------------|
| context bar 展示 | `actionCtx` 构建 |
| message list + 空状态 | batchQueue bar UI 数据与 handlers |
| `ChatComposer` 组合 | activeTaskBar（pause/abort 按钮逻辑） |
| store 读 input/model/messages | `settings` / `groupedModels` 来源 |
| dispatch send / quick action | cloudSync、dialog、toast |
| | `composerInputRef` 可注入或内部 ref |

### Store selectors（ChatPage 内部使用）

```typescript
// 已有
useActiveBook()
useActiveMessages()
useIsTaskRunning()
useRunningTaskLabel()
useCanStartTask()

// 新增（selectors.ts）
useStudioInput()           // input + setInput
useStudioSelectedModel()   // selectedModelValue + setSelectedModel
useActiveProject()         // activeBook.project | null
useActiveBookStats()       // deriveNovelChapterProgress(project, chapters)
useCurrentStage()          // deriveNovelStage(project) — 或内联 helper
```

`canSendChat` 逻辑：`input.trim().length > 0 && !isTaskRunning && selectedModelValue` — 可在 ChatPage 内 `useMemo` 计算。

### ChatPageProps

```typescript
import type { StudioActionContext } from "../actions/types";
import type { LocalModelSettings } from "#lib/model-settings";
import type { StudioAction } from "../actions/types";
import type { MenuGroup } from "./chat/ComposerMoreMenu";

export type ChatPageProps = {
  actionCtx: StudioActionContext;
  settings: LocalModelSettings;
  onManageModels: () => void;
  moreMenuGroups: MenuGroup[];
  onOpenCloudSync: () => void;
  composerInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  batchQueueBar?: React.ReactNode;
  activeTaskBar?: React.ReactNode;
};
```

### 发送与 QuickActions

```typescript
const handleSend = () => {
  const text = useStudioStore.getState().input;
  void dispatchStudioAction(actionCtx, { type: "send-message", text });
};

const handleQuickAction = (action: StudioAction) => {
  void dispatchStudioAction(actionCtx, action);
};
```

与现 `NovelStudio` 中 `sendMessage(actionCtx, input)` / `handleStudioAction` 等价，搬迁后从 `ChatPage` 调用。

### ToolExecutionSteps

对齐 InkOS 思路，适配当前较简的 `StudioMessagePart` tool 形状：

```typescript
type ToolPart = Extract<StudioMessagePart, { type: "tool" }>;
// { label, status: "running" | "completed" | "error", detail? }
```

- 展示 tool 名称 + 状态 badge（执行中 / 已完成 / 失败）
- `detail` 可折叠展示（`<pre>` 或 `<details>`）
- `MessagePartRenderer` case `"tool"` 改为 `<ToolExecutionSteps part={part} />`
- 样式追加到 `studio.module.css`（`.toolSteps`、status badge），不引入新 UI 库

### NovelStudio P5 改造片段

替换 `styles.chatSurface` 内联块为：

```tsx
<ChatPage
  actionCtx={actionCtx}
  settings={settings}
  onManageModels={onManageModels}
  moreMenuGroups={buildComposerMoreMenuGroups()}
  onOpenCloudSync={() => setCloudSyncDialogOpen(true)}
  composerInputRef={composerInputRef}
  batchQueueBar={/* 现有 batchQueue JSX */}
  activeTaskBar={/* 现有 activeTaskBar JSX */}
/>
```

## P6 — BookSidebar 设计

### Section 映射（从 NovelBookPanel 搬迁）

| 组件 | 原 `CollapsibleSection` id | 原文件行号（约） | defaultOpen |
|------|---------------------------|-----------------|-------------|
| `ProgressSection` | `book-progress` | L1173–1185 | ✓ |
| `ChaptersSection` | `chapter-list` | L1187–1216 | ✓ |
| `ChapterDetailSection` | `chapter-detail` | L1219–2004 | ✗ |
| `OutlineSection` | `outline` | L2007–2075 | ✗ |
| `AssetsSection` | `assets` + `settings` | L2077–2254, L2492–2507 | ✗ |
| `ReviewSection` | `context` 内审稿块 | L2256–2403（部分） | ✗ |
| `TasksSection` | `tasks` | L2405–2474 | ✗ |
| `ExportSection` | `publication` + `preview` | L2476–2511 | ✗ |

`context` section 中纯「写作上下文 / prompt 预览」内容并入 `ReviewSection` 或 `ChapterDetailSection`（按原 JSX 边界切，不重构业务逻辑）。

### BookSidebarProps

与现 `NovelBookPanel` write callbacks **1:1 对齐**；read 数据改由 store 内部获取。

```typescript
export type BookSidebarProps = {
  chapterVersions: StoredNovelChapterVersion[];
  onChapterSelect: (chapterId: string) => void;
  onChapterDraftSave: (
    chapter: StoredNovelChapter,
    updates: Pick<StoredNovelChapter, "content" | "summary">,
  ) => Promise<void>;
  onChapterStatusChange: (
    chapter: StoredNovelChapter,
    status: StoredNovelChapter["status"],
  ) => Promise<void>;
  onChapterPublicationStatusChange: (
    chapter: StoredNovelChapter,
    status: NonNullable<StoredNovelChapter["publicationStatus"]>,
  ) => Promise<void>;
  onChapterDelete: (chapter: StoredNovelChapter) => Promise<void>;
  onChapterVersionRestore: (version: StoredNovelChapterVersion) => Promise<void>;
  onGenerateChapter: (target: NovelChapterWriteTarget) => Promise<void>;
  onReviseChapter: (selectedIssueIds?: string[]) => Promise<void>;
  onRetryTask: (task: StoredNovelTask) => void;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRequestPrompt: (options: { ... }) => Promise<string | null>;
  onRequestConfirm: (options: { ... }) => Promise<boolean>;
  onShowToast: (message: string, tone?: "success" | "warning" | "error") => void;
};
```

### BookSidebar 内部 read 路径

```typescript
const activeBook = useActiveBook();
const activeChapterId = useStudioStore((s) => s.activeChapterId);

const project = activeBook?.project;
const assets = activeBook?.assets ?? emptyAssets;
const chapters = activeBook?.chapters ?? [];
const tasks = activeBook?.tasks ?? [];

const stats = useMemo(
  () => project ? deriveNovelChapterProgress(project, chapters) : null,
  [project, chapters],
);
const chapterRows = useMemo(
  () => project ? mergeNovelChapterPlan(project, chapters) : [],
  [project, chapters],
);
const promptPreview = useMemo(/* buildNovelChapterContextPreview */, [...]);
```

`onChapterSelect` 内部应调用 store `setActiveChapter` **或** 委托 NovelStudio callback（保持现 `setActiveChapter` 行为，含 side effects 若有）。

### Section 组件 props 模式

每个 section 接收 **已派生的数据 + callbacks 子集**，避免每个 section 重复访问 store：

```typescript
// 示例：ChaptersSection
type ChaptersSectionProps = {
  chapterRows: ReturnType<typeof mergeNovelChapterPlan>;
  activeChapterId: string;
  onChapterSelect: (id: string) => void;
  onGenerateChapter: BookSidebarProps["onGenerateChapter"];
  // ...
};
```

`BookSidebar` 负责 `useMemo` 派生一次，向下分发。

### 共享 state（section 间）

`NovelBookPanel` 内若有 `useState`（如 outline 编辑草稿、资产筛选），搬迁时 **原样留在对应 section 文件**，不提升到 BookSidebar，除非跨 section 共享。

## Selectors 扩展规格

`apps/web/features/studio/store/selectors.ts` 新增：

```typescript
export function useActiveChapter() {
  const activeBook = useActiveBook();
  const activeChapterId = useStudioStore((s) => s.activeChapterId);
  return useMemo(
    () => activeBook?.chapters.find((c) => c.id === activeChapterId) ?? null,
    [activeBook, activeChapterId],
  );
}

export function useActiveChapterRow() {
  const activeBook = useActiveBook();
  const activeChapterId = useStudioStore((s) => s.activeChapterId);
  return useMemo(() => {
    if (!activeBook?.project) return null;
    const rows = mergeNovelChapterPlan(activeBook.project, activeBook.chapters);
    return rows.find((r) => r.key === activeChapterId) ?? rows[0] ?? null;
  }, [activeBook, activeChapterId]);
}

export function useStudioInput() {
  const input = useStudioStore((s) => s.input);
  const setInput = useStudioStore((s) => s.setInput);
  return [input, setInput] as const;
}

export function useStudioSelectedModel() {
  const selectedModelValue = useStudioStore((s) => s.selectedModelValue);
  const setSelectedModel = useStudioStore((s) => s.setSelectedModel);
  return [selectedModelValue, setSelectedModel] as const;
}
```

`useActiveBookStats` / `useCurrentStage` 可选：若仅 ChatPage 使用，也可在 ChatPage 内 `useMemo` 避免 selector 文件膨胀。

## 不在范围内

- 不修改 `lib/novel-store.ts` schema（P7）
- 不新建 `ChapterEditorDialog` / `ChapterVersionComparePanel` / `ReviewIssuePanel`（P6.5 可选）
- 不把 `chapterVersions` 迁入 store
- 不改 P0 已收敛的布局与视觉密度
- 不新增 sidebar action 模块（write 仍走 NovelStudio callbacks）
- 不修改 `NovelBookList` 结构（左侧列表独立维护）

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| P6 大块 JSX 搬迁引入 subtle 回归 | 按 section 逐步提交；每 section 后跑 verification |
| section 间隐式依赖（共享 closure 变量） | 搬迁前标注 `NovelBookPanel` 内 section 用到的外层变量，BookSidebar 显式传入 |
| `ReviewSection` / `context` 切分边界模糊 | 以原 `CollapsibleSection` 注释/ JSX 块为界，不重组 markup |
| ChatPage 与 NovelStudio 重复 derive 逻辑 | 共用 `novel-helpers` 纯函数；selector 仅薄包装 |

## 验证命令

每个阶段完成后运行：

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

### 人工验收

- [ ] 打开 AI 创作，三栏正常：书籍列表 / 对话 / 上下文
- [ ] 发送消息、QuickActions（写下一章/审稿/修订）正常
- [ ] tool / progress parts 渲染正常（ToolExecutionSteps）
- [ ] 右侧：默认只展开书籍信息 + 章节；其余 section 可展开且功能完整
- [ ] 章节编辑保存、版本恢复、审稿修订、任务重试、导出预览均可用
- [ ] batchQueue / activeTask pause-abort 仍正常（bar 由 NovelStudio 注入）

## 参考

- InkOS：`packages/studio/src/pages/ChatPage.tsx`
- InkOS：`packages/studio/src/components/chat/BookSidebar.tsx`
- InkOS：`packages/studio/src/components/chat/ToolExecutionSteps.tsx`
- 本平台：`docs/superpowers/specs/2026-07-08-inkos-studio-p3-p4-design.md`
- 本平台：`INKOS_STUDIO_ALIGNMENT_TODO.md`

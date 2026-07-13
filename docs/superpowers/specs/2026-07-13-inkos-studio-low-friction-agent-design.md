# InkOS Studio 对齐 — 低打扰 Agent 交互设计规格

**日期：** 2026-07-13  
**范围：** `apps/web/features/studio` — 写下一章主路径去弹窗、统一 action 路由、可选写作偏好 Sheet、消息流任务卡、Composer 收敛  
**状态：** 已确认，待实施  
**前置：** [2026-07-08 InkOS Studio P3+P4 设计](./2026-07-08-inkos-studio-p3-p4-design.md)（store + action runtime 已落地）

## 背景

P3/P4 已将 Zustand store、`dispatchStudioAction`、`sendMessage` / `runCoreAction` 从 `NovelStudio.tsx` 拆出。但主写作路径仍被 `WriteChapterConfirmDialog` 阻断：

- `QuickActions` 派发 `{ type: "write-chapter" }`，但 `NovelStudio.handleStudioAction` 特判绕过 `dispatch`，调用 `startWriteChapter()` → `requestWriteChapterConfirm()`。
- `dispatch.ts` 中 `write-chapter` 已可直接调 `runCoreAction`，主路径未走此线。
- 章节侧栏 `onGenerateChapter` 同样经 confirm 弹窗。
- `ProgressSteps` 为简单列表，非 InkOS 式可折叠任务卡。
- `ChatComposer` 使用 `Cmd/Ctrl+Enter` 发送，与 InkOS 的 Enter 发送不一致。

本设计覆盖 `todo.md` 全部 5 个实施批次，目标是对齐 InkOS Studio「点击即执行、过程在消息流、配置按需展开」的交互，同时保留章节版本、审稿、批量队列、云同步等增强能力。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 架构方案 | **方案 1 — 扩展 dispatch + write-chapter 模块** | 在 P3/P4 基础上增量演进；不新建独立 action-router 层 |
| action 唯一入口 | **`dispatchStudioAction`** | 组件层不得直接调用 `sendMessage` / `runCoreAction` |
| 默认写作参数 | **`book.assets.contextSelection` → `buildDefaultNovelContextSelection`** | 结构化 clone，禁止修改 store 内引用 |
| 高级配置 UI | **右侧 Sheet（窄屏底部 Sheet）** | 不使用居中全屏 Modal；批次 3 迁移旧 Dialog |
| 主按钮 | **SplitButton** | 主按钮一键生成；下拉提供高级/默认偏好入口 |
| progress 渲染 | **TaskExecutionCard（升级 ProgressSteps）** | 运行展开、成功收起、失败/暂停展开 |
| 持久化 schema | **不改 `novel-store.ts`** | 默认偏好经已有 `updateStoredNovelBook` patch `assets.contextSelection` |
| 实施节奏 | **5 批次严格串行** | 每批独立验收，不一次性全量重构 |

## 目标与验收标准

### 体验目标

1. 用户点击一次「写下一章」即开始生成，主路径零确认弹窗。
2. 默认参数来自书籍已保存的 `assets.contextSelection`；无保存值时用 `buildDefaultNovelContextSelection(project)`。
3. 生成期间在聊天流内显示简短、可折叠的 Agent 进度；完成后显示正文和保存状态。
4. 高级写作参数为可选入口（SplitButton 下拉 → Sheet），不是每次生成的必经步骤。
5. 「审稿」「修订本章」等同理：直接执行 + 消息流反馈（批次 4 统一任务卡）。

### 明确不做

- 不删除章节计划、上下文选择、题材/文风约束、审稿、批量队列、版本管理。
- 不把所有高级功能塞回聊天输入框。
- 不改变 `lib/novel-store.ts` 持久化数据结构。
- 不展示模型 thinking 链、无关 file tool 日志或虚构工具步骤。
- 不为对齐 InkOS 而移除章节版本、云同步、批量队列等增强。

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│ NovelStudio（编排壳：Sheet open state / toast / batchQueue）  │
└────────────┬───────────────────────────────┬─────────────────┘
             │ dispatchStudioAction         │ 打开 WritingSheet
             ▼                               ▼
┌────────────────────────┐    ┌──────────────────────────────┐
│ actions/dispatch.ts    │    │ components/writing/*          │
│  唯一 action router     │    │  OptionsForm / OptionsSheet   │
└────────────┬───────────┘    │  WriteChapterSplitButton      │
             │                └──────────────────────────────┘
             ▼
┌────────────────────────┐    ┌──────────────────────────────┐
│ actions/write-chapter.ts│───▶│ actions/run-core-action.ts    │
│  默认 selection 解析    │    │  Prompt / 流式 / progress     │
│  executeWriteChapter    │    │  result / checkpoint          │
└────────────────────────┘    └──────────────────────────────┘
             │
             ▼
┌────────────────────────┐
│ useStudioStore          │
│  message / task / book  │
└────────────────────────┘
```

### 模块边界

| 模块 | 职责 | 禁止 |
|------|------|------|
| `actions/write-chapter.ts` | `WriteChapterRequest`、默认 selection 解析、摘要、发起写章 | UI、弹窗、store 直接 mutation |
| `actions/dispatch.ts` | 按 `StudioAction.type` 分发 | 业务逻辑、confirm 回调 |
| `actions/run-core-action.ts` | Prompt 构建、流式执行、progress/result 写入 | 打开 Sheet/Dialog |
| `components/writing/*` | 受控表单、Sheet、SplitButton | 直连 `runCoreAction` |
| `NovelStudio.tsx` | Sheet open state、toast、batchQueue | write-chapter 特判、confirm Promise |

---

## 1. Action 路由与数据流

### 1.1 扩展 `StudioAction` 类型

```ts
type StudioActionSource =
  | "composer"
  | "quick-action"
  | "chapter-panel"
  | "advanced"
  | "retry"
  | "batch";

type StudioAction =
  | { type: "send-message"; text: string; source?: StudioActionSource }
  | {
      type: "write-chapter";
      source: StudioActionSource;
      target?: NovelChapterWriteTarget;
      contextSelection?: NovelContextSelection;
    }
  | { type: "review"; source?: StudioActionSource }
  | { type: "revise-chapter"; selectedIssueIds?: string[]; source?: StudioActionSource }
  | { type: "abort-task" };
```

`source` 仅用于行为一致性、埋点/测试和错误恢复，不改变 Prompt 内容。

### 1.2 `WriteChapterRequest` 与纯函数

```ts
type WriteChapterRequest = {
  target: NovelChapterWriteTarget;
  contextSelection: NovelContextSelection;
  source: StudioActionSource;
  persistAsDefault?: false;
};

// actions/write-chapter.ts
resolveDefaultWriteChapterSelection(book, project): NovelContextSelection
  // structuredClone(book.assets.contextSelection ?? buildDefaultNovelContextSelection(project))

summarizeContextSelection(selection): string
  // 用户语言，只列启用项，如「大纲、上一章摘要、世界观」

executeWriteChapter(ctx, request): Promise<boolean>
  // guard → runCoreAction(ctx, "write-chapter", { targetChapter, contextSelectionOverride })
```

### 1.3 统一 action 时序

```text
guard（书 / 会话 / 模型 / runningTask）
  → append 用户消息（一次）
  → append assistant 占位（一次）
  → store.startTask
  → runCoreAction 流式更新同一 assistant 消息
  → 成功或失败收束
  → store.finishTask（finally）
```

不允许 `NovelStudio.tsx` 用 resolver ref / Promise 等待常规 Agent 操作确认；仅破坏性操作（删除、覆盖不可恢复版本）保留 `AppDialog`。

### 1.4 三入口收敛

| 入口 | 改后 dispatch 调用 |
|------|-------------------|
| QuickActions 主按钮 | `{ type: "write-chapter", source: "quick-action" }` |
| 章节侧栏生成 | `{ type: "write-chapter", source: "chapter-panel", target }` |
| 文本命令「写下一章」 | `{ type: "write-chapter", source: "composer" }` via `QUICK_CORE_ACTIONS` 路由 |

输入框有文字时：`runCoreAction` 读取 `store.input.trim()` 作为 `userInstruction`，任务开始后清空 input。

### 1.5 删除项

- `StudioActionContext.confirmWriteChapter`
- `NovelStudio`: `writeChapterConfirm` state、`writeChapterConfirmResolverRef`、`requestWriteChapterConfirm`、`closeWriteChapterConfirm`、`handleStudioAction` 中 `write-chapter` 特判

---

## 2. UI 交互 — 主路径与写作偏好

### 2.1 批次 2：主路径去弹窗

| 触发 | 改后行为 |
|------|----------|
| QuickActions「写下一章」 | 直接 dispatch，0 次额外点击 |
| 章节侧栏「生成」 | 同上，`target` 由侧栏传入 |
| 输入框有文字 + 点写下一章 | 文字作为额外指令，任务开始后清空 |

默认 selection 不自动持久化；仅用户显式「编辑默认写作偏好 → 保存」才写回 `book.assets.contextSelection`。

批次 2 末：`WriteChapterConfirmDialog.tsx` 零引用，文件可暂留至批次 3 删除。

### 2.2 批次 3：`WriteChapterSplitButton`

替换 QuickActions 中「写下一章」普通 chip：

```
┌──────────────────────┬───┐
│     写下一章          │ ⌄ │
└──────────────────────┴───┘
```

- 主按钮 + 菜单「按默认偏好写下一章」行为相同
- 菜单项：「本章高级选项…」「编辑默认写作偏好…」
- `aria-label="写下一章"`；⌄ 按钮 `aria-haspopup="menu"`
- 任务运行中 disabled
- 「审稿」「修订本章」保持普通 chip（批次 4 统一任务卡）

**文件：** `components/chat/WriteChapterSplitButton.tsx`  
**QuickActions** 接收 `onWriteChapter`、`onOpenAdvancedOptions`、`onEditDefaultPreferences` callback。

### 2.3 批次 3：写作偏好 Sheet

**组件拆分：**

| 文件 | 职责 |
|------|------|
| `WriteChapterOptionsForm.tsx` | 纯受控表单：`value` / `onChange` / `mode` / `derivedStyleConstraints` |
| `WriteChapterOptionsSheet.tsx` | 容器：open/close、mode、footer 按钮 |

**两种 mode：**

| mode | 标题 | 初始值 | 主按钮 | 关闭行为 |
|------|------|--------|--------|----------|
| `once` | 本章高级选项 | `resolveDefault...()` clone | 「开始生成」→ dispatch + 临时 selection | 丢弃临时值 |
| `defaults` | 编辑默认写作偏好 | 书籍 `contextSelection` clone | 「保存偏好」→ patch assets | 未保存则丢弃 |

**表单信息架构：**

```
默认可见：目标字数、视角、节奏、额外要求（highlights）

▸ 上下文来源（折叠，默认收起）
  摘要：「已带入：大纲、上一章摘要、…」
  展开：6 个 checkbox

▸ 更多约束（折叠，默认收起）
  爽点、禁用词、额外风格约束

只读：题材/文风自动约束（derivedStyleConstraints，有值时显示）
```

**布局：**
- 桌面：右侧 Sheet，360–440px
- 窄屏（≤1024px）：底部 Sheet，max-height 85vh
- Esc / 遮罩 / 取消 → 关闭，focus 回触发按钮
- CSS：`.writingOptionsSheet` 等；迁移后删除 `.writeChapterConfirmDialog`

**数据隔离：**

```text
once:     打开 clone → 开始生成 dispatch → 关闭丢弃
defaults: 打开 clone → 保存 patch → toast「已保存为默认写作偏好」
```

### 2.4 NovelStudio 最小 UI 状态

```ts
type WritingSheetState =
  | { mode: "once"; target: NovelChapterWriteTarget }
  | { mode: "defaults" }
  | null;
```

---

## 3. 消息流与任务卡（批次 4）

### 3.1 扩展 `progress` part（向后兼容）

```ts
type ProgressPart = {
  type: "progress";
  label: string;
  steps: Array<{ message: string; at: number }>;
  paused?: boolean;
  status?: "running" | "completed" | "error" | "paused";
  startedAt?: string;
  completedAt?: string;
  summary?: string;
};
```

**渲染推断（旧数据无 status）：**
- `paused: true` → paused
- 同消息含 `result` → completed
- 同消息含 `error` → error
- 否则 → running

### 3.2 `runCoreAction` progress 规范

写章节 progress 步骤（仅真实阶段，不伪造思考）：

```text
1. 「正在准备第 N 章《标题》」
2. 「已带入 X 项上下文：…」（summarizeContextSelection，仅一条摘要）
3. …现有流式步骤…
4. 「第 N 章已保存」
```

- `tool` part 无用户意义内容不渲染
- 有意义步骤（保存章节等）合并进 progress 卡
- Core Action 完成后正文放入独立 `result` part

### 3.3 `TaskExecutionCard`（升级 `ProgressSteps.tsx`）

| 状态 | 默认折叠 | 行为 |
|------|----------|------|
| running | 展开 | 显示耗时 |
| completed | 收起（标题 + summary） | 可手动展开 |
| error / paused | 展开 | recovery + 重试/继续 |

长正文 result：支持复制，不默认折叠到不可见。

### 3.4 错误 / 重试 / 取消幂等性

| 场景 | 规则 |
|------|------|
| 失败重试 | 复用同一 `assistantMessageId`，不新增用户消息 |
| 取消/暂停 | progress 保留，checkpoint 写入 |
| 刷新恢复 | 从 checkpoint + 持久化消息恢复，无永久 spinner |
| 切换书籍/会话 | 任务只更新发起时 `requestSessionId` |

### 3.5 Agent 反馈规范

| 状态 | 用户可见 | 行为 |
|------|----------|------|
| 刚点击 | `正在准备第 N 章《标题》` | 新增 assistant progress |
| 上下文组装 | `已带入 X 项上下文` | 一行摘要 |
| Agent 执行 | `正在创作…` + 真实进度 | 折叠卡，运行自动展开 |
| 成功 | `第 N 章已保存` + result 正文 | progress 收起 |
| 失败 | 原因 + 重试 | 不丢失额外指令 |
| 取消/暂停 | 当前进度保留 | checkpoint / resume |

---

## 4. Composer 与可靠性（批次 5）

### 4.1 键盘与发送

```ts
onKeyDown:
  if (event.isComposing) return;
  if (event.key === "Enter" && !event.shiftKey) { preventDefault(); onSend(); }
  // Cmd/Ctrl+Enter 保留兼容
```

- textarea 自动增高，max-height ~200px
- 发送后清空 input

### 4.2 Composer 视觉顺序

```text
快捷动作（含 SplitButton）→ 输入框/发送 → 模型选择 → 更多菜单
→ [仅有任务时] batchQueueBar / activeTaskBar
```

任务运行中：禁用并发写作动作和发送；允许阅读、展开进度、取消/暂停。

### 4.3 智能滚动

新增 `useMessageListScroll`（或等效逻辑）：

- `userScrolledAway`：用户不在底部附近时为 true
- 新消息/流式更新：仅 `!userScrolledAway` 时 auto-scroll
- 滚离底部时显示「回到最新消息」按钮

### 4.4 会话安全

- 运行中切换书籍/会话：原任务只更新发起会话
- `activeSessionId` 为空：guard 阻止，仅 toast
- 取消/失败/重试：最多 1 条用户消息 + 1 条 assistant 任务消息

---

## 5. 实施批次

| 批次 | 范围 | 验收 | 本批不做 |
|------|------|------|----------|
| **1** | `write-chapter.ts`、扩展 dispatch/types、三入口统一、单测 | 行为不变（弹窗仍在），test 通过 | 删弹窗、改 UI |
| **2** | 删除 confirm 主路径、一键生成 | 点击即见聊天流，无 Modal | 高级 Sheet |
| **3** | SplitButton + OptionsSheet + 删旧 Dialog | 高级可配，默认/临时不串 | 任务卡 |
| **4** | TaskExecutionCard + progress 扩展 | 写/审/修订统一任务卡 | thinking 链 |
| **5** | Enter 发送、scroll、会话安全、全量回归 | 自动化 + 手工全过 | schema 改动 |

### 推荐提交拆分

1. `refactor(studio): introduce typed write-chapter request and default resolver`
2. `feat(studio): start next chapter directly from quick action`
3. `feat(studio): move chapter options into optional writing sheet`
4. `refactor(studio): collapsible task execution card in message stream`
5. `feat(studio): inkos-style composer input and message scroll`

---

## 6. 文件清单

| 操作 | 文件 |
|------|------|
| 新增 | `actions/write-chapter.ts`、`actions/write-chapter.test.mjs` |
| 新增 | `components/writing/WriteChapterOptionsForm.tsx` |
| 新增 | `components/writing/WriteChapterOptionsSheet.tsx` |
| 新增 | `components/chat/WriteChapterSplitButton.tsx` |
| 新增 | `hooks/useMessageListScroll.ts`（可选，或内联 NovelStudio） |
| 修改 | `actions/dispatch.ts`、`actions/types.ts`、`actions/run-core-action.ts` |
| 修改 | `components/NovelStudio.tsx` |
| 修改 | `components/chat/QuickActions.tsx`、`ChatComposer.tsx` |
| 修改 | `components/chat/ProgressSteps.tsx`、`MessagePartRenderer.tsx` |
| 修改 | `store/types.ts`、`store/selectors.ts` |
| 修改 | `studio.module.css` |
| 删除 | `components/dialogs/WriteChapterConfirmDialog.tsx`（批次 3 末） |

---

## 7. 测试计划

### 单元测试

- `write-chapter.test.mjs`：clone 默认 selection、summary 只含启用项、不 mutate 输入
- `dispatch` 测试：`write-chapter` 路由到 write-chapter action，无 confirm callback
- `run-core-action` 测试：selection 传入指令构建；progress 仅一条上下文摘要
- SplitButton：主按钮一次 dispatch；菜单不自动执行
- OptionsSheet：once 关闭不保存；defaults 保存回显；Esc/focus
- TaskExecutionCard：折叠行为、旧 progress fallback
- 会话安全：切换 session、空 activeSession、重试幂等

### 手工验收（Chrome，桌面 + 窄屏 ≤1024px）

- [ ] 点击「写下一章」：一次点击即见进度，无弹窗
- [ ] 章节侧栏生成：与快捷按钮一致
- [ ] 「本章高级选项」：Sheet 出现；1500 字生效
- [ ] 「编辑默认偏好」：保存后下次主按钮直接用新值
- [ ] 输入额外指令 + 主按钮：指令带入，input 清空
- [ ] 运行/失败/暂停/取消/重试：无重复用户消息
- [ ] 无书/会话/模型：明确可恢复提示
- [ ] 键盘 Tab/Enter/Esc 完成全部路径

### 必跑命令

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web test
```

---

## 8. Definition of Done

- [ ] 三入口行为一致，主路径零确认 Modal
- [ ] 默认偏好 vs 单次临时偏好严格隔离
- [ ] Agent 过程只在消息流，完成后不喧宾夺主
- [ ] `NovelStudio.tsx` 无 confirm Promise / resolver ref
- [ ] `novel-store.ts` schema 零改动
- [ ] typecheck、lint、test、Chrome 手工验收全过
- [ ] 删除死代码、废弃 CSS

## 9. 回滚策略

- 不涉及数据库迁移
- 保留 `runCoreAction` 上下文构建和 checkpoint 行为
- 可按批次单独 revert UI/action 提交

# InkOS Studio 对齐 — P3 + P4 设计规格

**日期：** 2026-07-08  
**范围：** P3 建立 InkOS 风格 Studio Store + P4 统一 Chat 与 Core Action Runtime  
**状态：** 已确认，待实施

## 背景

P0–P2 已完成：`page.tsx` 从 10k+ 行降到 ~318 行，模型配置迁入 `features/models/`，小说工作台迁入 `features/studio/components/NovelStudio.tsx`（~3200 行）。

当前核心问题：

- `NovelStudio` 内联 ~20 个 `useState`，`books` / `messagesBySession` / `activeBookId` / `isSending` / `isRunningCoreAction` 等 runtime 状态与 UI 耦合
- `sendNovelMessage` / `runCoreAction` / `runBatchCoreAction` 三个 async 函数内联在组件内（合计 ~700 行），直接操作 state + IndexedDB
- Chat 与 Core Action 用 markdown 字符串（`formatCoreProgressContent`）模拟进度，渲染路径不统一
- `QuickActions` 传递中文字符串命令，而非 typed action

本设计覆盖 INKOS_STUDIO_ALIGNMENT_TODO.md 中的 **P3** 和 **P4**，不涉及 P5（ChatPage 拆分）、P6（BookSidebar 拆分）、P7（novel-store 收敛）。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 状态管理 | **A — Zustand slice** | 对齐 InkOS `store/chat`，新增 `zustand` 依赖 |
| 消息模型迁移 | **A — 数据层 + 渲染同步改** | Action 写结构化 `StudioMessagePart`；新增渲染组件，废弃新消息路径上的 markdown 进度拼接 |
| Store 迁入范围 | **A — 核心 runtime** | books、sessions、messages、activeIds、input、selectedModel、runningTask 迁入 store；dialog/toast/cloudSync/batchQueue 留 NovelStudio |
| 实现方案 | **1 — Slice 管状态 + 独立 Action 模块** | slice 负责同步 mutation；`actions/` 负责 async 编排 |
| 持久化 schema | **不改 novel-store** | P3/P4 经 `message-bridge.ts` 适配；schema 扩展留 P7 |

## 目标与验收标准

### P3 完成标准

- [ ] 新建 `features/studio/store/types.ts`，定义 `StudioSessionRuntime`、`StudioMessage`、`StudioMessagePart`、`StudioTaskRuntime`、`StudioBookRuntime`
- [ ] 新建 `features/studio/store/store.ts`，4 slices：session / message / task / book
- [ ] `books`、`messagesBySession`、`activeBookId`、`activeSessionId`、`activeChapterId`、`input`、`selectedModelValue`、`runningTask` 迁入 store
- [ ] UI 组件通过 selector + action 读写，不再 props drilling 一长串 runtime state
- [ ] `isSending` + `isRunningCoreAction` 合并为单一 `runningTask: StudioTaskRuntime | null`

### P4 完成标准

- [ ] `sendNovelMessage` → `actions/send-message.ts`
- [ ] `runCoreAction` → `actions/run-core-action.ts`
- [ ] `runBatchCoreAction` → `actions/run-batch-action.ts`
- [ ] Chat 与 Core Action 共用 `StudioMessagePart`（text / progress / tool / error / result）
- [ ] 新消息不再用 `formatCoreProgressContent` 拼 markdown；改用 `ProgressSteps` 等组件渲染
- [ ] Abort / pause / resume / task log 写入统一放在 action runtime + task slice
- [ ] `QuickActions` 派发 typed action（`{ type: "write-chapter" }`），不再传中文字符串
- [ ] 行为零回归：typecheck、lint、现有测试全部通过
- [ ] 旧 IndexedDB 消息（仅 `content: string`）正常显示

### 量化目标

- `NovelStudio.tsx`：~3200 行 → ~1800 行（UI/弹窗/导出仍留，P5–P6 继续瘦）
- 新增依赖：`zustand ^5.0.12`（与 InkOS 同版本）
- 新增文件：~18 个（store 6 + actions 5 + persistence 1 + components 4 + tests 4）
- `lib/novel-store.ts`：0 行 schema 改动

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│ NovelStudio（编排壳：dialog / toast / batchQueue / 导出） │
└───────────┬─────────────────────────────┬───────────────┘
            │ selectors                 │ dispatchStudioAction
            ▼                           ▼
┌───────────────────────┐    ┌──────────────────────────┐
│ useStudioStore        │◄───│ actions/                 │
│  book slice           │    │  send-message.ts         │
│  session slice        │    │  run-core-action.ts      │
│  message slice        │    │  run-batch-action.ts     │
│  task slice           │    │  dispatch.ts             │
└───────────┬───────────┘    └──────────┬───────────────┘
            │                           │
            ▼                           ▼
┌───────────────────────┐    ┌──────────────────────────┐
│ persistence/          │    │ helpers/                 │
│  message-bridge.ts    │    │  inkos-stream.ts         │
└───────────┬───────────┘    │  model-binding.ts      │
            │                └──────────┬───────────────┘
            ▼                           ▼
┌───────────────────────┐    ┌──────────────────────────┐
│ lib/novel-store.ts    │    │ @repo/inkos-adapter      │
│ (IndexedDB, 不改schema)│    │ provider API             │
└───────────────────────┘    └──────────────────────────┘
```

## 目录结构

```
apps/web/features/studio/
  store/
    types.ts                    # StudioMessage, StudioMessagePart, slices 类型
    store.ts                    # create<StudioStore>()
    initialState.ts
    selectors.ts                # useActiveBook, useActiveMessages, useCanStartTask
    slices/
      book/
        initialState.ts
        action.ts
      session/
        initialState.ts
        action.ts
      message/
        initialState.ts
        action.ts
        parts-builder.ts        # 纯函数：build/append/update parts
      task/
        initialState.ts
        action.ts
  actions/
    types.ts                    # StudioAction, StudioActionContext
    dispatch.ts                 # dispatchStudioAction router
    send-message.ts
    run-core-action.ts
    run-batch-action.ts
    runtime/
      task-guard.ts
      message-parts.ts          # flatten/unflatten, legacy detect
  persistence/
    message-bridge.ts           # StudioMessage ↔ StoredNovelMessage
  components/chat/
    ChatMessage.tsx             # 新增：单条消息容器
    MessagePartRenderer.tsx     # 新增：按 part.type 分发
    ProgressSteps.tsx           # 新增：progress part 渲染
    QuickActions.tsx            # 改：typed action callback
    MarkdownContent.tsx         # 保留：legacy fallback + 普通 text
    ChatComposer.tsx            # 改：接 store selectors
```

## 类型系统

### `StudioMessagePart`

```typescript
type StudioMessagePart =
  | { type: "text"; content: string }
  | {
      type: "progress";
      label: string;
      steps: Array<{ message: string; at: number }>;
      paused?: boolean;
    }
  | {
      type: "tool";
      label: string;
      status: "running" | "completed" | "error";
      detail?: string;
    }
  | { type: "error"; title: string; detail: string; recovery?: string }
  | { type: "result"; title: string; content: string };
```

### `StudioMessage`

```typescript
type StudioMessage = {
  id: string;
  role: "user" | "assistant";
  parts: StudioMessagePart[];
  streaming?: boolean;
  status?: "sent" | "error";
  createdAt: string;
};
```

### `StudioTaskRuntime`

```typescript
type StudioTaskRuntime = {
  kind: "chat" | "core" | "batch";
  label: string;
  action?: InkosCoreAction;
  status: "running" | "paused" | "error";
  abortController: AbortController;
  taskId?: string;
  assistantMessageId?: string;
};
```

`StudioSessionRuntime` 复用现有 session 字段（id / bookId / title / summary / age）。  
`StudioBookRuntime` 复用现有 `NovelBookEntry` 类型，不重复定义。

### `StudioAction`

```typescript
type StudioAction =
  | { type: "send-message"; text: string }
  | { type: "write-chapter" }
  | { type: "review" }
  | { type: "revise-chapter"; selectedIssueIds?: string[] }
  | { type: "abort-task" };
```

## Store 设计（4 Slices）

### book slice

| State | 说明 |
|-------|------|
| `books: NovelBookEntry[]` | 工作区书籍列表 |
| `activeBookId: string` | 当前书籍 |
| `activeChapterId: string` | 当前章节 |
| `isLoading: boolean` | workspace 加载中 |
| `error: string` | 加载错误 |

| Actions | 说明 |
|---------|------|
| `hydrateFromSnapshot(snapshot)` | 从 `loadNovelWorkspace()` 灌入 |
| `setBooks(books)` | 全量替换 |
| `patchBook(bookId, patch)` | 单书局部更新（core action 写回后） |
| `setActiveBook(id)` | 切换书籍 |
| `setActiveChapter(id)` | 切换章节 |

### session slice

| State | 说明 |
|-------|------|
| `activeSessionId: string` | 当前会话 |
| `input: string` | 输入框 |
| `selectedModelValue: string` | 模型选择（`providerId::model` 格式） |

| Actions | 说明 |
|---------|------|
| `setActiveSession(id)` | 切换会话 |
| `setInput(text)` | 更新输入 |
| `setSelectedModel(value)` | 更新模型 |

### message slice

| State | 说明 |
|-------|------|
| `messagesBySessionId: Record<string, StudioMessage[]>` | 会话消息 |

| Actions | 说明 |
|---------|------|
| `setMessagesForSession(sessionId, messages)` | 全量替换（hydrate 用） |
| `appendMessage(sessionId, message)` | 追加消息 |
| `updateMessage(sessionId, messageId, updater)` | 更新单条 |
| `appendPart(sessionId, messageId, part)` | 追加 part |
| `updateLastPart(sessionId, messageId, updater)` | 更新最后一个 part（streaming 用） |
| `clearSession(sessionId)` | 清空会话消息 |

### task slice

| State | 说明 |
|-------|------|
| `runningTask: StudioTaskRuntime | null` | 当前运行任务（null = idle） |

| Actions | 说明 |
|---------|------|
| `startTask(task: StudioTaskRuntime)` | 开始任务 |
| `pauseTask()` | 标记 paused（配合 core action checkpoint） |
| `finishTask()` | 清空 runningTask |
| `abortTask()` | 调用 abortController.abort() + finishTask |

### Selectors（`selectors.ts`）

```typescript
function useActiveBook(): NovelBookEntry | null
function useActiveMessages(): StudioMessage[]
function useIsTaskRunning(): boolean
function useCanStartTask(): { canStart: boolean; message: string }
function useRunningTaskLabel(): string
```

`useCanStartTask` 内部调用 `getNovelTaskGuard({ runningTask })`，替代原来的双 boolean 检查。

## Action Runtime

### `StudioActionContext`

Action 模块不 import React，通过 context 注入外部依赖：

```typescript
type StudioActionContext = {
  getState: () => StudioStore;
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
  notify: (message: string, tone: "success" | "warning" | "error") => void;
  confirmWriteChapter?: (opts: WriteChapterConfirmOptions) => Promise<NovelContextSelection | null>;
  refreshWorkspace: () => Promise<void>;
};
```

### `send-message.ts` 流程

1. `task-guard` 检查 `runningTask === null`
2. 校验 session / model binding / project 存在
3. `startTask({ kind: "chat", label: "聊天回复", ... })`
4. message slice：追加 user message + assistant message（初始 text part，`streaming: true`）
5. `appendStoredNovelMessage` 持久化 user message
6. `streamNovelChat` → 增量 `updateLastPart` 更新 text part
7. 成功：finalize text part，`appendStoredNovelMessage` 持久化，`finishTask`
8. 失败/abort：替换为 error part 或取消文案，`finishTask`

### `run-core-action.ts` 流程

1. guard + binding + book/project 校验
2. 处理 resume checkpoint（复用现有 `StoredNovelTask` 逻辑）
3. `startTask({ kind: "core", label, action, ... })`
4. 创建/恢复 `StoredNovelTask`，写入 taskId
5. message slice：追加 user message（非 resume）+ assistant message（初始 progress part）
6. `streamInkosCoreAction` 事件映射：
   - `progress` → append step 到 progress part
   - 完成 → 追加 result part，清除 streaming
   - 错误 → 替换/追加 error part
7. **写回逻辑**（从 NovelStudio 原样迁入，不改行为）：
   - write-chapter → `upsertStoredNovelChapter` + assets delta + project sync
   - review → parse review notes + reconcile history
   - revise-chapter → update chapter content + mark issues resolved
   - radar → `applyNovelMarketRadarToAssets`
   - diagnostics → merge local + remote diagnostics
8. `patchBook` 更新 store，`appendStoredNovelMessage` 持久化，`finishStoredNovelTask`
9. pause：写 checkpoint + `pauseTask`；abort：`abortTask` + error part

### `run-batch-action.ts` 流程

- `batchQueue*` state 仍留 NovelStudio（不在 P3 迁入范围）
- 函数签名：`runBatchCoreAction(ctx, action: NovelBatchQueueAction)`
- 内部：build queue items → 循环调用 `runCoreAction(ctx, item.action, options)`
- 不再 duplicate guard / stream / progress 逻辑

### `dispatch.ts`

```typescript
function dispatchStudioAction(ctx: StudioActionContext, action: StudioAction): void {
  switch (action.type) {
    case "send-message":
      void sendMessage(ctx, action.text);
      break;
    case "write-chapter":
      void runCoreAction(ctx, "write-chapter");
      break;
    case "review":
      void runCoreAction(ctx, "review");
      break;
    case "revise-chapter":
      void runCoreAction(ctx, "revise-chapter", { selectedIssueIds: action.selectedIssueIds });
      break;
    case "abort-task":
      ctx.getState().abortTask();
      break;
  }
}
```

## 消息渲染

### 新组件

| 组件 | 职责 |
|------|------|
| `ChatMessage.tsx` | 单条消息容器（user/assistant 样式、streaming indicator） |
| `MessagePartRenderer.tsx` | 按 `part.type` 分发到子组件 |
| `ProgressSteps.tsx` | 渲染 progress part 的步骤列表（替代 markdown 进度块） |

### 渲染规则

```tsx
// NovelStudio message list 改造
{messages.map((message) => (
  <ChatMessage key={message.id} message={message} />
))}

// ChatMessage 内部
{message.parts.map((part, i) => (
  <MessagePartRenderer key={i} part={part} />
))}
```

### Legacy fallback

从 IndexedDB 加载的消息仅含 `content: string`，经 `message-bridge.ts` 转为：

```typescript
{ parts: [{ type: "text", content: stored.content }] }
```

若检测到 content 匹配旧 core action markdown 格式（`## ` 开头 + `### 执行进度`），仍用 `MarkdownContent` 渲染该 text part，保证历史消息显示不变。

新产生的 chat / core action 消息一律走结构化 parts 渲染。

### 废弃路径

以下函数在新消息路径上不再调用（保留文件供 legacy 检测参考，P5 可删）：

- `formatCoreProgressContent`
- `formatCoreFinalContent`

`formatCoreErrorContent` 的逻辑迁入 `message-parts.ts` 的 `buildErrorPart()`。

## 持久化边界

### `message-bridge.ts`

```typescript
function fromStoredMessage(stored: StoredNovelMessage): StudioMessage
function toStoredMessage(msg: StudioMessage, sessionId: string): StoredNovelMessage
function flattenPartsToContent(parts: StudioMessagePart[]): string
function isLegacyCoreMarkdown(content: string): boolean
```

**写入**：`toStoredMessage` 将 parts flatten 为 `content` 字符串写入现有 `StoredNovelMessage` schema（不新增 `parts` 字段）。

**读取**：`fromStoredMessage` 将 `content` 包装为单 text part；渲染层按 legacy 规则决定是否走 MarkdownContent。

**Flatten 规则**：

- text / result → 直接取 content
- progress → 转为 `## {label}\n- step1\n- step2` 格式（与旧格式兼容，backup/export 不受影响）
- error → 转为 `## {title}\n### 原因\n{detail}` 格式

## NovelStudio 迁移

### 迁入 store 的 state

| 原 useState | 迁入 |
|-------------|------|
| `books` | book slice |
| `activeBookId` | book slice |
| `activeChapterId` | book slice |
| `isNovelStoreLoading` | book slice `isLoading` |
| `novelStoreError` | book slice `error` |
| `activeSessionId` | session slice |
| `input` | session slice |
| `selectedModelValue` | session slice |
| `messagesBySession` | message slice |
| `isSending` + `isRunningCoreAction` + `activeTaskLabel` | task slice `runningTask` |

### 留 NovelStudio 的 state

dialog、toast、cloudSync、batchQueue、toolPanel、writeChapterConfirm、chapterVersions、publishValidation、webDav 等 UI/弹窗/低频功能 state。

### 删除的内联函数

- `sendNovelMessage` → `actions/send-message.ts`
- `runCoreAction` → `actions/run-core-action.ts`
- `runBatchCoreAction` → `actions/run-batch-action.ts`
- `runQuickAction` → `dispatchStudioAction`

### 保留的 refs（暂留 NovelStudio，供 core action pause/resume）

- `activeCoreTaskIdRef`
- `activeCoreProgressRef`
- `activeCoreAssistantMessageIdRef`
- `activeTaskPauseRequestedRef`

P4 实施时将 refs 协调逻辑迁入 `run-core-action.ts` 内部，NovelStudio 不再持有。

## 测试计划

### 新增测试文件

| 文件 | 覆盖 |
|------|------|
| `store/slices/message/parts-builder.test.mjs` | part builder、append/update part |
| `actions/runtime/message-parts.test.mjs` | flatten/unflatten、buildErrorPart、buildProgressPart、buildResultPart |
| `actions/runtime/task-guard.test.mjs` | runningTask guard（替代双 boolean） |
| `persistence/message-bridge.test.mjs` | fromStored/toStored、legacy detect |

`send-message` / `run-core-action` 的集成测试在 P4 第二步追加（mock stream + mock store）。

### 验收命令

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test \
  apps/web/lib/novel-store.test.mjs \
  apps/web/lib/provider-stream-parser.test.mjs \
  apps/web/features/studio/store/slices/message/parts-builder.test.mjs \
  apps/web/features/studio/actions/runtime/message-parts.test.mjs \
  apps/web/features/studio/actions/runtime/task-guard.test.mjs \
  apps/web/features/studio/persistence/message-bridge.test.mjs
```

## 不在范围内

- 不拆 `ChatPage.tsx` / `BookSidebar.tsx`（P5/P6）
- 不改 `lib/novel-store.ts` schema（P7）
- 不迁 batchQueue state 到 store（P7/P8）
- 不迁 dialog/toast/cloudSync state
- 不添加 URL 路由
- 不改变 UI 样式或布局（P0 已收敛）

## 实施顺序

### Phase 1 — Store 骨架（P3）

1. 添加 `zustand` 依赖
2. 创建 `store/types.ts` + `initialState.ts` + 4 slice 骨架
3. 创建 `store/store.ts` + `selectors.ts`
4. 创建 `persistence/message-bridge.ts` + 测试
5. NovelStudio 改用 store 读写 books/sessions/messages/activeIds/input/selectedModel
6. 验证：workspace 加载、切书、切会话、消息列表显示正常

### Phase 2 — Action 抽取（P4）

7. 创建 `actions/types.ts` + `runtime/task-guard.ts` + `runtime/message-parts.ts`
8. 创建消息渲染组件（ChatMessage / MessagePartRenderer / ProgressSteps）
9. 抽取 `send-message.ts`，替换内联函数
10. 抽取 `run-core-action.ts`（含写回逻辑 + pause/resume/abort）
11. 抽取 `run-batch-action.ts` + `dispatch.ts`
12. QuickActions / ChatComposer 接 typed dispatch
13. 删除 NovelStudio 内联 action 函数和相关 refs

### Phase 3 — 验收

14. 运行验收命令
15. 人工验收：chat 回复、写下一章、审稿、修订、abort、旧消息显示
16. 更新 `INKOS_STUDIO_ALIGNMENT_TODO.md` P3/P4 勾选

## 参考

- InkOS: `packages/studio/src/store/chat/types.ts`
- InkOS: `packages/studio/src/store/chat/store.ts`
- InkOS: `packages/studio/src/store/chat/slices/message/action.ts`
- InkOS: `packages/studio/src/store/chat/slices/message/runtime.ts`
- InkOS: `packages/studio/src/components/chat/ToolExecutionSteps.tsx`
- 当前: `apps/web/features/studio/components/NovelStudio.tsx`
- 当前: `apps/web/features/studio/helpers/inkos-stream.ts`
- 当前: `apps/web/features/studio/state/studio-types.ts`

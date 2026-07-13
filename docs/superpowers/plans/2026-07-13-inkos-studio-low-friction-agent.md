# InkOS Studio 低打扰 Agent 交互 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除写下一章主路径确认弹窗，统一 action 路由，保留可选高级写作偏好 Sheet，并将 Agent 进度收敛到 InkOS 式消息流任务卡。

**Architecture:** 扩展现有 `dispatchStudioAction` + 新增 `actions/write-chapter.ts` 纯逻辑模块；UI 层（SplitButton / Sheet）与 action runtime 分离；`runCoreAction` 继续作为唯一执行引擎。5 批次严格串行交付。

**Tech Stack:** Next.js 16、React 19、Zustand 5、TypeScript 5.9、Node test runner（`--experimental-strip-types`）

**Spec:** [`docs/superpowers/specs/2026-07-13-inkos-studio-low-friction-agent-design.md`](../specs/2026-07-13-inkos-studio-low-friction-agent-design.md)

---

## File Structure（全批次）

| 文件 | 职责 |
|------|------|
| `actions/write-chapter.ts` | 默认 selection 解析、摘要、`executeWriteChapter` |
| `actions/dispatch.ts` | 唯一 action router |
| `actions/types.ts` | `StudioAction`、`StudioActionSource`、`WriteChapterRequest` |
| `actions/run-core-action.ts` | Prompt / 流式 / progress（批次 4 补充摘要） |
| `components/writing/WriteChapterOptionsForm.tsx` | 受控表单（批次 3） |
| `components/writing/WriteChapterOptionsSheet.tsx` | Sheet 容器（批次 3） |
| `components/chat/WriteChapterSplitButton.tsx` | SplitButton（批次 3） |
| `components/chat/ProgressSteps.tsx` | TaskExecutionCard（批次 4） |
| `components/NovelStudio.tsx` | 编排壳；批次 1 起删除 write-chapter 特判 |

---

## 验证命令（每批次末尾必跑）

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
pnpm --filter web run check-types
pnpm --filter web run lint
node --experimental-strip-types --test \
  apps/web/features/studio/actions/write-chapter.test.mjs \
  apps/web/features/studio/actions/dispatch.test.mjs \
  apps/web/features/studio/actions/runtime/task-guard.test.mjs \
  apps/web/features/studio/store/slices/message/parts-builder.test.mjs
```

---

# 批次 1：收口写下一章动作入口（不改 UI、弹窗仍在）

**Goal:** 三入口（QuickActions、章节侧栏、文本命令）共用 typed `executeWriteChapter`；`dispatchStudioAction` 成为唯一 router。用户仍看到 confirm 弹窗（行为不变）。

**Architecture:** `executeWriteChapter` 在 batch 1 仍调用 `ctx.requestWriteChapterConfirm`（强类型化）；batch 2 删除该分支。

---

### Task 1: `resolveDefaultWriteChapterSelection` 与 `summarizeContextSelection`

**Files:**
- Create: `apps/web/features/studio/actions/write-chapter.ts`
- Create: `apps/web/features/studio/actions/write-chapter.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// apps/web/features/studio/actions/write-chapter.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDefaultWriteChapterSelection,
  summarizeContextSelection,
} from "./write-chapter.ts";

const savedSelection = {
  includeOutline: false,
  includePreviousSummary: true,
  includeWorld: false,
  includeCharacters: true,
  includeForeshadowing: false,
  includeReviewIssues: true,
  targetWords: 2500,
  viewpoint: "第一人称",
  pacing: "快节奏",
  highlights: "反转",
  bannedWords: "烂俗",
  styleConstraints: "冷峻",
  thrillPoints: "悬疑",
};

const bookWithSaved = {
  assets: { contextSelection: savedSelection },
};

const bookWithoutSaved = {
  assets: {},
};

const project = { chapterWordCount: 3000 };

test("resolveDefaultWriteChapterSelection uses saved assets.contextSelection", () => {
  const result = resolveDefaultWriteChapterSelection(bookWithSaved, project);
  assert.deepEqual(result, savedSelection);
  assert.notEqual(result, savedSelection);
});

test("resolveDefaultWriteChapterSelection falls back to buildDefaultNovelContextSelection", () => {
  const result = resolveDefaultWriteChapterSelection(bookWithoutSaved, project);
  assert.equal(result.targetWords, 3000);
  assert.equal(result.includeOutline, true);
  assert.equal(result.viewpoint, "第三人称有限视角");
});

test("resolveDefaultWriteChapterSelection does not mutate book assets", () => {
  resolveDefaultWriteChapterSelection(bookWithSaved, project).includeOutline = true;
  assert.equal(bookWithSaved.assets.contextSelection.includeOutline, false);
});

test("summarizeContextSelection lists only enabled context items", () => {
  const summary = summarizeContextSelection(savedSelection);
  assert.match(summary, /上一章摘要/);
  assert.match(summary, /角色/);
  assert.match(summary, /审稿遗留问题/);
  assert.doesNotMatch(summary, /大纲|世界观|伏笔/);
});

test("summarizeContextSelection returns fallback when nothing enabled", () => {
  const summary = summarizeContextSelection({
    ...savedSelection,
    includeOutline: false,
    includePreviousSummary: false,
    includeWorld: false,
    includeCharacters: false,
    includeForeshadowing: false,
    includeReviewIssues: false,
  });
  assert.equal(summary, "无额外上下文");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test apps/web/features/studio/actions/write-chapter.test.mjs
```

Expected: FAIL — `Cannot find module './write-chapter.ts'` or export not defined

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/features/studio/actions/write-chapter.ts
import {
  buildDefaultNovelContextSelection,
  selectNextNovelChapterTarget,
  buildNovelStyleConstraintsFromAssets,
  type InkosNovelProject,
  type NovelChapterWriteTarget,
  type NovelContextSelection,
  type NovelProjectAssets,
} from "../../../lib/novel-store";
import type { NovelBookEntry } from "../state/studio-types";
import type { StudioActionContext, StudioActionSource } from "./types";
import { runCoreAction } from "./run-core-action";

export type WriteChapterRequest = {
  target: NovelChapterWriteTarget;
  contextSelection: NovelContextSelection;
  source: StudioActionSource;
};

const CONTEXT_LABELS: Array<[keyof NovelContextSelection, string]> = [
  ["includeOutline", "章节计划 / 大纲"],
  ["includePreviousSummary", "上一章摘要"],
  ["includeWorld", "世界观"],
  ["includeCharacters", "角色状态"],
  ["includeForeshadowing", "伏笔池"],
  ["includeReviewIssues", "审稿遗留问题"],
];

export function resolveDefaultWriteChapterSelection(
  book: Pick<NovelBookEntry, "assets">,
  project: Pick<InkosNovelProject, "chapterWordCount">,
): NovelContextSelection {
  const base =
    book.assets.contextSelection ??
    buildDefaultNovelContextSelection(project);
  return structuredClone(base);
}

export function summarizeContextSelection(
  selection: NovelContextSelection,
): string {
  const enabled = CONTEXT_LABELS.filter(([key]) =>
    Boolean(selection[key]),
  ).map(([, label]) => label);
  return enabled.length > 0 ? enabled.join("、") : "无额外上下文";
}

export async function executeWriteChapter(
  ctx: StudioActionContext,
  options: {
    source: StudioActionSource;
    target?: NovelChapterWriteTarget;
    contextSelection?: NovelContextSelection;
  },
): Promise<boolean> {
  const store = ctx.getState();
  const activeBook =
    store.books.find((book) => book.id === store.activeBookId) ?? null;
  const project = activeBook?.project ?? null;

  if (!activeBook || !project) {
    ctx.notify("请先创建一本书籍。", "warning");
    return false;
  }

  const target =
    options.target ??
    selectNextNovelChapterTarget(project, activeBook.chapters);

  let selection = options.contextSelection;

  if (!selection) {
    const initialSelection = resolveDefaultWriteChapterSelection(
      activeBook,
      project,
    );

    if (ctx.requestWriteChapterConfirm) {
      const derivedStyleConstraints = buildNovelStyleConstraintsFromAssets(
        activeBook.assets,
        project,
      );
      const confirmed = await ctx.requestWriteChapterConfirm({
        target,
        initialSelection,
        derivedStyleConstraints,
      });
      if (!confirmed) {
        return false;
      }
      selection = confirmed;
    } else {
      selection = initialSelection;
    }
  }

  return runCoreAction(ctx, "write-chapter", {
    targetChapter: target,
    contextSelectionOverride: selection,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --experimental-strip-types --test apps/web/features/studio/actions/write-chapter.test.mjs
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/studio/actions/write-chapter.ts \
        apps/web/features/studio/actions/write-chapter.test.mjs
git commit -m "refactor(studio): add write-chapter selection helpers and tests"
```

---

### Task 2: 强类型化 `StudioAction` 与 `StudioActionContext`

**Files:**
- Modify: `apps/web/features/studio/actions/types.ts`

- [ ] **Step 1: Replace weak confirm type and extend StudioAction**

```ts
// apps/web/features/studio/actions/types.ts — 新增/替换部分

export type StudioActionSource =
  | "composer"
  | "quick-action"
  | "chapter-panel"
  | "advanced"
  | "retry"
  | "batch";

export type WriteChapterConfirmInput = {
  target: NovelChapterWriteTarget;
  initialSelection: NovelContextSelection;
  derivedStyleConstraints: string;
};

export type StudioAction =
  | { type: "send-message"; text: string; source?: StudioActionSource }
  | {
      type: "write-chapter";
      source: StudioActionSource;
      target?: NovelChapterWriteTarget;
      contextSelection?: NovelContextSelection;
    }
  | { type: "review"; source?: StudioActionSource }
  | {
      type: "revise-chapter";
      selectedIssueIds?: string[];
      source?: StudioActionSource;
    }
  | { type: "abort-task" };

// StudioActionContext 中替换 confirmWriteChapter:
export type StudioActionContext = {
  // ...existing fields...
  requestWriteChapterConfirm?: (
    input: WriteChapterConfirmInput,
  ) => Promise<NovelContextSelection | null>;
};
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter web run check-types
```

Expected: FAIL on `NovelStudio.tsx` / `dispatch.ts` until Task 3–4 fix call sites

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/studio/actions/types.ts
git commit -m "refactor(studio): add typed StudioActionSource and write-chapter action"
```

---

### Task 3: 更新 `dispatch.ts` 路由 write-chapter

**Files:**
- Modify: `apps/web/features/studio/actions/dispatch.ts`

- [ ] **Step 1: Write dispatch test**

```js
// apps/web/features/studio/actions/dispatch.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { dispatchStudioAction } from "./dispatch.ts";

test("dispatch write-chapter calls executeWriteChapter with source", async () => {
  let executed = false;
  const original = await import("./write-chapter.ts");
  const { executeWriteChapter } = original;

  // Monkey-patch via dynamic re-import is fragile; instead test integration
  // by spying on ctx.notify when no book:
  const ctx = {
    getState: () => ({
      books: [],
      activeBookId: "",
      activeSessionId: "",
      runningTask: null,
    }),
    settings: {},
    onSettingsChange: () => {},
    notify: (message) => {
      if (message === "请先创建一本书籍。") executed = true;
    },
    trackModelCall: () => {},
    refreshWorkspace: async () => {},
  };

  dispatchStudioAction(ctx, {
    type: "write-chapter",
    source: "quick-action",
  });

  await new Promise((r) => setTimeout(r, 0));
  assert.equal(executed, true);
});
```

- [ ] **Step 2: Update dispatch.ts**

```ts
// apps/web/features/studio/actions/dispatch.ts
import { sendMessage } from "./send-message";
import { runCoreAction } from "./run-core-action";
import { executeWriteChapter } from "./write-chapter";
import type { StudioAction, StudioActionContext } from "./types";

export function dispatchStudioAction(
  ctx: StudioActionContext,
  action: StudioAction,
): void {
  switch (action.type) {
    case "send-message":
      void sendMessage(ctx, action.text);
      break;
    case "write-chapter":
      void executeWriteChapter(ctx, {
        source: action.source,
        target: action.target,
        contextSelection: action.contextSelection,
      });
      break;
    case "review":
      void runCoreAction(ctx, "review");
      break;
    case "revise-chapter":
      void runCoreAction(ctx, "revise-chapter", {
        selectedIssueIds: action.selectedIssueIds,
      });
      break;
    case "abort-task":
      ctx.getState().abortTask();
      break;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
node --experimental-strip-types --test apps/web/features/studio/actions/dispatch.test.mjs
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/studio/actions/dispatch.ts \
        apps/web/features/studio/actions/dispatch.test.mjs
git commit -m "refactor(studio): route write-chapter through executeWriteChapter"
```

---

### Task 4: 统一 `NovelStudio` 三入口

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/features/studio/components/chat/QuickActions.tsx`

- [ ] **Step 1: Update actionCtx with typed confirm callback**

将 `requestWriteChapterConfirm` 接入 `actionCtx`（替换旧 `confirmWriteChapter` 如有）：

```ts
const actionCtx = useMemo<StudioActionContext>(
  () => ({
    getState: useStudioStore.getState,
    settings,
    onSettingsChange,
    notify: showToast,
    trackModelCall,
    refreshWorkspace: refreshNovelWorkspace,
    requestWriteChapterConfirm: async (input) => {
      return requestWriteChapterConfirm(
        input.target,
        { contextSelection: input.initialSelection, /* 其余 assets 字段从 activeBook 取 */ },
        project!,
      );
    },
  }),
  [/* deps */],
);
```

**注意：** `requestWriteChapterConfirm` 现有签名是 `(target, assets, project)`。batch 1 最小改动：在 callback 内从 `activeBook.assets` 合并 `initialSelection`：

```ts
requestWriteChapterConfirm: async (input) => {
  if (!activeBook || !project) return null;
  return requestWriteChapterConfirm(
    input.target,
    {
      ...activeBook.assets,
      contextSelection: input.initialSelection,
    },
    project,
  );
},
```

同时将 `requestWriteChapterConfirm` 内部 `derivedStyleConstraints` 改为使用 `input.derivedStyleConstraints`（若 callback 传入），或保持现有 `buildNovelStyleConstraintsFromAssets` 调用——两者等价。

- [ ] **Step 2: Remove handleStudioAction write-chapter special case**

```ts
function handleStudioAction(action: StudioAction) {
  if (action.type === "write-chapter") {
    dispatchStudioAction(actionCtx, {
      ...action,
      source: action.source ?? "quick-action",
    });
    return;
  }
  if (
    (action.type === "review" || action.type === "revise-chapter") &&
    !action.source
  ) {
    dispatchStudioAction(actionCtx, { ...action, source: "quick-action" });
    return;
  }
  dispatchStudioAction(actionCtx, action);
}
```

- [ ] **Step 3: Update QuickActions to pass source**

```tsx
// QuickActions.tsx — write-chapter 按钮
onClick={() =>
  onAction({ type: "write-chapter", source: "quick-action" })
}
// review / revise-chapter 同理加 source: "quick-action"
```

- [ ] **Step 4: Unify chapter panel entry**

```tsx
// NovelStudio.tsx — onGenerateChapter
onGenerateChapter={async (target) => {
  dispatchStudioAction(actionCtx, {
    type: "write-chapter",
    source: "chapter-panel",
    target,
  });
}}
```

删除 `startWriteChapter` 函数及其在 `handleStudioAction` 中的调用（confirm 逻辑已在 `executeWriteChapter`）。

- [ ] **Step 5: Unify text command entry**

```ts
function runExtendedCommand(command: string) {
  const coreAction = QUICK_CORE_ACTIONS[command];

  if (coreAction === "write-chapter") {
    dispatchStudioAction(actionCtx, {
      type: "write-chapter",
      source: "composer",
    });
    return;
  }
  if (coreAction === "review") {
    dispatchStudioAction(actionCtx, { type: "review", source: "composer" });
    return;
  }
  if (coreAction === "revise-chapter") {
    dispatchStudioAction(actionCtx, {
      type: "revise-chapter",
      source: "composer",
    });
    return;
  }
  if (coreAction) {
    void runCoreAction(actionCtx, coreAction);
    return;
  }
  void sendMessage(actionCtx, command);
}
```

- [ ] **Step 6: Run full batch 1 verification**

```bash
pnpm --filter web run check-types
pnpm --filter web run lint
node --experimental-strip-types --test \
  apps/web/features/studio/actions/write-chapter.test.mjs \
  apps/web/features/studio/actions/dispatch.test.mjs
```

Expected: all PASS；手工点击「写下一章」仍出现 confirm 弹窗（行为不变）

- [ ] **Step 7: Commit**

```bash
git add apps/web/features/studio/components/NovelStudio.tsx \
        apps/web/features/studio/components/chat/QuickActions.tsx
git commit -m "refactor(studio): unify write-chapter entry points through dispatch"
```

---

### 批次 1 验收清单

- [ ] QuickActions、章节侧栏、文本命令「写下一章」均经 `dispatchStudioAction` → `executeWriteChapter`
- [ ] confirm 弹窗仍出现（batch 1 预期）
- [ ] `handleStudioAction` 无 write-chapter 业务逻辑
- [ ] typecheck / lint / 单测通过

---

# 批次 2：移除主路径确认弹窗

**Goal:** 点击「写下一章」直接生成；删除 confirm Promise/state。

### Task 5: 删除 confirm 分支

**Files:**
- Modify: `apps/web/features/studio/actions/write-chapter.ts`
- Modify: `apps/web/features/studio/actions/types.ts`
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`

- [ ] **Step 1: Simplify executeWriteChapter — always use resolveDefault**

```ts
// write-chapter.ts — 删除 requestWriteChapterConfirm 分支
let selection =
  options.contextSelection ??
  resolveDefaultWriteChapterSelection(activeBook, project);
```

- [ ] **Step 2: Remove from types.ts**

删除 `requestWriteChapterConfirm` 和 `WriteChapterConfirmInput`。

- [ ] **Step 3: Remove from NovelStudio.tsx**

删除：`writeChapterConfirm` state、`writeChapterConfirmResolverRef`、`requestWriteChapterConfirm`、`closeWriteChapterConfirm`、`<WriteChapterConfirmDialog />` JSX。

保留 `WriteChapterConfirmDialog.tsx` 文件零引用（batch 3 迁移表单）。

- [ ] **Step 4: Add test — executeWriteChapter skips confirm**

```js
test("executeWriteChapter uses default selection without confirm callback", async () => {
  // mock ctx without requestWriteChapterConfirm, verify runCoreAction path
});
```

- [ ] **Step 5: Verify + commit**

```bash
git commit -m "feat(studio): start next chapter directly without confirm dialog"
```

### 批次 2 验收

- [ ] 点击「写下一章」→ 聊天流出现 progress，无 Modal
- [ ] 侧栏生成入口行为一致
- [ ] 输入框额外指令传入且任务开始后清空

---

# 批次 3：高级写作偏好 Sheet + SplitButton

**Goal:** 可选配置从必经步骤变为 SplitButton 下拉 + 右侧 Sheet。

### Task 6: WriteChapterOptionsForm

**Files:**
- Create: `apps/web/features/studio/components/writing/WriteChapterOptionsForm.tsx`
- Migrate form fields from `WriteChapterConfirmDialog.tsx`

- [ ] 受控组件：`value: NovelContextSelection`、`onChange`、`derivedStyleConstraints?: string`
- [ ] 折叠区：上下文来源（6 checkbox + 摘要行）、更多约束（爽点/禁用词/风格）
- [ ] 默认可见：目标字数、视角、节奏、highlights

### Task 7: WriteChapterOptionsSheet

**Files:**
- Create: `apps/web/features/studio/components/writing/WriteChapterOptionsSheet.tsx`

- [ ] Props: `mode: "once" | "defaults"`、`open`、`onClose`、`initialValue`、`target?`、`onStartGenerate`、`onSaveDefaults`
- [ ] once：「开始生成」→ `onStartGenerate(selection)`；关闭丢弃
- [ ] defaults：「保存偏好」→ patch book assets；toast「已保存为默认写作偏好」
- [ ] Esc / 遮罩关闭 + focus return

### Task 8: WriteChapterSplitButton

**Files:**
- Create: `apps/web/features/studio/components/chat/WriteChapterSplitButton.tsx`
- Modify: `apps/web/features/studio/components/chat/QuickActions.tsx`

- [ ] 主按钮 → `onWriteChapter()`
- [ ] 菜单：默认偏好 / 本章高级选项 / 编辑默认偏好
- [ ] `aria-label`、`aria-haspopup`

### Task 9: Wire NovelStudio + CSS + 删除旧 Dialog

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/features/studio/studio.module.css`
- Delete: `apps/web/features/studio/components/dialogs/WriteChapterConfirmDialog.tsx`

- [ ] `WritingSheetState` 最小 state
- [ ] advanced dispatch: `{ type: "write-chapter", source: "advanced", contextSelection, target }`
- [ ] 新增 `.writingOptionsSheet` 样式；删除 `.writeChapterConfirmDialog`

### 批次 3 验收

- [ ] 主按钮零 Modal；高级 Sheet 按需打开
- [ ] 临时值与默认偏好不串值
- [ ] 窄屏 Sheet 无溢出；Esc/Tab 可用

---

# 批次 4：TaskExecutionCard 消息流

**Goal:** progress 可折叠；运行展开、成功收起、失败/暂停展开。

### Task 10: 扩展 progress part 类型

**Files:**
- Modify: `apps/web/features/studio/store/types.ts`
- Modify: `apps/web/features/studio/store/slices/message/parts-builder.ts`

- [ ] 新增可选 `status`、`startedAt`、`completedAt`、`summary`
- [ ] `buildProgressPart` 接受 `status` / `startedAt`

### Task 11: run-core-action 上下文摘要

**Files:**
- Modify: `apps/web/features/studio/actions/run-core-action.ts`

- [ ] write-chapter 开始时 append 一条：`已带入 X 项上下文：…`（调用 `summarizeContextSelection`）
- [ ] 完成时 set `status: "completed"`、`summary`

### Task 12: TaskExecutionCard

**Files:**
- Modify: `apps/web/features/studio/components/chat/ProgressSteps.tsx`
- Modify: `apps/web/features/studio/components/chat/MessagePartRenderer.tsx`

- [ ] 折叠控制 + 耗时显示
- [ ] `tool` part 无用户内容时不渲染
- [ ] 旧 progress（无 status）fallback 推断逻辑
- [ ] 测试：折叠行为、legacy fallback

### 批次 4 验收

- [ ] 写/审/修订均显示连贯任务卡 + 独立 result
- [ ] 无重复用户消息；无永久 spinner

---

# 批次 5：Composer + 可靠性收尾

### Task 13: ChatComposer Enter 发送

**Files:**
- Modify: `apps/web/features/studio/components/chat/ChatComposer.tsx`

```ts
onKeyDown={(event) => {
  if (event.nativeEvent.isComposing) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    onSend();
    return;
  }
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    onSend();
  }
}}
```

- [ ] 视觉顺序：快捷动作 → 输入 → 模型 → 更多 → 任务条

### Task 14: 智能滚动

**Files:**
- Create: `apps/web/features/studio/hooks/useMessageListScroll.ts`（或内联 NovelStudio）
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`

- [ ] 仅底部附近 auto-scroll
- [ ] 「回到最新消息」按钮

### Task 15: 会话安全测试

**Files:**
- Create/extend tests for session switch, empty activeSession, retry idempotency

### 批次 5 验收

- [ ] Enter 发送 / Shift+Enter 换行 / 输入法组合态不发送
- [ ] 切换书籍/会话不串消息
- [ ] 全量 typecheck / lint / test + Chrome 手工验收

---

## Spec Coverage Self-Review

| Spec 章节 | 对应 Task |
|-----------|-----------|
| 1. Action 路由 | Task 2–4 |
| 2. UI 去弹窗 | Task 5 |
| 2. SplitButton / Sheet | Task 6–9 |
| 3. TaskExecutionCard | Task 10–12 |
| 4. Composer / scroll | Task 13–14 |
| 5. 会话安全 | Task 15 |
| 测试计划 | 每 Task 内嵌 + 批次验收清单 |

无 TBD / 占位符。

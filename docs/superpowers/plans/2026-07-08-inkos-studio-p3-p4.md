# InkOS Studio P3 + P4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Zustand Studio Store（P3），并将 chat / core action / batch runtime 抽成独立 action 模块 + 统一 `StudioMessagePart` 渲染（P4）。

**Architecture:** 4 Zustand slices（book / session / message / task）管同步 state；`actions/` 管 async 编排（stream、IndexedDB 写回、abort/pause）；`message-bridge.ts` 适配现有 `StoredNovelMessage` schema；新消息走结构化 parts 渲染，旧消息 legacy fallback。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand ^5.0.12, CSS Modules, node:test (`--experimental-strip-types`)

**Spec:** `docs/superpowers/specs/2026-07-08-inkos-studio-p3-p4-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/package.json` | Modify | 添加 `zustand` 依赖 |
| `apps/web/features/studio/store/types.ts` | Create | StudioMessage、StudioMessagePart、slice 类型 |
| `apps/web/features/studio/store/initialState.ts` | Create | 合并 4 slice 初始 state |
| `apps/web/features/studio/store/store.ts` | Create | `create<StudioStore>()` |
| `apps/web/features/studio/store/selectors.ts` | Create | `useActiveBook`、`useActiveMessages` 等 |
| `apps/web/features/studio/store/slices/book/initialState.ts` | Create | book slice state |
| `apps/web/features/studio/store/slices/book/action.ts` | Create | hydrate、patchBook |
| `apps/web/features/studio/store/slices/session/initialState.ts` | Create | session slice state |
| `apps/web/features/studio/store/slices/session/action.ts` | Create | setInput、setActiveSession |
| `apps/web/features/studio/store/slices/message/initialState.ts` | Create | message slice state |
| `apps/web/features/studio/store/slices/message/action.ts` | Create | append/update message parts |
| `apps/web/features/studio/store/slices/message/parts-builder.ts` | Create | 纯函数 part 构建 |
| `apps/web/features/studio/store/slices/message/parts-builder.test.mjs` | Create | parts-builder 单测 |
| `apps/web/features/studio/store/slices/task/initialState.ts` | Create | task slice state |
| `apps/web/features/studio/store/slices/task/action.ts` | Create | start/finish/abort task |
| `apps/web/features/studio/persistence/message-bridge.ts` | Create | StudioMessage ↔ StoredNovelMessage |
| `apps/web/features/studio/persistence/message-bridge.test.mjs` | Create | bridge 单测 |
| `apps/web/features/studio/actions/types.ts` | Create | StudioAction、StudioActionContext |
| `apps/web/features/studio/actions/runtime/task-guard.ts` | Create | runningTask guard |
| `apps/web/features/studio/actions/runtime/task-guard.test.mjs` | Create | guard 单测 |
| `apps/web/features/studio/actions/runtime/message-parts.ts` | Create | flatten、legacy detect、error part |
| `apps/web/features/studio/actions/runtime/message-parts.test.mjs` | Create | flatten 单测 |
| `apps/web/features/studio/actions/dispatch.ts` | Create | dispatchStudioAction router |
| `apps/web/features/studio/actions/send-message.ts` | Create | 聊天 action |
| `apps/web/features/studio/actions/run-core-action.ts` | Create | core action（从 NovelStudio 迁入） |
| `apps/web/features/studio/actions/run-batch-action.ts` | Create | batch 循环调 core |
| `apps/web/features/studio/components/chat/ChatMessage.tsx` | Create | 单条消息容器 |
| `apps/web/features/studio/components/chat/MessagePartRenderer.tsx` | Create | part 分发渲染 |
| `apps/web/features/studio/components/chat/ProgressSteps.tsx` | Create | progress part UI |
| `apps/web/features/studio/components/chat/QuickActions.tsx` | Modify | typed action callback |
| `apps/web/features/studio/components/chat/ChatComposer.tsx` | Modify | 可选：减少 props |
| `apps/web/features/studio/components/NovelStudio.tsx` | Modify | 接 store + dispatch，删内联 action |
| `apps/web/features/studio/helpers/novel-helpers.ts` | Modify | hydrate 改用 message-bridge |
| `apps/web/features/studio/studio.module.css` | Modify | progress steps 样式 |
| `INKOS_STUDIO_ALIGNMENT_TODO.md` | Modify | P3/P4 勾选 |
| `apps/web/lib/novel-store.ts` | **不修改** | — |

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
  apps/web/features/studio/persistence/message-bridge.test.mjs
```

---

## Task 1: 添加 zustand 依赖

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装 zustand**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web add zustand@^5.0.12
```

- [ ] **Step 2: 验证安装**

Run: `pnpm --filter web list zustand`
Expected: `zustand 5.0.x`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add zustand for studio store"
```

---

## Task 2: Store 类型定义

**Files:**
- Create: `apps/web/features/studio/store/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
// apps/web/features/studio/store/types.ts
import type { InkosCoreAction } from "@repo/inkos-adapter";
import type { NovelBookEntry } from "../state/studio-types";

export type StudioMessagePart =
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

export type StudioMessage = {
  id: string;
  role: "user" | "assistant";
  parts: StudioMessagePart[];
  streaming?: boolean;
  status?: "sent" | "error";
  createdAt: string;
};

export type StudioBookRuntime = NovelBookEntry;

export type StudioTaskRuntime = {
  kind: "chat" | "core" | "batch";
  label: string;
  action?: InkosCoreAction;
  status: "running" | "paused" | "error";
  abortController: AbortController;
  taskId?: string;
  assistantMessageId?: string;
};

export type BookSliceState = {
  books: StudioBookRuntime[];
  activeBookId: string;
  activeChapterId: string;
  isLoading: boolean;
  error: string;
};

export type SessionSliceState = {
  activeSessionId: string;
  input: string;
  selectedModelValue: string;
};

export type MessageSliceState = {
  messagesBySessionId: Record<string, StudioMessage[]>;
};

export type TaskSliceState = {
  runningTask: StudioTaskRuntime | null;
};

export type StudioState = BookSliceState &
  SessionSliceState &
  MessageSliceState &
  TaskSliceState;

export type BookSliceActions = {
  hydrateFromSnapshot: (input: {
    books: StudioBookRuntime[];
    messagesBySessionId: Record<string, StudioMessage[]>;
    activeBookId?: string;
    activeSessionId?: string;
  }) => void;
  setBooks: (books: StudioBookRuntime[]) => void;
  patchBook: (
    bookId: string,
    patch: Partial<StudioBookRuntime> | ((book: StudioBookRuntime) => StudioBookRuntime),
  ) => void;
  setActiveBook: (bookId: string) => void;
  setActiveChapter: (chapterId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string) => void;
};

export type SessionSliceActions = {
  setActiveSession: (sessionId: string) => void;
  setInput: (text: string) => void;
  setSelectedModel: (value: string) => void;
};

export type MessageSliceActions = {
  setMessagesForSession: (sessionId: string, messages: StudioMessage[]) => void;
  appendMessage: (sessionId: string, message: StudioMessage) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updater: (message: StudioMessage) => StudioMessage,
  ) => void;
  clearSessionMessages: (sessionId: string) => void;
};

export type TaskSliceActions = {
  startTask: (task: StudioTaskRuntime) => void;
  pauseTask: () => void;
  finishTask: () => void;
  abortTask: () => void;
};

export type StudioStore = StudioState &
  BookSliceActions &
  SessionSliceActions &
  MessageSliceActions &
  TaskSliceActions;
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter web run check-types`
Expected: PASS（新文件无 import 错误）

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/studio/store/types.ts
git commit -m "feat(studio): add store types for P3"
```

---

## Task 3: parts-builder 纯函数（TDD）

**Files:**
- Create: `apps/web/features/studio/store/slices/message/parts-builder.ts`
- Create: `apps/web/features/studio/store/slices/message/parts-builder.test.mjs`

- [ ] **Step 1: 写失败测试**

```javascript
// apps/web/features/studio/store/slices/message/parts-builder.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import {
  appendProgressStep,
  buildProgressPart,
  buildResultPart,
  buildTextPart,
  updateTextPartContent,
} from "./parts-builder.ts";

test("buildTextPart returns text part", () => {
  assert.deepEqual(buildTextPart("hello"), { type: "text", content: "hello" });
});

test("buildProgressPart starts with empty steps", () => {
  const part = buildProgressPart("写下一章");
  assert.equal(part.type, "progress");
  assert.equal(part.label, "写下一章");
  assert.deepEqual(part.steps, []);
});

test("appendProgressStep adds step with timestamp", () => {
  const part = buildProgressPart("审稿");
  const next = appendProgressStep(part, "正在分析", 1000);
  assert.equal(next.steps.length, 1);
  assert.equal(next.steps[0].message, "正在分析");
  assert.equal(next.steps[0].at, 1000);
});

test("updateTextPartContent replaces content", () => {
  const part = buildTextPart("a");
  assert.deepEqual(updateTextPartContent(part, "b"), { type: "text", content: "b" });
});

test("buildResultPart includes title and content", () => {
  assert.deepEqual(buildResultPart("完成", "chapter text"), {
    type: "result",
    title: "完成",
    content: "chapter text",
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `node --experimental-strip-types --test apps/web/features/studio/store/slices/message/parts-builder.test.mjs`
Expected: FAIL module not found

- [ ] **Step 3: 实现 parts-builder.ts**

```typescript
// apps/web/features/studio/store/slices/message/parts-builder.ts
import type { StudioMessagePart } from "../../types";

export function buildTextPart(content: string): StudioMessagePart {
  return { type: "text", content };
}

export function buildProgressPart(
  label: string,
  options?: { paused?: boolean },
): Extract<StudioMessagePart, { type: "progress" }> {
  return { type: "progress", label, steps: [], paused: options?.paused };
}

export function appendProgressStep(
  part: Extract<StudioMessagePart, { type: "progress" }>,
  message: string,
  at: number,
): Extract<StudioMessagePart, { type: "progress" }> {
  return { ...part, steps: [...part.steps, { message, at }] };
}

export function updateTextPartContent(
  part: Extract<StudioMessagePart, { type: "text" }>,
  content: string,
): Extract<StudioMessagePart, { type: "text" }> {
  return { ...part, content };
}

export function buildResultPart(
  title: string,
  content: string,
): Extract<StudioMessagePart, { type: "result" }> {
  return { type: "result", title, content };
}

export function buildErrorPart(
  title: string,
  detail: string,
  recovery?: string,
): Extract<StudioMessagePart, { type: "error" }> {
  return { type: "error", title, detail, recovery };
}
```

- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/studio/store/slices/message/parts-builder.ts \
  apps/web/features/studio/store/slices/message/parts-builder.test.mjs
git commit -m "feat(studio): add message parts builder with tests"
```

---

## Task 4: message-bridge 持久化适配（TDD）

**Files:**
- Create: `apps/web/features/studio/persistence/message-bridge.ts`
- Create: `apps/web/features/studio/persistence/message-bridge.test.mjs`

- [ ] **Step 1: 写失败测试**

```javascript
// apps/web/features/studio/persistence/message-bridge.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import {
  fromStoredMessage,
  isLegacyCoreMarkdown,
  toStoredMessage,
} from "./message-bridge.ts";

test("fromStoredMessage wraps content as single text part", () => {
  const msg = fromStoredMessage({
    id: "m1",
    sessionId: "s1",
    role: "assistant",
    content: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(msg.id, "m1");
  assert.deepEqual(msg.parts, [{ type: "text", content: "hello" }]);
});

test("toStoredMessage flattens text part to content", () => {
  const stored = toStoredMessage(
    {
      id: "m2",
      role: "user",
      parts: [{ type: "text", content: "写下一章" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    "s1",
  );
  assert.equal(stored.content, "写下一章");
  assert.equal(stored.sessionId, "s1");
});

test("isLegacyCoreMarkdown detects old progress format", () => {
  const content = "## 写下一章\n\n- 等待任务开始";
  assert.equal(isLegacyCoreMarkdown(content), true);
  assert.equal(isLegacyCoreMarkdown("plain chat reply"), false);
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

- [ ] **Step 3: 实现 message-bridge.ts**

```typescript
// apps/web/features/studio/persistence/message-bridge.ts
import type { StoredNovelMessage } from "../../../lib/novel-store";
import type { StudioMessage, StudioMessagePart } from "../store/types";
import { flattenPartsToContent } from "../actions/runtime/message-parts";

export function fromStoredMessage(stored: StoredNovelMessage): StudioMessage {
  return {
    id: stored.id,
    role: stored.role,
    parts: [{ type: "text", content: stored.content }],
    status: stored.status,
    createdAt: stored.createdAt,
  };
}

export function toStoredMessage(
  message: StudioMessage,
  sessionId: string,
): StoredNovelMessage {
  return {
    id: message.id,
    sessionId,
    role: message.role,
    content: flattenPartsToContent(message.parts),
    createdAt: message.createdAt,
    status: message.status,
  };
}

export function fromStoredMessagesBySession(
  messagesBySessionId: Record<string, StoredNovelMessage[]>,
): Record<string, StudioMessage[]> {
  return Object.fromEntries(
    Object.entries(messagesBySessionId).map(([sessionId, messages]) => [
      sessionId,
      messages.map(fromStoredMessage),
    ]),
  );
}

export function isLegacyCoreMarkdown(content: string): boolean {
  return /^##\s+.+/m.test(content) && content.includes("- ");
}
```

Note: `flattenPartsToContent` 在 Task 5 实现；Task 4 Step 3 可先写 stub 或 Task 5 先做。实施顺序：**Task 5 在 Task 4 之前**，或 Task 4 内联简单 flatten 后 Task 5 替换。

- [ ] **Step 4–5: 测试 PASS + Commit**

---

## Task 5: message-parts runtime + task-guard（TDD）

**Files:**
- Create: `apps/web/features/studio/actions/runtime/message-parts.ts`
- Create: `apps/web/features/studio/actions/runtime/message-parts.test.mjs`
- Create: `apps/web/features/studio/actions/runtime/task-guard.ts`
- Create: `apps/web/features/studio/actions/runtime/task-guard.test.mjs`

- [ ] **Step 1: message-parts 测试 + 实现**

```typescript
// apps/web/features/studio/actions/runtime/message-parts.ts
import type { StudioMessagePart } from "../../store/types";

export function flattenPartsToContent(parts: StudioMessagePart[]): string {
  return parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.content;
        case "result":
          return [part.title, part.content].filter(Boolean).join("\n\n");
        case "error":
          return [`## ${part.title}`, `### 原因\n${part.detail}`, part.recovery ? `### 恢复建议\n${part.recovery}` : ""]
            .filter(Boolean)
            .join("\n\n");
        case "progress":
          return [
            `## ${part.label}${part.paused ? "（已暂停）" : ""}`,
            part.steps.length > 0
              ? part.steps.map((s) => `- ${s.message}`).join("\n")
              : "- 等待任务开始",
          ].join("\n\n");
        case "tool":
          return `[${part.label}] ${part.status}${part.detail ? `: ${part.detail}` : ""}`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export function isLegacyCoreMarkdown(content: string): boolean {
  return /^##\s+.+/m.test(content) && content.includes("- ");
}
```

```javascript
// message-parts.test.mjs — 测试 flatten progress/text/result
test("flattenPartsToContent flattens progress steps", () => {
  const content = flattenPartsToContent([
    { type: "progress", label: "写下一章", steps: [{ message: "开始", at: 1 }] },
    { type: "result", title: "完成", content: "chapter body" },
  ]);
  assert.match(content, /## 写下一章/);
  assert.match(content, /- 开始/);
  assert.match(content, /chapter body/);
});
```

- [ ] **Step 2: task-guard 测试 + 实现**

```typescript
// apps/web/features/studio/actions/runtime/task-guard.ts
import type { StudioTaskRuntime } from "../../store/types";

export function getStudioTaskGuard(runningTask: StudioTaskRuntime | null): {
  canStart: boolean;
  message: string;
} {
  if (!runningTask) {
    return { canStart: true, message: "" };
  }
  return {
    canStart: false,
    message: `当前正在执行「${runningTask.label}」，请等待完成或取消后再试。`,
  };
}
```

```javascript
test("getStudioTaskGuard blocks when task running", () => {
  const guard = getStudioTaskGuard({
    kind: "chat",
    label: "聊天回复",
    status: "running",
    abortController: new AbortController(),
  });
  assert.equal(guard.canStart, false);
});
```

- [ ] **Step 3: 更新 message-bridge 引用 flattenPartsToContent**

- [ ] **Step 4: 测试 PASS + Commit**

---

## Task 6: 四个 Slice + Store 组装

**Files:**
- Create: `apps/web/features/studio/store/slices/*/initialState.ts`（4 个）
- Create: `apps/web/features/studio/store/slices/*/action.ts`（4 个）
- Create: `apps/web/features/studio/store/initialState.ts`
- Create: `apps/web/features/studio/store/store.ts`
- Create: `apps/web/features/studio/store/selectors.ts`

- [ ] **Step 1: 创建各 slice initialState**

```typescript
// book/initialState.ts
export const initialBookState = {
  books: [],
  activeBookId: "",
  activeChapterId: "",
  isLoading: true,
  error: "",
};
```

session / message / task 同理（见 spec）。

- [ ] **Step 2: 创建 book slice action**

```typescript
// book/action.ts
import type { StateCreator } from "zustand";
import type { StudioStore } from "../../types";

export const createBookSlice: StateCreator<StudioStore, [], [], Pick<StudioStore,
  keyof import("../../types").BookSliceState | keyof import("../../types").BookSliceActions
>> = (set) => ({
  ...initialBookState,
  hydrateFromSnapshot: ({ books, messagesBySessionId, activeBookId, activeSessionId }) => {
    const firstBook = books.find((b) => !b.archived) ?? books[0];
    set((state) => ({
      books,
      messagesBySessionId,
      activeBookId:
        activeBookId && books.some((b) => b.id === activeBookId)
          ? activeBookId
          : firstBook?.id ?? "",
      activeSessionId:
        activeSessionId &&
        books.some((b) => b.sessions.some((s) => s.id === activeSessionId))
          ? activeSessionId
          : firstBook?.sessions[0]?.id ?? "",
      isLoading: false,
      error: "",
    }));
  },
  setBooks: (books) => set({ books }),
  patchBook: (bookId, patch) =>
    set((state) => ({
      books: state.books.map((book) => {
        if (book.id !== bookId) return book;
        return typeof patch === "function" ? patch(book) : { ...book, ...patch };
      }),
    })),
  setActiveBook: (activeBookId) => set({ activeBookId }),
  setActiveChapter: (activeChapterId) => set({ activeChapterId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
});
```

- [ ] **Step 3: message slice action（含 updateMessage）**

```typescript
updateMessage: (sessionId, messageId, updater) =>
  set((state) => ({
    messagesBySessionId: {
      ...state.messagesBySessionId,
      [sessionId]: (state.messagesBySessionId[sessionId] ?? []).map((msg) =>
        msg.id === messageId ? updater(msg) : msg,
      ),
    },
  })),
```

- [ ] **Step 4: task slice action**

```typescript
startTask: (runningTask) => set({ runningTask }),
pauseTask: () =>
  set((state) =>
    state.runningTask
      ? { runningTask: { ...state.runningTask, status: "paused" } }
      : {},
  ),
finishTask: () => set({ runningTask: null }),
abortTask: () =>
  set((state) => {
    state.runningTask?.abortController.abort();
    return { runningTask: null };
  }),
```

- [ ] **Step 5: 组装 store.ts**

```typescript
// store/store.ts
import { create } from "zustand";
import type { StudioStore } from "./types";
import { createBookSlice } from "./slices/book/action";
import { createSessionSlice } from "./slices/session/action";
import { createMessageSlice } from "./slices/message/action";
import { createTaskSlice } from "./slices/task/action";

export const useStudioStore = create<StudioStore>()((...args) => ({
  ...createBookSlice(...args),
  ...createSessionSlice(...args),
  ...createMessageSlice(...args),
  ...createTaskSlice(...args),
}));
```

- [ ] **Step 6: selectors.ts**

```typescript
import { useStudioStore } from "./store";

export function useActiveBook() {
  return useStudioStore((s) =>
    s.books.find((b) => b.id === s.activeBookId) ?? null,
  );
}

export function useActiveMessages() {
  return useStudioStore((s) => s.messagesBySessionId[s.activeSessionId] ?? []);
}

export function useIsTaskRunning() {
  return useStudioStore((s) => s.runningTask !== null);
}

export function useCanStartTask() {
  const runningTask = useStudioStore((s) => s.runningTask);
  return getStudioTaskGuard(runningTask);
}
```

- [ ] **Step 7: check-types PASS + Commit**

---

## Task 7: NovelStudio 接入 Store（P3 迁移）

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `apps/web/features/studio/helpers/novel-helpers.ts`

- [ ] **Step 1: 删除已迁入 store 的 useState**

移除：`books`, `activeBookId`, `activeSessionId`, `activeChapterId`, `input`, `selectedModelValue`, `messagesBySession`, `isSending`, `isRunningCoreAction`, `activeTaskLabel`, `isNovelStoreLoading`, `novelStoreError`

- [ ] **Step 2: 改用 selectors + store actions**

```typescript
const books = useStudioStore((s) => s.books);
const activeBookId = useStudioStore((s) => s.activeBookId);
const setActiveBook = useStudioStore((s) => s.setActiveBook);
// ... 其余同理
const isTaskRunning = useIsTaskRunning();
const runningTask = useStudioStore((s) => s.runningTask);
const activeTaskLabel = runningTask?.label ?? "";
```

- [ ] **Step 3: 改造 applyNovelSnapshot**

```typescript
function applyNovelSnapshot(snapshot: NovelWorkspaceSnapshot) {
  const loadedBooks = toNovelBookEntries(/* 同现有参数 */);
  const firstBook = loadedBooks.find((b) => !b.archived) ?? loadedBooks[0];
  useStudioStore.getState().hydrateFromSnapshot({
    books: loadedBooks,
    messagesBySessionId: fromStoredMessagesBySession(snapshot.messagesBySessionId),
    activeBookId: useStudioStore.getState().activeBookId,
    activeSessionId: useStudioStore.getState().activeSessionId,
  });
  setChapterVersionsById(snapshot.chapterVersionsByChapterId);
  setSelectedBookIds(/* 同现有 */);
  setCreatingBook(loadedBooks.length === 0);
}
```

- [ ] **Step 4: 加载 effect 改用 store.setLoading/setError**

- [ ] **Step 5: 将所有 `isSending || isRunningCoreAction` 替换为 `useIsTaskRunning()`**

- [ ] **Step 6: 验证命令 PASS + 手动冒烟（打开页面、切书、切会话）**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(studio): migrate core runtime state to zustand store"
```

---

## Task 8: 消息渲染组件

**Files:**
- Create: `apps/web/features/studio/components/chat/ProgressSteps.tsx`
- Create: `apps/web/features/studio/components/chat/MessagePartRenderer.tsx`
- Create: `apps/web/features/studio/components/chat/ChatMessage.tsx`
- Modify: `apps/web/features/studio/studio.module.css`

- [ ] **Step 1: ProgressSteps.tsx**

```tsx
"use client";

import styles from "../../studio.module.css";
import type { StudioMessagePart } from "../../store/types";

export function ProgressSteps({
  part,
}: {
  part: Extract<StudioMessagePart, { type: "progress" }>;
}) {
  return (
    <div className={styles.progressSteps}>
      <strong>{part.label}{part.paused ? "（已暂停）" : ""}</strong>
      <ul>
        {part.steps.length === 0 ? (
          <li>等待任务开始</li>
        ) : (
          part.steps.map((step, index) => <li key={index}>{step.message}</li>)
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: MessagePartRenderer.tsx**

```tsx
"use client";

import type { StudioMessagePart } from "../../store/types";
import { isLegacyCoreMarkdown } from "../../actions/runtime/message-parts";
import { MarkdownContent } from "./MarkdownContent";
import { ProgressSteps } from "./ProgressSteps";
import styles from "../../studio.module.css";

export function MessagePartRenderer({ part }: { part: StudioMessagePart }) {
  switch (part.type) {
    case "text":
      if (isLegacyCoreMarkdown(part.content)) {
        return <MarkdownContent content={part.content} />;
      }
      return <MarkdownContent content={part.content} />;
    case "progress":
      return <ProgressSteps part={part} />;
    case "result":
      return (
        <div className={styles.resultBlock}>
          <strong>{part.title}</strong>
          <MarkdownContent content={part.content} />
        </div>
      );
    case "error":
      return (
        <div className={styles.errorBlock}>
          <strong>{part.title}</strong>
          <p>{part.detail}</p>
          {part.recovery ? <p>{part.recovery}</p> : null}
        </div>
      );
    case "tool":
      return (
        <div className={styles.toolBlock}>
          <span>{part.label}</span> — {part.status}
          {part.detail ? <pre>{part.detail}</pre> : null}
        </div>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 3: ChatMessage.tsx**

```tsx
"use client";

import type { StudioMessage } from "../../store/types";
import { MessagePartRenderer } from "./MessagePartRenderer";
import styles from "../../studio.module.css";

export function ChatMessage({ message }: { message: StudioMessage }) {
  return (
    <article
      className={
        message.status === "error"
          ? styles.errorMessage
          : message.role === "user"
            ? styles.userMessage
            : styles.assistantMessage
      }
    >
      <strong>{message.role === "user" ? "你" : "InkOS"}</strong>
      {message.parts.map((part, index) => (
        <MessagePartRenderer key={index} part={part} />
      ))}
      {message.streaming ? (
        <span className={styles.typingIndicator}><i /><i /><i /></span>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: NovelStudio message list 改用 ChatMessage**

替换 `messages.map` 块（约 L2917–2937）为 `<ChatMessage message={message} />`。

注意：此步 messages 仍为 `StudioMessage[]`（Task 7 已通过 bridge 加载）。若仍用 `NovelChatMessage`，先改类型。

- [ ] **Step 5: CSS + check-types + Commit**

---

## Task 9: send-message action

**Files:**
- Create: `apps/web/features/studio/actions/types.ts`
- Create: `apps/web/features/studio/actions/send-message.ts`

- [ ] **Step 1: StudioActionContext**

```typescript
// actions/types.ts
import type { InkosCoreAction } from "@repo/inkos-adapter";
import type { LocalModelSettings } from "../../../lib/model-settings";
import type { NovelContextSelection } from "../../../lib/novel-store";
import type { StudioStore } from "../store/types";

export type StudioAction =
  | { type: "send-message"; text: string }
  | { type: "write-chapter" }
  | { type: "review" }
  | { type: "revise-chapter"; selectedIssueIds?: string[] }
  | { type: "abort-task" };

export type StudioActionContext = {
  getState: () => StudioStore;
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
  notify: (message: string, tone: "success" | "warning" | "error") => void;
  trackModelCall: (
    binding: import("../state/studio-types").ReadyModelBinding,
    label: string,
    status: import("../../../lib/model-settings").ModelCallLog["status"],
    startedAt: string,
    endedAt: string,
    options?: { latencyMs?: number; errorMessage?: string },
  ) => void;
  refreshWorkspace: () => Promise<void>;
  confirmWriteChapter?: (opts: unknown) => Promise<NovelContextSelection | null>;
};

export type RunCoreActionOptions = {
  targetChapter?: import("../../../lib/novel-store").NovelChapterWriteTarget;
  targetStoredChapter?: import("../../../lib/novel-store").StoredNovelChapter;
  selectedIssueIds?: string[];
  existingTaskId?: string;
  resumeTask?: import("../../../lib/novel-store").StoredNovelTask;
  labelOverride?: string;
  contextSelectionOverride?: NovelContextSelection;
};
```

- [ ] **Step 2: 从 NovelStudio L860–1023 抽出 send-message.ts**

核心逻辑：
1. `getStudioTaskGuard(getState().runningTask)`
2. `startTask({ kind: "chat", label: "聊天回复", status: "running", abortController })`
3. 构建 `StudioMessage`（user text part + assistant streaming text part）
4. `appendMessage` × 2
5. `appendStoredNovelMessage(toStoredMessage(...))`
6. `streamNovelChat` → `updateMessage` 更新 assistant text part
7. 完成/错误 → `finishTask`

**关键改动：** 不再使用 `NovelChatMessage.content` 字符串，改用 `parts: [buildTextPart(...)]`。

- [ ] **Step 3: NovelStudio 删除 sendNovelMessage，改为**

```typescript
const actionCtx = useMemo(() => buildActionContext(/* ... */), [settings, ...]);

async function handleSendMessage(text: string) {
  await sendMessage(actionCtx, text);
}
```

- [ ] **Step 4: 验证 chat 发送 + Commit**

---

## Task 10: run-core-action（最大块）

**Files:**
- Create: `apps/web/features/studio/actions/run-core-action.ts`

- [ ] **Step 1: 从 NovelStudio L1025–~1570 整段复制到 run-core-action.ts**

导出：

```typescript
export async function runCoreAction(
  ctx: StudioActionContext,
  action: InkosCoreAction,
  options?: RunCoreActionOptions,
): Promise<boolean>
```

- [ ] **Step 2: 替换消息更新为 parts API**

| 原逻辑 | 新逻辑 |
|--------|--------|
| `formatCoreProgressContent(label, progressMessages)` | progress part + `appendProgressStep` |
| `formatCoreFinalContent(...)` | append `buildResultPart(label, content)` |
| `formatCoreErrorContent(...)` | replace with `buildErrorPart(...)` |

progress 更新模式：

```typescript
store.updateMessage(sessionId, assistantMessageId, (msg) => ({
  ...msg,
  parts: msg.parts.map((part) =>
    part.type === "progress"
      ? appendProgressStep(part, event.message, Date.now())
      : part,
  ),
}));
```

- [ ] **Step 3: 写回逻辑（章节/资产/review）保持行为不变**

整块迁入，把 `setBooks` / `setMessagesBySession` / `setIsRunningCoreAction` 改为 store actions：
- `patchBook`
- `updateMessage` / `appendMessage`
- `startTask` / `finishTask` / `pauseTask`

- [ ] **Step 4: pause/resume refs 迁入 run-core-action.ts 模块级变量**

```typescript
let activeCoreTaskId = "";
let activeCoreProgress: string[] = [];
// ...
```

NovelStudio 的 `cancelActiveTask` 改为 `ctx.getState().abortTask()`。

- [ ] **Step 5: NovelStudio 删除 runCoreAction 内联函数**

- [ ] **Step 6: 验证 write-chapter / review / revise + Commit**

---

## Task 11: run-batch-action + dispatch

**Files:**
- Create: `apps/web/features/studio/actions/run-batch-action.ts`
- Create: `apps/web/features/studio/actions/dispatch.ts`
- Modify: `apps/web/features/studio/components/chat/QuickActions.tsx`

- [ ] **Step 1: run-batch-action.ts**

从 NovelStudio L1589–~1700 抽出；内部 `await runCoreAction(ctx, item.action, options)`。

- [ ] **Step 2: dispatch.ts**

```typescript
export function dispatchStudioAction(ctx: StudioActionContext, action: StudioAction): void {
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

- [ ] **Step 3: QuickActions 改 typed callback**

```tsx
import type { StudioAction } from "../../actions/types";

const ACTIONS = [
  { label: "写下一章", type: "write-chapter" as const },
  { label: "审稿", type: "review" as const },
  { label: "修订本章", type: "revise-chapter" as const },
];

export function QuickActions({
  disabled,
  onAction,
}: {
  disabled: boolean;
  onAction: (action: StudioAction) => void;
}) {
  // onClick={() => onAction({ type: item.type })}
}
```

- [ ] **Step 4: NovelStudio runQuickAction 改为 dispatchStudioAction**

删除 `runQuickAction` 字符串映射（L1570–1587）。

- [ ] **Step 5: Commit**

---

## Task 12: 清理 + TODO 更新 + 最终验收

**Files:**
- Modify: `apps/web/features/studio/components/NovelStudio.tsx`
- Modify: `INKOS_STUDIO_ALIGNMENT_TODO.md`

- [ ] **Step 1: 删除 NovelStudio 中已无用的 import**

`formatCoreProgressContent`, `formatCoreFinalContent`（若 send/core 路径不再使用）

- [ ] **Step 2: 删除 activeTaskAbortRef 等已迁入 action 的 refs**

- [ ] **Step 3: 更新 INKOS_STUDIO_ALIGNMENT_TODO.md P3/P4 全部 `[x]`**

- [ ] **Step 4: 运行完整验收命令**

- [ ] **Step 5: 人工验收清单**

- [ ] 普通 chat 回复正常，streaming 显示正常
- [ ] 写下一章 / 审稿 / 修订：progress steps UI 显示（非 markdown 块）
- [ ] Abort 任务可取消
- [ ] 刷新页面后旧消息仍正常显示
- [ ] QuickActions 三个按钮正常

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(studio): complete P3 store and P4 unified action runtime"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| store/types.ts 五种 runtime 类型 | Task 2 |
| store.ts 4 slices | Task 6 |
| 核心 state 迁入 store | Task 7 |
| isSending+isRunningCoreAction → runningTask | Task 6–7 |
| send-message.ts | Task 9 |
| run-core-action.ts | Task 10 |
| run-batch-action.ts | Task 11 |
| StudioMessagePart 五种 type | Task 2–3 |
| 结构化渲染非 markdown 进度 | Task 8 |
| QuickActions typed action | Task 11 |
| message-bridge 不改 schema | Task 4–5 |
| 旧消息 legacy fallback | Task 8 |
| abort/pause/resume 统一 | Task 6, 10 |
| 测试文件 4 个 | Task 3, 4, 5 |
| NovelStudio ~1800 行 | Task 7–12 |

---

## 不在范围内（实施时不要做）

- 不创建 ChatPage.tsx / BookSidebar.tsx
- 不改 novel-store.ts schema
- 不迁 batchQueue / dialog / cloudSync 到 store
- 不改 UI 布局结构

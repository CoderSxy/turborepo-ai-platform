# InkOS Studio 对齐重构 Todo

更新时间：2026-07-08

本文档用于交给 Cursor 执行当前平台 AI 小说创作模块的重构。核心目标不是继续堆功能，而是让当前平台重新对齐 InkOS Studio 的简洁工作台体验与清晰代码边界。

参考项目：

```text
/Users/nerosun/裂缝中的阳光/sxy/日常/code/inkos
```

重点参考文件：

```text
packages/studio/src/pages/ChatPage.tsx
packages/studio/src/components/chat/BookSidebar.tsx
packages/studio/src/components/chat/QuickActions.tsx
packages/studio/src/components/chat/ToolExecutionSteps.tsx
packages/studio/src/pages/ServiceListPage.tsx
packages/studio/src/pages/ServiceDetailPage.tsx
packages/studio/src/pages/chat-page-state.ts
packages/studio/src/pages/service-detail-state.ts
packages/studio/src/store/chat
packages/studio/src/store/service
```

当前项目重点文件：

```text
apps/web/app/page.tsx
apps/web/app/page.module.css
apps/web/lib/model-settings.ts
apps/web/lib/novel-store.ts
apps/web/lib/provider-stream-parser.ts
packages/inkos-adapter/src/index.ts
packages/inkos-adapter/src/server.ts
```

## 当前判断

当前平台已经实现了不少 InkOS Studio 没有的增强能力，例如本地持久化、章节版本、审稿闭环、批量队列、云同步、导出发布等。但这些能力集中挤在一个主页面里，导致体验和代码都变得拖沓。

现在最明显的问题：

- `apps/web/app/page.tsx` 超过一万行，混合了首页、模型配置、小说工作台、聊天、Agent action、导出、云同步、章节编辑器等逻辑。
- `NovelStudio` 同时承担 UI、workspace 状态、任务调度、消息流、弹窗、toast、批量队列和持久化协调。
- 页面功能入口太多，第一屏像功能陈列台，不像 InkOS Studio 那样聚焦“书籍 / 对话 / 上下文”。
- 普通写作路径被题材、文风、导入、市场雷达、环境诊断、导出、发布、云同步、批量任务等低频能力干扰。
- Chat 和 Core Action 没有统一 runtime，普通聊天、写下一章、审稿、修订、市场雷达各自维护消息、进度和任务状态。
- `apps/web/lib/novel-store.ts` 过载，混合类型、纯函数、IndexedDB、导入导出、云同步、审稿 diff、资产图谱、任务队列。

重构原则：

- 先做体验减法，再做代码拆分。
- 页面只做编排，状态流和业务动作下沉到 store/helper。
- 主工作台默认只保留书籍、对话、上下文三条主线。
- 高级功能保留，但收进二级入口、更多菜单、右侧折叠区或独立弹窗。
- 避免继续向 `apps/web/app/page.tsx` 添加新业务逻辑。

## P0：对齐 InkOS Studio 的简洁体验

当前平台的问题不是功能不足，而是页面内容太多、操作入口太散、流程太繁琐。重构时必须优先参考 InkOS Studio 的简洁工作台体验：用户进入 AI 小说创作后，应当马上看到“书籍 / 对话 / 上下文”三栏主线，而不是被大量工具、导出、云同步、发布、批量任务、诊断、配置入口打断。

### 体验收敛目标

- [x] AI 小说创作首页只保留核心三栏：
  - 左侧：书籍与会话
  - 中间：对话与 Agent 操作
  - 右侧：当前书籍上下文、章节、设定、任务进度
- [x] 顶部或横向工具菜单不要展示过多功能；默认只突出：
  - AI 创作
  - 写下一章
  - 审稿 / 修订
  - 上下文 / 设定
- [x] 题材、文风、导入、市场雷达、环境诊断改成二级入口或右侧工具，不要抢主工作台空间。
- [x] 导出、发布、云同步、批量队列、备份恢复等低频功能收进“更多”菜单或独立弹窗。
- [x] 不要在主页面同时展示太多解释性文案、状态块、按钮组和管理入口。
- [x] 每个主流程最多 1-2 次点击即可开始，例如：
  - 创建书籍
  - 选择模型
  - 输入想法
  - 写下一章
  - 审稿
  - 修订
- [x] 所有复杂配置采用渐进披露：默认隐藏高级配置，需要时再展开。
- [x] Quick Actions 保持 InkOS Studio 风格，只放 3-5 个最常用动作。
- [x] 右侧面板按 section 折叠，不要一次性展开所有章节、资产、审稿、导出、发布信息。
- [x] 页面视觉密度降低：减少大面积卡片、重复状态提示和长说明文字，让对话工作台成为视觉中心。

### 判断标准

- [x] 新用户进入 AI 小说创作页面，5 秒内能判断下一步该做什么。
- [x] 主工作台第一屏不出现超过 6 个同级主操作按钮。
- [x] 普通写作路径不需要理解云同步、导出、发布、批量队列等高级功能。
- [x] 页面结构更接近 InkOS Studio 的 `ChatPage + BookSidebar + QuickActions`，而不是功能陈列台。

## P1：建立模块边界，停止继续膨胀 page.tsx

- [x] 不再继续往 `apps/web/app/page.tsx` 添加新业务逻辑。
- [x] 新建 `apps/web/features/studio/`，作为 AI 小说创作模块边界。
- [x] 新建 `apps/web/features/models/`，承接当前模型配置页面逻辑。
- [x] 保持现有行为不变，先做纯搬迁和拆分。
- [x] `apps/web/app/page.tsx` 最终只保留顶层路由 / 页面编排，目标少于 300 行。（当前 318 行）

建议目录：

```text
apps/web/features/studio/
  components/
  components/chat/
  components/sidebar/
  actions/
  store/
  state/
  persistence/

apps/web/features/models/
  components/
  state/
```

## P2：拆分主入口和模型配置

- [x] 把 `AppShell`、首页 dashboard、页面切换逻辑拆到独立组件。
- [x] 把 `ModelSettingsHome`、`ProviderDetail`、provider card/status/result 相关组件拆到 `features/models/components/`。
- [x] 把 provider 过滤、分组、测试连接、拉模型等逻辑拆成 `features/models/state/model-settings-state.ts` 或 hook。
- [x] 对齐 InkOS 的 `ServiceListPage.tsx`、`ServiceDetailPage.tsx`、`service-detail-state.ts` 思路：UI 负责表单和展示，探测、保存、删除、回填放到 state/helper。
- [x] 模型配置页面保持平台级公共模块，不要重新塞回小说模块内部。

## P3：建立 InkOS 风格的 Studio Store

- [x] 新建 `features/studio/store/types.ts`，定义：
  - `StudioSessionRuntime`
  - `StudioMessage`
  - `StudioMessagePart`
  - `StudioTaskRuntime`
  - `StudioBookRuntime`
- [x] 新建 `features/studio/store/store.ts`，集中管理：
  - books
  - sessions
  - activeBookId
  - activeSessionId
  - activeChapterId
  - input
  - selectedModel
  - runningTask
- [x] 把当前 `NovelStudio` 里的 `books/messagesBySession/activeBookId/activeSessionId/isSending/isRunningCoreAction` 迁入 store。
- [x] UI 组件只能通过 selector 和 action 读写状态，避免继续传一长串 props。
- [x] 参考 InkOS `store/chat` 的 slice 结构，至少拆出：
  - session slice
  - message slice
  - task slice
  - book/workspace slice

## P4：统一 Chat 与 Core Action Runtime

- [x] 把 `sendNovelMessage` 抽成 `features/studio/actions/send-message.ts`。
- [x] 把 `runCoreAction` 抽成 `features/studio/actions/run-core-action.ts`。
- [x] 把 `runBatchCoreAction` 抽成 `features/studio/actions/run-batch-action.ts`。
- [x] 普通聊天、写下一章、审稿、修订、市场雷达都写入同一种 `StudioMessagePart`：
  - `text`
  - `progress`
  - `tool`
  - `error`
  - `result`
- [x] 不再用大段 markdown 字符串模拟任务步骤，改成结构化 progress/tool parts，再由组件渲染。
- [x] Abort、pause、resume、task log 写入统一放在 action runtime 内。
- [x] `QuickActions` 不直接拼复杂逻辑，只派发 action，例如 `{ type: "write-chapter" }`。

## P5：按 InkOS 拆 Chat UI

- [ ] 新建 `features/studio/components/ChatPage.tsx`，只负责消息区、输入框、模型选择、quick actions。
- [ ] 新建或迁移：
  - `components/chat/ChatMessage.tsx`
  - `components/chat/QuickActions.tsx`
  - `components/chat/ToolExecutionSteps.tsx`
  - `components/chat/ModelPicker.tsx`
- [ ] 当前 `NovelStudio` 的 AI 创作面板改为组合：
  - 左侧 `BookList`
  - 中间 `ChatPage`
  - 右侧 `BookSidebar`
- [ ] ChatPage 不直接读写 IndexedDB，不直接调用 InkOS Core，只调用 store/action。
- [ ] 空状态参考 InkOS：用一句轻量引导，不展示大段说明。

## P6：拆右侧 BookSidebar

- [ ] 新建 `features/studio/components/sidebar/BookSidebar.tsx`。
- [ ] 拆出：
  - `ProgressSection`
  - `ChaptersSection`
  - `OutlineSection`
  - `AssetsSection`
  - `ReviewSection`
  - `ExportSection`
- [ ] 把当前 `NovelBookPanel` 拆空，禁止一个组件同时承担章节编辑、审稿、资产、大纲、导出。
- [ ] 章节编辑器独立成 `ChapterEditorDialog` 或 `ChapterEditorPanel`。
- [ ] 版本对比独立成 `ChapterVersionComparePanel`。
- [ ] 审稿问题列表独立成 `ReviewIssuePanel`。
- [ ] 默认只展开最常用 section，其余折叠，减少第一屏压力。

## P7：收敛 novel-store.ts

- [ ] 保留 IndexedDB CRUD 在 `apps/web/lib/novel-store.ts` 或迁到 `features/studio/persistence/`。
- [ ] 把纯函数按主题拆出：
  - `review-state.ts`
  - `outline-state.ts`
  - `assets-state.ts`
  - `export-state.ts`
  - `cloud-sync-state.ts`
  - `task-queue-state.ts`
- [ ] 每次拆分必须同步移动对应测试，避免测试继续依赖巨型文件。
- [ ] IndexedDB 函数只负责读写，不承担 UI 状态和业务流程编排。

## P8：高级功能降噪

- [ ] 题材、文风、导入、市场雷达、环境诊断先降级为 action 或二级工具，不要作为主导航同级入口常驻。
- [ ] 云同步、发布导出、批量队列放到右侧 section 或“更多”菜单。
- [ ] 导出和发布相关按钮不要出现在普通聊天主路径。
- [ ] 环境诊断只在配置异常或用户主动打开时出现。
- [ ] 批量队列只在章节计划视图或任务面板中出现。

## P9：验证要求

每个阶段完成后至少运行：

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/lib/novel-store.test.mjs apps/web/lib/provider-stream-parser.test.mjs
```

人工验收重点：

- [x] 打开 AI 小说创作页面，第一眼能看到书籍、对话、上下文三栏。
- [x] 主工作台第一屏不出现超过 6 个同级主操作按钮。
- [x] 写下一章、审稿、修订三条路径清楚且点击次数少。
- [x] 高级功能仍能找到，但不会干扰普通写作。
- [x] `apps/web/app/page.tsx` 明显变薄。
- [x] Chat 和 Core Action 的消息渲染路径统一。

## 建议执行顺序

1. 先做 P0：体验减法，把主工作台收敛成 InkOS 风格。
2. 再做 P1-P2：拆主入口和模型配置，阻止 `page.tsx` 继续膨胀。
3. 再做 P3-P4：统一 studio store 和 action runtime。
4. 再做 P5-P6：拆 Chat UI 和右侧 Sidebar。
5. 最后做 P7-P8：收敛 `novel-store.ts` 和高级功能降噪。

不要一口气全量重写。每完成一个阶段都必须保证类型检查、lint 和现有测试通过。

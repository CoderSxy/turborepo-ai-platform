# InkOS Studio 对齐 — P0 + P1 设计规格

**日期：** 2026-07-08  
**范围：** P0 体验减法 + P1 模块边界建立  
**状态：** 已确认，待实施

## 背景

当前 `apps/web/app/page.tsx` 约 10,376 行，混合首页、模型配置、小说工作台、聊天、导出、云同步等逻辑。功能完整但入口分散，第一屏像功能陈列台，不像 InkOS Studio 那样聚焦「书籍 / 对话 / 上下文」三栏主线。

本设计覆盖 INKOS_STUDIO_ALIGNMENT_TODO.md 中的 **P0** 和 **P1**，不涉及 P3（store）、P4（统一 runtime）、P5-P8。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 低频工具 tab（题材/文风/导入/市场雷达/环境诊断） | **C** | 保留 tab，视觉降级；默认只突出「AI创作」，其余收进 overflow 菜单 |
| 导出/云同步/批量/备份 | **A** | 全部收进输入区「更多 ⋮」菜单 |
| Quick Actions 主路径 | **A** | 只保留：写下一章 / 审稿 / 修订本章（3 个） |
| P1 拆分深度 | **B** | 标准拆分：小说 → `features/studio/`，模型 → `features/models/`，`page.tsx` 只做编排 |
| 右侧默认展开 section | **B** | 默认展开「进度 + 章节列表」，其余折叠 |
| 执行路径 | **方案 2** | P0 + P1 同步：搬迁组件时同步应用 UI 变更，分 3 个子阶段验证 |

## 目标与验收标准

### P0 体验收敛

- [ ] AI 小说创作首页只保留核心三栏：书籍与会话 / 对话与 Agent / 书籍上下文
- [ ] 主工作台第一屏不超过 6 个同级主操作按钮
- [ ] Quick Actions 只有 3 个 chip
- [ ] 顶部 tab 默认只突出「AI创作」，次级工具在 overflow 菜单
- [ ] 导出、云同步、批量队列、备份不在主路径常驻
- [ ] 右侧面板默认只展开进度 + 章节列表
- [ ] 新用户 5 秒内能判断下一步该做什么

### P1 模块边界

- [ ] 新建 `apps/web/features/studio/` 和 `apps/web/features/models/`
- [ ] `page.tsx` 缩减到 200–400 行，只做顶层路由编排
- [ ] 所有小说/模型组件从 `page.tsx` 迁出
- [ ] 行为零变更：typecheck、lint、现有测试全部通过
- [ ] 不再向 `page.tsx` 添加新业务逻辑

## P0 体验架构

### 整体布局

三栏结构保持不变，降噪入口：

```
┌─────────────────────────────────────────────────────────────┐
│ [AI创作]  [···更多工具]          ← 顶部 tab 区（降级）        │
├──────────┬──────────────────────────┬───────────────────────┤
│ 书籍列表  │  对话区（视觉中心）        │  右侧上下文（折叠）     │
│ + 会话   │  消息列表                 │  ▼ 书籍信息/进度      │
│          │  QuickActions ×3          │  ▼ 章节列表           │
│          │  输入框 + 模型选择         │  ▸ 章节详情（折叠）    │
│          │  [发送] [更多 ⋮]          │  ▸ 大纲（折叠）        │
│          │                          │  ▸ 设定资产（折叠）    │
│          │                          │  ▸ 审稿（折叠）        │
│          │                          │  ▸ 任务/发布（折叠）   │
└──────────┴──────────────────────────┴───────────────────────┘
```

### 1. 顶部工具 tab

**现状：** 6 个同级 tab 横排（AI创作 / 题材 / 文风 / 导入 / 市场雷达 / 环境诊断）

**目标：**
- 默认只显示「AI创作」tab（主样式、高亮）
- 右侧加「··· 更多工具」按钮，下拉列出 5 个次级工具
- 选中次级工具时，tab 区显示当前工具名 + 返回 AI创作 的 breadcrumb
- 次级工具面板内容（`GenreTool`、`StyleTool` 等）不变，仅入口降级

**CSS 变更：**
- `.novelToolTabs` 改为 flex，主 tab 左对齐，overflow 按钮右对齐
- 新增 `.novelToolOverflow`、`.novelToolBreadcrumb` 样式
- 次级 tab 不再横排展示

### 2. 聊天输入区 — ChatComposer

新建 `features/studio/components/chat/ChatComposer.tsx`，替代当前 `composerQuickActions` 大段按钮 + 常驻 `CloudSyncPanel`。

**结构：**

```
[写下一章] [审稿] [修订本章]     ← QuickActions（3 chip）
┌─────────────────────────────────┐
│ textarea                        │
└─────────────────────────────────┘
[模型选择]              [更多 ⋮] [发送]
```

**QuickActions（新建 `QuickActions.tsx`）：**
- 3 个 chip：写下一章 / 审稿 / 修订本章
- 点击调用现有 `runQuickAction(command)`
- disabled 状态与 `isSending || isRunningCoreAction` 联动

**「更多 ⋮」菜单（新建 `ComposerMoreMenu.tsx`）：**

| 分组 | 收纳项 |
|------|--------|
| 会话 | 编辑上一条、重试失败、清空会话、导出会话 |
| 批量 | 批量生成、批量审稿、批量修订；队列控制（暂停/继续/报告） |
| 导出 | 整书 MD/TXT/docx、分章导出、按卷导出、各平台导出、发布清单、整书 JSON、创作日志 |
| 数据 | 备份数据、恢复数据、云同步（含 WebDAV 配置，点击后弹窗展示 `CloudSyncPanel`） |
| 扩展 | 生成大纲、整理设定、市场雷达 |

**批量队列：**
- `batchQueueBar` 仅在 `batchQueueItems.length > 0` 时显示
- 显示位置：composer 上方细条状态栏，不占主路径按钮位

**路由提示：**
- `composerRouteHint` 默认隐藏
- 仅在模型绑定异常（`!canSendChat`）时显示错误信息

### 3. 右侧 BookSidebar 折叠

为 `NovelBookPanel` 各 section 包裹 `CollapsibleSection` 组件。

**默认展开：**

| Section | 默认状态 |
|---------|----------|
| 书籍信息 / 进度 | 展开 |
| 章节列表 | 展开 |

**默认折叠：**

| Section | 默认状态 |
|---------|----------|
| 章节详情 | 折叠 |
| 大纲与章节计划 | 折叠 |
| 设定资产 | 折叠 |
| 写作上下文 | 折叠 |
| 审稿问题 | 折叠 |
| 任务日志 | 折叠 |
| 发布记录 | 折叠 |
| 设定 / 上下文预览 | 折叠 |

**CollapsibleSection 行为：**
- 点击 section 标题切换展开/折叠
- 折叠状态持久化到 `localStorage`（key: `sxy-studio-sidebar-sections`）
- 章节详情内的编辑器、版本对比、审稿列表功能不变，仅默认折叠

### 4. 视觉密度降低

- chat header 只保留：书名 + 阶段 + 进度一行
- 空状态保留一句轻量引导（「输入一个题材、角色或章节目标，从这里开始」），去掉大段说明
- 删除 composer 区模型路由长说明的默认展示

## P1 模块结构

### 目录结构

```text
apps/web/
├── app/
│   ├── page.tsx                    # 仅编排（目标 <400 行）
│   └── page.module.css             # AppShell / HomeDashboard 样式
│
├── components/shell/
│   ├── AppShell.tsx
│   ├── HomeDashboard.tsx
│   └── shell.module.css            # 可选：从 page.module.css 拆出
│
├── features/
│   ├── studio/
│   │   ├── components/
│   │   │   ├── NovelStudio.tsx
│   │   │   ├── CreateBookPanel.tsx
│   │   │   ├── NovelBookList.tsx
│   │   │   ├── NovelBookPanel.tsx
│   │   │   ├── NovelToolPanel.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatComposer.tsx      # 新建
│   │   │   │   ├── QuickActions.tsx      # 新建
│   │   │   │   ├── ComposerMoreMenu.tsx  # 新建
│   │   │   │   ├── ModelPicker.tsx
│   │   │   │   └── MarkdownContent.tsx
│   │   │   ├── tools/
│   │   │   │   ├── GenreTool.tsx
│   │   │   │   ├── StyleTool.tsx
│   │   │   │   ├── ImportTool.tsx
│   │   │   │   ├── RadarTool.tsx
│   │   │   │   └── DoctorTool.tsx
│   │   │   ├── dialogs/
│   │   │   │   ├── AppDialog.tsx
│   │   │   │   ├── AppToast.tsx
│   │   │   │   ├── WriteChapterConfirmDialog.tsx
│   │   │   │   ├── OutlineEditorDialog.tsx
│   │   │   │   ├── KnowledgeAssetLibraryDialog.tsx
│   │   │   │   ├── AssetConflictDialog.tsx
│   │   │   │   ├── PublishValidationDialog.tsx
│   │   │   │   ├── CloudSyncPanel.tsx
│   │   │   │   └── CloudSyncMergeDialog.tsx
│   │   │   └── sidebar/
│   │   │       ├── CollapsibleSection.tsx  # 新建
│   │   │       ├── CharacterStateTimelinePanel.tsx
│   │   │       └── CharacterRelationGraphPanel.tsx
│   │   ├── state/
│   │   │   └── studio-types.ts
│   │   ├── helpers/
│   │   │   ├── novel-helpers.ts
│   │   │   ├── inkos-stream.ts
│   │   │   ├── model-binding.ts
│   │   │   └── export-helpers.ts
│   │   └── studio.module.css
│   │
│   └── models/
│       ├── components/
│       │   ├── ModelSettingsHome.tsx
│       │   ├── ProviderDetail.tsx
│       │   ├── ProviderCard.tsx
│       │   ├── StatusPill.tsx
│       │   ├── ResultBanner.tsx
│       │   └── ModelRoutePanel.tsx
│       ├── state/
│       │   └── model-page-types.ts
│       └── models.module.css
│
└── lib/                            # 不变
    ├── model-settings.ts
    ├── novel-store.ts
    └── ...
```

### page.tsx 搬迁后结构

约 250 行，职责：
1. `activePage` 路由状态（home / novel / models）
2. `settings` 加载/保存（`loadLocalModelSettings` / `saveLocalModelSettings`）
3. 模型页筛选状态（category、searchQuery、connectedOnly、selectedProviderId）
4. provider 操作函数（openProvider、backToProviderList、runProviderTest 等）
5. 条件渲染：`AppShell` + `HomeDashboard` / `NovelStudio` / `ModelSettingsHome` / `ProviderDetail`

### 组件搬迁映射

| 原 page.tsx 符号 | 目标 |
|------------------|------|
| `AppShell` | `components/shell/AppShell.tsx` |
| `HomeDashboard` | `components/shell/HomeDashboard.tsx` |
| `NovelStudio` | `features/studio/components/NovelStudio.tsx` |
| `CreateBookPanel` | `features/studio/components/CreateBookPanel.tsx` |
| `NovelBookList` | `features/studio/components/NovelBookList.tsx` |
| `NovelBookPanel` | `features/studio/components/NovelBookPanel.tsx` |
| `NovelToolPanel` | `features/studio/components/NovelToolPanel.tsx` |
| `GenreTool` ~ `DoctorTool` | `features/studio/components/tools/` |
| `ModelPicker` | `features/studio/components/chat/ModelPicker.tsx` |
| `MarkdownContent` + 解析函数 | `features/studio/components/chat/MarkdownContent.tsx` |
| `AppDialog` ~ `CloudSyncMergeDialog` | `features/studio/components/dialogs/` |
| `CharacterStateTimelinePanel` 等 | `features/studio/components/sidebar/` |
| `ModelSettingsHome` ~ `ModelRoutePanel` | `features/models/components/` |
| `ProviderCard`、`StatusPill` 等 | `features/models/components/` |
| `downloadTextFile` 等导出函数 | `features/studio/helpers/export-helpers.ts` |
| `toNovelBookEntries` 等 | `features/studio/helpers/novel-helpers.ts` |
| `parseInkosActionStreamEvent` 等 | `features/studio/helpers/inkos-stream.ts` |
| `resolveChatModelBinding` 等 | `features/studio/helpers/model-binding.ts` |
| `NovelBookEntry`、`NovelChatMessage` 等类型 | `features/studio/state/studio-types.ts` |

### CSS 拆分

| 来源 | 目标文件 |
|------|----------|
| `.appFrame`、`.appSidebar`、`.homeShell`、`.homeHero` 等 | `page.module.css` 或 `shell.module.css` |
| `.novel*`、`.chat*`、`.book*`、`.composer*`、`.chapter*` 等 | `studio.module.css` |
| `.provider*` 及模型配置相关 | `models.module.css` |

原则：搬迁时按 class 前缀批量切割，**不改 class 名**，避免样式回归。

### 搬迁约束

1. **逻辑零变更** — `NovelStudio` 内 state、effect、action 原样搬迁，不抽 store（P3 再做）
2. **lib/ 不变** — `@/lib/novel-store`、`@/lib/model-settings` 等 import 路径保持
3. **props 不重构** — `NovelBookPanel` 等长 props 列表保持原样（P6 再拆）
4. **新建组件仅 4 个** — `ChatComposer`、`QuickActions`、`ComposerMoreMenu`、`CollapsibleSection`
5. **相对 import** — feature 内部用相对路径，跨 feature 通过 `page.tsx` 或 `lib/` 协调

## 数据流

搬迁不改变数据流：

```
page.tsx (settings state)
  └─ NovelStudio (books/messages/tasks state)
       ├─ IndexedDB via novel-store.ts（不变）
       ├─ API via /api/novel-chat、/api/inkos/action（不变）
       └─ model-settings.ts（不变）
```

## 实施子阶段

| 阶段 | 内容 | 验证命令 |
|------|------|----------|
| **2a** | 建目录骨架；搬 `AppShell`、`HomeDashboard`；搬 `features/models/` 全部 | typecheck + lint |
| **2b** | 搬 `features/studio/` 全部组件、helpers、types；CSS 切割 | typecheck + lint + test |
| **2c** | P0 UI：tab 降级、ChatComposer、ComposerMoreMenu、CollapsibleSection、视觉降噪 | 全量验证 + 人工验收 |

每阶段完成后运行：

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test apps/web/lib/novel-store.test.mjs apps/web/lib/provider-stream-parser.test.mjs
```

## 人工验收清单

- [ ] 打开 AI 小说创作，第一眼看到书籍 / 对话 / 上下文三栏
- [ ] 主工作台第一屏不超过 6 个同级主操作按钮
- [ ] Quick Actions 只有 3 个：写下一章 / 审稿 / 修订本章
- [ ] 顶部默认只突出「AI创作」，次级工具在 overflow 菜单可达
- [ ] 导出、云同步、批量队列在「更多 ⋮」菜单内，不在主路径
- [ ] 右侧默认只展开进度 + 章节列表
- [ ] 写下一章、审稿、修订路径清楚且点击次数 ≤ 2
- [ ] 高级功能仍能找到（更多菜单、overflow 工具、折叠 section）
- [ ] `page.tsx` 明显变薄（< 400 行）
- [ ] 所有现有功能行为不变（创建书籍、聊天、写章、审稿、导出、云同步等）

## 不在本次范围

- P3：Studio Store（Zustand slice 结构）
- P4：统一 Chat 与 Core Action Runtime
- P5：按 InkOS 拆 Chat UI 为独立 `ChatPage`
- P6：拆 `NovelBookPanel` 为多个 sidebar section 组件
- P7：收敛 `novel-store.ts`
- P8：高级功能进一步降噪（本次已做入口收纳，不做 action 层重构）

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 大 diff 难以 review | 分 3 个子阶段提交，每阶段独立验证 |
| CSS 搬迁遗漏导致样式丢失 | 按 class 前缀批量切割，不改名；每阶段目视检查 |
| import 路径错误 | 每批搬迁后立即 typecheck |
| 更多菜单层级过深 | 分组清晰（5 组），云同步用弹窗而非嵌套菜单 |
| 折叠状态丢失 | localStorage 持久化 + 合理默认值 |

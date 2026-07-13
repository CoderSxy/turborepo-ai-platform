# InkOS Studio 右栏对齐 — R1 + R2 设计规格

**日期：** 2026-07-13  
**范围：** R1 主面板信息架构收敛 + R2 InkOS 式详情阅读/编辑视图  
**状态：** 已确认，待实施  
**参考：** [INKOS_STUDIO_RIGHT_PANEL_ALIGNMENT.md](../../INKOS_STUDIO_RIGHT_PANEL_ALIGNMENT.md)

## 背景

当前 `NovelBookPanel.tsx`（~2550 行）在右栏同时展示 10+ 个同级 `CollapsibleSection`：书籍信息、章节、章节详情、大纲、设定资产、写作上下文、任务日志、发布记录、设定、上下文预览等。创作时常用上下文被低频管理能力淹没，与 InkOS Studio `BookSidebar` 的「少量、可扫读、与当前创作直接相关」原则不符。

P3 store（`features/studio/store/`）与 `WriteChapterOptionsSheet` 已就位。本次改版聚焦右栏入口降噪与详情视图分离，不涉及 IndexedDB schema 变更，不删除任何现有能力。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 实施范围 | **B — R1 + R2** | 主面板 + 详情视图；R3/R4 推迟 |
| 实现方案 | **A — 外壳替换 + 原地搬迁** | 新建 `right-panel/`，从 `NovelBookPanel` 剪切代码，低风险 |
| 详情路由状态 | **本地组件 state** | `BookContextPanel` 内 `panelView` + `detailTarget`；不扩展 store |
| 折叠卡组件 | **增强 CollapsibleSection → SidebarCard** | 保留 localStorage key；新增收起摘要 slot |
| 低频能力入口 | **WorkspaceMoreSheet（临时）** | R1 整块搬迁旧 section；R3 再分组为 WorkspaceMoreMenu |
| 章节进详情 | **单击选章 + 行内「打开」进详情** | 单击保持 `activeChapterId`；避免双击误触 |
| `NovelBookPanel` 兼容 | **re-export** | `NovelStudio` import 不变 |

## 目标与验收标准

### R1 完成标准

- [ ] 新建 `features/studio/components/right-panel/` 目录与 `BookContextPanel` 外壳
- [ ] 实现 5 张主卡片：`ChaptersSection`、`CharactersSection`、`CoreFilesSection`、`WorldSummarySection`、`CharacterSummarySection`
- [ ] 每张卡收起态有真实摘要线索；展开内容严格限量（见下表）
- [ ] 顶部 `BookSummaryHeader` 替换书籍信息大块（高度 ≤ 44px）
- [ ] 章节卡默认展开，其余默认折叠
- [ ] 10 个低频 section 从主面板隐藏，迁入 `WorkspaceMoreSheet`；功能零删减
- [ ] 保留 `CollapsibleSection` localStorage 兼容（key：`sxy-studio-sidebar-sections`）
- [ ] 右栏第一屏 ≤ 6 个可见区块；无长正文、完整 Prompt、任务日志

### R2 完成标准

- [ ] 新建 `BookContextDetailView`，支持 `chapter | core-file` 两种主类型（`character`/`outline` R2 简化为打开 core-file 或现有 Dialog）
- [ ] `ChapterDetailView` 承接原章节详情全部能力：编辑、版本对比、审稿、导出、删除
- [ ] `CoreFileDetailView` 承接核心文件与世界观完整 Markdown 阅读/编辑
- [ ] 详情顶栏：`← 返回`、标题、编辑/保存；返回恢复主面板展开态与滚动位置
- [ ] 章节列表单击仅切换 `activeChapterId`；行内「打开」或等效按钮进入详情
- [ ] 主面板不再常驻章节编辑器、版本对比、审稿问题列表
- [ ] 从详情返回不丢失：当前书籍、当前章节、未保存草稿、右栏滚动位置

### 量化目标

- `NovelBookPanel.tsx`：2550 行 → re-export（~10 行）
- `BookContextPanel.tsx`：目标 < 300 行（编排 + 路由）
- `ChapterDetailView.tsx`：承接 ~800–1200 行（自 `NovelBookPanel` 搬迁）
- 新增文件：~12 个
- `lib/novel-store.ts`：0 行 schema 改动
- `NovelStudio.tsx`：仅改 import（或不变，若 re-export 保持路径）

### 验证命令

每批次完成后执行：

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
```

手工验收：选择章节、进入/返回详情、编辑默认写作偏好（Composer sheet）、打开 more sheet 内资产库/任务恢复、刷新后展开状态恢复。

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│ NovelStudio（编排壳，props 不变）                         │
└───────────────────────────┬─────────────────────────────┘
                            │ project / assets / chapters / callbacks
                            ▼
┌─────────────────────────────────────────────────────────┐
│ BookContextPanel                                         │
│  本地 state: panelView, detailTarget, scrollRef          │
│  ├─ main → BookSummaryHeader + 5×Section + MoreButton    │
│  └─ detail → BookContextDetailView                       │
│       ├─ ChapterDetailView                               │
│       └─ CoreFileDetailView                              │
└───────────────────────────┬─────────────────────────────┘
                            │
              WorkspaceMoreSheet（临时，承载旧 section 全文）
```

## 目录结构

```
apps/web/features/studio/components/
  right-panel/
    BookContextPanel.tsx
    BookSummaryHeader.tsx
    SidebarCard.tsx
    ChaptersSection.tsx
    CharactersSection.tsx
    CoreFilesSection.tsx
    WorldSummarySection.tsx
    CharacterSummarySection.tsx
    WorkspaceMoreSheet.tsx
    core-file-keys.ts              # CoreFileKey 常量与 assets 字段映射
    detail/
      BookContextDetailView.tsx
      ChapterDetailView.tsx
      CoreFileDetailView.tsx
  NovelBookPanel.tsx               # export { BookContextPanel as NovelBookPanel }
  sidebar/
    CollapsibleSection.tsx         # 保留；SidebarCard 可内部复用其 localStorage 逻辑
```

## 主面板设计（R1）

### 布局

```text
┌─ 当前书籍 · 已生成 12 / 120 章 ─────────────┐
│  （runningTask 时一行轻量状态）               │
├──────────────────────────────────────────────┤
│ ▾ 章节                                        │
├──────────────────────────────────────────────┤
│ ▸ 角色状态                                    │
│ ▸ 核心文件                                    │
│ ▸ 世界观                                      │
│ ▸ 人物摘要                                    │
├──────────────────────────────────────────────┤
│                    [更多工作区 ···]            │
└──────────────────────────────────────────────┘
```

### 卡片规格

| 卡片 | localStorage id | 默认 | 收起摘要 | 展开内容（上限） | 点击行为 |
|------|-----------------|------|----------|------------------|----------|
| 章节 | `chapter-list` | 展开 | `N 章 · 当前第 X 章` | 号/标题/状态/字数；max-h 220px 滚动 | 单击选章；「打开」进详情 |
| 角色状态 | `characters` | 折叠 | 角色数或当前章相关角色名 | 最多 4 张紧凑状态卡 | 点击角色 → core-file `character_matrix` 或资产详情 |
| 核心文件 | `core-files` | 折叠 | `已加载 N 项` | 仅列已存在文件链接 | 点击 → `CoreFileDetailView` |
| 世界观 | `world-summary` | 折叠 | 首行截断（≤ 60 字） | 2–4 行摘要 +「查看完整」 | 「查看完整」→ `CoreFileDetailView` |
| 人物摘要 | `character-summary` | 折叠 | 主角名 / 配角数 | 主角 + 主要配角短摘要 +「查看完整」 | 「查看完整」→ 角色矩阵详情 |

### SidebarCard API

```typescript
type SidebarCardProps = {
  id: string;                    // localStorage key 段
  title: string;
  defaultOpen?: boolean;
  summary?: React.ReactNode;     // 收起时显示在 header 区域
  actions?: React.ReactNode;     // header 右侧操作
  children: React.ReactNode;     // 展开时 body
};
```

- 读写 `localStorage` key `sxy-studio-sidebar-sections`，与 `CollapsibleSection` 格式兼容
- `aria-expanded` 在 header button 上
- 收起时 `summary` 必须非空（主卡片的「摘要线索」要求）

### BookSummaryHeader

- 显示：书名（可点击，more sheet 内定位书籍统计）、`已生成 X / Y 章`
- `runningTask` 存在时追加一行：`正在{写作|审稿|修订}…`（读 `tasks`，不展示完整日志）
- 高度 ≤ 44px；不展开

### 数据来源映射

| 卡片 | 数据源 |
|------|--------|
| 章节 | `mergeNovelChapterPlan(project, chapters)`、`activeChapterId` |
| 角色状态 | `assets.characters`、`assets.knowledgeAssets`、当前章 `outlineNodes` / pending deltas |
| 核心文件 | `assets.worldNotes`、`outline`、`settings`、`characters`、`knowledgeAssets`；按 `core-file-keys.ts` 判断是否存在 |
| 世界观 | `project.world`、`assets.worldNotes`；优先 story bible 世界观章节首段 |
| 人物摘要 | `project.protagonist`、`assets.characters`；区别于角色矩阵的状态卡 |

### WorkspaceMoreSheet（R1 临时）

底部 Sheet / 侧滑面板，分组展示从主面板移除的全部 section（原 JSX 整块搬迁，不改业务逻辑）：

- 书籍信息（完整进度块）
- 大纲与章节计划
- 设定资产
- 写作上下文（R3 删除；R1 保留在 more 内）
- 任务日志
- 发布记录
- 设定
- 上下文预览
- 章节详情（R2 完成后从 more 移除，仅保留详情视图入口）

触发：主面板底部固定按钮「更多工作区 ···」。

## 详情视图设计（R2）

### 路由类型

```typescript
/** 对齐 InkOS「核心文件」概念；字段以 NovelProjectAssets 为准 */
type CoreFileKey =
  | "worldNotes"    // 世界观设定 → assets.worldNotes
  | "outline"       // 卷纲规划 → assets.outline
  | "settings"      // 叙事规则 → assets.settings
  | "characters";   // 角色矩阵 → assets.characters
// 伏笔池等待确认资产等通过 knowledgeAssets 聚合展示，R2 不在 CoreFileDetailView 单独开类型

type DetailTarget =
  | { type: "chapter"; chapterId: string }
  | { type: "core-file"; fileKey: CoreFileKey };

type PanelView = "main" | "detail";
```

`character` / `outline` 在 R2 不单独建视图：`character` 映射为 `core-file: characters`；`outline` 保留 more sheet 内 `OutlineEditorDialog` 入口。

### BookContextDetailView 壳

- 顶栏：`← 返回`（恢复 `panelView = "main"` + `scrollRef`）、标题、可选编辑/保存按钮
- 内容区：按 `detailTarget.type` 渲染 `ChapterDetailView` 或 `CoreFileDetailView`
- Esc 关闭详情（R2 基础支持；R4 完善焦点恢复）
- 返回时不卸载主面板 DOM 状态：用条件渲染 + `scrollRef` 保存/恢复 `scrollTop`

### ChapterDetailView

从 `NovelBookPanel` **剪切搬迁**（非重写），包含：

- 章节元信息、状态/发布 select
- 正文编辑器（localStorage 草稿、`sxy-novel-chapter-draft:{id}`、自动保存、搜索替换、全屏）
- 版本列表与对比、`buildNovelChapterVersionCompareView` 相关 UI
- 审稿问题列表、筛选、修订选中、`onReviseChapter`
- 操作：导出 MD/TXT/docx、删除、生成本章（计划章）、上一章/下一章导航

Props：接收与现 `NovelBookPanel` 相同的章节相关 callbacks + `activeChapterId` + `chapterVersions`。

### CoreFileDetailView

- 按 `fileKey` 从 `assets` / `project` 读取 Markdown 文本
- 阅读：`MarkdownContent`；编辑：textarea 切换 + `onProjectChange` 保存
- 顶栏编辑按钮对齐 InkOS `ArtifactView`
- R2 不做文件版本历史；复杂结构化编辑仍通过 more sheet 内 Dialog

### 核心文件标签（对齐 InkOS 展示名，映射本项目 assets）

| fileKey | 显示名 | 数据源 | 存在条件 |
|---------|--------|--------|----------|
| worldNotes | 世界观设定 | `assets.worldNotes` | 非空字符串 |
| outline | 卷纲规划 | `assets.outline` | 非空字符串 |
| settings | 叙事规则 | `assets.settings` | 非空字符串 |
| characters | 角色矩阵 | `assets.characters` | 非空字符串 |

InkOS 中的状态卡、伏笔池、支线、感情线在本项目无独立 Markdown 字段；`CoreFilesSection` 收起摘要中的「已加载 N 项」仅统计上表 4 项。`knowledgeAssets` 中按类别聚合的条目（如伏笔 `foreshadowing`）在 R1 通过 `CharactersSection` 异常提示或 more sheet 资产库访问；R3 再考虑扩展核心文件列表。

`core-file-keys.ts` 集中定义：`label`、`getContent(assets)`、`isPresent(assets)`、`applySave(assets, content)`。

## 状态与数据流

- **不新增** store slice；`activeChapterId` 仍由 `NovelStudio` / book slice 管理
- `BookContextPanel` 本地 state：`panelView`、`detailTarget`、`mainPanelScrollTop`
- 所有持久化写入继续走现有 props callbacks
- 任务过程展示：聊天任务卡为主；`BookSummaryHeader` 仅一行运行时摘要

## 迁移步骤（实施顺序）

### 阶段 1 — R1 外壳与主卡

1. 创建 `SidebarCard`（含 summary + localStorage）
2. 创建 `BookSummaryHeader`、5 个 Section 组件（真实摘要数据）
3. 创建 `BookContextPanel` 主面板布局
4. 创建 `WorkspaceMoreSheet`，搬迁 10 个旧 section JSX
5. `NovelBookPanel.tsx` 改为 re-export
6. typecheck + lint + 手工验收 R1

### 阶段 2 — R2 详情视图

1. 创建 `BookContextDetailView` 壳 + 路由 state
2. 创建 `ChapterDetailView`，从 `NovelBookPanel` / more sheet 剪切章节详情代码
3. 创建 `CoreFileDetailView` + `core-file-keys.ts`
4. `ChaptersSection` / `CoreFilesSection` / 世界观卡接入详情导航
5. 从主面板与 more sheet 移除冗余「章节详情」常驻块
6. typecheck + lint + 手工验收 R2

## 明确推迟（R3 / R4）

| 项 | 批次 |
|----|------|
| `WorkspaceMoreMenu` 分组（资产/任务/发布/诊断） | R3 |
| 右栏删除「写作上下文」；统一 Composer options sheet | R3 |
| 角色/世界观卡上的待确认资产异常徽标 | R3 |
| 桌面宽度拖拽 280–520px、窄屏抽屉 | R4 |
| 完整 a11y（焦点圈定、Tab 陷阱测试） | R4 |
| `sidebarView` 迁入 studio store | 可选，R3+ |

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 剪切章节编辑器引入回归 | 整块搬迁 JSX + 同文件 hooks；搬迁前后对照手工验收清单 |
| localStorage 展开状态 id 变更 | 新卡使用新 id；more sheet 内保留旧 id |
| `NovelBookPanel` 外部引用 | re-export 保持导出名与 props 类型 |
| 详情返回丢草稿 | 草稿 key 不变；`ChapterDetailView` 不 unmount 时保持 state，或依赖既有 localStorage 草稿 |

## 与 INKOS_STUDIO_ALIGNMENT_TODO P6 的关系

本次实现覆盖 P6 的核心目标（拆 `NovelBookPanel`、默认折叠、章节编辑进独立视图）。命名采用对齐文档的 `BookContextPanel` / `right-panel/`，而非 P6 草案中的 `BookSidebar`。P6 checklist 可在 R1+R2 完成后勾选相应子项。

# InkOS Studio 左侧栏对齐 — 书籍树设计规格

**日期：** 2026-07-14  
**状态：** 已确认  
**参考：** [INKOS_STUDIO_LEFT_PANEL_ALIGNMENT.md](../../INKOS_STUDIO_LEFT_PANEL_ALIGNMENT.md)

## 1. 范围与决策

### 本轮范围

覆盖 alignment 文档的 **L1 + L2 + L4**（书籍区信息架构、渐进披露管理、视觉与测试）。

### 明确不做

- **L3「工具 - 普通聊天」** 整块推迟。当前 `StoredNovelSession.bookId` 为必填，左栏无独立普通聊天；不做 schema 变通或独立会话集合。
- 不改 IndexedDB / 书籍 / 会话 schema。
- 不删归档、批量、改名、排序等能力，只改变可见层级。
- 不复制 InkOS 主题色板或 Tailwind 皮肤；沿用 `studio.module.css` 现有主题。
- 不做拖拽排序（管理态沿用已有上移/下移）。
- 不改造会话网络懒加载层；现状 `book.sessions` 已在内存，按 `expandedBookIds` 条件渲染即可。

### 已确认决策

| 决策点 | 选择 |
|--------|------|
| 实现路径 | 原地重构 `NovelBookList`，同目录拆分子组件（非新建 `left-panel/`） |
| 书籍点击 | 点书名 = 切换当前书并展开；点箭头 = 仅展开/收起 |
| 管理模式 | 就地模式：标题行 ⋯ →「管理书籍」后出现复选框 + 批量栏；「完成管理」退出 |
| 展开状态 | `expandedBookIds: Set<string>`，仅内存，不写书籍数据 |
| 普通聊天 | 本轮不做 |

## 2. 目标体验

默认浏览态：

```text
书籍                    [+ 新建书籍]  [⌕]  [⋯]
›  📁 旧日秘密                                    [⋯]
⌄  📁 长夜行                                      [⋯]
      小说名《长夜行》……              11 个月     [⋯]
      新的创作会话                    24 天       [⋯]
   +  新建会话
```

原则：浏览优先、渐进披露、行为兼容（现有 callbacks / store actions 不换语义）。

## 3. 组件结构

`NovelStudio` 仍渲染 `NovelBookList`，现有 props/callbacks 保留。

| 文件 | 职责 |
|------|------|
| `NovelBookList.tsx` | 编排：展开态、搜索显隐、管理模式、过滤列表 |
| `BookSidebarHeader.tsx` | 「书籍」标题、新建、⌕、⋯ |
| `BookTreeItem.tsx` | 书节点：箭头、文件夹图标、书名、hover ⋯ |
| `SessionTreeItem.tsx` | 会话：单行标题 + 相对时间、选中态、hover ⋯ |
| `BookActionsMenu.tsx` | 重命名、归档/还原、上移、下移、删除 |
| `SessionActionsMenu.tsx` | 重命名、删除 |

可选同目录小 helper（便于单测）：`book-tree-expand.ts`（展开集合操作）。

## 4. UI 状态（仅 NovelBookList 本地）

| 状态 | 作用 |
|------|------|
| `expandedBookIds` | 多书同时展开；与 `activeBookId` 解耦 |
| `searchOpen` | 标题行 ⌕ 控制搜索行 |
| `manageMode` | 就地管理：复选框 + 批量栏 |
| `viewArchived` | 标题行 ⋯「已归档书籍」；默认只显示进行中 |

`searchQuery` / `selectedBookIds` / `showArchived` 等仍可由 `NovelStudio` 注入；`viewArchived` 可与现有 `showArchivedBooks` 对齐或在 list 内桥接，避免双数据源冲突——实现时优先复用现有 `showArchivedBooks` + `onShowArchivedChange`。

## 5. 交互规范

### 展开与选中

- 点箭头：toggle 该书是否在 `expandedBookIds`
- 点书名：调用 `onBookSelect`，并将该书加入 `expandedBookIds`
- 选会话 / 新建会话：确保对应书展开
- `activeBookId` 变化：自动将该书加入 `expandedBookIds`
- 可同时展开多本书

### 会话展示

- 仅标题（截断）+ `age`
- 不再展示 `summary`、会话数、书籍 meta/题材摘要
- 「+ 新建会话」固定在已展开书的会话列表底部

### 菜单

- 书籍 `…`：重命名、归档/还原、上移、下移、删除；首尾禁用对应排序项；删除走现有确认
- 会话 `…`：重命名、删除；删除走现有确认
- 标题行 `…`：「已归档书籍」「管理书籍」
- `…` 在 hover / focus-within / 菜单打开时可见；不改变行宽；触屏可直接点到 `⋯`

### 搜索与管理

- ⌕：展开搜索行并 focus；Esc 清空并收起（不在文本编辑时误伤 Composer）
- 管理书籍：`manageMode=true` → 复选框 + 批量归档/还原/删除 +「完成管理」；退出清选择并隐藏复选框
- 日常默认禁止同时出现：搜索框、筛选胶囊、快捷键提示条、复选框、常驻 ↑↓改归档删按钮、书籍摘要块

### 键盘（扩展 NovelStudio 现有 handlers）

| 键 | 行为 |
|----|------|
| `/` | 打开搜索并 focus（非输入目标时） |
| `N` | 新建书籍（保持） |
| `Esc` | 关菜单 → 关搜索 → 退出管理/清选择（依次） |

输入框/textarea 内不拦截 `/`、`N`。

### 空状态

文案收敛为「还没有书籍」+「新建书籍」主操作；去掉强调管理/归档/导出的说明。

## 6. 视觉与 a11y

- 紧凑行高、弱边界、单行选中背景；去掉默认大卡片边框与元信息堆叠
- 长标题 ellipsis；相对时间不撑宽布局
- 菜单绝对定位，窄屏不被裁切
- 箭头 `aria-expanded`；当前书/会话有当前项语义；icon-only 有 `aria-label`/`title` 与 `:focus-visible`
- 菜单可用 Esc 关闭并回焦

## 7. 数据与兼容

- 不改 schema；所有写操作继续走现有 `onRenameBook` / `onArchiveBook` / `onDeleteBook` / `onMoveBook` / `onRenameSession` / `onDeleteSession` / 批量 callbacks
- 删除当前书/会话后的回退逻辑仍在 `NovelStudio`，本轮不改
- 展开状态可不持久化

## 8. 测试与验证

纯逻辑单测（node:test，风格对齐右栏）：

1. 展开集合：选书/选会话后必含 active book；箭头 toggle 不影响其他书
2. 归档过滤：默认排除归档；归档视图只显示归档

验证命令：

```bash
pnpm --filter web run check-types
pnpm --filter web run lint
pnpm --filter web run test
```

## 9. 实施顺序

1. **L1**：拆组件 + `expandedBookIds` + 条件渲染会话树（点书名/箭头语义落地）
2. **L2**：菜单、搜索/归档入口、就地管理模式、Esc 链
3. **L4**：CSS 密度、a11y、单测、类型与 lint

## 10. 验收对照（本轮）

来自 alignment §6，排除普通聊天相关项：

- [x] 默认左栏无搜索框、全选、选择框、书籍摘要、会话数、上下移动/改名/归档/删除文字按钮
- [x] 每本书为「箭头 + 文件夹图标 + 书名」；展开后才显示会话与新建会话
- [x] 可同时展开多本书；切书/切会话后对应书保持展开
- [x] 会话仅标题 + 相对时间；长标题不破布局
- [x] 改名/删除/归档/还原/排序/批量仍可从菜单或管理模式到达
- [x] 删除有确认；归档书默认不混入进行中列表
- [x] 键盘与触屏可访问折叠与菜单；Esc 不误清空 Composer 输入
- [x] check-types、lint、相关测试通过

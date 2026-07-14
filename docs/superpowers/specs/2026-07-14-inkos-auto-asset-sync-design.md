# InkOS Studio 自动资产同步底座（P1）设计规格

**日期：** 2026-07-14  
**状态：** 已确认  
**参考：** [INKOS_STUDIO_AUTONOMOUS_WRITING_AND_CHARACTER_ALIGNMENT.md](../../INKOS_STUDIO_AUTONOMOUS_WRITING_AND_CHARACTER_ALIGNMENT.md) §2 / §5 P1

## 1. 范围与决策

### 本轮范围

仅落地 alignment 文档 **P1：自动资产同步底座**：

- 新章节生成后资产自动合并落库（不再写入日常 `pendingAssetDeltas` 审批队列）
- 历史 `pendingAssetDeltas` 在书籍加载时幂等迁移
- 右栏/工作区移除日常「待确认」标签与确认/忽略入口
- 不可安全合并的硬错误以同步诊断呈现（低干扰）

### 明确不做

- P2：`characterProfiles` 与完整角色档案右栏重构
- P3–P4：写下一章内置审核 / 评分 / 自动修订流水线
- 扩展完整 `NovelAssetChangeEvent`（before/after / `status: rolled-back` 等）
- `manualLocks` 与「手改即保护」启发式
- 复刻 InkOS 文件系统 `roles/*` 目录语义以外的存储改写

### 已确认决策

| 决策点 | 选择 |
|--------|------|
| 本轮子系统 | 仅 P1 |
| 冲突处理 | 只写 `needs-attention` 语义诊断；右栏不出现「待确认」 |
| 历史迁移时机 | 打开/加载该书时幂等自动迁移 |
| 合并策略 | 宽进：几乎总是 apply；仅硬错误写诊断 |
| 实现路径 | 最小增量：包一层 `mergeNovelChapterAssetDeltaSafely`，复用现有 `apply` / `assetChangeEvents` / `diagnostics` |

## 2. 目标体验

用户点击「写下一章」并完成现有 Writer 保存后：

1. 章节正文与可提取资产增量**自动写入** knowledge / 摘要相关资产。
2. 任务进度文案为「已同步：…」或「章节已完成；N 项同步需关注…」。
3. 右栏**不得**出现「待确认 N 项」「待确认」角色标签，以及确认/忽略按钮。
4. 打开旧书时，历史 pending 自动迁移；冲突保留诊断与可恢复信息，不丢数据。

## 3. 架构与数据流

```text
写下一章 (现有 Writer 返回)
  → buildNovelChapterAssetDelta
  → mergeNovelChapterAssetDeltaSafely(assets, delta, { source: "chapter-pipeline" })
       ├─ 幂等：同章已 apply → no-op
       ├─ 成功：applyNovelChapterAssetDelta + appendNovelAssetChangeEvent
       └─ 硬错误：写入 assets.diagnostics，不 queue pending
  → 同一次 patch 持久化章节 + assets

打开书籍 / hydrate
  → migratePendingAssetDeltas(assets)
       ├─ 按 chapterNumber + 时间升序处理
       ├─ 成功：apply 并从 pending 移除；source: "migration"
       └─ 失败：diagnostic + 保留原始 pending/快照；标记避免成功项重跑
```

### 语义变化

| 概念 | P1 语义 |
|------|---------|
| `pendingAssetDeltas` | 迁移兼容 / 极端失败暂存；**新生成路径禁止 queue** |
| `assetChangeEvents` | 继续用现有简 schema 记录已应用变更；不扩 before/after |
| `assets.diagnostics` | 承载同步硬错误（`ok: false`，label 前缀 `同步诊断`） |
| confirm / dismiss API | 可保留内部函数；**UI 不再接线** |

### 建议新增字段

```ts
// 挂在 assets 上，幂等迁移标记（命名以实现为准）
pendingMigration?: {
  schemaVersion: 1;
  migratedAt?: string;
};
```

## 4. 合并幂等与诊断规则

### `mergeNovelChapterAssetDeltaSafely(assets, delta, policy)`

| 情况 | 行为 |
|------|------|
| 增量实质为空 | 不写变更；可选 info diagnostic「无可同步增量」 |
| 同章已成功 apply | 返回原 assets，不二次 append |
| apply 抛错 / 校验失败 | 不改 knowledge；记 `ok: false` 同步诊断；**不** queue pending |
| 正常 | `applyNovelChapterAssetDelta` + `appendNovelAssetChangeEvent` |

### 幂等键（最小实现）

- 在 `assetChangeEvents` 中查找同 `chapterNumber` 且 label/detail 标明 `chapter-pipeline` 或 `migration` 的已应用事件；命中则跳过。
- 加载迁移：成功跑完后写 `pendingMigration.migratedAt`；对仍失败保留的 pending，按稳定 `id` 只处理尚未永久失败占位的条目，避免刷新重复成功合并。

### 宽进

P1 **不做**字段级人工锁与手改保护启发式。沿用现有 `applyNovelChapterAssetDelta` upsert/merge 行为。

### 同步诊断计数

```ts
syncAttentionCount = diagnostics.filter(
  (d) => !d.ok && d.label.startsWith("同步诊断"),
).length;
```

## 5. UI 清理

### 删除日常「待确认」路径

- `buildAssetAlertCounts`：`pendingCount` 改为基于 `syncAttentionCount`（或重命名字段）；不再读 `pendingAssetDeltas.length` 作日常警报。
- `SidebarCardAlert`：文案「N 需关注」，禁止「待确认」。
- `buildCharacterStateCards` / 角色摘要 / `CharacterDetailView`：不以 pending 标「待确认」。
- `WorkspaceMoreSections`：移除 pending 列表与确认/忽略/编辑入口。
- `NovelBookPanel` / `useNovelBookWorkspace`：UI 不再调用 confirm/dismiss。

### 低干扰入口

- 仅当 `syncAttentionCount > 0` 时在右栏卡片或顶栏显示 badge。
- 点击进入「更多工作区」诊断或轻量 dialog：列出同步诊断（原因 + 章节）；**不阻断**继续写下一章。
- 资产变更时间线保留，语义改为已自动同步记录。

### 任务进度文案（`run-core-action.ts`）

- 成功：`已同步：章节摘要、角色状态、世界观、伏笔与大纲`
- 有诊断：`章节已完成；N 项同步需关注，详见同步诊断`
- **禁止**：`等待人工确认后写入设定资产`

## 6. 主要改动面

| 区域 | 文件（预期） |
|------|----------------|
| 合并/迁移纯函数 | `apps/web/lib/novel-store.ts`（+ 可选抽出小模块 + `.test`） |
| 写下一章落库 | `apps/web/features/studio/actions/run-core-action.ts` |
| 加载迁移接线 | 书籍 hydrate / 加载路径（`NovelStudio` 或 book slice / workspace hook） |
| 右栏摘要与 badge | `right-panel-summaries.ts`、`SidebarCardAlert.tsx`、相关 section/detail |
| 工作区更多 | `WorkspaceMoreSections.tsx`、`useNovelBookWorkspace.ts`、`NovelBookPanel.tsx` |

## 7. 测试与验收

### 单测

1. 新 delta 经 safe merge 后资产已写入，且不增加 `pendingAssetDeltas`
2. 同章二次 merge 幂等，不重复角色状态 / 伏笔 / change event
3. `migratePendingAssetDeltas`：有序 apply；成功项移出 pending；失败 → diagnostic 且保留数据；二次加载不重跑成功项
4. 空增量不污染 assets
5. 摘要/alert 测试不再期望「待确认」文案；改为「需关注」或无 alert

### 命令

```bash
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
```

### 手工验收

1. 写新章后右栏无「待确认」；刷新后摘要/角色/世界观/伏笔仍在
2. 含历史 pending 的旧书打开后自动合并或进入同步诊断，不丢条目
3. 「更多」中无确认/忽略 pending 日常按钮

## 8. 与后续阶段关系

- P2 可在本底座上引入 `characterProfiles` 与锁定字段（替换宽进策略）
- P3 可将 Writer→Auditor→… 完成后再调用同一 `merge…Safely`，不改 P1 语义

## 9. 验收对照（本轮）

- [ ] 新章节生成后摘要、角色、世界观、伏笔相关资产自动写入，`pendingAssetDeltas` 不被新路径增长
- [ ] 同一章节重复恢复/合并不重复追加状态与变更事件
- [ ] 历史 pending 按顺序迁移；冲突只产生同步诊断
- [ ] 右栏无「待确认」字样与确认/忽略日常入口
- [ ] `check-types`、`lint`、相关单测通过

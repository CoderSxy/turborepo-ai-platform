# InkOS P1 Remediation：同步 identity + 原子提交设计规格

**日期：** 2026-07-14  
**状态：** 已确认  
**参考：** [INKOS_STUDIO_P1_REMEDIATION.md](../../INKOS_STUDIO_P1_REMEDIATION.md) P1-1 / P1-2  
**前置：** [2026-07-14-inkos-auto-asset-sync-design.md](./2026-07-14-inkos-auto-asset-sync-design.md)

## 1. 范围与决策

### 本轮范围

仅落地 remediation **P1-1 + P1-2**：

1. **P1-1**：资产同步幂等键从 `chapterNumber` 改为稳定 `syncId`；同章多条 pending 不得静默丢失。
2. **P1-2**：写下一章结果经唯一 `commitWriteChapterResult`，IndexedDB 单事务写入 chapter + version + book(assets)（+ 可选 task）；失败整笔回滚。

### 明确不做

- P1-3 `characterProfiles` 与右栏角色重构
- P1-4 Writer → Auditor → Reviser 流水线
- commit-pending 检查点方案（已否决，采用单事务）
- 用 `Date.now()` 或仅章节号作为同步幂等键

### 已确认决策

| 决策点 | 选择 |
|--------|------|
| 本轮子系统 | P1-1 + P1-2 |
| 原子提交 | IndexedDB 跨 store 单事务（方案 A） |
| 新路径 `syncId` | `chapterId:chapterVersionId:stableHash(canonicalDelta)` |
| 实现路径 | 分层：`novel-asset-auto-sync.ts` + `commit-write-chapter-result` + 改写 `run-core-action` 写章接线 |

## 2. P1-1：幂等 identity

### 2.1 `pendingMigration` schema v2

```ts
pendingMigration: {
  schemaVersion: 2;
  appliedSyncIds: string[];
  legacyAppliedChapters?: number[]; // 仅兼容读取旧 appliedChapters
  skippedPendingIds?: string[];
  migratedAt?: string;
};
```

规范化：

- 若发现 v1（仅有 `appliedChapters`）：写入 `legacyAppliedChapters`，`appliedSyncIds: []`，`schemaVersion: 2`。
- `legacyAppliedChapters` **不得**用来删除/跳过同章但 `syncId` 未知的 pending。

### 2.2 `syncId` 规则

| 来源 | `syncId` |
|------|----------|
| 历史 pending | `legacy:${pending.id}` |
| 新写下一章自动同步 | `${chapterId}:${chapterVersionId}:${stableHash(canonicalDelta)}` |

`canonicalDelta`：稳定序列化 `chapterNumber`、`chapterTitle`、`summary`、角色/世界观/伏笔数组（排序确定），排除时间戳等不稳定字段。哈希实现可用项目内简易非加密 hash（需确定性、跨会话稳定）。

### 2.3 `mergeNovelChapterAssetDeltaSafely`

签名需接收 `syncId`：

```ts
mergeNovelChapterAssetDeltaSafely(
  assets,
  delta,
  { source: "chapter-pipeline" | "migration"; syncId: string },
): {
  status: "applied" | "skipped" | "needs-attention";
  assets: NovelProjectAssets;
}
```

行为：

| 情况 | status | 行为 |
|------|--------|------|
| `appliedSyncIds` 已含 syncId | `skipped` | 原样返回 |
| 无实质内容（与现有 hasDeltaContent 一致：不含 summary-only） | `needs-attention` | 稳定诊断 id `sync-diag:${syncId}`；不静默删除 pending |
| apply 成功 | `applied` | `applyNovelChapterAssetDelta` + append syncId |
| apply 抛错 | `needs-attention` | 保留 assets；稳定诊断；不 queue 新 pending |

**禁止**用 `chapterNumber ∈ appliedChapters/legacyAppliedChapters` 做短路。

调用方不得靠「数组长度是否变化」推断结果，必须读 `status`。

### 2.4 `migratePendingAssetDeltas`

1. 按 `chapterNumber`、再 `createdAt` 排序。
2. 逐条：`syncId = legacy:${id}`。
3. 已在 `appliedSyncIds` → 从 pending 移除（已处理）。
4. 同章不同 id → **依次** merge；不得因同章号跳过。
5. `needs-attention` / 失败：保留原 pending；记入 `skippedPendingIds`；诊断 id 稳定，二次加载不叠加重复诊断。
6. `legacyAppliedChapters` 仅作审计线索，不删未知同章 delta。

## 3. P1-2：原子提交

### 3.1 问题

`run-core-action` 写章路径先 `upsertStoredNovelChapter`，稍后才 `updateStoredNovelBook(assets)`。中断会产生「正文已存、资产未同步」。

### 3.2 唯一提交入口

新增例如：

- `apps/web/features/studio/actions/writing/commit-write-chapter-result.ts`（编排）
- 底层 `commitWriteChapterResult` 持久化放在 `novel-store`（与现有 `transactionDone` / 多 store put 一致）

```ts
commitWriteChapterResult({
  bookId: string;
  book: StoredNovelBook; // title/genre/premise/project/assets 最终态
  finalChapter: StoredNovelChapter;
  finalChapterVersion: StoredNovelChapterVersion;
  task?: StoredNovelTask; // 可选终态
}): Promise<void>
```

同一 `readwrite` transaction 写入 stores：`chapters`、`chapterVersions`、`books`、可选 `tasks`。失败 → reject，IndexedDB 回滚；成功才返回。

### 3.3 写章主路径（内存 → 一次提交）

1. Writer 返回 → 构造 `generatedChapter`，**预分配** `chapterId` 与 `chapterVersionId`。
2. `buildNovelChapterAssetDelta`。
3. `syncId = chapterId:versionId:hash(canonicalDelta)`。
4. `mergeNovelChapterAssetDeltaSafely` **只更新内存** `nextAssets`。
5. `commitWriteChapterResult(...)` — **唯一**持久化点。
6. 成功后再：`setActiveChapter`、更新内存 chapters、进度「第 N 章已保存」、最终 assistant 消息 / toast。

事务开始后至结束：忽略取消造成的半提交（完成当前事务或失败回滚，不留半截）。

### 3.4 下一章选择

提交成功前不得把该章当作已完成计划写入并驱动「下一章」。事务失败回滚后库中无半成品章；若未来存在其它半状态入口，选择逻辑须忽略不完整章（本轮以事务回滚为主保障）。

## 4. 改动面

| 区域 | 文件 |
|------|------|
| syncId / merge / migrate | `apps/web/lib/novel-asset-auto-sync.ts` + tests |
| pendingMigration 类型与 normalize | `apps/web/lib/novel-store.ts` |
| 原子 commit API | `novel-store.ts` + `actions/writing/commit-write-chapter-result.ts` |
| 写章接线 | `apps/web/features/studio/actions/run-core-action.ts` |

## 5. 测试与验收

### P1-1

- [ ] 同章两条不同 pending id，迁移后两条角色/世界观/伏笔都存在
- [ ] 同一 syncId 重复 merge/migrate，不重复写入知识资产与变更事件
- [ ] 空内容 pending 不静默删除
- [ ] 仅有旧 `appliedChapters` 的书不丢失未知同章 pending
- [ ] 失败后刷新：pending + 稳定诊断仍在，诊断数量不增长

### P1-2

- [ ] 模拟 transaction 失败：chapter / version / book.assets / task 均保持写入前
- [ ] 成功路径只产生一次 chapter、一次 version、一次按 syncId 的资产 apply
- [ ] commit 成功前不 `setActiveChapter`、不报「已保存」
- [ ] （可选）提交中 abort 不留下半截库状态

### 命令

```bash
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
```

## 6. 后续

- P1-3 / P1-4 依赖本轮 `syncId` 与原子 commit；不得再引入提前 upsert chapter 的写路径。

# InkOS P1 Remediation：同步、原子提交、角色档案与写作质量流水线设计规格

**日期：** 2026-07-14  
**状态：** 已确认  
**参考：** [INKOS_STUDIO_P1_REMEDIATION.md](../../INKOS_STUDIO_P1_REMEDIATION.md) P1-1 / P1-2 / P1-3 / P1-4
**前置：** [2026-07-14-inkos-auto-asset-sync-design.md](./2026-07-14-inkos-auto-asset-sync-design.md)

## 1. 范围与决策

### 本轮范围

一次串行落地 remediation **P1-1 到 P1-4**：

1. **P1-1**：资产同步幂等键从 `chapterNumber` 改为稳定 `syncId`；同章多条 pending 不得静默丢失。
2. **P1-2**：写下一章结果经唯一 `commitWriteChapterResult`，IndexedDB 单事务写入 chapter + version + book(assets) + task + final message；失败整笔回滚。
3. **P1-3**：建立权威 `characterProfiles`，右栏展示全部角色的定位、当前状态、关系和状态历史。
4. **P1-4**：将“写下一章”改为 Writer → Auditor →（必要时 Reviser）→ Re-auditor → 事实同步 → 校验 → 原子提交的内置流水线。

### 明确不做

- commit-pending 检查点方案（已否决，采用单事务）
- 用 `Date.now()` 或仅章节号作为同步幂等键

### 已确认决策

| 决策点 | 选择 |
|--------|------|
| 本轮子系统 | P1-1 + P1-2 + P1-3 + P1-4（严格串行） |
| 原子提交 | IndexedDB 跨 store 单事务（方案 A） |
| 新路径 `syncId` | `chapterId:chapterVersionId:stableHash(canonicalDelta)` |
| 实现路径 | 分层：`novel-asset-auto-sync.ts` + `commit-write-chapter-result` + 改写 `run-core-action` 写章接线 |
| 角色权威来源 | `assets.characterProfiles`；Markdown / knowledge assets / protagonist 只作迁移兼容输入 |
| 写作质量闭环 | 明确任务状态机 + 结构化审核报告 + 最多配置次数自动修订/复审 |

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

### 2.5 v1 → v2 规范化与重试语义

`normalizeNovelProjectAssets`（或唯一的 stored-book normalizer）必须在任何迁移逻辑前完成 schema 归一化：

```ts
function normalizePendingMigration(input?: PendingMigrationV1 | PendingMigrationV2) {
  if (!input || input.schemaVersion !== 2) {
    return {
      schemaVersion: 2,
      appliedSyncIds: [],
      legacyAppliedChapters: input?.appliedChapters ?? [],
      skippedPendingIds: input?.skippedPendingIds ?? [],
      migratedAt: input?.migratedAt,
    };
  }
  return {
    ...input,
    appliedSyncIds: input.appliedSyncIds ?? [],
    legacyAppliedChapters: input.legacyAppliedChapters ?? [],
    skippedPendingIds: input.skippedPendingIds ?? [],
  };
}
```

约束：

- 不能直接删除旧 `appliedChapters`；它必须被完整保留为 `legacyAppliedChapters`，用于审计和排障。
- 升级本身不得删除任何 pending delta；即使其 `chapterNumber` 出现在旧 `appliedChapters` 中，也必须按 `legacy:${pending.id}` 独立判断。
- `skippedPendingIds` 只用于避免**同一加载周期**对同一失败项重复合并和重复报错，不能让失败项永久失去重试机会。
- 后续加载应在下列条件之一满足时重新尝试失败项：同步实现/schema 版本变化、原始 pending 内容 hash 变化、用户在“同步诊断”中显式点击重试。重试成功后移除该 id 与对应诊断。
- 正常写作链路不应产生 `skippedPendingIds`；它仅是历史迁移或异常恢复机制。

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
  completedTask: StoredNovelTask; // 写章任务必须有终态，不可选
  finalAssistantMessage: StoredNovelMessage; // 替换已有 streaming assistant message
}): Promise<void>
```

同一 `readwrite` transaction 写入 stores：`chapters`、`chapterVersions`、`books`、`tasks`、`messages`。失败 → reject，IndexedDB 回滚；成功才返回。

`completedTask` 与 `finalAssistantMessage` 必须是必填项，原因是：若 chapter/book 已提交但 task 仍为 running、assistant message 仍为 streaming，用户刷新后会看到一个“卡住的任务”，并可能再次启动同一章节写作。因此它们属于同一个完成语义，不能作为提交成功后的 best-effort 写入。

### 3.3 事务实现约束

底层持久化 API 必须在 `novel-store` 中集中实现，禁止调用方分别调用 `upsertStoredNovelChapter`、`updateStoredNovelBook`、`finishStoredNovelTask` 和 `persistMessage` 拼接成伪事务。

```ts
async function commitWriteChapterResult(input: CommitWriteChapterResultInput) {
  const tx = db.transaction(
    [CHAPTERS_STORE, CHAPTER_VERSIONS_STORE, BOOKS_STORE, TASKS_STORE, MESSAGES_STORE],
    "readwrite",
  );

  // 只在 tx 内 put；任何 request error 或 tx abort 都 reject。
  // await transactionDone(tx) 成功后才向调用方返回。
}
```

必须满足：

1. 事务打开前验证 `finalChapter.bookId === bookId`、最终 version 指向该 chapter、task 属于本书、message 属于请求 session，防止跨书误写。
2. `finalChapterVersion` 必须在事务前预分配稳定 id，且引用 `finalChapter.id`、最终正文 hash、`syncId` 和最终审核/生成来源；同一恢复任务重复调用时应 upsert 相同 id，而不是新增版本。
3. `completedTask.status` 必须是 `success` 或 `completed_with_attention`，并带上最终 chapter id、syncId、流水线阶段摘要；不允许在 transaction 后再单独 `finishStoredNovelTask`。
4. `finalAssistantMessage.streaming` 必须为 `false`，内容必须引用该最终 chapter/version；不允许在 transaction 后再单独 `persistMessage` 写成功结果。
5. 任一 store request 失败、transaction `abort` 或 `error` 时，调用方不得更新内存 store、当前章节、成功 toast 或“已保存”进度；应将现有任务/消息以**失败状态**更新（该失败更新允许 best-effort，但不得伪造成功）。
6. 事务提交完成后，调用方仅刷新 workspace 或以事务 payload 更新内存；不要再调用会产生重复版本/变更事件的旧写入 API。

### 3.4 写章主路径（内存 → 一次提交）

1. Writer 返回 → 构造 `generatedChapter`，**预分配** `chapterId` 与 `chapterVersionId`。
2. `buildNovelChapterAssetDelta`。
3. `syncId = chapterId:versionId:hash(canonicalDelta)`。
4. `mergeNovelChapterAssetDeltaSafely` **只更新内存** `nextAssets`。
5. 构造 `completedTask` 与 `finalAssistantMessage`（二者均关联 `chapterId`、`chapterVersionId`、`syncId`）。
6. `commitWriteChapterResult(...)` — **唯一的成功持久化点**。
7. 成功后再：`setActiveChapter`、更新内存 chapters、进度「第 N 章已保存」、toast；此时不得再次持久化 task/message。

事务开始后至结束：忽略取消造成的半提交（完成当前事务或失败回滚，不留半截）。

### 3.5 取消、异常与下一章选择

1. `AbortSignal` 在 `validating_state` 之前可停止流水线；进入 `committing` 后禁止中断 transaction。UI 可显示“正在保存，请勿关闭”。
2. transaction 失败回滚后库中无半成品 chapter/version/book 变更；任务标为失败、assistant message 标为非流式错误结果（best-effort），并保留可诊断错误原因。
3. 提交成功但 UI 刷新失败时，重新加载 workspace 必须能从 task/message 的成功终态恢复，不得重复写章节。
4. 提交成功前不得把该章当作已完成计划写入并驱动「下一章」。若未来存在其它入口写出的不完整状态，目标选择逻辑必须忽略它们或先进入恢复流程。

## 4. P1-3：权威角色档案与完整右栏角色视图

### 4.1 问题与目标

当前 `ParsedCharacter` / `buildCharacterStateCards(..., limit = 4)` 只是一组临时预览卡：角色来源依赖 Markdown 或知识资产，默认最多四项，没有稳定角色 id、定位、关系、目标和状态时间线。

本轮后，`assets.characterProfiles` 是角色详情与右栏的唯一权威来源。右栏默认展示全部角色（可滚动、分组、折叠），当前章节登场角色置顶，但绝不隐藏未登场角色；每个角色至少展示名称、剧情定位、当前状态与最后同步章节。

### 4.2 数据模型与兼容来源

```ts
type NovelCharacterProfile = {
  id: string;
  name: string;
  aliases: string[];
  tier: "protagonist" | "major" | "minor";
  narrativeRole: string;
  coreTraits: string[];
  motivations: string[];
  goals: string[];
  relationships: Array<{
    targetCharacterId?: string;
    targetName: string;
    label: string;
    state: string;
  }>;
  currentState: {
    chapterId?: string;
    chapterNumber?: number;
    location?: string;
    physical?: string;
    emotional?: string;
    knowledge?: string;
    objective?: string;
    summary: string;
    updatedAt: string;
  };
  stateHistory: Array<{
    chapterId?: string;
    chapterNumber: number;
    summary: string;
    changes: string[];
    source: "chapter-pipeline" | "manual" | "migration";
    createdAt: string;
  }>;
  manualLocks: Array<"narrativeRole" | "coreTraits" | "relationships" | "currentState">;
  source: "foundation" | "chapter-pipeline" | "manual" | "migration";
};
```

迁移优先级固定为：已有 `characterProfiles` → `knowledgeAssets(category=character)` → `assets.characters` Markdown → `project.protagonist`。迁移只能提取已有事实；没有可靠历史状态时留空，不得用模型补造历史。

### 4.3 合并与人工锁定规则

1. 新书基础设定完成时必须创建主角 profile；可解析的配角也在同一阶段创建。
2. 每个章节资产 delta 必须带结构化 `characterStateChanges`，以 profile id 或别名解析角色；不能只写“名称：状态”的长文本。
3. 章节流水线只能更新 `currentState`、追加 `stateHistory`；基础定位、性格、关系仅能补空字段，不能静默覆盖人工锁定字段。
4. 同步 identity 使用 P1-1 的 `syncId`，同一章节重试不得重复追加状态历史。
5. 锁定字段发生自动更新冲突时，保留人工值、写稳定 `needs-attention` 诊断、继续同步其它安全字段；不得恢复“待确认”常规工作流。

### 4.4 右栏与详情交互

1. `buildCharacterProfilesView` 替代 `buildCharacterStateCards`，UI 层不再解析 Markdown。
2. `CharactersSection` 按主角/主要/次要角色分组展示全部 profiles；当前章节角色置顶；显示“已同步至第 N 章”而不是待确认 badge。
3. `CharacterDetailView` 展示定位、性格/动机/目标、关系、当前状态、状态时间线、同步来源和诊断。
4. 仅明确的“编辑角色档案”可写基础字段；保存后记录 `source: manual` 和对应 `manualLocks`。

## 5. P1-4：写下一章的审核、修订、复审与校验流水线

### 5.1 状态机

禁止通过 progress 文案判断任务阶段。写作任务必须使用结构化状态与 checkpoint：

```text
queued → preparing_context → planning → drafting → auditing
→ revising → reauditing → extracting_facts → syncing_assets
→ validating_state → committing
→ completed | completed_with_attention | failed | cancelled
```

`revising` / `reauditing` 仅在发现阻塞问题时进入；`committing` 调用第 3 节的唯一原子提交 API，进入后不再接受取消。

### 5.2 流水线职责

1. **preparing_context**：锁定同一本书的写作任务，读取章节计划、前章、角色 profiles、世界观、伏笔、规则和用户指令；关键输入缺失时失败且不写入最终数据。
2. **planning**：生成并校验章节 intent（冲突、登场角色、预期状态变化、伏笔和结尾 hook），仅用作内部上下文，不要求用户确认。
3. **drafting**：Writer 生成草稿，可流式展示，但不是最终章节。
4. **auditing**：Auditor 输出 schema 化报告：总分、连续性、角色一致性、剧情推进、文风、节奏、伏笔、字数；每个问题必须含 severity、证据和建议。解析失败重试一次；仍失败只能 `completed_with_attention`，不能假装审核通过。
5. **revising / reauditing**：存在 critical 问题或低于配置阈值时调用 Reviser；默认最多一次、配置范围 0–2；每次保留版本，修订后必须复审。
6. **extracting_facts / syncing_assets**：只从最终选定版本提取摘要、角色状态、世界观、伏笔和大纲，调用 P1-1 幂等合并。
7. **validating_state**：校验正文、标题、字数、章节顺序、角色 id、状态冲突和伏笔引用；通过后构造 P1-2 原子提交 payload。

### 5.3 审核数据与 UI

```ts
type ChapterAudit = {
  totalScore: number;
  dimensions: Array<{
    key: "continuity" | "character" | "plot" | "style" | "pacing" | "foreshadowing" | "length";
    score: number;
    issues: Array<{
      severity: "info" | "warning" | "critical";
      evidence: string;
      suggestion: string;
    }>;
  }>;
};
```

Agent 区显示可折叠时间线：上下文、草稿字数、审核评分、自动修订次数、复审结果、资产同步和保存结果。`completed_with_attention` 保存最佳版本和完整报告，并在未发生状态校验失败时允许继续写下一章；`failed` / `cancelled` 不得同步最终 assets。

### 5.4 复用与模型约束

- 新增 `runWriteChapterPipeline`；`run-core-action.ts` 的 write-chapter 分支只负责启动/恢复它，不得继续直接 Writer 后保存。
- 手动“审稿”“修订本章”复用同一 Auditor/Reviser、审核报告和版本模型，不保留平行数据结构。
- Writer、Auditor、Reviser、State Validator 使用现有模型绑定；模型失败、刷新恢复和取消均记录 checkpoint，但只有 `committing` 完成后才能显示成功。

## 6. 改动面

| 区域 | 文件 |
|------|------|
| syncId / merge / migrate | `apps/web/lib/novel-asset-auto-sync.ts` + tests |
| pendingMigration 类型与 normalize | `apps/web/lib/novel-store.ts` |
| 原子 commit API | `novel-store.ts` + `actions/writing/commit-write-chapter-result.ts` |
| 写章接线 | `apps/web/features/studio/actions/run-core-action.ts` |
| 角色档案、迁移与合并 | `novel-store.ts`、`novel-asset-auto-sync.ts` + tests |
| 角色右栏/详情 | `right-panel-summaries.ts`、`CharactersSection.tsx`、`CharacterDetailView.tsx` |
| 写作质量流水线 | 新增 `actions/writing/run-write-chapter-pipeline.ts`、`actions/types.ts`、任务/消息/章节详情组件 |

## 7. 测试与验收

### P1-1

- [ ] 同章两条不同 pending id，迁移后两条角色/世界观/伏笔都存在
- [ ] 同一 syncId 重复 merge/migrate，不重复写入知识资产与变更事件
- [ ] 空内容 pending 不静默删除
- [ ] 仅有旧 `appliedChapters` 的书不丢失未知同章 pending
- [ ] 失败后刷新：pending + 稳定诊断仍在，诊断数量不增长
- [ ] v1 `pendingMigration.appliedChapters` 升级为 v2 后保留在 `legacyAppliedChapters`，且未知同章 pending 仍逐条合并
- [ ] 失败项在同一加载周期不重复报错；升级同步 schema / 内容变化 / 显式重试后可再次尝试，成功后清理 skipped id 与稳定诊断

### P1-2

- [ ] 模拟任意一个 store request 或 transaction abort：chapter / version / book.assets / task / assistant message 均保持写入前状态
- [ ] 成功路径只产生一次 chapter、一次 version、一次按 syncId 的资产 apply，并将 task 和 assistant message 一起转为完成态
- [ ] commit 成功前不 `setActiveChapter`、不报「已保存」、不写成功 assistant message
- [ ] transaction 成功后刷新页面，任务不处于 running，assistant message 不处于 streaming，且不重复写章
- [ ] 提交中 abort 不留下半截库状态；提交开始前 abort 不写入任何最终资产

### P1-3

- [ ] 有 6 个角色的书，右栏可见全部 6 个，不再固定 4 条
- [ ] 每位角色有定位与当前状态；当前章节登场角色置顶但不隐藏其它角色
- [ ] 写新章节后角色状态自动更新并关联到状态时间线章节
- [ ] 历史书至少恢复主角，已有角色资产可恢复全部可解析角色
- [ ] 人工锁定的定位/关系不被生成流程覆盖

### P1-4

- [ ] 一次“写下一章”按 Writer → Auditor →（必要时）Reviser → Re-auditor 顺序运行
- [ ] 审核报告含总分、维度分、问题证据与建议；解析失败不假装通过
- [ ] 自动修订最多执行配置次数，且仅最终版本同步角色/世界观/伏笔
- [ ] completed / completed_with_attention / failed / cancelled 的 UI、下一章可用性与状态机一致
- [ ] 取消、模型失败、刷新恢复不产生半同步资产

### 命令

```bash
pnpm --filter web run test
pnpm --filter web run check-types
pnpm --filter web run lint
```

## 8. 依赖顺序

P1-1、P1-2 通过数据测试和原子提交测试后，才能开始 P1-3；P1-3 的 profiles 与结构化状态变更就绪后，才能开始 P1-4。P1-4 的最终版本必须只通过 P1-2 commit API 持久化，不得重新引入提前 upsert chapter 的写路径。

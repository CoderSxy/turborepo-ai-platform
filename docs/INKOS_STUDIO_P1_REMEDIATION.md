# InkOS Studio 对齐：四项 P1 修复执行清单

> 目标：修复自动资产同步的数据丢失与半同步风险；完成完整角色档案；将“写下一章”升级为内置审核、自动修订和复审的单一流水线。
>
> 执行顺序不可调换：P1-1 / P1-2 是数据一致性底座，必须先完成并通过测试，再开始角色与 Agent 流程。

---

## P1-1：历史同章多条资产增量不能丢失

### 问题

`apps/web/lib/novel-asset-auto-sync.ts` 目前使用 `chapterNumber` 作为幂等标识：

```ts
if (applied.includes(delta.chapterNumber)) return assets;
```

历史数据中同一章节可能存在多条 `pendingAssetDeltas`（重试、补提取、用户编辑后再次生成等）。迁移时第一条成功后，后续同章项被 `continue` 跳过，且不进入 `remaining`，导致角色状态、世界观或伏笔静默丢失。

### 修复要求

1. 将幂等键从 `chapterNumber` 改为**单条 delta 的稳定 identity**。
   - 优先使用已有 `pending.id`；
   - 新生成的自动同步 delta 必须创建 `syncId`，建议：`chapterId + finalChapterVersionId + normalizedDeltaHash`；
   - 不得仅使用章节号，也不得用 `Date.now()` 作为恢复幂等键。
2. 将 `pendingMigration.appliedChapters: number[]` 迁移为兼容字段，例如：

```ts
pendingMigration: {
  schemaVersion: 2;
  appliedSyncIds: string[];
  // 兼容读取旧数据：legacyAppliedChapters?: number[]
  skippedPendingIds?: string[];
  migratedAt?: string;
}
```

3. `migratePendingAssetDeltas` 必须逐条处理：
   - 已应用的同一 `syncId` 跳过；
   - 同章但不同 `syncId` 的 delta 都要依次合并；
   - 无内容 delta 留在 `remaining` 或写入明确的 `needs-attention` 诊断，不能静默删除；
   - 合并失败的原始 delta 必须保留，并添加稳定的失败标识，避免每次加载重复追加相同诊断。
4. 为旧 `appliedChapters` 制定迁移语义：
   - 仅把它当作“旧版已经处理到该章”的线索，不能据此删除同章未知 delta；
   - 对缺少可靠 identity 的旧 delta，基于其稳定 `id` 生成 `legacy:${id}`。
5. `mergeNovelChapterAssetDeltaSafely` 必须接收 `syncId`，并以它判断幂等；返回结果须明确 `applied | skipped | needs-attention`，不要通过“数组长度是否变化”推断结果。

### 涉及文件

- `apps/web/lib/novel-asset-auto-sync.ts`
- `apps/web/lib/novel-store.ts`（类型、默认值、数据规范化）
- `apps/web/lib/novel-asset-auto-sync.test.ts`

### 验收测试

- [ ] 同一章两条不同 id 的 pending delta，迁移后两条的角色/世界观/伏笔都存在。
- [ ] 同一 delta 重复运行迁移 2 次，不重复写入知识资产、角色状态和变更事件。
- [ ] 同章空 delta 不会被静默删除。
- [ ] 旧版只有 `appliedChapters` 的书籍加载后不丢失未知同章 delta。
- [ ] 迁移失败后刷新页面，失败 delta 和单条稳定诊断仍存在，但诊断数量不增长。

---

## P1-2：章节、资产与任务状态必须可原子提交或可恢复

### 问题

当前写作分两段写入：先 `upsertStoredNovelChapter`，后续才 `updateStoredNovelBook(assets)`。后半段失败、刷新或取消时，会留下“正文已保存，但角色/世界观/伏笔未同步”的半完成状态。下一次写作还可能选择错误的下一章。

### 修复要求

建立一个唯一的章节完成提交入口，例如：

```ts
commitWriteChapterResult({
  taskId,
  bookId,
  finalChapter,
  finalChapterVersion,
  nextProject,
  nextAssets,
  taskCompletion,
})
```

该入口必须满足以下一种实现（优先 A）：

#### A. IndexedDB 单事务（优先）

1. 在同一个 `readwrite` transaction 中写入：
   - chapter；
   - chapter version；
   - book（project + assets）；
   - task / checkpoint 终态。
2. transaction 失败时全部回滚，任务标为 `failed`，不得把 `success` 消息写进对话。
3. 事务成功后才更新 React store、当前章节、完成 toast 和最终 assistant message。

#### B. 检查点恢复（若现有 IndexedDB 包装层无法支持跨 store transaction）

1. 在任何持久化前写入 `commit-pending` checkpoint，包含最终章节 id、版本 id、资产 syncId 和完整 payload/hash。
2. 每一步写入后更新 checkpoint 已完成步骤。
3. `loadNovelWorkspace` / 任务恢复必须检测 checkpoint：
   - 章节已写、book 未写：完成 book/assets 写入；
   - book 已写、task 未完成：完成 task/message；
   - payload hash 不一致或数据无法恢复：回滚该章节版本并标记失败，展示诊断。
4. 只有所有步骤完成才清理 checkpoint 和标记 task 为 `success`。

### 流程调整

1. `run-core-action.ts` 不得在资产合并成功前把章节视为“已保存”。
2. `store.setActiveChapter`、`latestChapters` 更新和 `第 N 章已保存` progress 必须发生在完成提交之后。
3. `abort` 只能取消尚未提交的阶段；一旦进入提交阶段需忽略取消或完成恢复，不得留下半提交。
4. 下一章目标选择必须忽略 `commit-pending` / `failed` 的不完整章节，或先恢复它们。

### 涉及文件

- `apps/web/features/studio/actions/run-core-action.ts`
- `apps/web/lib/novel-store.ts`
- 可能新增 `apps/web/features/studio/actions/writing/commit-write-chapter-result.ts`
- 任务恢复与 checkpoint 相关测试文件

### 验收测试

- [ ] 模拟 book 写入失败：章节、版本、assets、task 全部保持写入前状态，或刷新后自动完成恢复。
- [ ] 模拟章节写入失败：book/assets 不得提前改变。
- [ ] 在提交过程刷新：恢复后章节正文、版本、assets、task 状态一致。
- [ ] 成功路径只产生一次 chapter、一次版本、一次资产变更事件。
- [ ] 不完整提交时不能开始“写下一章”。

---

## P1-3：完成 InkOS 式完整角色档案，移除“四张状态卡”模型

### 问题

当前右栏仍使用 `ParsedCharacter` 与 `buildCharacterStateCards(..., limit = 4)`：

- 默认只展示 4 个角色；
- 没有结构化的角色定位、关系、目标、当前状态与历史；
- 主要依赖 `knowledgeAssets`/Markdown 文本解析；
- 不能达到 InkOS “全部角色 + 角色定位 + 持续状态”体验。

### 数据模型

在 `NovelProjectAssets` 中新增权威字段 `characterProfiles`：

```ts
type NovelCharacterProfile = {
  id: string;
  name: string;
  aliases?: string[];
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
    changes?: string[];
    source: "chapter-pipeline" | "manual" | "migration";
    createdAt: string;
  }>;
  manualLocks?: Array<"narrativeRole" | "coreTraits" | "relationships" | "currentState">;
  source: "foundation" | "chapter-pipeline" | "manual" | "migration";
};
```

### 实施步骤

1. **初始化与迁移**
   - 新书：从主角、配角设定和角色知识资产创建 profile，至少必须有主角。
   - 历史书：按 `characterProfiles → knowledgeAssets(character) → assets.characters Markdown → project.protagonist` 优先级回填。
   - 读取可可靠识别的历史角色状态文本，按章追加 `stateHistory`；不能推断的数据留空，不能让模型编造历史。
2. **章节资产合并**
   - `buildNovelChapterAssetDelta` / 提取器输出结构化角色状态变更。
   - 用稳定角色 id/别名解析合并；章节写作只更新 `currentState`、追加 `stateHistory`，不得覆写锁定的基础字段。
   - 自动同步的角色状态必须使用 P1-1 的 `syncId` 去重。
3. **右栏**
   - 用 `buildCharacterProfilesView` 替换 `buildCharacterStateCards`。
   - `CharactersSection` 默认显示**全部**角色：分主角/主要/次要角色；当前章节角色置顶，但不能隐藏其他角色。
   - 每条展示姓名、定位、当前状态与最近同步章节；不再出现待确认 badge。
   - `CharacterDetailView` 展示定位、性格/动机/目标、关系、当前状态、状态时间线和变更来源。
4. **人工编辑**
   - 明确的“编辑角色档案”才能修改基础字段；保存后记录 `source: manual` 和 `manualLocks`。
   - 自动同步遇到锁定字段时保留人工值，写 `needs-attention` 诊断，但不阻塞其他角色或资产同步。

### 涉及文件

- `apps/web/lib/novel-store.ts`
- `apps/web/lib/novel-asset-auto-sync.ts`
- `apps/web/features/studio/components/right-panel/right-panel-summaries.ts`
- `apps/web/features/studio/components/right-panel/CharactersSection.tsx`
- `apps/web/features/studio/components/right-panel/detail/CharacterDetailView.tsx`
- 角色迁移、合并、组件测试

### 验收测试

- [ ] 有 6 个角色的书，右栏默认可见全部 6 个（允许滚动/折叠，不允许固定 4 条）。
- [ ] 每位角色有定位与当前状态；当前章节登场角色置顶。
- [ ] 新章完成后角色状态自动更新，并在状态时间线中关联对应章节。
- [ ] 历史书至少恢复主角；已有角色资产可恢复全部角色。
- [ ] 手工锁定的角色定位/关系不被生成流程覆盖。

---

## P1-4：将“写下一章”改为写作、审核、自动修订、复审的一体化流水线

### 问题

当前 `write-chapter` 是单次 Writer 请求后直接保存。审核、修订与自动复审仅作为独立手动动作存在，无法对齐 InkOS `writeNextChapter` 的内置质量闭环。

### 新任务状态机

禁止用 progress 字符串推断任务状态。新增明确枚举与 checkpoint：

```text
queued
→ preparing_context
→ planning
→ drafting
→ auditing
→ revising          // 仅有阻塞问题且未超过上限
→ reauditing
→ extracting_facts
→ syncing_assets
→ validating_state
→ completed | completed_with_attention | failed | cancelled
```

### 新编排入口

新增纯编排模块，例如：

```text
apps/web/features/studio/actions/writing/run-write-chapter-pipeline.ts
```

`run-core-action.ts` 的 `write-chapter` 分支只负责启动/恢复该 pipeline；不得继续直接在 Writer 返回后 `upsertStoredNovelChapter`。

### 阶段要求

1. **preparing_context**：锁定该书写作任务；加载章节计划、前章、角色 profile、世界观、伏笔、规则、用户指令；缺关键条件时失败且不写内容。
2. **planning**：生成/验证章节 intent（冲突、登场角色、预期状态变化、伏笔、hook），仅作为内部上下文，不要求用户确认。
3. **drafting**：Writer 生成草稿；可流式展示，但尚不是最终版本。
4. **auditing**：Auditor 输出 schema 化报告：

```ts
type ChapterAudit = {
  totalScore: number; // 0-100
  dimensions: Array<{
    key: "continuity" | "character" | "plot" | "style" | "pacing" | "foreshadowing" | "length";
    score: number;
    issues: Array<{ severity: "info" | "warning" | "critical"; evidence: string; suggestion: string }>;
  }>;
};
```

   - schema 无法解析时重试一次；仍失败进入 `completed_with_attention`，不得视为审核通过。
   - 阻塞阈值（critical 问题、最低维度分）必须配置化。
5. **revising / reauditing**：有阻塞问题时调用 Reviser，默认最多 1 次（可配置 0–2）；每次保留版本；修订后必须复审。
6. **extracting_facts / syncing_assets**：只从最终版本提取摘要、角色、世界观、伏笔和大纲；调用 P1-1 的 idempotent 自动同步。
7. **validating_state**：检查正文、标题、字数、章节序号、角色 id、状态冲突和伏笔引用；通过后调用 P1-2 唯一 commit 入口。

### UI 与失败策略

1. Agent 区用可折叠时间线显示阶段：上下文、草稿字数、评分、修订次数、复审、同步结果；不要将内部提示全部堆在正文中。
2. `completed_with_attention`：保存最佳版本与完整审核报告，可继续写下一章（除非状态校验失败）；显示“已生成，建议查看 N 项问题”。
3. `failed` / `cancelled`：不得同步 assets；可保留草稿 checkpoint 供重试，但不能被当成最终章节。
4. 手动“审稿”“修订本章”复用相同 Auditor/Reviser、报告、版本和状态模型，不能保留平行实现。

### 涉及文件

- `apps/web/features/studio/actions/run-core-action.ts`
- 新增 `apps/web/features/studio/actions/writing/*`
- `apps/web/features/studio/actions/types.ts`
- `apps/web/lib/novel-store.ts`（task/checkpoint/version）
- Agent 消息/任务时间线组件与章节详情组件
- 模型绑定配置（Writer / Reviewer / Reviser / State Validator）

### 验收测试

- [ ] 点击一次“写下一章”按 Writer → Auditor →（需要时）Reviser → Re-auditor 顺序执行。
- [ ] 审核报告含总分、维度分、问题证据和建议；解析失败不假装通过。
- [ ] 关键问题触发最多配置次数的自动修订；最终只同步通过/选定的最终版本。
- [ ] 取消、模型失败、刷新恢复不产生半同步资产。
- [ ] `completed` / `completed_with_attention` / `failed` / `cancelled` 状态与 UI、下一章可用性一致。

---

## Cursor 执行与提交拆分

1. `fix(studio): key asset sync by delta identity`：完成 P1-1 + 单测。
2. `fix(studio): atomically commit chapter and asset sync`：完成 P1-2 + 故障恢复测试。
3. `feat(studio): add structured character profiles`：完成 P1-3 数据模型、迁移、合并测试。
4. `feat(studio): render complete character profiles in right panel`：完成 P1-3 UI 与组件测试。
5. `feat(studio): run write chapter through review pipeline`：完成 P1-4 状态机、审核评分和版本测试。
6. `feat(studio): auto revise and validate generated chapters`：完成 P1-4 自动修订、复审、提交整合和端到端测试。

每一步完成后均执行：

```bash
pnpm --filter web run check-types
pnpm --filter web run lint
```

最后运行所有新增的 studio / novel-store 相关测试，并手工验证：历史书迁移、多角色书、生成中刷新、审核不通过自动修订、取消任务。


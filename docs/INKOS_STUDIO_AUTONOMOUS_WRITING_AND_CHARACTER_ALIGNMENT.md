# InkOS Studio 自动写作流程与角色面板对齐改版说明

> 范围：AI 小说创作的右侧上下文面板、章节资产写回机制，以及“写下一章”的 Agent 编排。
>
> 目标：默认全自动完成创作、审核、修订、状态同步与落库；用户只查看结果、选择继续创作或在异常时处理，而不是逐项点击“确认”。

---

## 0. 最终体验与不可违反原则

用户点击一次“写下一章”后，系统应在一个任务内完成：

```text
准备上下文 → 章节策划 → 撰写草稿 → 审核评分 → 必要时自动修订（有上限）
→ 复审 → 提取章节事实 → 自动同步角色/世界观/伏笔/大纲 → 校验 → 保存最终版本
```

最终只出现两种结果：

1. **已完成**：最终章节、角色状态、世界观、伏笔、大纲全部已自动写入；用户可以查看过程和版本，但不需要点击确认。
2. **需关注**：达到自动修订上限、无法安全合并、模型/网络失败或数据校验失败。保留已知安全状态和完整诊断，提供“重试 / 查看差异 / 手动处理”，但不能将普通资产更新伪装成待用户审批。

原则：

- 不将“待确认”作为常规工作流状态；移除右栏全部 `待确认` 标签与确认/忽略按钮。
- 自动写入不是盲覆盖：保留来源、版本、变更日志与可回滚历史；人工明确锁定的字段不能被模型静默改写。
- 角色面板展示“完整角色档案 + 当前状态”，而非仅当前章节、最多 4 张的临时状态卡。
- 审核/评分是写下一章的内置步骤，不是要求用户额外点击“审稿”的后置操作；“审稿”按钮可以保留为人工主动复查工具。
- 中断、取消或失败必须原子化：不可产生“正文已保存、状态没同步”或“状态已提前覆盖、正文没保存”的半完成状态。

---

## 1. 现状差异与 InkOS 参考链路

| 维度 | 当前项目 | InkOS Core / Studio 参考方式 | 改造目标 |
| --- | --- | --- | --- |
| 章节资产 | `run-core-action.ts` 在生成后调用 `queueNovelPendingAssetDelta` | 写作流水线生成最终章节与真相文件，再校验并一次性持久化 | 将可安全应用的增量自动合并、自动落库 |
| 右栏提示 | `pendingAssetDeltas` 产生“待确认 N 项”与“待确认”角色 | 右栏展示可读的章节、角色、核心文件、世界观；不把正常写作资产作为待审批项目 | 删除正常路径的待确认 UI，只显示同步状态/异常诊断 |
| 角色来源 | 多源兜底，`buildCharacterStateCards` 默认最多返回 4 个，待确认增量优先 | 角色档案是权威来源（`roles/major/*`、`roles/minor/*`）；状态随章节自动更新 | 建立完整角色档案集合和可追溯的当前状态投影 |
| 写下一章 | Writer 返回内容后立即保存；审核、修订由用户另行触发 | `PipelineRunner.writeNextChapter` 内置 Writer → ContinuityAuditor → Reviser 循环 → 状态校验 → 持久化 | 将审核、评分、修订、复审、事实同步收敛为一个可恢复任务 |
| 失败处理 | 用户可见生成结果但资产可能待确认 | 有审计结果、状态退化/修复路径、持久化前校验 | 严格区分“已完成”“已完成但需关注”“失败未落库” |

参考源码（仅作行为对齐，不要拷贝文件系统实现）：

- InkOS 写作总编排：`inkos/packages/core/src/pipeline/runner.ts` 的 `writeNextChapter`。
- InkOS 审核/修订循环：`inkos/packages/core/src/pipeline/chapter-review-cycle.ts`。
- InkOS 角色权威来源：`roles/major/*`、`roles/minor/*` 与 `character_matrix.md` 的兼容读取。
- 当前待确认来源：`apps/web/features/studio/actions/run-core-action.ts` 与 `apps/web/lib/novel-store.ts` 的 `pendingAssetDeltas`。

---

## 2. 改版 A：取消“待确认”，改为自动合并、可回溯的资产同步

### A1. 数据语义调整

将 `pendingAssetDeltas` 从“正常章节生成后的人工审批队列”降级为**迁移兼容与不可自动合并异常的暂存区**。新生成章节不得写入该队列。

新增或扩展资产变更记录（可复用现有 `assetChangeEvents`，避免重复 schema）：

```ts
type NovelAssetChangeEvent = {
  id: string;
  chapterId: string;
  chapterNumber: number;
  source: "chapter-pipeline" | "manual" | "migration";
  status: "applied" | "needs-attention" | "rolled-back";
  changedFields: Array<"summary" | "characters" | "world" | "foreshadowing" | "outline">;
  before?: SerializedAssetSnapshot; // 仅保存必要字段或版本引用，控制体积
  after?: SerializedAssetSnapshot;
  diagnostics?: NovelDiagnostic[];
  createdAt: string;
};
```

约束：

1. 角色、世界观、伏笔、章节摘要及大纲必须与最终审核通过的正文关联同一个 `chapterId` / 版本来源。
2. `applyNovelChapterAssetDelta` 必须保持纯函数、幂等；同一个章节重复恢复任务时不得重复追加角色状态、伏笔或变更事件。
3. 对人工编辑且标记为锁定的字段，不自动覆盖；生成 `needs-attention` 诊断并保留原值。**这不是“待确认”标签，不阻塞其它安全字段自动写入。**
4. 资产写入前建立快照或可反向计算的 diff；支持从章节版本记录恢复。

### A2. 新章节自动写回

修改 `apps/web/features/studio/actions/run-core-action.ts`：

1. Writer/审阅/修订完成并选定 `finalChapter` 后，才调用 `buildNovelChapterAssetDelta`。
2. 将 `queueNovelPendingAssetDelta(nextAssets, delta)` 改为自动合并流程：
   - `mergeNovelChapterAssetDeltaSafely(nextAssets, delta, policy)`；
   - 写入 `assetChangeEvents`，状态为 `applied`；
   - 只将不可安全合并字段写入结构化 diagnostics，绝不生成常规 `pendingAssetDeltas`。
3. 在同一持久化事务/逻辑提交中写入：最终章节版本、项目章节计划、合并后的 assets、变更事件。若 IndexedDB API 无真正事务，使用写入顺序 + 恢复检查点，确保刷新后可继续完成或回滚。
4. 任务结束文案改为：
   - `已同步：章节摘要、角色状态、世界观、伏笔与大纲`；或
   - `章节已完成；1 项角色字段已保留原值，详见同步诊断`。
5. 不再输出“等待人工确认后写入设定资产”。

### A3. 历史数据迁移

在加载/规范化书籍数据时，为历史 `pendingAssetDeltas` 增加**一次性、幂等**迁移：

1. 按 `chapterNumber` 与创建时间升序处理历史 delta。
2. 采用同一 `mergeNovelChapterAssetDeltaSafely` 自动合并，并为每项写入 `source: "migration"` 的变更事件。
3. 完全合并后从 `pendingAssetDeltas` 移除；冲突项不丢弃，转为 `needs-attention` diagnostics，保留原始 delta 的可恢复快照。
4. 加 `assets.schemaVersion` 或迁移标记，保证刷新和多标签页不会重复合并。
5. 历史小说即使从未有角色状态，也必须保留原有 `project.protagonist` 和角色知识资产作为角色面板兜底。

### A4. 右栏 UI 清理

涉及位置：

- `apps/web/features/studio/components/right-panel/*`
- `apps/web/features/studio/components/right-panel/right-panel-summaries.ts`
- `apps/web/features/studio/components/NovelBookPanel.tsx`
- `apps/web/features/studio/hooks/useNovelBookWorkspace.ts`

执行：

1. 删除/隐藏所有“待确认 N 项”“待确认”badge，以及“确认 / 忽略 / 编辑待确认增量”的日常入口。
2. `buildAssetAlertCounts`、角色/核心文件/世界观摘要不再把 `pendingAssetDeltas` 作为正常状态来源。
3. 右栏只显示：内容摘要、最后同步章节、最近同步时间、可选的“查看变更”。
4. 出现 `needs-attention` 时使用低干扰的“同步诊断”入口（例如 warning 图标 + 数量），点击查看原因、差异与重试/保留原值；不把它放在每一个面板标题旁。
5. 清理不再使用的 `confirmPendingAssetDelta`、`dismissPendingAssetDelta`、`editPendingAssetDelta` UI 调用；保留仅供历史迁移或开发修复的受限内部 API，不能留下死按钮。

验收：生成第一章和后续章节后，右栏没有“待确认”字样；刷新页面后角色、世界观、伏笔和章节摘要仍存在。

---

## 3. 改版 B：将“角色状态”重构为 InkOS 式完整角色档案

### B1. 目标界面

右栏“角色”默认展示全部已设计角色的紧凑列表；点击角色进入详情。不可只展示当前章节或限制为 4 项。

```text
角色  · 已同步至第 12 章

⌄ 顾长安                         主角 / 巡夜人
  定位：从守夜人到揭露真相的行动者
  当前：在后山禁地入口，已知陈昭身份；右臂有伤
  目标：找到失踪弟弟；阻止阵法启动
  关系：陈昭（对立）、刘小四（保护）
  最近变更：第 12 章 · 身份线索确认

› 陈昭                           对手 / 阵法师
› 刘小四                         盟友 / 线人
› 醉酒的老头                     次要角色 / 引路人
```

显示规则：

- 默认显示全部角色的“名称 + 角色定位 + 当前状态”单行/双行摘要；不裁成 4 条。
- 当前章节登场角色置顶，但不隐藏未登场角色。
- 主角、主要角色、次要角色按明确分组排序；组内按最近出现章节或手动顺序排序。
- 点击任一角色查看完整档案与状态时间线；可编辑档案，但人工锁定字段必须明确显示。
- 不显示“待确认”。状态来源显示为“同步至第 N 章”或“手动编辑”。

### B2. 统一角色领域模型

不要继续将 Markdown 字符串和 `ParsedCharacter` 当成主数据模型。新增可版本化的结构化角色档案（字段可按现有类型命名调整）：

```ts
type NovelCharacterProfile = {
  id: string;
  name: string;
  tier: "protagonist" | "major" | "minor";
  narrativeRole: string;          // 身份/剧情定位
  coreTraits: string[];
  voice?: string;
  backstory?: string;
  motivations: string[];
  goals: string[];
  relationships: Array<{ targetCharacterId?: string; targetName: string; label: string; state: string }>;
  knowledgeBoundary?: string;
  currentState: {
    chapterNumber: number;
    location?: string;
    physical?: string;
    emotional?: string;
    knowledge?: string;
    objective?: string;
    relationshipChanges?: string[];
    summary: string;
    updatedAt: string;
  };
  stateHistory: Array<NovelCharacterStateSnapshot>;
  manualLocks?: Array<"narrativeRole" | "coreTraits" | "relationships" | "currentState">;
  source: "foundation" | "chapter-pipeline" | "manual" | "migration";
};
```

实现约束：

1. `assets.characterProfiles` 成为角色详情与右栏的权威来源；现有 `assets.characters`、`knowledgeAssets(category === "character")`、`project.protagonist` 仅用作迁移/兼容输入。
2. 保持可读 Markdown 导入/导出能力，但解析失败不得清空已存在的结构化角色。
3. 章节提取器必须对每位登场角色输出结构化 `characterStateChanges`，至少包含状态摘要、位置/目标/认知/关系变化中能确定的字段；没有变化的字段不生成空覆盖。
4. 合并策略：基础档案补全可以更新空字段；章节只能更新 `currentState` 和追加 `stateHistory`，不得覆写锁定的基础设定。
5. 同名/别名合并必须有稳定 `id`，不得仅按中文名称字符串拼接，避免“顾长安/长安”生成两个人。

### B3. 数据迁移与回填

1. 新书创建时，在基础设定阶段从主角、配角设计、角色知识资产直接创建完整 `characterProfiles`，至少包含主角。
2. 历史书籍迁移优先级：结构化 profile（若存在）→ 角色知识资产 → `assets.characters` Markdown → `project.protagonist`。
3. 读取既有章节摘要、已应用资产变更、角色状态追踪文本，按章节顺序补 `stateHistory`；无法可靠推断的字段留空，不用模型虚构历史。
4. 所有历史书籍在第一章之后至少应显示主角档案；若存在角色来源，应显示全部可解析角色。

### B4. 组件重构

涉及位置：

- `apps/web/features/studio/components/right-panel/CharactersSection.tsx`
- `apps/web/features/studio/components/right-panel/detail/CharacterDetailView.tsx`
- `apps/web/features/studio/components/right-panel/right-panel-summaries.ts`
- `apps/web/lib/novel-store.ts`

执行：

1. 用 `buildCharacterProfilesView` 替代 `buildCharacterStateCards(..., limit = 4)`；不要在 UI 层解析多个 Markdown 来源。
2. 删除 `pending`、`待确认` 作为角色属性；可保留 `syncStatus: synced | needs-attention`，但只在详情或诊断入口显示。
3. `CharactersSection` 展示分组、当前章相关角色置顶、总人数和最后同步章节；不显示未完成占位文案，除非确实没有任何角色来源。
4. `CharacterDetailView` 展示完整定位、标签/性格、动机与目标、关系、当前状态、状态时间线和资产变更历史。
5. 只允许用户通过明确的“编辑角色档案”进入人工编辑；保存后写 `source: manual` 与锁定字段，不做隐式修改。

验收：有 6 个角色的书在右栏默认能看到 6 个角色；任意角色都有定位与当前状态，写新章节后状态自动更新并可追溯到对应章节。

---

## 4. 改版 C：将“写下一章”升级为内置审核、评分与自动修订流水线

### C1. 状态机与阶段

新增明确的章节流水线任务状态。禁止用聊天文本或字符串包含关系判断阶段。

```text
queued
  → preparing_context
  → planning
  → drafting
  → auditing
  → revising (仅发现阻塞问题且未超过重试上限)
  → reauditing
  → extracting_facts
  → syncing_assets
  → validating_state
  → completed | completed_with_attention | failed | cancelled
```

任务记录至少包含：`taskId`、`bookId`、`chapterId`、阶段时间线、模型调用、审核结果、修订次数、资产同步结果、错误与恢复检查点。

### C2. 编排实现

将 `run-core-action.ts` 中“单次 `write-chapter` 请求后立即保存”的逻辑拆分为可测试的 `runWriteChapterPipeline`（文件位置可在 `actions/writing/`）：

1. **准备上下文**
   - 锁定同一本书的写作任务，阻止并行写同一下一章。
   - 读取章节计划、前章摘要、角色 profiles 当前状态、世界观、伏笔、规则、当前用户补充指令。
   - 执行基础预检：无目标章节、缺少模型、关键状态未恢复时立即失败，不能写半章。
2. **章节策划（轻量）**
   - 基于章节计划生成/校验本章 intent：冲突推进、登场角色、状态变化预期、伏笔操作、结尾 hook。
   - 该结果只作为本次任务上下文与审计基线，不要求用户确认。
3. **撰写草稿**
   - Writer 返回标题、正文、摘要候选和结构化事实候选；流式内容可展示，但不标记为最终发布版本。
4. **审核与评分**
   - Auditor 对草稿做结构化输出，至少评分：连续性、角色一致性、剧情推进、文风/去 AI 腔、长度与节奏、伏笔、事实冲突。
   - 每项输出 `score (0-100)`、`severity (info/warning/critical)`、证据片段、修订建议；输出 schema 校验失败时重试一次或转换为 `completed_with_attention`，不能默默当通过。
   - 阻塞条件由 `critical`、评分阈值和事实冲突共同决定，阈值必须配置化。
5. **自动修订与复审**
   - 若存在阻塞问题，调用 Reviser，输入仅包含确定的问题、原文、章节 intent 和角色/世界观约束。
   - 最大自动修订次数默认 1（配置可设 0–2）；每次修订生成版本记录。
   - 修订后必须复审；超过上限仍有阻塞问题时保存为 `completed_with_attention`，保留最佳版本和明确诊断，不要求用户“确认资产”。
6. **事实提取与自动同步**
   - 只对最终版本提取章节摘要、角色状态变化、世界观增量、伏笔新增/回收与大纲进度。
   - 调用第 2 节的自动合并逻辑，并把变更来源标为该章节流水线。
7. **终态校验与持久化**
   - 校验正文非空、标题去重、字数、章节顺序、角色 id 完整、状态更新不矛盾、引用伏笔存在。
   - 校验通过后原子写入最终正文、审核报告、版本、角色 profile、其它 assets 与任务完成状态。
   - 校验不可自动修复：不要写入不一致状态；保留草稿和诊断，任务失败或需要关注。

### C3. 评分与状态展示

在 Agent 对话区显示紧凑可展开的任务时间线，而不是把内部警告堆成大段正文：

```text
✓ 上下文准备完成（8 项来源）
✓ 章节草稿完成（3,012 字）
✓ 审核：86 / 100 · 连续性 92 · 角色 88 · 节奏 78
✓ 自动修订第 1 次：修复 2 项阻塞问题
✓ 复审通过：89 / 100
✓ 已同步角色、世界观、伏笔与大纲
```

- 评分和问题详情默认折叠，可从章节详情打开完整审核报告和版本 diff。
- `completed_with_attention` 用明确状态（例如“已生成，建议查看 2 项问题”），不阻塞继续写下一章；但若状态校验失败，必须阻止下一章，直到自动恢复或人工修复。
- 原有“审稿”“修订本章”按钮保留为手动入口，分别走相同 Auditor/Reviser 和版本机制，不创建平行数据模型。

### C4. 模型与失败策略

1. Writer、Auditor、Reviser、State Validator 分别使用现有模型绑定配置（例如 `novel.writer` / `novel.reviewer`），并允许同模型回退。
2. 任务取消时 abort 所有后续调用；草稿可保存为 `cancelled` 恢复点，但不可同步 assets。
3. 断网/刷新恢复时，通过 checkpoint 判断最后完成阶段；已完成的阶段不得重复写入角色状态或伏笔。
4. 记录每个模型调用耗时与失败原因，但不要将 provider 原始错误暴露给最终读者视图。

---

## 5. Cursor 分批执行顺序

### P1：先建立自动资产同步底座

- 新增安全合并函数、变更事件和幂等键。
- 将新章节的 `pendingAssetDeltas` 写入改为自动合并。
- 处理历史 pending 增量迁移；保留回滚/诊断。
- 右栏去除待确认标签与确认入口。

完成标准：新旧书籍均不再因常规章节生成出现“待确认”，刷新后资产状态正确。

### P2：结构化角色档案与右栏重构

- 新增 `characterProfiles` schema、迁移和新书初始化。
- 将已有角色来源转换为 profile；补状态时间线但不虚构历史。
- 重构角色列表/详情，展示全部角色、定位、当前状态、状态历史。

完成标准：右栏角色展示不再依赖 4 条上限或 pending 卡片；历史书至少恢复主角，已有角色资产全部可见。

### P3：抽取章节流水线与审核 schema

- 新建 `runWriteChapterPipeline`、任务状态机和 checkpoint。
- 把写作、审核评分、结构化解析和章节版本写入串联起来；此阶段先不自动修订。
- Agent 区显示阶段时间线与审核评分。

完成标准：一次“写下一章”必定产生审核报告和评分，并且正文与审核报告版本关联正确。

### P4：自动修订、复审与状态校验

- 接入 Reviser、最大重试次数、复审。
- 加最终事实提取、角色/世界观/伏笔同步和 state validation。
- 实现 `completed_with_attention`、失败恢复与“阻止下一章”的严格校验条件。

完成标准：发现关键问题时自动修订并复审；无法修复时可诊断且不产生不一致资产。

### P5：回归、迁移与体验打磨

- 处理旧版本/历史书/空角色/手动锁定角色/中途取消/刷新恢复。
- 删除废弃确认流程的死代码与文案；更新 docs。
- 完成所有测试、类型检查、lint 和手工验收。

---

## 6. 必须覆盖的测试

### 自动同步与迁移

- [ ] 新章节生成后，摘要、角色、世界观、伏笔和大纲已自动写入，`pendingAssetDeltas` 为空。
- [ ] 同一章节任务恢复两次，不重复角色状态、伏笔或变更事件。
- [ ] 历史书的 pending delta 按顺序自动迁移；冲突只产生诊断，不丢数据。
- [ ] 人工锁定角色字段不会被自动覆盖，未锁定的当前状态仍正常更新。
- [ ] 章节写入失败或取消时，assets 保持上一致状态。

### 角色档案

- [ ] 新书至少生成主角 profile；多角色书显示全部角色，不限 4 条。
- [ ] 角色档案包含定位、当前状态和状态时间线；当前章节角色置顶但其它角色仍可见。
- [ ] 历史书可从 knowledge assets、Markdown 和 protagonist 回填；缺失数据不虚构。
- [ ] 同名/别名不会创建重复 profile。

### 写作流水线

- [ ] Writer → Auditor →（必要时）Reviser → Re-auditor 的顺序、最大次数、失败策略正确。
- [ ] Auditor 结构化评分解析失败可控，不能假装审核通过。
- [ ] 自动修订后仅最终版本同步角色/世界观/伏笔。
- [ ] 任务被取消、刷新恢复、模型失败时不会留下半同步状态。
- [ ] `completed`、`completed_with_attention`、`failed`、`cancelled` 的 UI 与是否允许写下一章符合状态机。

### 检查命令

- [ ] `pnpm --filter web run check-types`
- [ ] `pnpm --filter web run lint`
- [ ] 相关 `apps/web/features/studio/**/*.test.*` 测试

---

## 7. 明确不做事项

- 不为追求自动化而静默覆盖用户锁定的角色设定或手工编辑内容。
- 不将“审核未满分”一律变为阻塞；只有配置的关键问题、事实/状态冲突才进入自动修订或需关注。
- 不复刻 InkOS 的文件系统目录；当前项目继续使用 IndexedDB/现有存储层，但实现同等的权威数据、版本与校验语义。
- 不把“待确认”换成同义词继续要求用户逐项操作；异常只提供诊断与可选处理，不作为常规链路。


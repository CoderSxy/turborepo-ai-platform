# InkOS Studio 对齐 — P2 设计规格

**日期：** 2026-07-08  
**范围：** P2 拆分主入口和模型配置（完成剩余 3 项）  
**状态：** 已确认，待实施

## 背景

P0/P1 已完成：`AppShell`、首页 dashboard、模型配置 UI 组件已迁到 `features/models/components/`，`page.tsx` 从 10k+ 行降到 ~318 行。

P2 剩余工作：约 200 行模型配置编排逻辑仍留在 `page.tsx`（过滤分组、probe/save/clear、proxy 调用）。需对齐 InkOS `ServiceListPage` / `ServiceDetailPage` + `service-detail-state.ts` 的 UI/state 分离模式。

## 决策记录

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 编排层位置 | **A** | `ModelSettingsPage` + `ProviderDetailPage` 各自带 hook；`page.tsx` 只传 `settings` / `onSettingsChange` |
| `lib/model-settings.ts` 改动 | **A** | P2 不动 domain 层；新建 `model-settings-state.ts` 只放页面编排逻辑 |
| 测试策略 | **A** | 新增 `model-settings-state.test.mjs`，覆盖纯函数与流程编排 |
| 实现方案 | **1** | Page 内路由 list/detail + 两个 hook + state 模块 |
| `ProviderDetailPage` | **独立文件** | 与 InkOS 两个 Page 对称，职责清晰 |

## 目标与验收标准

### P2 完成标准（对应 INKOS_STUDIO_ALIGNMENT_TODO.md）

- [ ] provider 过滤、分组、测试连接、拉模型逻辑迁入 `features/models/state/model-settings-state.ts` + hooks
- [ ] UI 负责表单和展示；probe、save、delete、回填放到 state/helper
- [ ] 模型配置保持平台级公共模块，不塞回小说模块
- [ ] `page.tsx` 模型相关逻辑移除，`activePage === "models"` 时只渲染 `<ModelSettingsPage />`
- [ ] 行为零变更：typecheck、lint、现有测试全部通过

### 量化目标

- `page.tsx` 模型配置相关代码：~200 行 → ~0 行（只剩 `<ModelSettingsPage />` 一行挂载）
- 新增文件：6 个（2 page 组件、2 hooks、1 state 模块、1 test）
- `lib/model-settings.ts`：0 行改动

## 目录结构

```
apps/web/features/models/
  components/
    ModelSettingsHome.tsx       # 已有，纯展示
    ProviderDetail.tsx          # 已有，纯展示
    ModelSettingsPage.tsx       # 新增：list/detail 路由
    ProviderDetailPage.tsx      # 新增：详情页编排
  state/
    model-page-types.ts         # 已有
    model-settings-state.ts     # 新增
    model-settings-state.test.mjs
    use-model-settings-list.ts  # 新增
    use-provider-detail.ts      # 新增
```

## 职责边界

| 层 | 文件 | 职责 | 不做 |
|----|------|------|------|
| Domain | `lib/model-settings.ts` | 类型、localStorage CRUD、route 解析、底层 fetch API | 页面 UI 状态、过滤分组 |
| State | `model-settings-state.ts` | 过滤分组、modelOptions 合并、probe/save/clear 流程、proxy 封装 | React 状态 |
| Hooks | `use-model-settings-list.ts` / `use-provider-detail.ts` | React 状态、调用 state 模块 | 直接 DOM 操作 |
| Page | `ModelSettingsPage.tsx` / `ProviderDetailPage.tsx` | 组合 hook + 展示组件 | 业务逻辑 inline |
| 顶层 | `page.tsx` | 路由编排、共享 `settings` load/save | 模型配置细节 |

## `model-settings-state.ts` API

### 纯函数（同步，可单测）

```typescript
filterProviderGroups(
  settings: LocalModelSettings,
  filters: { category: ProviderCategory; searchQuery: string; connectedOnly: boolean },
): {
  activeGroups: Array<ProviderGroup & { providers: LocalModelProvider[] }>;
  visibleGroups: Array<ProviderGroup & { providers: LocalModelProvider[] }>;
  connectedCount: number;
}

buildModelOptions(
  provider: LocalModelProvider,
  modelsResult?: ProviderModelsResult | null,
): string[]

normalizeProviderForSave(provider: LocalModelProvider): LocalModelProvider
normalizeProviderForClear(provider: LocalModelProvider): LocalModelProvider
mergeProbeIntoProvider(
  provider: LocalModelProvider,
  testResult: ModelConnectionTestResult,
): LocalModelProvider | null
mergeModelsIntoProvider(
  provider: LocalModelProvider,
  modelsResult: ProviderModelsResult,
): LocalModelProvider | null
```

### Proxy 封装（async，可 mock）

```typescript
testProviderViaProxy(
  provider: LocalModelProvider,
  model?: string,
  prompt?: string,
): Promise<ModelConnectionTestResult>

listProviderModelsViaProxy(
  provider: LocalModelProvider,
): Promise<ProviderModelsResult>
```

走现有 API 路由：
- `POST /api/model-providers/test`
- `POST /api/model-providers/models`

### 流程编排（async）

```typescript
runProviderProbeFlow(
  provider: LocalModelProvider,
  modelOptions: string[],
  deps?: { testFn?: typeof testProviderViaProxy; listFn?: typeof listProviderModelsViaProxy },
): Promise<{
  testResult: ModelConnectionTestResult;
  updatedProvider?: LocalModelProvider;
  modelsResult?: ProviderModelsResult;
}>

runProviderModelsFlow(
  provider: LocalModelProvider,
  deps?: { listFn?: typeof listProviderModelsViaProxy },
): Promise<{
  modelsResult: ProviderModelsResult;
  updatedProvider?: LocalModelProvider;
}>
```

`runProviderProbeFlow` 行为与当前 `page.tsx` 的 `runProviderTest` 一致：
1. 调用 test proxy
2. 成功时 merge probe 结果到 provider（含 availableModels）
3. 若 probe 未返回 models，自动触发 list models

## Hooks

### `useModelSettingsList(settings)`

**状态：**
- `category: ProviderCategory`（默认 `"all"`）
- `searchQuery: string`
- `connectedOnly: boolean`
- `selectedProviderId: string | null`

**派生：**
- 调用 `filterProviderGroups(settings, { category, searchQuery, connectedOnly })`

**动作：**
- `openProvider(id)` — 设置 selectedProviderId，重置详情相关状态由 ProviderDetailPage 负责
- `backToList()` — 清空 selectedProviderId
- `restorePreset()` — 返回 `DEFAULT_LOCAL_MODEL_SETTINGS`（由 Page 传给 onSettingsChange）

### `useProviderDetail(settings, providerId, onSettingsChange)`

**状态：**
- `testResult`, `modelsResult`
- `temperature`（默认 0.7）, `streamEnabled`（默认 true）
- `showApiKey`, `advancedOpen`
- `isTesting`, `isLoadingModels`

**派生：**
- `selectedProvider` — 从 `settings.providers` 查找
- `modelOptions` — 调用 `buildModelOptions`

**动作：**
- `handleProviderChange(next)` — `upsertProvider(settings, next)` + onSettingsChange
- `runProviderTest()` — 调用 `runProviderProbeFlow`，更新 testResult/modelsResult/settings
- `save()` — `normalizeProviderForSave` + 写入 settings
- `clear()` — `normalizeProviderForClear` + 写入 settings

## Page 组件

### `ModelSettingsPage`

```tsx
interface ModelSettingsPageProps {
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
}

export function ModelSettingsPage({ settings, onSettingsChange }: ModelSettingsPageProps) {
  const list = useModelSettingsList(settings);

  if (list.selectedProviderId) {
    return (
      <ProviderDetailPage
        settings={settings}
        providerId={list.selectedProviderId}
        onSettingsChange={onSettingsChange}
        onBack={list.backToList}
      />
    );
  }

  return (
    <ModelSettingsHome
      settings={settings}
      category={list.category}
      searchQuery={list.searchQuery}
      connectedOnly={list.connectedOnly}
      connectedCount={list.connectedCount}
      visibleGroups={list.visibleGroups}
      onCategoryChange={list.setCategory}
      onSearchQueryChange={list.setSearchQuery}
      onConnectedOnlyChange={list.setConnectedOnly}
      onOpenProvider={list.openProvider}
      onRestorePreset={() => onSettingsChange(DEFAULT_LOCAL_MODEL_SETTINGS)}
      onSettingsChange={onSettingsChange}
    />
  );
}
```

### `ProviderDetailPage`

```tsx
interface ProviderDetailPageProps {
  settings: LocalModelSettings;
  providerId: string;
  onSettingsChange: (settings: LocalModelSettings) => void;
  onBack: () => void;
}

export function ProviderDetailPage({ settings, providerId, onSettingsChange, onBack }: ProviderDetailPageProps) {
  const detail = useProviderDetail(settings, providerId, onSettingsChange);

  useEffect(() => {
    if (!detail.selectedProvider) onBack();
  }, [detail.selectedProvider, onBack]);

  if (!detail.selectedProvider) return null;

  return <ProviderDetail ... />;
}
```

## `page.tsx` 改造

**移除：**
- 全部模型配置 state（category, searchQuery, testResult 等）
- `testProviderConnectionViaProxy` / `listProviderModelsViaProxy` 函数
- `visibleGroups` / `modelOptions` useMemo
- `runProviderTest` / `runListModels` / `saveCurrentProvider` / `clearProviderConfig`
- `selectedProvider` 分支渲染

**保留：**
- `settings` state + load/save localStorage（Home / Novel / Models 共享）
- `activePage` 路由

**替换为：**
```tsx
{activePage === "models" ? (
  <ModelSettingsPage settings={settings} onSettingsChange={updateSettings} />
) : null}
```

**ProviderDetail 全屏时的 AppShell 处理：**

当前 `page.tsx` 在 `selectedProvider` 存在时提前 return 一个固定 `activePage='models'` 的 AppShell。改造后有两种方式：

- **采用方式 A（推荐）：** `ModelSettingsPage` 不包裹 AppShell；`page.tsx` 始终只渲染一个 AppShell。详情页作为 models 页内子视图，导航栏保持 models 高亮。行为与现在一致（详情页仍在 models 上下文内）。

## 测试计划

### 新增 `model-settings-state.test.mjs`

| 测试用例 | 覆盖函数 |
|----------|----------|
| 按 category 过滤分组 | `filterProviderGroups` |
| searchQuery 匹配 name/baseUrl | `filterProviderGroups` |
| connectedOnly 过滤 | `filterProviderGroups` |
| 合并 fetched + suggestions 去重 | `buildModelOptions` |
| ollama 无 key 也可 save | `normalizeProviderForSave` |
| clear 清空 key 并 disabled | `normalizeProviderForClear` |
| probe 成功回填 availableModels | `mergeProbeIntoProvider` |
| models 成功回填 | `mergeModelsIntoProvider` |
| proxy 函数 mock fetch | `testProviderViaProxy`, `listProviderModelsViaProxy` |

### 验收命令

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run check-types
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter web run lint
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --test \
  apps/web/lib/model-settings.test.mjs \
  apps/web/features/models/state/model-settings-state.test.mjs \
  apps/web/lib/provider-stream-parser.test.mjs
```

## 不在范围内

- 不修改 `lib/model-settings.ts`（P7 范畴）
- 不引入全局 store（P3 范畴）
- 不改变 UI 样式或交互流程
- 不添加 URL 路由（provider 详情仍用组件内 state 切换）

## 实施顺序

1. 创建 `model-settings-state.ts` + 测试（TDD：先写测试再实现）
2. 创建 `use-model-settings-list.ts` 和 `use-provider-detail.ts`
3. 创建 `ModelSettingsPage.tsx` 和 `ProviderDetailPage.tsx`
4. 精简 `page.tsx`，删除迁移走的逻辑
5. 运行验收命令，更新 `INKOS_STUDIO_ALIGNMENT_TODO.md` P2 勾选

## 参考

- InkOS: `packages/studio/src/pages/ServiceListPage.tsx`
- InkOS: `packages/studio/src/pages/ServiceDetailPage.tsx`
- InkOS: `packages/studio/src/pages/service-detail-state.ts`
- 当前: `apps/web/app/page.tsx`（待精简部分，约 L27–286）
- 已有组件: `apps/web/features/models/components/`

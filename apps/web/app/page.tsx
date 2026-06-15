"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  DEFAULT_MODEL_ROUTE_PRESET,
  MODEL_ROUTE_PRESETS,
  MODEL_SUGGESTIONS,
  PROVIDER_TEMPLATES,
  createProviderId,
  exportLocalModelSettings,
  getRouteConfig,
  importLocalModelSettings,
  loadLocalModelSettings,
  maskSecret,
  resolveModelRoute,
  saveLocalModelSettings,
  testModelConnection,
  upsertProvider,
  upsertRouteConfig,
  type LocalModelProvider,
  type LocalModelRoute,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ModelRoutePreset,
} from "../lib/model-settings";

type ViewMode = "routes" | "providers" | "models" | "test";

export default function Home() {
  const [settings, setSettings] = useState<LocalModelSettings>(
    DEFAULT_LOCAL_MODEL_SETTINGS,
  );
  const [selectedRouteKey, setSelectedRouteKey] = useState("novel.writer");
  const [selectedProviderId, setSelectedProviderId] = useState("deepseek");
  const [viewMode, setViewMode] = useState<ViewMode>("routes");
  const [testPrompt, setTestPrompt] =
    useState("用一句中文回复：模型连接正常。");
  const [testResult, setTestResult] =
    useState<ModelConnectionTestResult | null>(null);
  const [importValue, setImportValue] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setSettings(loadLocalModelSettings());
  }, []);

  useEffect(() => {
    saveLocalModelSettings(settings);
  }, [settings]);

  const selectedPreset = useMemo(
    () =>
      MODEL_ROUTE_PRESETS.find((route) => route.routeKey === selectedRouteKey) ??
      DEFAULT_MODEL_ROUTE_PRESET,
    [selectedRouteKey],
  );

  const selectedProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === selectedProviderId) ??
      settings.providers[0] ??
      DEFAULT_LOCAL_MODEL_SETTINGS.providers[0]!,
    [selectedProviderId, settings.providers],
  );

  const resolvedSelectedRoute = useMemo(
    () => resolveModelRoute(settings, selectedRouteKey),
    [selectedRouteKey, settings],
  );

  const configuredRouteCount = MODEL_ROUTE_PRESETS.filter((route) =>
    settings.routes.some((config) => config.routeKey === route.routeKey),
  ).length;
  const readyRouteCount = MODEL_ROUTE_PRESETS.filter(
    (route) => resolveModelRoute(settings, route.routeKey).status === "ready",
  ).length;

  function updateSettings(nextSettings: LocalModelSettings) {
    setSettings(nextSettings);
    setTestResult(null);
  }

  function handleProviderChange(nextProvider: LocalModelProvider) {
    updateSettings(upsertProvider(settings, nextProvider));
    setSelectedProviderId(nextProvider.id);
  }

  function handleRouteChange(nextRoute: LocalModelRoute) {
    updateSettings(upsertRouteConfig(settings, nextRoute));
    setSelectedRouteKey(nextRoute.routeKey);
  }

  function getEditableRoute(preset: ModelRoutePreset): LocalModelRoute {
    const existingRoute = getRouteConfig(settings, preset.routeKey);
    const globalRoute = getRouteConfig(settings, "global.default");

    return {
      routeKey: preset.routeKey,
      providerId:
        existingRoute?.providerId ??
        globalRoute?.providerId ??
        settings.providers[0]?.id ??
        "",
      model: existingRoute?.model ?? globalRoute?.model ?? "deepseek-chat",
      temperature:
        existingRoute?.temperature ?? preset.defaultTemperature ?? 0.6,
      maxTokens: existingRoute?.maxTokens ?? preset.defaultMaxTokens ?? 4000,
      stream: existingRoute?.stream ?? true,
    };
  }

  function addProviderFromTemplate(templateId: string) {
    const template = PROVIDER_TEMPLATES.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    const provider = settings.providers.some((item) => item.id === template.id)
      ? {
          ...template,
          id: createProviderId(template.name),
          name: `${template.name} 副本`,
        }
      : template;

    handleProviderChange(provider);
    setViewMode("providers");
  }

  function handleImportSettings() {
    try {
      updateSettings(importLocalModelSettings(importValue));
      setImportValue("");
    } catch {
      setTestResult({
        ok: false,
        status: "error",
        message: "导入失败：JSON 格式不正确。",
      });
    }
  }

  async function runConnectionTest(routeKey = selectedRouteKey) {
    setIsTesting(true);

    try {
      const resolved = resolveModelRoute(settings, routeKey);
      const result = await testModelConnection(resolved, testPrompt);
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <div>
            <strong>SXY Platform</strong>
            <span>本地模型配置</span>
          </div>
        </div>

        <nav className={styles.nav} aria-label="模型设置导航">
          <button
            className={viewMode === "routes" ? styles.activeNavButton : ""}
            onClick={() => setViewMode("routes")}
          >
            模型路由
          </button>
          <button
            className={viewMode === "providers" ? styles.activeNavButton : ""}
            onClick={() => setViewMode("providers")}
          >
            供应商
          </button>
          <button
            className={viewMode === "models" ? styles.activeNavButton : ""}
            onClick={() => setViewMode("models")}
          >
            模型列表
          </button>
          <button
            className={viewMode === "test" ? styles.activeNavButton : ""}
            onClick={() => setViewMode("test")}
          >
            测试连接
          </button>
        </nav>

        <div className={styles.localNotice}>
          <strong>当前设备本地保存</strong>
          <span>API Key 和个人路由不上传服务器，可导出 JSON 迁移。</span>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <h1>全局模型配置</h1>
            <p>
              平台维护 routeKey，用户在本机绑定供应商、模型和参数；InkOS
              只消费路由结果。
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                updateSettings(DEFAULT_LOCAL_MODEL_SETTINGS);
                setSelectedRouteKey("novel.writer");
                setSelectedProviderId("deepseek");
              }}
            >
              恢复预设
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => setImportValue(exportLocalModelSettings(settings))}
            >
              导出配置
            </button>
          </div>
        </header>

        <section className={styles.metricsGrid}>
          <Metric label="业务路由" value={MODEL_ROUTE_PRESETS.length} />
          <Metric label="已配置路由" value={configuredRouteCount} />
          <Metric label="可用路由" value={readyRouteCount} />
          <Metric label="供应商" value={settings.providers.length} />
        </section>

        {viewMode === "routes" ? (
          <RoutePanel
            settings={settings}
            selectedRouteKey={selectedRouteKey}
            onSelectRoute={setSelectedRouteKey}
            onChangeRoute={handleRouteChange}
            getEditableRoute={getEditableRoute}
            onTest={runConnectionTest}
            isTesting={isTesting}
          />
        ) : null}

        {viewMode === "providers" ? (
          <ProviderPanel
            providers={settings.providers}
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProviderId}
            onChangeProvider={handleProviderChange}
            onAddProvider={addProviderFromTemplate}
          />
        ) : null}

        {viewMode === "models" ? (
          <ModelListPanel settings={settings} onSelectProvider={setSelectedProviderId} />
        ) : null}

        {viewMode === "test" ? (
          <TestPanel
            settings={settings}
            selectedPreset={selectedPreset}
            selectedRouteKey={selectedRouteKey}
            resolvedStatus={resolvedSelectedRoute.status}
            testPrompt={testPrompt}
            testResult={testResult}
            isTesting={isTesting}
            onSelectRoute={setSelectedRouteKey}
            onChangePrompt={setTestPrompt}
            onRunTest={runConnectionTest}
            importValue={importValue}
            onImportValueChange={setImportValue}
            onImport={handleImportSettings}
          />
        ) : null}

        {testResult ? (
          <div
            className={
              testResult.ok ? styles.testResultSuccess : styles.testResultError
            }
          >
            <strong>{testResult.ok ? "测试成功" : "测试未通过"}</strong>
            <span>{testResult.message}</span>
            {testResult.latencyMs ? <em>{testResult.latencyMs} ms</em> : null}
            {testResult.sample ? <code>{testResult.sample}</code> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoutePanel({
  settings,
  selectedRouteKey,
  onSelectRoute,
  onChangeRoute,
  getEditableRoute,
  onTest,
  isTesting,
}: {
  settings: LocalModelSettings;
  selectedRouteKey: string;
  onSelectRoute: (routeKey: string) => void;
  onChangeRoute: (route: LocalModelRoute) => void;
  getEditableRoute: (preset: ModelRoutePreset) => LocalModelRoute;
  onTest: (routeKey?: string) => void;
  isTesting: boolean;
}) {
  const selectedPreset =
    MODEL_ROUTE_PRESETS.find((route) => route.routeKey === selectedRouteKey) ??
    DEFAULT_MODEL_ROUTE_PRESET;
  const route = getEditableRoute(selectedPreset);
  const providerSuggestions = MODEL_SUGGESTIONS[route.providerId] ?? [];

  return (
    <section className={styles.twoColumn}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>业务路由</h2>
            <p>平台固定业务场景，用户只覆盖实际模型。</p>
          </div>
        </div>
        <div className={styles.routeList}>
          {MODEL_ROUTE_PRESETS.map((preset) => {
            const resolved = resolveModelRoute(settings, preset.routeKey);
            const active = preset.routeKey === selectedRouteKey;

            return (
              <button
                key={preset.routeKey}
                className={active ? styles.activeRouteRow : styles.routeRow}
                onClick={() => onSelectRoute(preset.routeKey)}
              >
                <span>
                  <strong>{preset.label}</strong>
                  <em>{preset.routeKey}</em>
                </span>
                <StatusPill status={resolved.status} />
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{selectedPreset.label}</h2>
            <p>{selectedPreset.description}</p>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={isTesting}
            onClick={() => onTest(selectedPreset.routeKey)}
          >
            {isTesting ? "测试中" : "测试连接"}
          </button>
        </div>

        <div className={styles.formGrid}>
          <label>
            供应商
            <select
              value={route.providerId}
              onChange={(event) =>
                onChangeRoute({
                  ...route,
                  providerId: event.target.value,
                  model:
                    MODEL_SUGGESTIONS[event.target.value]?.[0] ?? route.model,
                })
              }
            >
              {settings.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            模型
            <input
              value={route.model}
              list="model-suggestions"
              onChange={(event) =>
                onChangeRoute({ ...route, model: event.target.value })
              }
            />
            <datalist id="model-suggestions">
              {providerSuggestions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>

          <label>
            温度 {route.temperature.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.01"
              value={route.temperature}
              onChange={(event) =>
                onChangeRoute({
                  ...route,
                  temperature: Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            Max Tokens
            <input
              type="number"
              min="256"
              max="128000"
              step="256"
              value={route.maxTokens}
              onChange={(event) =>
                onChangeRoute({
                  ...route,
                  maxTokens: Number(event.target.value),
                })
              }
            />
          </label>

          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={route.stream}
              onChange={(event) =>
                onChangeRoute({ ...route, stream: event.target.checked })
              }
            />
            启用流式输出
          </label>
        </div>

        <div className={styles.usedBy}>
          <span>使用方</span>
          {selectedPreset.usedBy.map((item) => (
            <strong key={item}>{item}</strong>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProviderPanel({
  providers,
  selectedProvider,
  onSelectProvider,
  onChangeProvider,
  onAddProvider,
}: {
  providers: LocalModelProvider[];
  selectedProvider: LocalModelProvider;
  onSelectProvider: (providerId: string) => void;
  onChangeProvider: (provider: LocalModelProvider) => void;
  onAddProvider: (templateId: string) => void;
}) {
  return (
    <section className={styles.twoColumn}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>供应商</h2>
            <p>API Key 仅存在当前浏览器本地。</p>
          </div>
        </div>
        <div className={styles.routeList}>
          {providers.map((provider) => (
            <button
              key={provider.id}
              className={
                provider.id === selectedProvider.id
                  ? styles.activeRouteRow
                  : styles.routeRow
              }
              onClick={() => onSelectProvider(provider.id)}
            >
              <span>
                <strong>{provider.name}</strong>
                <em>{provider.baseUrl}</em>
              </span>
              <StatusPill status={provider.enabled ? "ready" : "provider-disabled"} />
            </button>
          ))}
        </div>
        <div className={styles.templateButtons}>
          {PROVIDER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              className={styles.secondaryButton}
              onClick={() => onAddProvider(template.id)}
            >
              添加 {template.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{selectedProvider.name}</h2>
            <p>{selectedProvider.type} / {selectedProvider.apiFormat}</p>
          </div>
        </div>

        <div className={styles.formGrid}>
          <label>
            名称
            <input
              value={selectedProvider.name}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  name: event.target.value,
                })
              }
            />
          </label>
          <label>
            类型
            <select
              value={selectedProvider.type}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  type: event.target.value as LocalModelProvider["type"],
                })
              }
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            Base URL
            <input
              value={selectedProvider.baseUrl}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  baseUrl: event.target.value,
                })
              }
            />
          </label>
          <label>
            API Format
            <select
              value={selectedProvider.apiFormat}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  apiFormat: event.target
                    .value as LocalModelProvider["apiFormat"],
                })
              }
            >
              <option value="openai">OpenAI Compatible</option>
              <option value="ollama">Ollama</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>
          <label>
            API Key
            <input
              type="password"
              value={selectedProvider.apiKey}
              placeholder={maskSecret(selectedProvider.apiKey)}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  apiKey: event.target.value,
                })
              }
            />
          </label>
          <label>
            API Key Env
            <input
              value={selectedProvider.apiKeyEnv ?? ""}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  apiKeyEnv: event.target.value,
                })
              }
            />
          </label>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={selectedProvider.enabled}
              onChange={(event) =>
                onChangeProvider({
                  ...selectedProvider,
                  enabled: event.target.checked,
                })
              }
            />
            启用供应商
          </label>
        </div>
      </div>
    </section>
  );
}

function ModelListPanel({
  settings,
  onSelectProvider,
}: {
  settings: LocalModelSettings;
  onSelectProvider: (providerId: string) => void;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>模型列表</h2>
          <p>根据已启用供应商展示推荐模型；也可以在路由里手动输入任意模型名。</p>
        </div>
      </div>

      <div className={styles.modelGrid}>
        {settings.providers.map((provider) => {
          const models = MODEL_SUGGESTIONS[provider.id] ?? ["手动输入模型名"];

          return (
            <article key={provider.id} className={styles.modelGroup}>
              <div>
                <h3>{provider.name}</h3>
                <p>{provider.baseUrl}</p>
              </div>
              <div className={styles.modelTags}>
                {models.map((model) => (
                  <button
                    key={model}
                    onClick={() => onSelectProvider(provider.id)}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TestPanel({
  selectedPreset,
  selectedRouteKey,
  resolvedStatus,
  testPrompt,
  testResult,
  isTesting,
  importValue,
  settings,
  onSelectRoute,
  onChangePrompt,
  onRunTest,
  onImportValueChange,
  onImport,
}: {
  settings: LocalModelSettings;
  selectedPreset: ModelRoutePreset;
  selectedRouteKey: string;
  resolvedStatus: string;
  testPrompt: string;
  testResult: ModelConnectionTestResult | null;
  isTesting: boolean;
  importValue: string;
  onSelectRoute: (routeKey: string) => void;
  onChangePrompt: (prompt: string) => void;
  onRunTest: (routeKey?: string) => void;
  onImportValueChange: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <section className={styles.twoColumn}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>模型测试</h2>
            <p>测试会从当前浏览器直接请求模型供应商。</p>
          </div>
          <StatusPill status={resolvedStatus} />
        </div>
        <div className={styles.formGrid}>
          <label>
            业务场景
            <select
              value={selectedRouteKey}
              onChange={(event) => onSelectRoute(event.target.value)}
            >
              {MODEL_ROUTE_PRESETS.map((preset) => (
                <option key={preset.routeKey} value={preset.routeKey}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            测试 Prompt
            <textarea
              rows={5}
              value={testPrompt}
              onChange={(event) => onChangePrompt(event.target.value)}
            />
          </label>
        </div>
        <button
          className={styles.primaryButton}
          disabled={isTesting}
          onClick={() => onRunTest(selectedPreset.routeKey)}
        >
          {isTesting ? "测试中" : "测试连接"}
        </button>
        {testResult ? (
          <p className={styles.inlineHint}>
            最近一次测试：{testResult.message}
          </p>
        ) : null}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>导入 / 导出</h2>
            <p>配置包含本地 API Key，分享前请先清理敏感字段。</p>
          </div>
        </div>
        <textarea
          className={styles.importBox}
          value={importValue}
          placeholder={exportLocalModelSettings(settings)}
          onChange={(event) => onImportValueChange(event.target.value)}
        />
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={onImport}>
            导入 JSON
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    ready: "可用",
    "missing-api-key": "缺 Key",
    "missing-provider": "缺供应商",
    "provider-disabled": "已停用",
    "missing-route": "未配置",
  };

  return (
    <span
      className={status === "ready" ? styles.statusReady : styles.statusWarning}
    >
      {labelMap[status] ?? status}
    </span>
  );
}

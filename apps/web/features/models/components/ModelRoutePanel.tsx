"use client";

import type { InkosCoreAction } from "@repo/inkos-adapter";
import {
  INKOS_CORE_ACTION_LABELS,
  INKOS_CORE_ACTION_ROUTE_KEYS,
  MODEL_SUGGESTIONS,
  NOVEL_MODEL_ROUTE_KEYS,
  buildModelCallStats,
  buildModelRouteSummary,
  getRouteConfig,
  getRoutePreset,
  resolveModelRoute,
  upsertRouteConfig,
  type LocalModelRoute,
  type LocalModelSettings,
} from "../../../lib/model-settings";
import { isProviderConnected } from "../state/model-page-types";
import styles from "../models.module.css";
import { StatusPill } from "./StatusPill";

export function ModelRoutePanel({
  settings,
  onSettingsChange,
}: {
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
}) {
  const connectedProviders = settings.providers.filter(isProviderConnected);
  const globalRoute = getRouteConfig(settings, "global.default");
  const callStats = buildModelCallStats(settings.callLogs);

  function getProviderModels(providerId: string) {
    const provider = settings.providers.find((item) => item.id === providerId);

    if (!provider) {
      return [];
    }

    return Array.from(
      new Set([
        ...(provider.availableModels ?? []),
        ...(MODEL_SUGGESTIONS[provider.id] ?? []),
      ]),
    );
  }

  function updateRoute(routeKey: string, patch: Partial<LocalModelRoute>) {
    const preset = getRoutePreset(routeKey);
    const current = getRouteConfig(settings, routeKey);
    const fallbackProviderId =
      current?.providerId ??
      globalRoute?.providerId ??
      connectedProviders[0]?.id ??
      settings.providers[0]?.id ??
      "deepseek";
    const fallbackModel =
      current?.model ??
      globalRoute?.model ??
      getProviderModels(fallbackProviderId)[0] ??
      "deepseek-chat";

    onSettingsChange(
      upsertRouteConfig(settings, {
        routeKey,
        providerId: patch.providerId ?? fallbackProviderId,
        model: patch.model ?? fallbackModel,
        temperature:
          patch.temperature ??
          current?.temperature ??
          preset?.defaultTemperature ??
          0.7,
        maxTokens:
          patch.maxTokens ??
          current?.maxTokens ??
          preset?.defaultMaxTokens ??
          4000,
        stream: patch.stream ?? current?.stream ?? true,
      }),
    );
  }

  return (
    <section className={styles.modelRoutePanel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>业务模型路由</h2>
          <p>
            聊天使用创作台当前选择；写章、审稿、大纲等 Agent 任务走下方路由。
          </p>
        </div>
      </div>

      <div className={styles.modelRouteGrid}>
        {NOVEL_MODEL_ROUTE_KEYS.map((routeKey) => {
          const preset = getRoutePreset(routeKey);
          const current = getRouteConfig(settings, routeKey);
          const resolved = resolveModelRoute(settings, routeKey);
          const providerId =
            current?.providerId ??
            (resolved.status === "ready"
              ? resolved.provider.id
              : (globalRoute?.providerId ?? connectedProviders[0]?.id ?? ""));
          const modelOptions = getProviderModels(providerId);

          return (
            <article key={routeKey} className={styles.modelRouteCard}>
              <header>
                <strong>{preset?.label ?? routeKey}</strong>
                <span>{preset?.description}</span>
              </header>
              <label>
                服务商
                <select
                  value={providerId}
                  onChange={(event) =>
                    updateRoute(routeKey, {
                      providerId: event.target.value,
                      model: getProviderModels(event.target.value)[0] ?? "",
                    })
                  }
                >
                  {connectedProviders.length === 0 ? (
                    <option value=''>暂无已连接服务商</option>
                  ) : (
                    connectedProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label>
                模型
                <select
                  value={
                    current?.model ??
                    (resolved.status === "ready"
                      ? resolved.model
                      : (modelOptions[0] ?? ""))
                  }
                  onChange={(event) =>
                    updateRoute(routeKey, { model: event.target.value })
                  }
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.modelRouteNumbers}>
                <label>
                  温度
                  <input
                    type='number'
                    min={0}
                    max={2}
                    step={0.01}
                    value={
                      current?.temperature ??
                      preset?.defaultTemperature ??
                      0.7
                    }
                    onChange={(event) =>
                      updateRoute(routeKey, {
                        temperature: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Max Tokens
                  <input
                    type='number'
                    min={256}
                    max={128000}
                    step={256}
                    value={
                      current?.maxTokens ?? preset?.defaultMaxTokens ?? 4000
                    }
                    onChange={(event) =>
                      updateRoute(routeKey, {
                        maxTokens: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <footer>
                <StatusPill
                  status={
                    resolved.status === "ready" ? "ready" : "missing-api-key"
                  }
                />
                <span>{buildModelRouteSummary(settings, routeKey)}</span>
              </footer>
            </article>
          );
        })}
      </div>

      <section className={styles.modelRouteActions}>
        <h3>Agent 任务映射</h3>
        <ul>
          {Object.entries(INKOS_CORE_ACTION_ROUTE_KEYS).map(
            ([action, routeKey]) => (
              <li key={action}>
                <strong>
                  {INKOS_CORE_ACTION_LABELS[action as InkosCoreAction] ??
                    action}
                </strong>
                <span>{buildModelRouteSummary(settings, routeKey)}</span>
              </li>
            ),
          )}
        </ul>
      </section>

      {settings.callLogs && settings.callLogs.length > 0 ? (
        <section className={styles.modelCallLogs}>
          <h3>最近调用</h3>
          <div className={styles.cloudSyncMeta}>
            <span>总计 {callStats.total} 次</span>
            {callStats.successRate !== null ? (
              <span>成功率 {callStats.successRate}%</span>
            ) : null}
            {callStats.avgLatencyMs !== null ? (
              <span>平均耗时 {callStats.avgLatencyMs}ms</span>
            ) : null}
            <span>
              成功 {callStats.success} · 失败 {callStats.error} · 取消{" "}
              {callStats.cancelled}
            </span>
          </div>
          <div className={styles.modelCallLogList}>
            {settings.callLogs.slice(0, 12).map((entry) => (
              <article key={entry.id} className={styles.modelCallLogItem}>
                <strong>{entry.label}</strong>
                <span>
                  {entry.providerName} · {entry.model}
                </span>
                <span>
                  {entry.status}
                  {entry.latencyMs ? ` · ${entry.latencyMs}ms` : ""}
                </span>
                <time>{new Date(entry.endedAt).toLocaleString()}</time>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

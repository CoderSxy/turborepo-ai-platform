"use client";

import type {
  LocalModelProvider,
  ModelConnectionTestResult,
  ProviderModelsResult,
} from "../../../lib/model-settings";
import { isProviderConnected } from "../state/model-page-types";
import styles from "../models.module.css";
import { EyeIcon, EyeOffIcon } from "./EyeIcons";
import { ResultBanner } from "./ResultBanner";
import { StatusPill } from "./StatusPill";

export function ProviderDetail({
  provider,
  modelOptions,
  modelsResult,
  testResult,
  temperature,
  streamEnabled,
  showApiKey,
  advancedOpen,
  isTesting,
  isLoadingModels,
  onBack,
  onProviderChange,
  onTemperatureChange,
  onStreamEnabledChange,
  onShowApiKeyToggle,
  onAdvancedToggle,
  onRunProviderTest,
  onSave,
  onClearConfig,
}: {
  provider: LocalModelProvider;
  modelOptions: string[];
  modelsResult: ProviderModelsResult | null;
  testResult: ModelConnectionTestResult | null;
  temperature: number;
  streamEnabled: boolean;
  showApiKey: boolean;
  advancedOpen: boolean;
  isTesting: boolean;
  isLoadingModels: boolean;
  onBack: () => void;
  onProviderChange: (provider: LocalModelProvider) => void;
  onTemperatureChange: (temperature: number) => void;
  onStreamEnabledChange: (enabled: boolean) => void;
  onShowApiKeyToggle: () => void;
  onAdvancedToggle: () => void;
  onRunProviderTest: () => void;
  onSave: () => void;
  onClearConfig: () => void;
}) {
  return (
    <main className={styles.detailShell}>
      <button className={styles.backButton} onClick={onBack}>
        返回服务商管理
      </button>

      <section className={styles.detailHeader}>
        <div>
          <h1>{provider.name}</h1>
          <StatusPill
            status={isProviderConnected(provider) ? "ready" : "missing-api-key"}
          />
        </div>
      </section>

      <section className={styles.detailPanel}>
        <label className={styles.fullField}>
          API Key
          <span className={styles.secretField}>
            <input
              type={showApiKey ? "text" : "password"}
              value={provider.apiKey}
              placeholder='sk-...'
              onChange={(event) =>
                onProviderChange({
                  ...provider,
                  apiKey: event.target.value,
                  enabled:
                    Boolean(event.target.value) ||
                    provider.apiFormat === "ollama",
                })
              }
            />
            <button
              type='button'
              aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              title={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              onClick={onShowApiKeyToggle}
            >
              {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>

        <div className={styles.detailActions}>
          <button
            className={styles.secondaryButton}
            disabled={isTesting}
            onClick={onRunProviderTest}
          >
            {isTesting ? "测试中" : "测试连接"}
          </button>
          <button className={styles.primaryButton} onClick={onSave}>
            保存
          </button>
          <button className={styles.dangerButton} onClick={onClearConfig}>
            删除配置
          </button>
        </div>

        <div className={styles.protocolRow}>
          <label className={styles.protocolField}>
            协议类型
            <select
              value={provider.apiFormat}
              onChange={(event) =>
                onProviderChange({
                  ...provider,
                  apiFormat: event.target.value as LocalModelProvider["apiFormat"],
                })
              }
            >
              <option value='openai'>Chat / Completions</option>
              <option value='anthropic'>Anthropic Messages</option>
              <option value='gemini'>Gemini</option>
              <option value='ollama'>Ollama</option>
            </select>
          </label>

          <label className={styles.streamToggle}>
            <input
              type='checkbox'
              checked={streamEnabled}
              onChange={(event) => onStreamEnabledChange(event.target.checked)}
            />
            <span />
            <strong>流式响应</strong>
            <em>{streamEnabled ? "开启" : "关闭"}</em>
          </label>
        </div>

        <section className={styles.availableModels}>
          <div className={styles.panelHeader}>
            <div>
              <p>可用模型（{modelOptions.length}）</p>
            </div>
            {isLoadingModels ? (
              <span className={styles.loadingText}>正在获取模型...</span>
            ) : null}
          </div>
          <div className={styles.modelTags}>
            {modelOptions.length ? (
              modelOptions.map((model) => (
                <span className={styles.modelChip} key={model}>
                  {model}
                </span>
              ))
            ) : (
              <span>暂无模型列表。可以先测试连接。</span>
            )}
          </div>
        </section>

        <section className={styles.advancedBlock}>
          <button
            className={styles.advancedToggle}
            aria-expanded={advancedOpen}
            onClick={onAdvancedToggle}
          >
            <span>高级参数</span>
            <span>{advancedOpen ? "收起" : "展开"}</span>
          </button>
          {advancedOpen ? (
            <div className={styles.advancedPanel}>
              <label>
                Base URL
                <input
                  value={provider.baseUrl}
                  onChange={(event) =>
                    onProviderChange({
                      ...provider,
                      baseUrl: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                API Key Env
                <input
                  value={provider.apiKeyEnv ?? ""}
                  onChange={(event) =>
                    onProviderChange({
                      ...provider,
                      apiKeyEnv: event.target.value,
                    })
                  }
                />
              </label>
              <label className={styles.temperatureField}>
                temperature
                <div>
                  <input
                    type='range'
                    min='0'
                    max='2'
                    step='0.05'
                    value={temperature}
                    onChange={(event) =>
                      onTemperatureChange(Number(event.target.value))
                    }
                  />
                  <input
                    type='number'
                    min='0'
                    max='2'
                    step='0.05'
                    value={temperature}
                    onChange={(event) =>
                      onTemperatureChange(Number(event.target.value))
                    }
                  />
                </div>
              </label>
            </div>
          ) : null}
        </section>

        {modelsResult ? (
          <ResultBanner
            ok={modelsResult.ok}
            title={modelsResult.ok ? "模型列表已更新" : "获取模型失败"}
            message={modelsResult.message}
            latencyMs={modelsResult.latencyMs}
          />
        ) : null}

        {testResult ? (
          <ResultBanner
            ok={testResult.ok}
            title={testResult.ok ? "测试成功" : "测试未通过"}
            message={testResult.message}
            latencyMs={testResult.latencyMs}
            sample={testResult.sample}
          />
        ) : null}
      </section>
    </main>
  );
}

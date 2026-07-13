"use client";

import type { LocalModelProvider, LocalModelSettings } from "../../../lib/model-settings";
import {
  PROVIDER_GROUPS,
  type ProviderCategory,
} from "../state/model-page-types";
import styles from "../models.module.css";
import { ModelRoutePanel } from "./ModelRoutePanel";
import { ProviderCard } from "./ProviderCard";

export function ModelSettingsHome({
  settings,
  category,
  searchQuery,
  connectedOnly,
  connectedCount,
  visibleGroups,
  onCategoryChange,
  onSearchQueryChange,
  onConnectedOnlyChange,
  onOpenProvider,
  onRestorePreset,
  onSettingsChange,
}: {
  settings: LocalModelSettings;
  category: ProviderCategory;
  searchQuery: string;
  connectedOnly: boolean;
  connectedCount: number;
  visibleGroups: Array<
    (typeof PROVIDER_GROUPS)[number] & { providers: LocalModelProvider[] }
  >;
  onCategoryChange: (category: ProviderCategory) => void;
  onSearchQueryChange: (value: string) => void;
  onConnectedOnlyChange: (value: boolean) => void;
  onOpenProvider: (providerId: string) => void;
  onRestorePreset: () => void;
  onSettingsChange: (settings: LocalModelSettings) => void;
}) {
  return (
    <div className={styles.keyShell}>
      <section className={styles.keyHeader}>
        <div>
          <span className={styles.brandLine}>SXY Platform</span>
          <h1>服务商管理</h1>
          <p>只配置模型服务商和 API Key；对话时再选择具体 Key 和模型。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={onRestorePreset}>
            恢复预设
          </button>
        </div>
      </section>

      <section className={styles.serviceFilters}>
        <input
          aria-label='搜索服务商'
          placeholder='搜索服务商'
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <div className={styles.categoryButtons}>
          <button
            className={category === "all" ? styles.activeFilterButton : ""}
            onClick={() => onCategoryChange("all")}
          >
            全部 {settings.providers.length}
          </button>
          {PROVIDER_GROUPS.map((group) => (
            <button
              key={group.category}
              className={
                category === group.category ? styles.activeFilterButton : ""
              }
              onClick={() => onCategoryChange(group.category)}
            >
              {group.label}{" "}
              {
                settings.providers.filter((provider) =>
                  group.providerIds.includes(provider.id),
                ).length
              }
            </button>
          ))}
        </div>
        <label className={styles.connectedOnly}>
          <input
            type='checkbox'
            checked={connectedOnly}
            onChange={(event) => onConnectedOnlyChange(event.target.checked)}
          />
          只看已连接 ({connectedCount})
        </label>
      </section>

      <ModelRoutePanel settings={settings} onSettingsChange={onSettingsChange} />

      <section className={styles.serviceBank}>
        {visibleGroups.map((group) => (
          <section key={group.category} className={styles.serviceGroup}>
            <div className={styles.panelHeader}>
              <div>
                <h2>{group.label}</h2>
                <p>{group.description}</p>
              </div>
            </div>
            <div className={styles.providerGrid}>
              {group.providers.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onOpen={() => onOpenProvider(provider.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}

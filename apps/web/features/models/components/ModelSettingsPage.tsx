"use client";

import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  type LocalModelSettings,
} from "../../../lib/model-settings";
import { useModelSettingsList } from "../state/use-model-settings-list";
import { ModelSettingsHome } from "./ModelSettingsHome";
import { ProviderDetailPage } from "./ProviderDetailPage";

export function ModelSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: LocalModelSettings;
  onSettingsChange: (settings: LocalModelSettings) => void;
}) {
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

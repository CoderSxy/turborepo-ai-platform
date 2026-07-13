"use client";

import { useEffect } from "react";
import type { LocalModelSettings } from "../../../lib/model-settings";
import { useProviderDetail } from "../state/use-provider-detail";
import { ProviderDetail } from "./ProviderDetail";

export function ProviderDetailPage({
  settings,
  providerId,
  onSettingsChange,
  onBack,
}: {
  settings: LocalModelSettings;
  providerId: string;
  onSettingsChange: (settings: LocalModelSettings) => void;
  onBack: () => void;
}) {
  const detail = useProviderDetail(settings, providerId, onSettingsChange);

  useEffect(() => {
    if (!detail.selectedProvider) {
      onBack();
    }
  }, [detail.selectedProvider, onBack]);

  if (!detail.selectedProvider) {
    return null;
  }

  return (
    <ProviderDetail
      provider={detail.selectedProvider}
      modelOptions={detail.modelOptions}
      modelsResult={detail.modelsResult}
      testResult={detail.testResult}
      temperature={detail.temperature}
      streamEnabled={detail.streamEnabled}
      showApiKey={detail.showApiKey}
      advancedOpen={detail.advancedOpen}
      isTesting={detail.isTesting}
      isLoadingModels={detail.isLoadingModels}
      onBack={onBack}
      onProviderChange={detail.handleProviderChange}
      onTemperatureChange={detail.setTemperature}
      onStreamEnabledChange={detail.setStreamEnabled}
      onShowApiKeyToggle={() => detail.setShowApiKey((show) => !show)}
      onAdvancedToggle={() => detail.setAdvancedOpen((open) => !open)}
      onRunProviderTest={() => void detail.runProviderTest()}
      onSave={detail.save}
      onClearConfig={detail.clear}
    />
  );
}

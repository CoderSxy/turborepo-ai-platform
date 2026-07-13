"use client";

import { useCallback, useMemo, useState } from "react";
import {
  upsertProvider,
  type LocalModelProvider,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ProviderModelsResult,
} from "../../../lib/model-settings";
import {
  buildModelOptions,
  buildSaveSuccessResult,
  mergeProbeIntoProvider,
  normalizeProviderForClear,
  normalizeProviderForSave,
  runProviderModelsFlow,
  testProviderViaProxy,
} from "./model-settings-state";

const DEFAULT_PROBE_PROMPT = "用一句中文回复：模型连接正常。";

export function useProviderDetail(
  settings: LocalModelSettings,
  providerId: string,
  onSettingsChange: (settings: LocalModelSettings) => void,
) {
  const [testResult, setTestResult] =
    useState<ModelConnectionTestResult | null>(null);
  const [modelsResult, setModelsResult] = useState<ProviderModelsResult | null>(
    null,
  );
  const [temperature, setTemperature] = useState(0.7);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const selectedProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === providerId) ??
      null,
    [settings.providers, providerId],
  );

  const modelOptions = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }
    return buildModelOptions(selectedProvider, modelsResult);
  }, [modelsResult, selectedProvider]);

  const handleProviderChange = useCallback(
    (nextProvider: LocalModelProvider) => {
      onSettingsChange(upsertProvider(settings, nextProvider));
    },
    [onSettingsChange, settings],
  );

  const runProviderTest = useCallback(async () => {
    if (!selectedProvider) {
      return;
    }

    setIsTesting(true);

    try {
      const probeResult = await testProviderViaProxy(
        selectedProvider,
        modelOptions[0],
        DEFAULT_PROBE_PROMPT,
      );
      setTestResult(probeResult);

      if (probeResult.ok) {
        const probedProvider = mergeProbeIntoProvider(
          selectedProvider,
          probeResult,
        );

        if (probedProvider) {
          handleProviderChange(probedProvider);

          if ((probeResult.models ?? []).length > 0) {
            setModelsResult(null);
          } else {
            setIsLoadingModels(true);

            try {
              const listResult = await runProviderModelsFlow(probedProvider);
              setModelsResult(listResult.modelsResult);

              if (listResult.updatedProvider) {
                handleProviderChange(listResult.updatedProvider);
              }
            } finally {
              setIsLoadingModels(false);
            }
          }
        }
      }
    } finally {
      setIsTesting(false);
    }
  }, [handleProviderChange, modelOptions, selectedProvider]);

  const save = useCallback(() => {
    if (!selectedProvider) {
      return;
    }
    handleProviderChange(normalizeProviderForSave(selectedProvider));
    setTestResult(buildSaveSuccessResult());
  }, [handleProviderChange, selectedProvider]);

  const clear = useCallback(() => {
    if (!selectedProvider) {
      return;
    }
    handleProviderChange(normalizeProviderForClear(selectedProvider));
    setTestResult(null);
    setModelsResult(null);
  }, [handleProviderChange, selectedProvider]);

  return {
    selectedProvider,
    modelOptions,
    testResult,
    modelsResult,
    temperature,
    streamEnabled,
    showApiKey,
    advancedOpen,
    isTesting,
    isLoadingModels,
    setTemperature,
    setStreamEnabled,
    setShowApiKey,
    setAdvancedOpen,
    handleProviderChange,
    runProviderTest,
    save,
    clear,
  };
}

"use client";

import { useMemo, useState } from "react";
import type { LocalModelSettings } from "../../../lib/model-settings";
import { filterProviderGroups } from "./model-settings-state";
import type { ProviderCategory } from "./model-page-types";

export function useModelSettingsList(settings: LocalModelSettings) {
  const [category, setCategory] = useState<ProviderCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );

  const { visibleGroups, connectedCount } = useMemo(
    () =>
      filterProviderGroups(settings, {
        category,
        searchQuery,
        connectedOnly,
      }),
    [settings, category, searchQuery, connectedOnly],
  );

  function openProvider(providerId: string) {
    setSelectedProviderId(providerId);
  }

  function backToList() {
    setSelectedProviderId(null);
  }

  return {
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    connectedOnly,
    setConnectedOnly,
    selectedProviderId,
    visibleGroups,
    connectedCount,
    openProvider,
    backToList,
  };
}

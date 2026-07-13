"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  loadLocalModelSettings,
  saveLocalModelSettings,
  type LocalModelSettings,
} from "../lib/model-settings";
import { AppShell } from "../components/shell/AppShell";
import { HomeDashboard } from "../components/shell/HomeDashboard";
import type { AppPage } from "../components/shell/shell-types";
import { ModelSettingsPage } from "../features/models/components/ModelSettingsPage";
import { NovelStudio } from "../features/studio/components/NovelStudio";

export default function Home() {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [settings, setSettings] = useState<LocalModelSettings>(
    DEFAULT_LOCAL_MODEL_SETTINGS,
  );

  useEffect(() => {
    setSettings(loadLocalModelSettings());
  }, []);

  useEffect(() => {
    saveLocalModelSettings(settings);
  }, [settings]);

  function updateSettings(nextSettings: LocalModelSettings) {
    setSettings(nextSettings);
  }

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "home" ? (
        <HomeDashboard settings={settings} />
      ) : null}
      {activePage === "novel" ? (
        <NovelStudio
          settings={settings}
          onManageModels={() => setActivePage("models")}
          onSettingsChange={updateSettings}
        />
      ) : null}
      {activePage === "models" ? (
        <ModelSettingsPage
          settings={settings}
          onSettingsChange={updateSettings}
        />
      ) : null}
    </AppShell>
  );
}

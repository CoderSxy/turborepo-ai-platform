"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  INKOS_STATUS_LABELS,
  buildInkosPromptPreview,
  createDemoInkosProject,
  deriveInkosProjectStats,
  getCurrentStage,
  type InkosCoreAction,
  type InkosNovelProject,
  type InkosProjectAssetsPatch,
} from "@repo/inkos-adapter";
import styles from "./page.module.css";
import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  MODEL_SUGGESTIONS,
  loadLocalModelSettings,
  saveLocalModelSettings,
  upsertProvider,
  type LocalModelProvider,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ProviderModelsResult,
} from "../lib/model-settings";
import {
  appendStoredNovelMessage,
  appendStoredNovelTaskLog,
  applyNovelPendingAssetDelta,
  applyNovelReviewIssueSuggestionToContent,
  buildNovelChapterAssetDelta,
  buildNovelBatchQueueItems,
  buildNovelBatchQueueReport,
  buildNovelBookExportMarkdown,
  buildNovelBookExportText,
  buildNovelChapterContextPreview,
  buildNovelChapterDraftMeta,
  buildNovelChapterExportBundle,
  buildNovelChapterParagraphNavigation,
  buildNovelCreationLogExportMarkdown,
  buildNovelEditorSearchState,
  buildNovelPlatformExportText,
  buildNovelRecoverableErrorNotice,
  buildNovelChapterVersionCompareView,
  buildNovelReviewExportMarkdown,
  buildNovelReviewIssueHighlights,
  buildNovelReviewIssueViews,
  buildNovelReviseChapterInstruction,
  buildNovelWriteChapterInstruction,
  buildNovelVolumeExportBundle,
  clearStoredNovelSessionMessages,
  createDefaultNovelAssets,
  createStoredNovelBook,
  createStoredNovelSession,
  createStoredNovelTask,
  deriveNovelChapterProgress,
  deriveNovelReviewStatus,
  deleteStoredNovelBook,
  deleteStoredNovelChapter,
  deleteStoredNovelSession,
  dismissNovelPendingAssetDelta,
  formatNovelRelativeAge,
  formatNovelChapterVersionSource,
  finishStoredNovelTask,
  filterNovelReviewIssueViews,
  findNovelReviewIssueParagraph,
  getNovelTaskGuard,
  loadNovelWorkspace,
  mergeNovelChapterPlan,
  moveNovelBatchQueueItem,
  parseNovelReviewNotes,
  queueNovelPendingAssetDelta,
  reconcileNovelReviewHistory,
  markNovelReviewIssuesResolved,
  pauseStoredNovelTask,
  replaceNovelEditorSearchMatches,
  restoreStoredNovelChapterVersion,
  selectNextNovelChapterTarget,
  skipNovelBatchQueueItem,
  skipStoredNovelTask,
  startStoredNovelTask,
  syncNovelProjectChapterPlan,
  syncNovelProjectFromOutlineNodes,
  updateStoredNovelBook,
  updateStoredNovelChapter,
  updateStoredNovelMessage,
  updateStoredNovelSession,
  updateNovelPendingAssetDelta,
  upsertStoredNovelChapter,
  exportNovelWorkspaceBackup,
  restoreNovelWorkspaceBackup,
  type NovelProjectAssets,
  type NovelBatchQueueAction,
  type NovelBatchQueueItem,
  type NovelContextSelection,
  type NovelKnowledgeAsset,
  type NovelKnowledgeAssetCategory,
  type NovelOutlineNode,
  type NovelPendingAssetDelta,
  type NovelRecoverableErrorNotice,
  type NovelReviewIssueFilter,
  type NovelWorkspaceSnapshot,
  type NovelChapterWriteTarget,
  type StoredNovelBook,
  type StoredNovelChapter,
  type StoredNovelChapterVersion,
  type StoredNovelMessage,
  type StoredNovelSession,
  type StoredNovelTask,
} from "../lib/novel-store";

type ProviderCategory =
  | "all"
  | "aggregator"
  | "overseas"
  | "china"
  | "local"
  | "coding"
  | "custom";

type AppPage = "home" | "novel" | "models";

const APP_NAV_ITEMS: Array<{
  page: AppPage;
  label: string;
  description: string;
}> = [
  {
    page: "home",
    label: "首页",
    description: "平台总览",
  },
  {
    page: "novel",
    label: "AI小说创作",
    description: "InkOS 工作台",
  },
  {
    page: "models",
    label: "模型配置",
    description: "服务商与 Key",
  },
];

const PROVIDER_GROUPS: Array<{
  category: Exclude<ProviderCategory, "all">;
  label: string;
  description: string;
  providerIds: string[];
}> = [
  {
    category: "aggregator",
    label: "聚合 API",
    description: "聚合国内外主流模型，适合用一个 API Key 接入多模型的场景。",
    providerIds: ["kkaiapi", "openrouter", "new-api", "siliconflow"],
  },
  {
    category: "overseas",
    label: "海外原厂",
    description: "海外模型原厂服务商。",
    providerIds: ["anthropic", "openai", "google-gemini", "mistral", "xai"],
  },
  {
    category: "china",
    label: "国产原厂",
    description: "国内模型原厂服务商。",
    providerIds: [
      "deepseek",
      "minimax",
      "moonshot",
      "zhipu",
      "bailian",
      "volcengine",
      "hunyuan",
      "baichuan",
      "stepfun",
      "qianfan",
      "spark",
      "sensechat",
      "tencent-lkeap",
      "mimo",
      "longcat",
      "internlm",
      "lingyi",
      "ai360",
    ],
  },
  {
    category: "local",
    label: "本地 / 订阅",
    description: "本地模型或本机订阅服务。",
    providerIds: ["ollama", "github-copilot"],
  },
  {
    category: "coding",
    label: "CodingPlan",
    description: "面向代码生成、计划和工程代理的模型服务。",
    providerIds: [
      "kimi-coding-plan",
      "kimi-code",
      "minimax-coding-plan",
      "bailian-coding-plan",
      "glm-coding-plan",
      "volcengine-coding-plan",
      "opencode-coding-plan",
      "iflytek-astron-coding-plan",
    ],
  },
  {
    category: "custom",
    label: "自定义服务",
    description: "OpenAI-compatible 自定义网关。",
    providerIds: ["custom-openai-compatible"],
  },
];

async function testProviderConnectionViaProxy(
  provider: LocalModelProvider,
  model?: string,
  prompt?: string,
): Promise<ModelConnectionTestResult> {
  const response = await fetch("/api/model-providers/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider, model, prompt }),
  });

  return response.json() as Promise<ModelConnectionTestResult>;
}

async function listProviderModelsViaProxy(
  provider: LocalModelProvider,
): Promise<ProviderModelsResult> {
  const response = await fetch("/api/model-providers/models", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider }),
  });

  return response.json() as Promise<ProviderModelsResult>;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
}

function downloadBytesFile(filename: string, content: Uint8Array, type: string) {
  const buffer = new ArrayBuffer(content.byteLength);
  new Uint8Array(buffer).set(content);
  downloadBlob(filename, new Blob([buffer], { type }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createSimpleDocxFile(title: string, body: string): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[
    title,
    ...body.split(/\n{2,}/),
  ]
    .map((paragraph, index) =>
      `<w:p><w:r>${index === 0 ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(paragraph.replace(/\n/g, " "))}</w:t></w:r></w:p>`,
    )
    .join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { name: "word/document.xml", content: documentXml },
  ];

  return createZipStore(
    files.map((file) => ({
      name: file.name,
      content: new TextEncoder().encode(file.content),
    })),
  );
}

function createZipStore(files: Array<{ name: string; content: Uint8Array }>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.content);
    const local = buildZipLocalHeader({
      crc,
      compressedSize: file.content.length,
      uncompressedSize: file.content.length,
      nameLength: nameBytes.length,
    });
    chunks.push(local, nameBytes, file.content);
    centralDirectory.push(
      buildZipCentralDirectoryHeader({
        crc,
        compressedSize: file.content.length,
        uncompressedSize: file.content.length,
        nameLength: nameBytes.length,
        localHeaderOffset: offset,
      }),
      nameBytes,
    );
    offset += local.length + nameBytes.length + file.content.length;
  });
  const centralStart = offset;
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = buildZipEndRecord({
    entries: files.length,
    centralSize,
    centralStart,
  });

  return concatBytes([...chunks, ...centralDirectory, end]);
}

function buildZipLocalHeader(input: {
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
}) {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, input.crc, true);
  view.setUint32(18, input.compressedSize, true);
  view.setUint32(22, input.uncompressedSize, true);
  view.setUint16(26, input.nameLength, true);
  view.setUint16(28, 0, true);

  return bytes;
}

function buildZipCentralDirectoryHeader(input: {
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
  localHeaderOffset: number;
}) {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, input.crc, true);
  view.setUint32(20, input.compressedSize, true);
  view.setUint32(24, input.uncompressedSize, true);
  view.setUint16(28, input.nameLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, input.localHeaderOffset, true);

  return bytes;
}

function buildZipEndRecord(input: {
  entries: number;
  centralSize: number;
  centralStart: number;
}) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, input.entries, true);
  view.setUint16(10, input.entries, true);
  view.setUint32(12, input.centralSize, true);
  view.setUint32(16, input.centralStart, true);
  view.setUint16(20, 0, true);

  return bytes;
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;

  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  return bytes;
}

function crc32(bytes: Uint8Array) {
  let crc = -1;

  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function Home() {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [settings, setSettings] = useState<LocalModelSettings>(
    DEFAULT_LOCAL_MODEL_SETTINGS,
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [category, setCategory] = useState<ProviderCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [testResult, setTestResult] =
    useState<ModelConnectionTestResult | null>(null);
  const [modelsResult, setModelsResult] = useState<ProviderModelsResult | null>(
    null,
  );
  const [temperature, setTemperature] = useState(0.7);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setSettings(loadLocalModelSettings());
  }, []);

  useEffect(() => {
    saveLocalModelSettings(settings);
  }, [settings]);

  const selectedProvider = useMemo(
    () =>
      selectedProviderId
        ? (settings.providers.find(
            (provider) => provider.id === selectedProviderId,
          ) ?? null)
        : null,
    [selectedProviderId, settings.providers],
  );

  const connectedCount = settings.providers.filter(isProviderConnected).length;
  const activeGroups = useMemo(
    () =>
      PROVIDER_GROUPS.map((group) => ({
        ...group,
        providers: settings.providers.filter((provider) =>
          group.providerIds.includes(provider.id),
        ),
      })).filter((group) => group.providers.length > 0),
    [settings.providers],
  );
  const visibleGroups = activeGroups
    .filter((group) => category === "all" || group.category === category)
    .map((group) => ({
      ...group,
      providers: group.providers.filter((provider) => {
        const matchesSearch =
          !searchQuery.trim() ||
          provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          provider.baseUrl.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesConnected =
          !connectedOnly || isProviderConnected(provider);

        return matchesSearch && matchesConnected;
      }),
    }))
    .filter((group) => group.providers.length > 0);
  const modelOptions = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }

    const fetchedModels = modelsResult?.ok
      ? modelsResult.models
      : (selectedProvider.availableModels ?? []);
    const suggestedModels = MODEL_SUGGESTIONS[selectedProvider.id] ?? [];

    return Array.from(new Set([...fetchedModels, ...suggestedModels]));
  }, [modelsResult, selectedProvider]);

  function updateSettings(nextSettings: LocalModelSettings) {
    setSettings(nextSettings);
  }

  function handleProviderChange(nextProvider: LocalModelProvider) {
    updateSettings(upsertProvider(settings, nextProvider));
  }

  function openProvider(providerId: string) {
    setSelectedProviderId(providerId);
    setTestResult(null);
    setModelsResult(null);
    setAdvancedOpen(false);
    setShowApiKey(false);
  }

  function backToProviderList() {
    setSelectedProviderId(null);
    setTestResult(null);
    setModelsResult(null);
  }

  function clearProviderConfig() {
    if (!selectedProvider) {
      return;
    }

    handleProviderChange({
      ...selectedProvider,
      apiKey: "",
      enabled: false,
    });
    setTestResult(null);
    setModelsResult(null);
  }

  function saveCurrentProvider() {
    if (!selectedProvider) {
      return;
    }

    handleProviderChange({
      ...selectedProvider,
      enabled:
        Boolean(selectedProvider.apiKey) ||
        selectedProvider.apiFormat === "ollama",
    });
    setTestResult({
      ok: true,
      status: "success",
      message: "配置已保存到当前浏览器本地。",
    });
  }

  async function runProviderTest() {
    if (!selectedProvider) {
      return;
    }

    setIsTesting(true);

    try {
      const result = await testProviderConnectionViaProxy(
        selectedProvider,
        modelOptions[0],
        "用一句中文回复：模型连接正常。",
      );
      setTestResult(result);

      if (result.ok) {
        const returnedModels = result.models ?? [];
        const verifiedProvider = {
          ...selectedProvider,
          enabled: true,
          ...(returnedModels.length > 0
            ? { availableModels: returnedModels }
            : {}),
        };
        handleProviderChange(verifiedProvider);
        if (returnedModels.length > 0) {
          setModelsResult(null);
        } else {
          await runListModels(verifiedProvider);
        }
      }
    } finally {
      setIsTesting(false);
    }
  }

  async function runListModels(providerOverride?: LocalModelProvider) {
    const providerForRequest = providerOverride ?? selectedProvider;

    if (!providerForRequest) {
      return;
    }

    setIsLoadingModels(true);

    try {
      const result = await listProviderModelsViaProxy(providerForRequest);
      setModelsResult(result);

      if (result.ok && result.models.length > 0) {
        handleProviderChange({
          ...providerForRequest,
          availableModels: result.models,
        });
      }
    } finally {
      setIsLoadingModels(false);
    }
  }

  if (selectedProvider) {
    return (
      <AppShell
        activePage='models'
        onNavigate={(page) => {
          setActivePage(page);
          if (page !== "models") {
            backToProviderList();
          }
        }}
      >
        <ProviderDetail
          provider={selectedProvider}
          modelOptions={modelOptions}
          modelsResult={modelsResult}
          testResult={testResult}
          temperature={temperature}
          streamEnabled={streamEnabled}
          showApiKey={showApiKey}
          advancedOpen={advancedOpen}
          isTesting={isTesting}
          isLoadingModels={isLoadingModels}
          onBack={backToProviderList}
          onProviderChange={handleProviderChange}
          onTemperatureChange={setTemperature}
          onStreamEnabledChange={setStreamEnabled}
          onShowApiKeyToggle={() => setShowApiKey((show) => !show)}
          onAdvancedToggle={() => setAdvancedOpen((open) => !open)}
          onRunProviderTest={runProviderTest}
          onSave={saveCurrentProvider}
          onClearConfig={clearProviderConfig}
        />
      </AppShell>
    );
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
        />
      ) : null}
      {activePage === "models" ? (
        <ModelSettingsHome
          settings={settings}
          category={category}
          searchQuery={searchQuery}
          connectedOnly={connectedOnly}
          connectedCount={connectedCount}
          visibleGroups={visibleGroups}
          onCategoryChange={setCategory}
          onSearchQueryChange={setSearchQuery}
          onConnectedOnlyChange={setConnectedOnly}
          onOpenProvider={openProvider}
          onRestorePreset={() => updateSettings(DEFAULT_LOCAL_MODEL_SETTINGS)}
        />
      ) : null}
    </AppShell>
  );
}

function AppShell({
  activePage,
  onNavigate,
  children,
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}) {
  return (
    <main className={styles.appFrame}>
      <aside className={styles.appSidebar}>
        <button
          className={styles.appBrand}
          onClick={() => onNavigate("home")}
        >
          <span>S</span>
          <strong>SXY Platform</strong>
          <em>Creative AI Studio</em>
        </button>

        <nav className={styles.appNav}>
          {APP_NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={activePage === item.page ? styles.appNavActive : ""}
              onClick={() => onNavigate(item.page)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className={styles.appContent}>{children}</section>
    </main>
  );
}

function HomeDashboard({ settings }: { settings: LocalModelSettings }) {
  const connectedProviders = settings.providers.filter(isProviderConnected);
  const demoProject = createDemoInkosProject();
  const stats = deriveInkosProjectStats(demoProject);

  return (
    <div className={styles.homeShell}>
      <section className={styles.homeHero}>
        <div>
          <span className={styles.brandLine}>SXY Platform</span>
          <h1>创作中台</h1>
          <p>
            统一管理模型服务商、AI 小说工作台和后续多模态创作模块。当前配置只保存在本地浏览器。
          </p>
        </div>
        <div className={styles.homeHeroBadge}>
          <strong>{connectedProviders.length}</strong>
          <span>已连接模型服务商</span>
        </div>
      </section>

      <section className={styles.homeMetrics}>
        <article>
          <span>模型服务商</span>
          <strong>{settings.providers.length}</strong>
          <p>聚合 API、海外原厂、国产原厂、本地/订阅与 CodingPlan。</p>
        </article>
        <article>
          <span>小说项目</span>
          <strong>{demoProject.title}</strong>
          <p>当前示例工作台已准备 {demoProject.chapters.length} 个章节节点。</p>
        </article>
        <article>
          <span>定稿进度</span>
          <strong>{stats.progressPercent}%</strong>
          <p>{stats.approvedChapters} 章已定稿，{stats.readyForReviewChapters} 章待审稿。</p>
        </article>
      </section>

      <section className={styles.homeBand}>
        <div>
          <h2>下一步建议</h2>
          <p>
            先完成模型配置，再进入 AI 小说创作。后续图片、视频、小红书文案等模块可以复用同一套模型 Key。
          </p>
        </div>
      </section>
    </div>
  );
}

type NovelChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "sent" | "error";
  streaming?: boolean;
};

type NovelChatResponse = {
  ok: boolean;
  status: "success" | "error" | "unsupported";
  message: string;
  content?: string;
  latencyMs?: number;
};

type InkosActionResponse = {
  ok: boolean;
  action: InkosCoreAction;
  message: string;
  content?: string;
  project?: InkosNovelProject;
  assetsPatch?: InkosProjectAssetsPatch;
};

type InkosActionStreamEvent =
  | {
      type: "progress";
      stage: string;
      message: string;
    }
  | {
      type: "result";
      result: InkosActionResponse;
    }
  | {
      type: "error";
      message: string;
    };

type ModelPickerGroup = {
  service: string;
  label: string;
  models: Array<{ id: string; name: string }>;
};

const INKOS_CORE_ACTION_LABELS: Record<InkosCoreAction, string> = {
  outline: "生成大纲",
  settings: "整理设定",
  "write-chapter": "写下一章",
  "revise-chapter": "修订本章",
  review: "审稿",
  radar: "市场雷达",
  diagnostics: "环境诊断",
};

const QUICK_CORE_ACTIONS: Partial<Record<string, InkosCoreAction>> = {
  写下一章: "write-chapter",
  审稿: "review",
  修订本章: "revise-chapter",
  生成大纲: "outline",
  整理设定: "settings",
  市场雷达: "radar",
};

type AppDialogState =
  | {
      kind: "prompt";
      title: string;
      message?: string;
      initialValue?: string;
      multiline?: boolean;
      confirmLabel?: string;
    }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
    }
  | {
      kind: "alert";
      title: string;
      message: string;
      confirmLabel?: string;
    };

type AppToastState = {
  id: number;
  message: string;
  tone: "success" | "warning" | "error";
};

type NovelTool =
  | "AI创作"
  | "题材"
  | "文风"
  | "导入"
  | "市场雷达"
  | "环境诊断";

type NovelBookEntry = {
  id: string;
  title: string;
  meta: string;
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  archived: boolean;
  sortIndex: number;
  chapters: StoredNovelChapter[];
  tasks: StoredNovelTask[];
  sessions: Array<{
    id: string;
    title: string;
    summary: string;
    age: string;
  }>;
};

const NOVEL_TOOLS: NovelTool[] = [
  "AI创作",
  "题材",
  "文风",
  "导入",
  "市场雷达",
  "环境诊断",
];

function toNovelBookEntries(
  books: StoredNovelBook[],
  sessionsByBookId: Record<string, StoredNovelSession[]>,
  chaptersByBookId: Record<string, StoredNovelChapter[]>,
  tasksByBookId: Record<string, StoredNovelTask[]>,
): NovelBookEntry[] {
  return books.map((book) => ({
    id: book.id,
    title: book.title,
    meta: book.genre,
    project: book.project,
    assets: book.assets,
    archived: book.archived,
    sortIndex: book.sortIndex,
    chapters: chaptersByBookId[book.id] ?? [],
    tasks: tasksByBookId[book.id] ?? [],
    sessions: (sessionsByBookId[book.id] ?? []).map((session) => ({
      id: session.id,
      title: session.title,
      summary: session.summary,
      age: formatNovelRelativeAge(session.updatedAt),
    })),
  }));
}

function toNovelMessagesBySession(
  messagesBySessionId: NovelWorkspaceSnapshot["messagesBySessionId"],
): Record<string, NovelChatMessage[]> {
  return Object.fromEntries(
    Object.entries(messagesBySessionId).map(([sessionId, messages]) => [
      sessionId,
      messages.map((message) => toNovelChatMessage(message)),
    ]),
  );
}

function toNovelChatMessage(message: StoredNovelMessage): NovelChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
  };
}

function createWelcomeNovelMessages(sessionId: string): NovelChatMessage[] {
  return [
    {
      id: `assistant-welcome-${sessionId}`,
      role: "assistant",
      content:
        "告诉我你想写什么：题材、世界观、主角、核心冲突，或者直接让我写下一章。我会按 InkOS 的创作流程帮你推进。",
    },
  ];
}

function createNovelProject(input: {
  title: string;
  genre: string;
  premise: string;
}): InkosNovelProject {
  const demo = createDemoInkosProject();
  const title = input.title.trim();
  const genre = input.genre.trim() || "未设定题材";
  const premise = input.premise.trim();

  return {
    ...demo,
    title,
    genre,
    premise: premise || "等待补充核心设定。",
    protagonist: "等待补充主角设定。",
    world: "等待补充世界观设定。",
    chapters: [],
    currentStage: "foundation",
  };
}

function extractGeneratedChapter(input: {
  bookId: string;
  content: string;
  project: InkosNovelProject;
  target?: NovelChapterWriteTarget;
}): {
  bookId: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  status: StoredNovelChapter["status"];
  wordCount: number;
} | null {
  const latestChapter =
    input.project.chapters.find(
      (chapter) => chapter.number === input.target?.number,
    ) ??
    [...input.project.chapters].sort(
      (left, right) => right.number - left.number,
    )[0];

  if (!latestChapter && !input.target) {
    return null;
  }

  const rawContent = input.content.trim();
  const headingMatch = rawContent.match(/^#\s+(.+)$/m);
  const title =
    headingMatch?.[1]?.trim() ||
    latestChapter?.title ||
    input.target?.title ||
    "未命名章节";
  const withoutTitle = rawContent.replace(/^#\s+.+\n*/m, "").trim();
  const [bodySection = "", summaryAndRest = ""] = withoutTitle.split(
    /\n##\s+章节摘要\s*\n/,
  );
  const summary =
    summaryAndRest.split(/\n##\s+/)[0]?.trim() ||
    latestChapter?.focus ||
    input.target?.focus ||
    "";
  const chapterContent = bodySection.trim();

  if (!chapterContent) {
    return null;
  }

  return {
    bookId: input.bookId,
    number: latestChapter?.number ?? input.target!.number,
    title,
    content: chapterContent,
    summary,
    status:
      latestChapter?.status && latestChapter.status !== "planned"
        ? latestChapter.status
        : "ready-for-review",
    wordCount: countNovelContentWords(chapterContent),
  };
}

function countNovelContentWords(content: string): number {
  const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords =
    content
      .replace(/[\u4e00-\u9fff]/g, " ")
      .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;

  return chineseChars + latinWords;
}

function extractRevisedChapterContent(content: string): string {
  const withoutHeading = content.replace(/^#\s+.+\n*/m, "").trim();
  const [body = ""] = withoutHeading.split(/\n##\s+已处理问题\s*\n/);

  return body.trim() || content.trim();
}

async function streamNovelChat(
  provider: LocalModelProvider,
  model: string,
  messages: NovelChatMessage[],
  project: InkosNovelProject,
  onDelta: (content: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/novel-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider,
      model,
      temperature: 0.8,
      maxTokens: 3200,
      stream: true,
      messages: [
        {
          role: "system",
          content: [
            "你是 InkOS 小说创作助手，负责帮助用户推进长篇小说创作。",
            `当前书名：${project.title}`,
            `题材：${project.genre}`,
            "请用中文回答，优先给出可直接用于创作的内容；如果用户要求写章节，请输出正文或清晰章节草稿。",
            "回复可以使用 Markdown，但不要输出无意义的代码围栏。",
          ].join("\n"),
        },
        ...messages.slice(-10).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const result = (await response.json().catch(() => null)) as
      | NovelChatResponse
      | null;

    throw new Error(result?.message || "模型流式请求失败。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    content += chunk;
    onDelta(content);
  }

  const tail = decoder.decode();

  if (tail) {
    content += tail;
    onDelta(content);
  }

  return content;
}

async function streamInkosCoreAction(
  action: InkosCoreAction,
  provider: LocalModelProvider,
  model: string,
  project: InkosNovelProject,
  assets: NovelProjectAssets,
  messages: NovelChatMessage[],
  onEvent: (event: InkosActionStreamEvent) => void,
  instruction?: string,
  signal?: AbortSignal,
): Promise<InkosActionResponse> {
  const response = await fetch("/api/inkos/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      provider,
      model,
      project,
      assets: {
        outline: assets.outline,
        worldNotes: assets.worldNotes,
        characters: assets.characters,
        settings: assets.settings,
        marketRadars: assets.marketRadars,
        diagnostics: assets.diagnostics,
      },
      instruction,
      stream: true,
      recentMessages: messages.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const result = (await response.json().catch(() => null)) as
      | InkosActionResponse
      | { message?: string }
      | null;

    throw new Error(result?.message || "InkOS Core 流式请求失败。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: InkosActionResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseInkosActionStreamEvent(line);

      if (!event) continue;

      onEvent(event);

      if (event.type === "result") {
        finalResult = event.result;
      }

      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }

  const tail = decoder.decode();
  const finalLine = `${buffer}${tail}`.trim();

  if (finalLine) {
    const event = parseInkosActionStreamEvent(finalLine);

    if (event) {
      onEvent(event);

      if (event.type === "result") {
        finalResult = event.result;
      }

      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }

  if (!finalResult) {
    throw new Error("InkOS Core 没有返回最终结果。");
  }

  return finalResult;
}

function parseInkosActionStreamEvent(line: string): InkosActionStreamEvent | null {
  const trimmed = line.trim();

  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed) as InkosActionStreamEvent;

    if (
      event.type === "progress" ||
      event.type === "result" ||
      event.type === "error"
    ) {
      return event;
    }
  } catch {
    return null;
  }

  return null;
}

function formatCoreProgressContent(label: string, progressMessages: string[]) {
  const progress =
    progressMessages.length > 0
      ? progressMessages.map((message) => `- ${message}`).join("\n")
      : "- 等待任务开始";

  return [`## ${label}`, progress].join("\n\n");
}

function formatCoreFinalContent(
  label: string,
  progressMessages: string[],
  result: InkosActionResponse,
) {
  const progress = [...progressMessages, "任务完成。"]
    .map((message) => `- ${message}`)
    .join("\n");

  return [
    `## ${label}`,
    `### 执行进度\n${progress}`,
    result.content || result.message,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatCoreErrorContent(
  label: string,
  notice: NovelRecoverableErrorNotice,
) {
  return [
    `## ${label}${notice.category === "cancelled" ? "已取消" : "失败"}`,
    `### 原因\n${notice.detail}`,
    `### 恢复建议\n${notice.recoveryAction}`,
  ].join("\n\n");
}

function formatCoreTaskErrorMessage(notice: NovelRecoverableErrorNotice) {
  return [
    `${notice.title}：${notice.detail}`,
    `恢复建议：${notice.recoveryAction}`,
  ].join("\n");
}

function NovelStudio({
  settings,
  onManageModels,
}: {
  settings: LocalModelSettings;
  onManageModels: () => void;
}) {
  const [books, setBooks] = useState<NovelBookEntry[]>([]);
  const [chapterVersionsById, setChapterVersionsById] = useState<
    Record<string, StoredNovelChapterVersion[]>
  >({});
  const [input, setInput] = useState("");
  const [activeTool, setActiveTool] = useState<NovelTool>("AI创作");
  const [activeBookId, setActiveBookId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeChapterId, setActiveChapterId] = useState("");
  const [creatingBook, setCreatingBook] = useState(true);
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [showArchivedBooks, setShowArchivedBooks] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [isNovelStoreLoading, setIsNovelStoreLoading] = useState(true);
  const [novelStoreError, setNovelStoreError] = useState("");
  const [dialog, setDialog] = useState<AppDialogState | null>(null);
  const [dialogInput, setDialogInput] = useState("");
  const [toast, setToast] = useState<AppToastState | null>(null);
  const bookSearchInputRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const backupImportInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTaskAbortRef = useRef<AbortController | null>(null);
  const dialogResolverRef = useRef<
    ((value: string | boolean | null) => void) | null
  >(null);
  const groupedModels = useMemo<ModelPickerGroup[]>(
    () =>
      settings.providers
        .filter(isProviderConnected)
        .map((provider) => {
          const models = Array.from(
            new Set([
              ...(provider.availableModels ?? []),
              ...(MODEL_SUGGESTIONS[provider.id] ?? []),
            ]),
          );

          return {
            service: provider.id,
            label: provider.name,
            models: models.map((model) => ({ id: model, name: model })),
          };
        })
        .filter((group) => group.models.length > 0),
    [settings.providers],
  );
  const [selectedModelValue, setSelectedModelValue] = useState("");
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, NovelChatMessage[]>
  >({});
  const [isSending, setIsSending] = useState(false);
  const [isRunningCoreAction, setIsRunningCoreAction] = useState(false);
  const [activeTaskLabel, setActiveTaskLabel] = useState("");
  const [batchQueueItems, setBatchQueueItems] = useState<NovelBatchQueueItem[]>([]);
  const [batchQueueActiveIndex, setBatchQueueActiveIndex] = useState(-1);
  const [batchQueuePaused, setBatchQueuePaused] = useState(false);
  const [batchQueueTaskIds, setBatchQueueTaskIds] = useState<string[]>([]);
  const batchQueueItemsRef = useRef<NovelBatchQueueItem[]>([]);
  const batchQueuePausedRef = useRef(false);
  const batchQueueTaskIdsByItemRef = useRef<Record<string, string>>({});
  const visibleBooks = useMemo(() => {
    const query = bookSearchQuery.trim().toLowerCase();

    return books.filter((book) => {
      const matchesArchived = showArchivedBooks ? book.archived : !book.archived;
      const matchesQuery =
        !query ||
        book.title.toLowerCase().includes(query) ||
        book.meta.toLowerCase().includes(query) ||
        book.project.premise.toLowerCase().includes(query);

      return matchesArchived && matchesQuery;
    });
  }, [bookSearchQuery, books, showArchivedBooks]);
  const activeBook =
    books.find((book) => book.id === activeBookId) ?? visibleBooks[0] ?? books[0];
  const activeChapterRows = activeBook
    ? mergeNovelChapterPlan(activeBook.project, activeBook.chapters)
    : [];
  const activeChapterRow =
    activeChapterRows.find((chapter) => chapter.key === activeChapterId) ??
    activeChapterRows.at(-1) ??
    null;
  const activeChapter = activeChapterRow?.chapter ?? null;
  const project = activeBook?.project ?? null;
  const currentStage = project ? getCurrentStage(project) : null;
  const stats =
    project && activeBook
      ? deriveNovelChapterProgress(
          activeBook.chapters,
          project.targetChapters ?? 120,
        )
      : null;
  const promptPreview =
    project && activeBook
      ? buildNovelChapterContextPreview({
          project,
          assets: activeBook.assets,
          chapters: activeBook.chapters,
          selectedChapterId: activeChapter?.id,
        })
      : project
        ? buildInkosPromptPreview(project)
        : "";
  const messages = messagesBySession[activeSessionId] ?? [];
  const selectedModelParts = selectedModelValue.split("::");
  const selectedProvider = settings.providers.find(
    (provider) => provider.id === selectedModelParts[0],
  );
  const selectedModel = selectedModelParts.slice(1).join("::");

  function applyNovelSnapshot(snapshot: NovelWorkspaceSnapshot) {
    const loadedBooks = toNovelBookEntries(
      snapshot.books,
      snapshot.sessionsByBookId,
      snapshot.chaptersByBookId,
      snapshot.tasksByBookId,
    );
    const firstBook = loadedBooks.find((book) => !book.archived) ?? loadedBooks[0];

    setBooks(loadedBooks);
    setChapterVersionsById(snapshot.chapterVersionsByChapterId);
    setMessagesBySession(toNovelMessagesBySession(snapshot.messagesBySessionId));
    setSelectedBookIds((current) =>
      current.filter((bookId) => loadedBooks.some((book) => book.id === bookId)),
    );
    setActiveBookId((current) =>
      loadedBooks.some((book) => book.id === current) ? current : firstBook?.id ?? "",
    );
    setActiveSessionId((current) =>
      loadedBooks.some((book) =>
        book.sessions.some((session) => session.id === current),
      )
        ? current
        : firstBook?.sessions[0]?.id ?? "",
    );
    setCreatingBook(loadedBooks.length === 0);
  }

  async function refreshNovelWorkspace() {
    const snapshot = await loadNovelWorkspace();
    applyNovelSnapshot(snapshot);
    setNovelStoreError("");
  }

  function showToast(
    message: string,
    tone: AppToastState["tone"] = "success",
  ) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2600);
  }

  function cancelActiveTask() {
    activeTaskAbortRef.current?.abort();
    activeTaskAbortRef.current = null;
    setActiveTaskLabel("");
    setIsSending(false);
    setIsRunningCoreAction(false);
    showToast("任务已取消。", "warning");
  }

  async function toggleBatchQueuePaused() {
    const nextPaused = !batchQueuePausedRef.current;

    batchQueuePausedRef.current = nextPaused;
    setBatchQueuePaused(nextPaused);
    if (nextPaused) {
      const pendingTaskIds = batchQueueItemsRef.current
        .slice(Math.max(0, batchQueueActiveIndex + 1))
        .map((item) => batchQueueTaskIdsByItemRef.current[item.id])
        .filter((taskId): taskId is string => Boolean(taskId));

      await Promise.all(
        pendingTaskIds.map((taskId) => pauseStoredNovelTask(taskId)),
      ).catch(() => undefined);
      await refreshNovelWorkspace().catch(() => undefined);
    }
    showToast(nextPaused ? "队列会在当前任务结束后暂停。" : "队列已继续。");
  }

  function moveBatchQueueItem(itemId: string, direction: "up" | "down") {
    const activeItem = batchQueueItemsRef.current[batchQueueActiveIndex];
    if (activeItem?.id === itemId) {
      showToast("正在执行的队列项不能重排。", "warning");
      return;
    }

    const nextItems = moveNovelBatchQueueItem(
      batchQueueItemsRef.current,
      itemId,
      direction,
    );
    batchQueueItemsRef.current = nextItems;
    setBatchQueueItems(nextItems);
  }

  async function skipBatchQueueItem(itemId: string) {
    const activeItem = batchQueueItemsRef.current[batchQueueActiveIndex];
    if (activeItem?.id === itemId) {
      showToast("正在执行的队列项请用取消任务处理。", "warning");
      return;
    }

    const taskId = batchQueueTaskIdsByItemRef.current[itemId];
    if (taskId) {
      await skipStoredNovelTask(taskId).catch(() => undefined);
    }
    const nextItems = skipNovelBatchQueueItem(batchQueueItemsRef.current, itemId);
    batchQueueItemsRef.current = nextItems;
    setBatchQueueItems(nextItems);
    await refreshNovelWorkspace().catch(() => undefined);
    showToast("队列项已跳过。");
  }

  function exportBatchQueueReport() {
    if (!activeBook || batchQueueTaskIds.length === 0) {
      showToast("暂无可导出的批量任务报告。", "warning");
      return;
    }

    const selected = activeBook.tasks.filter((task) =>
      batchQueueTaskIds.includes(task.id),
    );
    const report = buildNovelBatchQueueReport(selected);

    downloadTextFile(
      `${activeBook.title}-批量任务报告.md`,
      report.markdown,
      "text/markdown;charset=utf-8",
    );
    showToast("批量任务报告已导出。");
  }

  function closeDialog(value: string | boolean | null) {
    dialogResolverRef.current?.(value);
    dialogResolverRef.current = null;
    setDialog(null);
    setDialogInput("");
  }

  function requestPrompt(options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }): Promise<string | null> {
    setDialogInput(options.initialValue ?? "");
    setDialog({
      kind: "prompt",
      ...options,
    });

    return new Promise((resolve) => {
      dialogResolverRef.current = (value) =>
        resolve(typeof value === "string" ? value : null);
    });
  }

  function requestConfirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    setDialog({
      kind: "confirm",
      ...options,
    });

    return new Promise((resolve) => {
      dialogResolverRef.current = (value) => resolve(value === true);
    });
  }

  function requestAlert(options: {
    title: string;
    message: string;
    confirmLabel?: string;
  }): Promise<void> {
    setDialog({
      kind: "alert",
      ...options,
    });

    return new Promise((resolve) => {
      dialogResolverRef.current = () => resolve();
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const snapshot = await loadNovelWorkspace();

        if (cancelled) {
          return;
        }

        applyNovelSnapshot(snapshot);
        setNovelStoreError("");
      } catch (error) {
        if (!cancelled) {
          setNovelStoreError(
            error instanceof Error
              ? error.message
              : "本地创作库加载失败。",
          );
          setCreatingBook(true);
        }
      } finally {
        if (!cancelled) {
          setIsNovelStoreLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentStillAvailable = groupedModels.some((group) =>
      group.models.some((model) => `${group.service}::${model.id}` === selectedModelValue),
    );
    const firstGroup = groupedModels[0];
    const firstModel = firstGroup?.models[0];

    if ((!selectedModelValue || !currentStillAvailable) && firstGroup && firstModel) {
      setSelectedModelValue(`${firstGroup.service}::${firstModel.id}`);
    }
  }, [groupedModels, selectedModelValue]);

  useEffect(() => {
    if (!activeBook) {
      setActiveChapterId("");
      return;
    }

    const chapterRows = mergeNovelChapterPlan(activeBook.project, activeBook.chapters);

    if (chapterRows.some((chapter) => chapter.key === activeChapterId)) {
      return;
    }

    setActiveChapterId(chapterRows.at(-1)?.key ?? "");
  }, [activeBook, activeChapterId]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (dialog) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog(dialog.kind === "confirm" ? false : null);
        }
        return;
      }

      if (event.key === "Escape" && selectedBookIds.length > 0) {
        event.preventDefault();
        setSelectedBookIds([]);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        composerInputRef.current?.focus();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        bookSearchInputRef.current?.focus();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreatingBook(true);
        setActiveTool("AI创作");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog, selectedBookIds.length]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  async function sendNovelMessage(text: string) {
    const trimmed = text.trim();
    const guard = getNovelTaskGuard({ isSending, isRunningCoreAction });

    if (!trimmed) {
      return;
    }

    if (!guard.canStart) {
      showToast(guard.message, "warning");
      return;
    }

    const userMessage: NovelChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const assistantMessageId = `assistant-stream-${Date.now()}`;
    const pendingAssistantMessage: NovelChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "InkOS 正在组织回应...",
      streaming: true,
    };
    const nextMessages = [...messages, userMessage];
    const visibleMessages = [...nextMessages, pendingAssistantMessage];
    const requestSessionId = activeSessionId;

    if (!requestSessionId) {
      setMessagesBySession((current) => ({
        ...current,
        pending: [
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: "请先创建或选择一个会话。",
          },
        ],
      }));
      return;
    }

    setMessagesBySession((current) => ({
      ...current,
      [requestSessionId]: visibleMessages,
    }));
    setInput("");
    setIsSending(true);
    setActiveTaskLabel("聊天回复");
    const abortController = new AbortController();
    activeTaskAbortRef.current = abortController;

    try {
      await appendStoredNovelMessage(requestSessionId, userMessage);

      if (!selectedProvider || !selectedModel) {
        throw new Error("请先选择一个已连接的模型。");
      }

      if (!project) {
        throw new Error("请先创建一本书籍。");
      }

      let streamedContent = "";
      const updateStreamingMessage = (content: string) => {
        streamedContent = content;
        setMessagesBySession((current) => ({
          ...current,
          [requestSessionId]: (current[requestSessionId] ?? visibleMessages).map(
            (message) =>
              message.id === assistantMessageId
                ? { ...message, content, streaming: true }
                : message,
          ),
        }));
      };

      const content = await streamNovelChat(
        selectedProvider,
        selectedModel,
        nextMessages,
        project,
        updateStreamingMessage,
        abortController.signal,
      );

      const assistantMessage: NovelChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: content || streamedContent || "模型返回为空。",
      };

      await appendStoredNovelMessage(requestSessionId, assistantMessage);

      setMessagesBySession((current) => ({
        ...current,
        [requestSessionId]: (current[requestSessionId] ?? visibleMessages).map(
          (message) =>
            message.id === assistantMessageId ? assistantMessage : message,
        ),
      }));
    } catch (error) {
      const isAbortError =
        error instanceof DOMException && error.name === "AbortError";
      const assistantMessage: NovelChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        status: isAbortError ? "sent" : "error",
        content: isAbortError
          ? "任务已取消。"
          : error instanceof Error
            ? error.message
            : "模型请求失败，请检查模型配置。",
      };

      if (requestSessionId) {
        await appendStoredNovelMessage(requestSessionId, {
          ...assistantMessage,
        }).catch(() => undefined);
      }

      setMessagesBySession((current) => ({
        ...current,
        [requestSessionId]: (current[requestSessionId] ?? visibleMessages).map(
          (message) =>
            message.id === assistantMessageId ? assistantMessage : message,
        ),
      }));
    } finally {
      activeTaskAbortRef.current = null;
      setActiveTaskLabel("");
      setIsSending(false);
    }
  }

  async function runCoreAction(
    action: InkosCoreAction,
    options?: {
      targetChapter?: NovelChapterWriteTarget;
      targetStoredChapter?: StoredNovelChapter;
      selectedIssueIds?: string[];
      existingTaskId?: string;
      labelOverride?: string;
    },
  ): Promise<boolean> {
    const guard = getNovelTaskGuard({ isSending, isRunningCoreAction });

    if (!guard.canStart) {
      showToast(guard.message, "warning");
      return false;
    }

    if (!activeSessionId) {
      showToast("请先创建或选择一个会话。", "warning");
      return false;
    }

    if (!selectedProvider || !selectedModel) {
      showToast("请先选择一个已连接的模型。", "warning");
      return false;
    }

    if (!activeBook || !project) {
      showToast("请先创建一本书籍。", "warning");
      return false;
    }

    const label = options?.labelOverride ?? INKOS_CORE_ACTION_LABELS[action];
    const requestSessionId = activeSessionId;
    if (options?.targetStoredChapter) {
      setActiveChapterId(options.targetStoredChapter.id);
    }
    const userMessage: NovelChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: label,
    };
    const nextMessages = [...messages, userMessage];
    const assistantMessageId = `assistant-core-${Date.now()}`;
    const progressMessages: string[] = [];
    const pendingAssistantMessage: NovelChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: formatCoreProgressContent(label, progressMessages),
      streaming: true,
    };
    const visibleMessages = [...nextMessages, pendingAssistantMessage];

    setMessagesBySession((current) => ({
      ...current,
      [requestSessionId]: visibleMessages,
    }));
    setIsRunningCoreAction(true);
    setActiveTaskLabel(label);
    const abortController = new AbortController();
    activeTaskAbortRef.current = abortController;
    let taskId = "";

    try {
      const task = options?.existingTaskId
        ? await startStoredNovelTask(options.existingTaskId)
        : await createStoredNovelTask({
            bookId: activeBook.id,
            sessionId: requestSessionId,
            action,
            label,
            targetChapterId: options?.targetStoredChapter?.id,
            targetChapterNumber:
              options?.targetStoredChapter?.number ??
              options?.targetChapter?.number,
            targetChapterTitle:
              options?.targetStoredChapter?.title ?? options?.targetChapter?.title,
          });
      if (!task) {
        throw new Error("队列任务不存在，无法执行。");
      }
      taskId = task.id;
      await appendStoredNovelMessage(requestSessionId, userMessage);
      const writeTarget =
        action === "write-chapter"
          ? options?.targetChapter ??
            selectNextNovelChapterTarget(project, activeBook.chapters)
          : null;
      const reviewTarget =
        action === "review" ? options?.targetStoredChapter ?? activeChapter : null;
      const reviseTarget =
        action === "revise-chapter"
          ? options?.targetStoredChapter ?? activeChapter
          : null;

      if (action === "revise-chapter" && !reviseTarget) {
        throw new Error("请先选择一个已生成章节，再根据审稿意见修订。");
      }

      const coreInstruction =
        action === "review" && reviewTarget
          ? [
              input.trim(),
              `请审稿当前选中章节：第 ${reviewTarget.number} 章《${reviewTarget.title}》。`,
              `章节摘要：${reviewTarget.summary || "暂无摘要"}`,
              `章节正文：\n${reviewTarget.content}`,
            ]
              .filter(Boolean)
              .join("\n\n")
          : action === "write-chapter" && writeTarget
            ? buildNovelWriteChapterInstruction({
                project,
                assets: activeBook.assets,
                chapters: activeBook.chapters,
                target: writeTarget,
                userInstruction: input.trim() || undefined,
              })
          : input.trim() || undefined;
      const resolvedCoreInstruction =
        action === "revise-chapter" && reviseTarget
          ? buildNovelReviseChapterInstruction({
              project,
              assets: activeBook.assets,
              chapter: reviseTarget,
              selectedIssueIds: options?.selectedIssueIds,
              userInstruction: input.trim() || undefined,
            })
          : coreInstruction;
      const updateCoreProgress = (message: string) => {
        progressMessages.push(message);
        if (taskId) {
          void appendStoredNovelTaskLog(taskId, message);
        }
        setMessagesBySession((current) => ({
          ...current,
          [requestSessionId]: (current[requestSessionId] ?? visibleMessages).map(
            (item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    content: formatCoreProgressContent(label, progressMessages),
                    streaming: true,
                  }
                : item,
          ),
        }));
      };
      const result = await streamInkosCoreAction(
        action,
        selectedProvider,
        selectedModel,
        project,
        activeBook.assets,
        nextMessages,
        (event) => {
          if (event.type === "progress") {
            updateCoreProgress(event.message);
          }
        },
        resolvedCoreInstruction,
        abortController.signal,
      );

      if (!result.ok) {
        throw new Error(result.message || "InkOS Core 执行失败。");
      }

      updateCoreProgress("正在写回 IndexedDB。");
      let nextProject = result.project ?? project;
      let nextAssets: NovelProjectAssets = {
        ...activeBook.assets,
        ...result.assetsPatch,
      };
      const assistantMessage: NovelChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: formatCoreFinalContent(label, progressMessages, result),
      };

      if (action === "write-chapter") {
        const generatedChapter = extractGeneratedChapter({
          bookId: activeBook.id,
          content: result.content ?? result.message ?? "",
          project: nextProject,
          target: writeTarget ?? undefined,
        });

        if (generatedChapter) {
          updateCoreProgress("正在提取章节摘要、角色状态、伏笔和世界观增量。");
          const assetDelta = buildNovelChapterAssetDelta({
            chapterNumber: generatedChapter.number,
            chapterTitle: generatedChapter.title,
            content: result.content ?? result.message ?? "",
            existingSummary: generatedChapter.summary,
          });
          const storedChapter = await upsertStoredNovelChapter({
            ...generatedChapter,
            summary: assetDelta.summary || generatedChapter.summary,
            versionSource: "generation",
            versionNote: "InkOS WriterAgent 生成章节",
          });
          nextProject = syncNovelProjectChapterPlan(nextProject, storedChapter);
          const pendingAssetCount = nextAssets.pendingAssetDeltas.length;
          nextAssets = queueNovelPendingAssetDelta(nextAssets, {
            ...assetDelta,
            chapterNumber: storedChapter.number,
            chapterTitle: storedChapter.title,
            summary: storedChapter.summary,
          });
          updateCoreProgress(
            nextAssets.pendingAssetDeltas.length > pendingAssetCount
              ? "章节资产增量已提取，等待人工确认后写入设定资产。"
              : "本章未发现需要确认的资产增量。",
          );
          setActiveChapterId(storedChapter.id);
        }
      }
      if (action === "review" && reviewTarget) {
        const reviewContent = result.content ?? result.message ?? "";
        const structuredReview = parseNovelReviewNotes(reviewContent);
        const nextReviews = reconcileNovelReviewHistory(
          reviewTarget.reviews ?? [],
          structuredReview,
        );
        const nextStatus = deriveNovelReviewStatus(reviewContent);

        const reviewedChapter = await updateStoredNovelChapter(
          reviewTarget.id,
          {
            reviewNotes: reviewContent,
            reviews: nextReviews,
            activeReviewId: structuredReview.id,
            status: nextStatus,
          },
          {
            versionSource: "review",
            versionNote: "InkOS ContinuityAuditor 审稿结果",
            versionReviewId: structuredReview.id,
          },
        );
        if (reviewedChapter) {
          nextProject = syncNovelProjectChapterPlan(nextProject, reviewedChapter);
        }
      }
      if (action === "revise-chapter" && reviseTarget) {
        const revisedContent = extractRevisedChapterContent(
          result.content ?? result.message ?? "",
        );
        const revisionVersionId = `revision-${Date.now()}`;
        const nextReviews =
          options?.selectedIssueIds && options.selectedIssueIds.length > 0
            ? markNovelReviewIssuesResolved(
                reviseTarget.reviews ?? [],
                options.selectedIssueIds,
                revisionVersionId,
              )
            : reviseTarget.reviews;

        const revisedChapter = await updateStoredNovelChapter(
          reviseTarget.id,
          {
            content: revisedContent,
            reviews: nextReviews,
            status: "ready-for-review",
          },
          {
            versionSource: "revision",
            versionNote: "InkOS ReviserAgent 根据审稿意见修订",
            revisedFromReviewId: reviseTarget.activeReviewId,
          },
        );
        if (revisedChapter) {
          nextProject = syncNovelProjectChapterPlan(nextProject, revisedChapter);
          updateCoreProgress("正在自动复审修订结果。");
          const reviewInstruction = [
            "请复审刚刚修订后的章节，重点判断选中审稿问题是否已经解决。",
            `复审章节：第 ${revisedChapter.number} 章《${revisedChapter.title}》。`,
            `章节摘要：${revisedChapter.summary || "暂无摘要"}`,
            `章节正文：\n${revisedChapter.content}`,
          ].join("\n\n");

          const rereviewResult = await streamInkosCoreAction(
            "review",
            selectedProvider,
            selectedModel,
            nextProject,
            nextAssets,
            nextMessages,
            (event) => {
              if (event.type === "progress") {
                updateCoreProgress(event.message);
              }
            },
            reviewInstruction,
            abortController.signal,
          );

          if (rereviewResult.ok) {
            const reviewContent =
              rereviewResult.content ?? rereviewResult.message ?? "";
            const structuredReview = parseNovelReviewNotes(reviewContent);
            const nextReviewHistory = reconcileNovelReviewHistory(
              revisedChapter.reviews ?? [],
              structuredReview,
            );
            const nextStatus = deriveNovelReviewStatus(reviewContent);
            const rereviewedChapter = await updateStoredNovelChapter(
              revisedChapter.id,
              {
                reviewNotes: reviewContent,
                reviews: nextReviewHistory,
                activeReviewId: structuredReview.id,
                status: nextStatus,
              },
              {
                versionSource: "review",
                versionNote: "InkOS 自动复审修订结果",
                versionReviewId: structuredReview.id,
              },
            );

            if (rereviewedChapter) {
              nextProject = syncNovelProjectChapterPlan(
                nextProject,
                rereviewedChapter,
              );
            }
            updateCoreProgress("自动复审完成，结果已写回章节。");
          } else {
            updateCoreProgress(
              `自动复审未完成：${rereviewResult.message || "模型未返回复审结果。"}`,
            );
          }
        }
      }
      await updateStoredNovelBook(activeBook.id, {
        title: nextProject.title,
        genre: nextProject.genre,
        premise: nextProject.premise,
        project: nextProject,
        assets: nextAssets,
      });
      await appendStoredNovelMessage(requestSessionId, assistantMessage);
      if (taskId) {
        await finishStoredNovelTask(taskId, "success");
      }
      await refreshNovelWorkspace();
      setMessagesBySession((current) => ({
        ...current,
        [requestSessionId]: (current[requestSessionId] ?? visibleMessages).map(
          (item) => (item.id === assistantMessageId ? assistantMessage : item),
        ),
      }));
      setInput("");
      showToast(result.message);
      return true;
    } catch (error) {
      const errorNotice = buildNovelRecoverableErrorNotice(error);
      const isAbortError = errorNotice.category === "cancelled";
      const assistantMessage: NovelChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        status: isAbortError ? "sent" : "error",
        content: formatCoreErrorContent(label, errorNotice),
      };
      const taskErrorMessage = formatCoreTaskErrorMessage(errorNotice);

      await appendStoredNovelMessage(requestSessionId, assistantMessage).catch(
        () => undefined,
      );
      if (taskId) {
        await finishStoredNovelTask(
          taskId,
          isAbortError ? "cancelled" : "error",
          taskErrorMessage,
        ).catch(() => undefined);
      }
      await refreshNovelWorkspace().catch(() => undefined);
      setMessagesBySession((current) => ({
        ...current,
        [requestSessionId]: (current[requestSessionId] ?? visibleMessages).map(
          (item) => (item.id === assistantMessageId ? assistantMessage : item),
        ),
      }));
      showToast(
        errorNotice.title,
        isAbortError ? "warning" : "error",
      );
      return false;
    } finally {
      activeTaskAbortRef.current = null;
      setActiveTaskLabel("");
      setIsRunningCoreAction(false);
    }
  }

  function runQuickAction(command: string) {
    const action = QUICK_CORE_ACTIONS[command];

    if (action) {
      void runCoreAction(action);
      return;
    }

    void sendNovelMessage(command);
  }

  async function runBatchCoreAction(action: NovelBatchQueueAction) {
    const guard = getNovelTaskGuard({ isSending, isRunningCoreAction });

    if (!guard.canStart) {
      showToast(guard.message, "warning");
      return;
    }

    if (!activeBook || !activeSessionId) {
      showToast("请先选择书籍和会话。", "warning");
      return;
    }

    if (!selectedProvider || !selectedModel) {
      showToast("请先选择一个已连接的模型。", "warning");
      return;
    }

    const queueItems = buildNovelBatchQueueItems(activeChapterRows, action);

    if (queueItems.length === 0) {
      showToast(
        action === "write-chapter"
          ? "没有待生成的计划章节。"
          : action === "review"
            ? "没有待审稿章节。"
            : "没有带未解决审稿问题的章节。",
        "warning",
      );
      return;
    }

    setBatchQueueItems(queueItems);
    batchQueueItemsRef.current = queueItems;
    setBatchQueueActiveIndex(0);
    setBatchQueuePaused(false);
    batchQueuePausedRef.current = false;
    showToast(`已加入队列：${queueItems.length} 个任务。`);

    const queuedTasks = await Promise.all(
      queueItems.map((item) =>
        createStoredNovelTask({
          bookId: activeBook.id,
          sessionId: activeSessionId,
          action: item.action,
          label: item.label,
          status: "queued",
          targetChapterId: item.chapter?.id,
          targetChapterNumber: item.number,
          targetChapterTitle: item.title,
        }),
      ),
    );
    const taskIdsByItem = Object.fromEntries(
      queueItems.map((item, index) => [item.id, queuedTasks[index]?.id ?? ""]),
    );
    batchQueueTaskIdsByItemRef.current = taskIdsByItem;
    setBatchQueueTaskIds(queuedTasks.map((task) => task.id));
    await refreshNovelWorkspace();

    let index = 0;

    while (index < batchQueueItemsRef.current.length) {
      while (batchQueuePausedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const item = batchQueueItemsRef.current[index];
      if (!item) {
        index += 1;
        continue;
      }
      setBatchQueueActiveIndex(index);
      const ok = await runCoreAction(item.action, {
        targetChapter: item.target,
        targetStoredChapter: item.chapter,
        existingTaskId: taskIdsByItem[item.id],
        labelOverride: item.label,
      });

      if (!ok) {
        const pendingItems = batchQueueItemsRef.current.slice(index + 1);
        await Promise.all(
          pendingItems
            .map((pendingItem) => taskIdsByItem[pendingItem.id])
            .filter((taskId): taskId is string => Boolean(taskId))
            .map((taskId) =>
              finishStoredNovelTask(
                taskId,
                "cancelled",
                "批量任务已停止，尚未执行。",
              ),
            ),
        );
        setBatchQueueActiveIndex(-1);
        setBatchQueueItems([]);
        showToast(`批量任务停在：${item.label}`, "error");
        await refreshNovelWorkspace().catch(() => undefined);
        return;
      }

      index += 1;
    }

    setBatchQueueActiveIndex(-1);
    batchQueueItemsRef.current = [];
    setBatchQueueItems([]);
    setBatchQueuePaused(false);
    batchQueuePausedRef.current = false;
    await refreshNovelWorkspace();
    showToast("批量任务已完成。");
  }

  async function createBook(inputValue: {
    title: string;
    genre: string;
    premise: string;
  }) {
    try {
      const project = createNovelProject(inputValue);
      const persisted = await createStoredNovelBook({
        title: project.title,
        genre: project.genre,
        premise: project.premise,
        project,
      });
      const bookId = persisted.book.id;
      const sessionId = persisted.session.id;
      const initialMessages = createWelcomeNovelMessages(sessionId);
      const nextBook: NovelBookEntry = {
        id: bookId,
        title: project.title,
        meta: project.genre,
        project,
        assets: persisted.book.assets,
        archived: persisted.book.archived,
        sortIndex: persisted.book.sortIndex,
        chapters: [],
        tasks: [],
        sessions: [
          {
            id: sessionId,
            title: "新会话",
            summary: persisted.session.summary,
            age: "刚刚",
          },
        ],
      };

      await Promise.all(
        initialMessages.map((message) =>
          appendStoredNovelMessage(sessionId, message),
        ),
      );

      setBooks((current) => [nextBook, ...current]);
      setActiveBookId(bookId);
      setActiveSessionId(sessionId);
      setMessagesBySession((current) => ({
        ...current,
        [sessionId]: initialMessages,
      }));
      setCreatingBook(false);
      setActiveTool("AI创作");
      setNovelStoreError("");
      showToast("书籍已创建。");
    } catch (error) {
      setNovelStoreError(
        error instanceof Error ? error.message : "创建书籍失败。",
      );
      showToast("创建书籍失败。", "error");
    }
  }

  async function createSession(bookId: string) {
    try {
      const persisted = await createStoredNovelSession(bookId, []);
      const sessionId = persisted.session.id;
      const initialMessages = createWelcomeNovelMessages(sessionId);

      await Promise.all(
        initialMessages.map((message) =>
          appendStoredNovelMessage(sessionId, message),
        ),
      );

      setBooks((current) =>
        current.map((book) =>
          book.id === bookId
            ? {
                ...book,
                sessions: [
                  {
                    id: sessionId,
                    title: "新会话",
                    summary: persisted.session.summary,
                    age: "刚刚",
                  },
                  ...book.sessions,
                ],
              }
            : book,
        ),
      );
      setActiveBookId(bookId);
      setActiveSessionId(sessionId);
      setMessagesBySession((current) => ({
        ...current,
        [sessionId]: initialMessages,
      }));
      setNovelStoreError("");
      showToast("会话已创建。");
    } catch (error) {
      setNovelStoreError(
        error instanceof Error ? error.message : "创建会话失败。",
      );
      showToast("创建会话失败。", "error");
    }
  }

  async function renameBook(bookId: string) {
    const book = books.find((item) => item.id === bookId);
    const nextTitle = await requestPrompt({
      title: "重命名书籍",
      message: "输入新的书名。",
      initialValue: book?.title ?? "",
      confirmLabel: "保存",
    });

    if (!book || !nextTitle?.trim()) {
      return;
    }

    const project = { ...book.project, title: nextTitle.trim() };
    await updateStoredNovelBook(bookId, {
      title: nextTitle.trim(),
      project,
    });
    await refreshNovelWorkspace();
    showToast("书籍名称已更新。");
  }

  async function archiveBook(bookId: string) {
    const book = books.find((item) => item.id === bookId);

    if (!book) {
      return;
    }

    await updateStoredNovelBook(bookId, { archived: !book.archived });
    await refreshNovelWorkspace();
    showToast(book.archived ? "书籍已还原。" : "书籍已归档。");
  }

  async function removeBook(bookId: string) {
    const book = books.find((item) => item.id === bookId);

    if (
      !book ||
      !(await requestConfirm({
        title: "删除书籍",
        message: `删除《${book.title}》及其所有会话？这个操作无法撤销。`,
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }

    await deleteStoredNovelBook(bookId);
    await refreshNovelWorkspace();
    setSelectedBookIds((current) => current.filter((id) => id !== bookId));
    showToast("书籍已删除。", "warning");
  }

  async function moveBook(bookId: string, direction: -1 | 1) {
    const currentIndex = visibleBooks.findIndex((book) => book.id === bookId);
    const targetBook = visibleBooks[currentIndex + direction];

    if (currentIndex < 0 || !targetBook) {
      return;
    }

    const currentBook = visibleBooks[currentIndex]!;

    await Promise.all([
      updateStoredNovelBook(currentBook.id, { sortIndex: targetBook.sortIndex }),
      updateStoredNovelBook(targetBook.id, { sortIndex: currentBook.sortIndex }),
    ]);
    await refreshNovelWorkspace();
    showToast("书籍排序已更新。");
  }

  async function renameSession(sessionId: string) {
    const session = books
      .flatMap((book) => book.sessions)
      .find((item) => item.id === sessionId);
    const nextTitle = await requestPrompt({
      title: "重命名会话",
      message: "输入新的会话名。",
      initialValue: session?.title ?? "",
      confirmLabel: "保存",
    });

    if (!session || !nextTitle?.trim()) {
      return;
    }

    await updateStoredNovelSession(sessionId, { title: nextTitle.trim() });
    await refreshNovelWorkspace();
    showToast("会话名称已更新。");
  }

  async function removeSession(bookId: string, sessionId: string) {
    const book = books.find((item) => item.id === bookId);

    if (!book || book.sessions.length <= 1) {
      await requestAlert({
        title: "不能删除会话",
        message: "至少保留一个会话。",
      });
      return;
    }

    if (
      !(await requestConfirm({
        title: "删除会话",
        message: "删除这个会话及其全部消息？这个操作无法撤销。",
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }

    await deleteStoredNovelSession(sessionId);
    await refreshNovelWorkspace();
    showToast("会话已删除。", "warning");
  }

  async function clearSessionMessages() {
    if (
      !activeSessionId ||
      !(await requestConfirm({
        title: "清空会话",
        message: "清空当前会话的所有消息？会保留一条新的欢迎提示。",
        confirmLabel: "清空",
        danger: true,
      }))
    ) {
      return;
    }

    await clearStoredNovelSessionMessages(activeSessionId);
    const initialMessages = createWelcomeNovelMessages(activeSessionId);
    await Promise.all(
      initialMessages.map((message) =>
        appendStoredNovelMessage(activeSessionId, message),
      ),
    );
    await refreshNovelWorkspace();
    showToast("当前会话已清空。", "warning");
  }

  async function editLastUserMessage() {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const nextContent = await requestPrompt({
      title: "编辑上一条用户消息",
      initialValue: lastUserMessage?.content ?? "",
      multiline: true,
      confirmLabel: "保存",
    });

    if (!lastUserMessage || !nextContent?.trim()) {
      return;
    }

    await updateStoredNovelMessage(lastUserMessage.id, {
      content: nextContent.trim(),
    });
    setMessagesBySession((current) => ({
      ...current,
      [activeSessionId]: (current[activeSessionId] ?? []).map((message) =>
        message.id === lastUserMessage.id
          ? { ...message, content: nextContent.trim() }
        : message,
      ),
    }));
    showToast("上一条消息已更新。");
  }

  function exportActiveSession() {
    if (!activeBook || !activeSessionId) {
      return;
    }

    const session = activeBook.sessions.find((item) => item.id === activeSessionId);
    const content = [
      `# ${activeBook.title} / ${session?.title ?? "会话"}`,
      "",
      ...messages.map(
        (message) =>
          `## ${message.role === "user" ? "你" : "InkOS"}\n\n${message.content}`,
      ),
    ].join("\n\n");

    downloadTextFile(
      `${activeBook.title}-${session?.title ?? "session"}.md`,
      content,
      "text/markdown;charset=utf-8",
    );
    showToast("会话已导出。");
  }

  function exportActiveBook(format: "markdown" | "text" | "docx") {
    if (!activeBook) {
      return;
    }

    const chapters = activeBook.chapters;

    if (format === "markdown") {
      downloadTextFile(
        `${activeBook.title}-整本书.md`,
        buildNovelBookExportMarkdown({
          title: activeBook.title,
          genre: activeBook.meta,
          premise: activeBook.project.premise,
          chapters,
        }),
        "text/markdown;charset=utf-8",
      );
    } else if (format === "text") {
      downloadTextFile(
        `${activeBook.title}-整本书.txt`,
        buildNovelBookExportText({ title: activeBook.title, chapters }),
        "text/plain;charset=utf-8",
      );
    } else {
      const content = buildNovelBookExportText({
        title: activeBook.title,
        chapters,
      });
      downloadBytesFile(
        `${activeBook.title}-整本书.docx`,
        createSimpleDocxFile(activeBook.title, content),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    }

    showToast("整本书已导出。");
  }

  function exportActiveBookChapters() {
    if (!activeBook) {
      return;
    }

    const bundle = buildNovelChapterExportBundle(activeBook.chapters);

    if (bundle.length === 0) {
      showToast("暂无可导出的章节正文。", "warning");
      return;
    }

    bundle.forEach((file) => {
      downloadTextFile(file.filename, file.content, "text/markdown;charset=utf-8");
    });
    showToast(`已导出 ${bundle.length} 个章节 Markdown。`);
  }

  function exportActiveBookVolumes() {
    if (!activeBook) {
      return;
    }

    const bundle = buildNovelVolumeExportBundle({
      title: activeBook.title,
      chapters: activeBook.chapters,
      outlineNodes: activeBook.assets.outlineNodes,
    });

    if (bundle.length === 0) {
      showToast("暂无可导出的卷内容。", "warning");
      return;
    }

    bundle.forEach((file) => {
      downloadTextFile(file.filename, file.content, "text/markdown;charset=utf-8");
    });
    showToast(`已导出 ${bundle.length} 个卷 Markdown。`);
  }

  function exportCreationLog() {
    if (!activeBook) {
      return;
    }

    downloadTextFile(
      `${activeBook.title}-创作日志.md`,
      buildNovelCreationLogExportMarkdown({
        bookTitle: activeBook.title,
        tasks: activeBook.tasks,
      }),
      "text/markdown;charset=utf-8",
    );
    showToast("创作日志已导出。");
  }

  function exportPlatformText(platform: "qidian" | "fanqie") {
    if (!activeBook) {
      return;
    }

    downloadTextFile(
      `${activeBook.title}-${platform}.txt`,
      buildNovelPlatformExportText({
        title: activeBook.title,
        platform,
        chapters: activeBook.chapters,
      }),
      "text/plain;charset=utf-8",
    );
    showToast("平台格式文本已导出。");
  }

  async function exportWorkspaceBackup() {
    const payload = await exportNovelWorkspaceBackup(settings);

    downloadTextFile(
      `sxy-creative-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    showToast("本地创作库备份已导出，模型 Key 已脱敏。");
  }

  async function restoreWorkspaceBackupFromFile(file: File) {
    if (
      !(await requestConfirm({
        title: "恢复本地备份",
        message:
          "恢复会替换当前浏览器里的书籍、会话、消息、章节、版本和任务日志。模型 Key 不会从备份恢复。继续吗？",
        confirmLabel: "恢复",
        danger: true,
      }))
    ) {
      return;
    }

    try {
      const raw = await file.text();
      const payload = await restoreNovelWorkspaceBackup(raw);

      await refreshNovelWorkspace();
      showToast(`已恢复备份：${payload.books.length} 本书籍。`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "恢复备份失败。",
        "error",
      );
    } finally {
      if (backupImportInputRef.current) {
        backupImportInputRef.current.value = "";
      }
    }
  }

  async function bulkArchiveBooks(archived: boolean) {
    const selectedBooks = books.filter((book) => selectedBookIds.includes(book.id));

    if (selectedBooks.length === 0) {
      return;
    }

    await Promise.all(
      selectedBooks.map((book) =>
        updateStoredNovelBook(book.id, {
          archived,
        }),
      ),
    );
    await refreshNovelWorkspace();
    setSelectedBookIds([]);
    showToast(archived ? "已批量归档书籍。" : "已批量还原书籍。");
  }

  async function bulkDeleteBooks() {
    const selectedBooks = books.filter((book) => selectedBookIds.includes(book.id));

    if (selectedBooks.length === 0) {
      return;
    }

    const confirmed = await requestConfirm({
      title: "批量删除书籍",
      message: `删除选中的 ${selectedBooks.length} 本书籍及其全部会话？这个操作无法撤销。`,
      confirmLabel: "批量删除",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    await Promise.all(selectedBooks.map((book) => deleteStoredNovelBook(book.id)));
    await refreshNovelWorkspace();
    setSelectedBookIds([]);
    showToast("已批量删除书籍。", "warning");
  }

  function toggleBookSelection(bookId: string) {
    setSelectedBookIds((current) =>
      current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId],
    );
  }

  function toggleVisibleBookSelection() {
    const visibleIds = visibleBooks.map((book) => book.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((bookId) => selectedBookIds.includes(bookId));

    setSelectedBookIds((current) =>
      allVisibleSelected
        ? current.filter((bookId) => !visibleIds.includes(bookId))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function retryLastFailedMessage() {
    let failedIndex = -1;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.status === "error") {
        failedIndex = index;
        break;
      }
    }
    const previousUser = messages
      .slice(0, failedIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (previousUser) {
      void sendNovelMessage(previousUser.content);
    }
  }

  async function updateActiveProject(
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) {
    if (!activeBook) {
      return;
    }

    const project = {
      ...activeBook.project,
      ...updates,
    };

    await updateStoredNovelBook(activeBook.id, {
      title: project.title,
      genre: project.genre,
      premise: project.premise,
      project,
      ...(assets ? { assets } : {}),
    });
    await refreshNovelWorkspace();
  }

  async function saveChapterDraft(
    chapter: StoredNovelChapter,
    updates: Pick<StoredNovelChapter, "content" | "summary">,
  ) {
    const updatedChapter = await updateStoredNovelChapter(
      chapter.id,
      updates,
      {
        versionSource: "manual-edit",
        versionNote: "章节编辑器保存",
      },
    );
    if (activeBook && updatedChapter) {
      await updateStoredNovelBook(activeBook.id, {
        project: syncNovelProjectChapterPlan(
          activeBook.project,
          updatedChapter,
        ),
      });
    }
    await refreshNovelWorkspace();
    showToast("章节已保存，版本记录已更新。");
  }

  async function updateChapterStatus(
    chapter: StoredNovelChapter,
    status: StoredNovelChapter["status"],
  ) {
    const updatedChapter = await updateStoredNovelChapter(
      chapter.id,
      { status },
      {
        versionSource: "status-change",
        versionNote: `状态改为 ${INKOS_STATUS_LABELS[status]}`,
      },
    );
    if (activeBook && updatedChapter) {
      await updateStoredNovelBook(activeBook.id, {
        project: syncNovelProjectChapterPlan(
          activeBook.project,
          updatedChapter,
        ),
      });
    }
    await refreshNovelWorkspace();
    showToast("章节状态已更新。");
  }

  async function updateChapterPublicationStatus(
    chapter: StoredNovelChapter,
    publicationStatus: NonNullable<StoredNovelChapter["publicationStatus"]>,
  ) {
    await updateStoredNovelChapter(
      chapter.id,
      { publicationStatus },
      { skipVersion: true },
    );
    await refreshNovelWorkspace();
    showToast("章节发布状态已更新。");
  }

  async function removeChapter(chapter: StoredNovelChapter) {
    if (
      !(await requestConfirm({
        title: "删除章节",
        message: `删除第 ${chapter.number} 章《${chapter.title}》？这个操作无法撤销。`,
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }

    await deleteStoredNovelChapter(chapter.id);
    await refreshNovelWorkspace();
    showToast("章节已删除。", "warning");
  }

  async function restoreChapterVersion(version: StoredNovelChapterVersion) {
    if (
      !(await requestConfirm({
        title: "恢复章节版本",
        message: `恢复第 ${version.number} 章《${version.title}》到 ${formatNovelChapterVersionSource(version.source)} 版本？当前正文会保存为新的恢复记录。`,
        confirmLabel: "恢复",
      }))
    ) {
      return;
    }

    const restoredChapter = await restoreStoredNovelChapterVersion(version.id);

    if (restoredChapter) {
      if (activeBook) {
        await updateStoredNovelBook(activeBook.id, {
          project: syncNovelProjectChapterPlan(
            activeBook.project,
            restoredChapter,
          ),
        });
      }
      setActiveChapterId(restoredChapter.id);
      await refreshNovelWorkspace();
      showToast("章节版本已恢复。");
    } else {
      showToast("没有找到这个章节版本。", "error");
    }
  }

  return (
    <div className={styles.novelChatShell}>
      <section className={styles.novelToolTabs} aria-label='AI 小说创作工具'>
        {NOVEL_TOOLS.map((tool) => (
          <button
            key={tool}
            className={activeTool === tool ? styles.activeNovelTool : ""}
            onClick={() => setActiveTool(tool)}
          >
            {tool}
          </button>
        ))}
      </section>

      {activeTool === "AI创作" && isNovelStoreLoading ? (
        <section className={styles.createBookScreen}>
          <div className={styles.createBookBox}>
            <span>SXY InkOS</span>
            <h2>正在加载本地创作库</h2>
            <p>书籍、会话和历史消息会从浏览器 IndexedDB 恢复。</p>
          </div>
        </section>
      ) : activeTool === "AI创作" && (creatingBook || books.length === 0) ? (
        <CreateBookPanel
          modelGroups={groupedModels}
          selectedModelValue={selectedModelValue}
          hasBooks={books.length > 0}
          errorMessage={novelStoreError}
          onCancel={() => setCreatingBook(false)}
          onCreate={createBook}
          onManageModels={onManageModels}
          onModelChange={setSelectedModelValue}
        />
      ) : activeTool === "AI创作" && activeBook && project && currentStage && stats ? (
        <section className={styles.novelChatLayout}>
          <NovelBookList
            books={visibleBooks}
            activeBookId={activeBookId}
            activeSessionId={activeSessionId}
            searchQuery={bookSearchQuery}
            selectedBookIds={selectedBookIds}
            showArchived={showArchivedBooks}
            totalBooks={books.length}
            searchInputRef={bookSearchInputRef}
            onBulkArchive={() => void bulkArchiveBooks(true)}
            onBulkDelete={() => void bulkDeleteBooks()}
            onBulkRestore={() => void bulkArchiveBooks(false)}
            onClearSelection={() => setSelectedBookIds([])}
            onCreateBook={() => setCreatingBook(true)}
            onCreateSession={createSession}
            onArchiveBook={(bookId) => void archiveBook(bookId)}
            onBookSelect={(bookId) => {
              const nextBook = books.find((book) => book.id === bookId);
              setActiveBookId(bookId);
              setActiveSessionId(nextBook?.sessions[0]?.id ?? "");
            }}
            onDeleteBook={(bookId) => void removeBook(bookId)}
            onMoveBook={(bookId, direction) => void moveBook(bookId, direction)}
            onRenameBook={(bookId) => void renameBook(bookId)}
            onRenameSession={(sessionId) => void renameSession(sessionId)}
            onSelectAllVisible={toggleVisibleBookSelection}
            onSelectBook={toggleBookSelection}
            onDeleteSession={(bookId, sessionId) =>
              void removeSession(bookId, sessionId)
            }
            onSearchQueryChange={setBookSearchQuery}
            onSessionSelect={(bookId, sessionId) => {
              setActiveBookId(bookId);
              setActiveSessionId(sessionId);
            }}
            onShowArchivedChange={setShowArchivedBooks}
          />

          <section className={styles.chatSurface}>
            <header className={styles.chatContextBar}>
              <div>
                <strong>{activeBook?.title ?? project.title}</strong>
                <span>
                  {(activeBook?.meta ?? project.genre)} / {currentStage.label} /{" "}
                  已生成 {stats.generatedChapters} 章 / 已定稿{" "}
                  {stats.approvedChapters} 章
                </span>
              </div>
              <em>Chat / InkOS</em>
            </header>

            <div className={styles.messageList}>
              {messages.length === 0 ? (
                <div className={styles.emptyMessageState}>
                  <strong>这个会话还没有消息</strong>
                  <span>输入一个题材、角色或章节目标，InkOS 会从这里开始推进。</span>
                </div>
              ) : null}
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.status === "error"
                      ? styles.errorMessage
                      : message.role === "user"
                        ? styles.userMessage
                        : styles.assistantMessage
                  }
                >
                  <strong>{message.role === "user" ? "你" : "InkOS"}</strong>
                  <MarkdownContent content={message.content} />
                  {message.streaming ? (
                    <span className={styles.typingIndicator}>
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null}
                </article>
              ))}
            </div>

            <footer className={styles.chatComposer}>
              <div className={styles.composerQuickActions}>
                {["写下一章", "审稿", "修订本章", "生成大纲", "整理设定", "市场雷达"].map(
                  (action) => (
                    <button
                      key={action}
                      disabled={isSending || isRunningCoreAction}
                      onClick={() => runQuickAction(action)}
                    >
                      {action}
                    </button>
                  ),
                )}
                <button onClick={editLastUserMessage}>编辑上一条</button>
                {messages.some((message) => message.status === "error") ? (
                  <button onClick={retryLastFailedMessage}>重试失败</button>
                ) : null}
                <button
                  disabled={isSending || isRunningCoreAction}
                  onClick={() => void runBatchCoreAction("write-chapter")}
                >
                  批量生成
                </button>
                <button
                  disabled={isSending || isRunningCoreAction}
                  onClick={() => void runBatchCoreAction("review")}
                >
                  批量审稿
                </button>
                <button
                  disabled={isSending || isRunningCoreAction}
                  onClick={() => void runBatchCoreAction("revise-chapter")}
                >
                  批量修订
                </button>
                <button onClick={clearSessionMessages}>清空会话</button>
                <button onClick={exportActiveSession}>导出会话</button>
                <button onClick={() => exportActiveBook("markdown")}>
                  导出整书 MD
                </button>
                <button onClick={() => exportActiveBook("text")}>
                  导出整书 TXT
                </button>
                <button onClick={() => exportActiveBook("docx")}>
                  导出整书 docx
                </button>
                <button onClick={exportActiveBookChapters}>分章导出</button>
                <button onClick={exportActiveBookVolumes}>按卷导出</button>
                <button onClick={exportCreationLog}>创作日志</button>
                <button onClick={() => exportPlatformText("qidian")}>
                  起点 TXT
                </button>
                <button onClick={() => exportPlatformText("fanqie")}>
                  番茄 TXT
                </button>
                <button onClick={() => void exportWorkspaceBackup()}>
                  备份数据
                </button>
                <button
                  onClick={() => backupImportInputRef.current?.click()}
                >
                  恢复数据
                </button>
                <input
                  ref={backupImportInputRef}
                  type='file'
                  accept='application/json,.json'
                  className={styles.hiddenFileInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void restoreWorkspaceBackupFromFile(file);
                    }
                  }}
                />
              </div>
              {batchQueueItems.length > 0 ? (
                <div className={styles.batchQueueBar}>
                  <div>
                    <span>
                      队列 {Math.max(0, batchQueueActiveIndex + 1)} /{" "}
                      {batchQueueItems.length}
                    </span>
                    <strong>
                      {batchQueueItems[batchQueueActiveIndex]?.label ??
                        "队列等待中"}
                    </strong>
                    {batchQueuePaused ? <em>已暂停，当前任务结束后停住</em> : null}
                  </div>
                  <div className={styles.batchQueueActions}>
                    <button onClick={() => void toggleBatchQueuePaused()}>
                      {batchQueuePaused ? "继续队列" : "暂停队列"}
                    </button>
                    <button onClick={exportBatchQueueReport}>完成报告</button>
                  </div>
                  <div className={styles.batchQueueList}>
                    {batchQueueItems.map((item, index) => (
                      <article
                        key={item.id}
                        className={
                          index === batchQueueActiveIndex
                            ? styles.activeBatchQueueItem
                            : ""
                        }
                      >
                        <span>{item.label}</span>
                        <div>
                          <button
                            disabled={index <= batchQueueActiveIndex + 1}
                            onClick={() => moveBatchQueueItem(item.id, "up")}
                          >
                            上移
                          </button>
                          <button
                            disabled={index <= batchQueueActiveIndex}
                            onClick={() => moveBatchQueueItem(item.id, "down")}
                          >
                            下移
                          </button>
                          <button
                            disabled={index <= batchQueueActiveIndex}
                            onClick={() => void skipBatchQueueItem(item.id)}
                          >
                            跳过
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              {activeTaskLabel ? (
                <div className={styles.activeTaskBar}>
                  <span>正在执行：{activeTaskLabel}</span>
                  <button onClick={cancelActiveTask}>取消任务</button>
                </div>
              ) : null}
              <textarea
                ref={composerInputRef}
                rows={3}
                value={input}
                placeholder='告诉我你想写什么，或输入：写下一章'
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    void sendNovelMessage(input);
                  }
                }}
              />
              <div className={styles.composerMetaRow}>
                <div className={styles.modelPickerInline}>
                  <span>模型</span>
                  <ModelPicker
                    value={selectedModelValue}
                    groups={groupedModels}
                    onManageModels={onManageModels}
                    onValueChange={setSelectedModelValue}
                  />
                </div>
                <div className={styles.sendControl}>
                  <span>⌘ / Ctrl + Enter 发送</span>
                  <button
                    className={styles.primaryButton}
                    disabled={
                      !input.trim() ||
                      isSending ||
                      isRunningCoreAction ||
                      !selectedModelValue
                    }
                    onClick={() => void sendNovelMessage(input)}
                  >
                    {isSending || isRunningCoreAction ? "处理中" : "发送"}
                  </button>
                </div>
              </div>
            </footer>
          </section>

          <NovelBookPanel
            project={project}
            assets={activeBook.assets}
            chapters={activeBook.chapters}
            chapterVersions={
              activeChapter
                ? chapterVersionsById[activeChapter.id] ?? []
                : []
            }
            tasks={activeBook.tasks}
            activeChapterId={activeChapterRow?.key ?? ""}
            stats={stats}
            promptPreview={promptPreview}
            onChapterSelect={setActiveChapterId}
            onChapterDraftSave={saveChapterDraft}
            onChapterStatusChange={updateChapterStatus}
            onChapterPublicationStatusChange={updateChapterPublicationStatus}
            onChapterDelete={removeChapter}
            onChapterVersionRestore={restoreChapterVersion}
            onGenerateChapter={async (target) => {
              await runCoreAction("write-chapter", { targetChapter: target });
            }}
            onReviseChapter={async (selectedIssueIds) => {
              await runCoreAction("revise-chapter", { selectedIssueIds });
            }}
            onRetryTask={(task) => {
              if (task.sessionId !== activeSessionId) {
                setActiveSessionId(task.sessionId);
              }
              const action = task.action as InkosCoreAction;
              const row = activeChapterRows.find(
                (chapter) => chapter.number === task.targetChapterNumber,
              );
              void runCoreAction(action, {
                targetChapter:
                  action === "write-chapter" && row
                    ? {
                        number: row.number,
                        title: row.title,
                        focus: row.focus,
                        targetWords: row.targetWords,
                        reason: row.generated ? "append" : "planned",
                      }
                    : undefined,
                targetStoredChapter:
                  action === "review" || action === "revise-chapter"
                    ? row?.chapter
                    : undefined,
                existingTaskId: task.status === "queued" ? task.id : undefined,
                labelOverride: task.label,
              });
            }}
            onProjectChange={updateActiveProject}
            onRequestPrompt={requestPrompt}
          />
        </section>
      ) : activeTool !== "AI创作" ? (
        <NovelToolPanel
          tool={activeTool}
          book={activeBook ?? null}
          project={project ?? createDemoInkosProject()}
          isRunningCoreAction={isRunningCoreAction}
          onProjectChange={updateActiveProject}
          onRunCoreAction={async (action) => {
            await runCoreAction(action);
          }}
          onRequestPrompt={requestPrompt}
        />
      ) : (
        <CreateBookPanel
          modelGroups={groupedModels}
          selectedModelValue={selectedModelValue}
          hasBooks={books.length > 0}
          errorMessage={novelStoreError}
          onCancel={() => setCreatingBook(false)}
          onCreate={createBook}
          onManageModels={onManageModels}
          onModelChange={setSelectedModelValue}
        />
      )}
      <AppDialog
        dialog={dialog}
        inputValue={dialogInput}
        onCancel={() => closeDialog(dialog?.kind === "confirm" ? false : null)}
        onConfirm={() =>
          closeDialog(dialog?.kind === "prompt" ? dialogInput : true)
        }
        onInputChange={setDialogInput}
      />
      <AppToast toast={toast} />
    </div>
  );
}

function ModelPicker({
  value,
  groups,
  onManageModels,
  onValueChange,
}: {
  value: string;
  groups: ModelPickerGroup[];
  onManageModels: () => void;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query) ||
            group.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [groups, search]);
  const selected = useMemo(() => {
    const [service, modelId] = value.split("::");
    const group = groups.find((item) => item.service === service);
    const model = group?.models.find((item) => item.id === modelId);

    return group && model
      ? { group, model, label: `${group.label} · ${model.name}` }
      : null;
  }, [groups, value]);

  if (groups.length === 0) {
    return (
      <button className={styles.modelPickerEmpty} onClick={onManageModels}>
        配置模型 →
      </button>
    );
  }

  return (
    <div className={styles.modelPickerRoot}>
      <button
        className={styles.modelPickerTrigger}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? "选择模型"}</span>
        <em>⌄</em>
      </button>

      {open ? (
        <div className={styles.modelPickerMenu}>
          <input
            value={search}
            placeholder='搜索模型...'
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className={styles.modelPickerList}>
            {filteredGroups.map((group) => (
              <section key={group.service}>
                <strong>{group.label}</strong>
                {group.models.map((model) => {
                  const itemValue = `${group.service}::${model.id}`;
                  const selectedItem = itemValue === value;

                  return (
                    <button
                      key={itemValue}
                      className={selectedItem ? styles.activeModelItem : ""}
                      onClick={() => {
                        onValueChange(itemValue);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span>{model.name}</span>
                      {selectedItem ? <em>✓</em> : null}
                    </button>
                  );
                })}
              </section>
            ))}
            {filteredGroups.length === 0 ? (
              <p className={styles.emptyModelSearch}>无匹配模型</p>
            ) : null}
          </div>
          <button className={styles.modelManageButton} onClick={onManageModels}>
            管理服务商
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AppDialog({
  dialog,
  inputValue,
  onCancel,
  onConfirm,
  onInputChange,
}: {
  dialog: AppDialogState | null;
  inputValue: string;
  onCancel: () => void;
  onConfirm: () => void;
  onInputChange: (value: string) => void;
}) {
  if (!dialog) {
    return null;
  }

  return (
    <div className={styles.dialogOverlay} role='presentation'>
      <section
        className={styles.appDialog}
        role={dialog.kind === "alert" ? "alertdialog" : "dialog"}
        aria-modal='true'
        aria-labelledby='app-dialog-title'
      >
        <header>
          <h2 id='app-dialog-title'>{dialog.title}</h2>
          {"message" in dialog && dialog.message ? <p>{dialog.message}</p> : null}
        </header>

        {dialog.kind === "prompt" ? (
          <label className={styles.dialogField}>
            <span>{dialog.multiline ? "内容" : "名称"}</span>
            {dialog.multiline ? (
              <textarea
                rows={6}
                value={inputValue}
                autoFocus
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    onConfirm();
                  }
                }}
              />
            ) : (
              <input
                value={inputValue}
                autoFocus
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onConfirm();
                  }
                }}
              />
            )}
            {dialog.multiline ? <em>⌘ / Ctrl + Enter 保存</em> : null}
          </label>
        ) : null}

        <footer>
          {dialog.kind !== "alert" ? (
            <button onClick={onCancel}>取消</button>
          ) : null}
          <button
            className={dialog.kind === "confirm" && dialog.danger ? styles.dangerButton : styles.primaryButton}
            onClick={onConfirm}
          >
            {dialog.confirmLabel ??
              (dialog.kind === "alert" ? "知道了" : "确认")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AppToast({ toast }: { toast: AppToastState | null }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`${styles.toast} ${styles[`toast_${toast.tone}`]}`}>
      {toast.message}
    </div>
  );
}

function CreateBookPanel({
  modelGroups,
  selectedModelValue,
  hasBooks,
  errorMessage,
  onCancel,
  onCreate,
  onManageModels,
  onModelChange,
}: {
  modelGroups: ModelPickerGroup[];
  selectedModelValue: string;
  hasBooks: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onCreate: (input: {
    title: string;
    genre: string;
    premise: string;
  }) => void | Promise<void>;
  onManageModels: () => void;
  onModelChange: (value: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [premise, setPremise] = useState("");
  const canCreate = title.trim().length > 0;

  return (
    <section className={styles.createBookScreen}>
      <div className={styles.createBookBox}>
        <span>SXY InkOS</span>
        <h2>{hasBooks ? "新建书籍" : "创建第一本书籍"}</h2>
        <p>
          先建立一本书，随后进入 AI 创作工作台；一本书可以拥有多个会话。
        </p>
        {errorMessage ? (
          <div className={styles.createBookError}>{errorMessage}</div>
        ) : null}
        <label>
          书名
          <input
            value={title}
            placeholder='例如：裂缝中的阳光'
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          题材
          <input
            value={genre}
            placeholder='例如：都市悬疑 / 现实异能'
            onChange={(event) => setGenre(event.target.value)}
          />
        </label>
        <label>
          核心设定
          <textarea
            rows={4}
            value={premise}
            placeholder='一句话描述主角、冲突或世界观。'
            onChange={(event) => setPremise(event.target.value)}
          />
        </label>
        <div className={styles.createBookModelRow}>
          <span>模型</span>
          <ModelPicker
            value={selectedModelValue}
            groups={modelGroups}
            onManageModels={onManageModels}
            onValueChange={onModelChange}
          />
        </div>
        <div className={styles.createBookActions}>
          {hasBooks ? (
            <button onClick={onCancel}>取消</button>
          ) : null}
          <button
            className={styles.primaryButton}
            disabled={!canCreate}
            onClick={() => {
              void onCreate({
                title,
                genre,
                premise,
              });
            }}
          >
            创建书籍
          </button>
        </div>
      </div>
    </section>
  );
}

function NovelBookList({
  books,
  activeBookId,
  activeSessionId,
  searchQuery,
  selectedBookIds,
  showArchived,
  totalBooks,
  searchInputRef,
  onBulkArchive,
  onBulkDelete,
  onBulkRestore,
  onClearSelection,
  onCreateBook,
  onCreateSession,
  onArchiveBook,
  onBookSelect,
  onDeleteBook,
  onDeleteSession,
  onMoveBook,
  onRenameBook,
  onRenameSession,
  onSelectAllVisible,
  onSelectBook,
  onSearchQueryChange,
  onSessionSelect,
  onShowArchivedChange,
}: {
  books: NovelBookEntry[];
  activeBookId: string;
  activeSessionId: string;
  searchQuery: string;
  selectedBookIds: string[];
  showArchived: boolean;
  totalBooks: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onBulkRestore: () => void;
  onClearSelection: () => void;
  onCreateBook: () => void;
  onCreateSession: (bookId: string) => void;
  onArchiveBook: (bookId: string) => void;
  onBookSelect: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onDeleteSession: (bookId: string, sessionId: string) => void;
  onMoveBook: (bookId: string, direction: -1 | 1) => void;
  onRenameBook: (bookId: string) => void;
  onRenameSession: (sessionId: string) => void;
  onSelectAllVisible: () => void;
  onSelectBook: (bookId: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSessionSelect: (bookId: string, sessionId: string) => void;
  onShowArchivedChange: (value: boolean) => void;
}) {
  const selectedCount = selectedBookIds.length;
  const visibleSelected =
    books.length > 0 && books.every((book) => selectedBookIds.includes(book.id));

  return (
    <aside className={styles.novelBookList}>
      <div className={styles.bookListHeader}>
        <span>书籍</span>
        <button onClick={onCreateBook}>+ 新建书籍</button>
      </div>
      <div className={styles.bookListFilters}>
        <input
          ref={searchInputRef}
          value={searchQuery}
          placeholder='搜索书名、题材或设定'
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <div>
          <button onClick={() => onShowArchivedChange(!showArchived)}>
            {showArchived ? "显示进行中" : "显示归档"} · {totalBooks}
          </button>
          <button onClick={onSelectAllVisible}>
            {visibleSelected ? "取消全选" : "全选当前"}
          </button>
        </div>
        <p>/ 搜索 · N 新建 · Esc 取消选择</p>
      </div>

      {selectedCount > 0 ? (
        <div className={styles.bulkActionBar}>
          <strong>已选 {selectedCount}</strong>
          {showArchived ? (
            <button onClick={onBulkRestore}>还原</button>
          ) : (
            <button onClick={onBulkArchive}>归档</button>
          )}
          <button onClick={onBulkDelete}>删除</button>
          <button onClick={onClearSelection}>取消</button>
        </div>
      ) : null}

      <div className={styles.bookListBody}>
        {books.length === 0 ? (
          <div className={styles.emptyBookList}>
            <strong>{searchQuery ? "没有匹配的书籍" : "这里暂时没有书籍"}</strong>
            <span>
              {searchQuery
                ? "换一个关键词，或者清空搜索条件。"
                : "创建一本书后，会在这里管理会话、归档和导出。"}
            </span>
            <button onClick={searchQuery ? () => onSearchQueryChange("") : onCreateBook}>
              {searchQuery ? "清空搜索" : "新建书籍"}
            </button>
          </div>
        ) : null}
        {books.map((book) => (
          <section key={book.id} className={styles.bookListGroup}>
            <div
              className={`${styles.bookListItem} ${
                activeBookId === book.id ? styles.activeBookButton : ""
              }`}
            >
              <label className={styles.bookSelectBox}>
                <input
                  type='checkbox'
                  checked={selectedBookIds.includes(book.id)}
                  onChange={() => onSelectBook(book.id)}
                />
                <span>选择</span>
              </label>
              <button onClick={() => onBookSelect(book.id)}>
                <strong>{book.title}</strong>
                <span>{book.meta}</span>
                <em>
                  {book.sessions.length} 个会话
                  {book.archived ? " · 已归档" : ""}
                </em>
              </button>
              <div className={styles.bookActions}>
                <button title='上移' onClick={() => onMoveBook(book.id, -1)}>
                  ↑
                </button>
                <button title='下移' onClick={() => onMoveBook(book.id, 1)}>
                  ↓
                </button>
                <button title='重命名' onClick={() => onRenameBook(book.id)}>
                  改
                </button>
                <button title='归档' onClick={() => onArchiveBook(book.id)}>
                  {book.archived ? "还原" : "归档"}
                </button>
                <button title='删除' onClick={() => onDeleteBook(book.id)}>
                  删
                </button>
              </div>
            </div>
            {activeBookId === book.id ? (
              <div className={styles.sessionList}>
                {book.sessions.map((session) => (
                  <div
                    key={session.id}
                    className={
                      activeSessionId === session.id
                        ? styles.activeSessionButton
                        : ""
                    }
                  >
                    <button onClick={() => onSessionSelect(book.id, session.id)}>
                      <span>{session.title}</span>
                      <em>{session.summary} · {session.age}</em>
                    </button>
                    <div>
                      <button onClick={() => onRenameSession(session.id)}>改</button>
                      <button
                        onClick={() => onDeleteSession(book.id, session.id)}
                      >
                        删
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className={styles.newSessionButton}
                  onClick={() => onCreateSession(book.id)}
                >
                  + 新建会话
                </button>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </aside>
  );
}

function NovelToolPanel({
  tool,
  book,
  project,
  isRunningCoreAction,
  onProjectChange,
  onRunCoreAction,
  onRequestPrompt,
}: {
  tool: Exclude<NovelTool, "AI创作">;
  book: NovelBookEntry | null;
  project: InkosNovelProject;
  isRunningCoreAction: boolean;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRunCoreAction: (action: InkosCoreAction) => Promise<void>;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }) => Promise<string | null>;
}) {
  const assets = book?.assets ?? createDefaultNovelAssets(project);

  return (
    <section className={styles.novelToolPanel}>
      <header>
        <strong>{tool}</strong>
        <span>当前数据写入本地 IndexedDB，跟随书籍一起保存。</span>
      </header>
      {tool === "题材" ? (
        <GenreTool
          assets={assets}
          project={project}
          onProjectChange={onProjectChange}
          onRequestPrompt={onRequestPrompt}
        />
      ) : null}
      {tool === "文风" ? (
        <StyleTool
          assets={assets}
          project={project}
          onProjectChange={onProjectChange}
        />
      ) : null}
      {tool === "导入" ? (
        <ImportTool
          assets={assets}
          project={project}
          onProjectChange={onProjectChange}
        />
      ) : null}
      {tool === "市场雷达" ? (
        <RadarTool
          assets={assets}
          project={project}
          isRunningCoreAction={isRunningCoreAction}
          onRunCoreAction={onRunCoreAction}
        />
      ) : null}
      {tool === "环境诊断" ? (
        <DoctorTool
          assets={assets}
          project={project}
          isRunningCoreAction={isRunningCoreAction}
          onRunCoreAction={onRunCoreAction}
        />
      ) : null}
    </section>
  );
}

function GenreTool({
  assets,
  project,
  onProjectChange,
  onRequestPrompt,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    confirmLabel?: string;
  }) => Promise<string | null>;
}) {
  const [selectedGenre, setSelectedGenre] = useState(
    assets.genres[0]?.id ?? "project",
  );
  const detail = assets.genres.find((genre) => genre.id === selectedGenre) ??
    assets.genres[0] ?? {
      id: "project",
      name: project.genre,
      source: "project" as const,
      language: project.language,
      chapterTypes: "",
      fatigueWords: "",
      pacingRule: "",
    };

  async function saveGenre(field: keyof typeof detail, value: string) {
    const nextGenre = { ...detail, [field]: value };
    const nextAssets = {
      ...assets,
      genres: assets.genres.some((genre) => genre.id === detail.id)
        ? assets.genres.map((genre) =>
            genre.id === detail.id ? nextGenre : genre,
          )
        : [nextGenre, ...assets.genres],
    };

    await onProjectChange(
      field === "name" ? { genre: value } : {},
      nextAssets,
    );
  }

  return (
    <div className={styles.toolTwoColumn}>
      <aside className={styles.toolListPanel}>
        <div className={styles.toolListHeader}>
          <strong>题材库</strong>
          <button
            onClick={async () => {
              const name = await onRequestPrompt({
                title: "新建题材",
                message: "输入题材名称。",
                initialValue: "新题材",
                confirmLabel: "创建",
              });
              if (!name?.trim()) return;
              const nextGenre = {
                id: `genre-${Date.now()}`,
                name: name.trim(),
                source: "project" as const,
                language: project.language,
                chapterTypes: "",
                fatigueWords: "",
                pacingRule: "",
              };
              void onProjectChange({}, {
                ...assets,
                genres: [nextGenre, ...assets.genres],
              });
              setSelectedGenre(nextGenre.id);
            }}
          >
            + 新建题材
          </button>
        </div>
        {assets.genres.map((genre) => (
          <button
            key={genre.id}
            className={genre.id === selectedGenre ? styles.activeToolListItem : ""}
            onClick={() => setSelectedGenre(genre.id)}
          >
            <strong>{genre.name}</strong>
            <span>{genre.source === "project" ? "项目题材" : "内置题材"} · {genre.language}</span>
          </button>
        ))}
      </aside>
      <section className={styles.toolFormPanel}>
        <div className={styles.formGrid}>
          <label>
            ID
            <input value={detail.id} readOnly />
          </label>
          <label>
            名称
            <input
              value={detail.name}
              onChange={(event) => void saveGenre("name", event.target.value)}
            />
          </label>
          <label>
            章节类型
            <input
              value={detail.chapterTypes}
              onChange={(event) =>
                void saveGenre("chapterTypes", event.target.value)
              }
            />
          </label>
          <label>
            疲劳词
            <input
              value={detail.fatigueWords}
              onChange={(event) =>
                void saveGenre("fatigueWords", event.target.value)
              }
            />
          </label>
          <label className={styles.fullField}>
            节奏规则
            <textarea
              rows={5}
              value={detail.pacingRule}
              onChange={(event) =>
                void saveGenre("pacingRule", event.target.value)
              }
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function StyleTool({
  assets,
  project,
  onProjectChange,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
}) {
  const currentSample = assets.styleSamples[0] ?? {
    id: `style-${Date.now()}`,
    title: `${project.title} · 样章`,
    content: "",
    updatedAt: new Date().toISOString(),
  };
  const [sample, setSample] = useState(currentSample.content);
  const sentenceLength = Math.max(8, Math.round(sample.length / 3));
  const diversity = Math.min(96, 48 + new Set(sample).size);
  async function saveSample() {
    const nextSample = {
      ...currentSample,
      content: sample,
      updatedAt: new Date().toISOString(),
    };

    await onProjectChange({}, {
      ...assets,
      styleSamples: [nextSample, ...assets.styleSamples.slice(1)],
    });
  }

  return (
    <div className={styles.toolTwoColumn}>
      <section className={styles.toolFormPanel}>
        <label>
          来源名称
          <input value={`${project.title} · 样章`} readOnly />
        </label>
        <label>
          文本样本
          <textarea
            rows={12}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
          />
        </label>
        <button className={styles.toolPrimaryButton} onClick={saveSample}>
          保存并分析文风
        </button>
      </section>
      <section className={styles.toolResultPanel}>
        <h2>分析结果</h2>
        <div className={styles.toolMetricGrid}>
          <article><span>平均句长</span><strong>{sentenceLength}</strong></article>
          <article><span>词汇多样性</span><strong>{diversity}%</strong></article>
          <article><span>段落密度</span><strong>中</strong></article>
          <article><span>情绪倾向</span><strong>克制</strong></article>
        </div>
        <div className={styles.tagGroup}>
          {["现实细节", "悬疑钩子", "冷色调", "人物内压"].map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function ImportTool({
  assets,
  project,
  onProjectChange,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
}) {
  const [tab, setTab] = useState<"chapters" | "canon" | "fanfic">("chapters");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function importMaterial() {
    if (!content.trim()) {
      return;
    }

    const material = {
      id: `import-${Date.now()}`,
      title: title.trim() || `${project.title} 导入素材`,
      type: tab,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextAssets = {
      ...assets,
      importedMaterials: [material, ...assets.importedMaterials],
      outline: tab === "chapters" ? content.trim() : assets.outline,
      worldNotes: tab === "canon" ? content.trim() : assets.worldNotes,
      settings: tab === "fanfic" ? content.trim() : assets.settings,
    };

    await onProjectChange(
      tab === "chapters" ? { currentStage: "chapter-plan" } : {},
      nextAssets,
    );
    setTitle("");
    setContent("");
  }

  return (
    <section className={styles.toolFormPanel}>
      <div className={styles.innerTabs}>
        {[
          ["chapters", "章节导入"],
          ["canon", "原作设定"],
          ["fanfic", "同人初始化"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? styles.activeInnerTab : ""}
            onClick={() => setTab(id as "chapters" | "canon" | "fanfic")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "chapters" ? (
        <>
          <input
            value={title}
            placeholder='素材标题或章节拆分规则'
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            rows={12}
            value={content}
            placeholder='粘贴需要导入的章节正文...'
            onChange={(event) => setContent(event.target.value)}
          />
          <button className={styles.toolPrimaryButton} onClick={importMaterial}>
            导入章节
          </button>
        </>
      ) : null}
      {tab === "canon" ? (
        <>
          <input
            value={title}
            placeholder='原作或资料来源'
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            rows={12}
            value={content}
            placeholder='粘贴原作设定、世界观或人物关系...'
            onChange={(event) => setContent(event.target.value)}
          />
          <button className={styles.toolPrimaryButton} onClick={importMaterial}>
            导入原作设定
          </button>
        </>
      ) : null}
      {tab === "fanfic" ? (
        <>
          <input
            value={title}
            placeholder='同人作品标题'
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            rows={10}
            value={content}
            placeholder='粘贴原作资料或世界观素材...'
            onChange={(event) => setContent(event.target.value)}
          />
          <button className={styles.toolPrimaryButton} onClick={importMaterial}>
            初始化同人项目
          </button>
        </>
      ) : null}
      {assets.importedMaterials.length > 0 ? (
        <div className={styles.importHistory}>
          {assets.importedMaterials.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.type} · {formatNovelRelativeAge(item.createdAt)}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RadarTool({
  assets,
  project,
  isRunningCoreAction,
  onRunCoreAction,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  isRunningCoreAction: boolean;
  onRunCoreAction: (action: InkosCoreAction) => Promise<void>;
}) {
  return (
    <div className={styles.toolTwoColumn}>
      <section className={styles.toolFormPanel}>
        <h2>市场扫描</h2>
        <p>
          使用 InkOS Core RadarAgent 扫描同题材趋势、标题简介卖点和章节留存风险。当前题材：{project.genre}
        </p>
        <button
          className={styles.toolPrimaryButton}
          disabled={isRunningCoreAction}
          onClick={() => void onRunCoreAction("radar")}
        >
          {isRunningCoreAction ? "扫描中" : "开始扫描"}
        </button>
      </section>
      <section className={styles.toolResultPanel}>
        <h2>推荐方向</h2>
        {assets.marketRadars.map((item) => (
          <article key={item.id} className={styles.radarResultItem}>
            <strong>{item.platform} · {item.genre}</strong>
            <span>{item.score}</span>
            <p>{item.concept}</p>
          </article>
        ))}
        {assets.marketRadars.length === 0 ? <p>暂无扫描结果。</p> : null}
      </section>
    </div>
  );
}

function DoctorTool({
  assets,
  project,
  isRunningCoreAction,
  onRunCoreAction,
}: {
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  isRunningCoreAction: boolean;
  onRunCoreAction: (action: InkosCoreAction) => Promise<void>;
}) {
  return (
    <section className={styles.toolFormPanel}>
      <h2>环境诊断</h2>
      <p>
        使用 InkOS Core StateValidatorAgent 校验《{project.title}》当前状态、伏笔和章节上下文。
      </p>
      <button
        className={styles.toolPrimaryButton}
        disabled={isRunningCoreAction}
        onClick={() => void onRunCoreAction("diagnostics")}
      >
        {isRunningCoreAction ? "诊断中" : "运行环境诊断"}
      </button>
      <div className={styles.doctorList}>
        {assets.diagnostics.map((check) => (
          <div key={check.id}>
            <span className={check.ok ? styles.checkOk : styles.checkWarn}>
              {check.ok ? "✓" : "!"}
            </span>
            <strong>{check.label}</strong>
            <em>{check.detail}</em>
          </div>
        ))}
        {assets.diagnostics.length === 0 ? (
          <div>
            <span className={styles.checkWarn}>!</span>
            <strong>未运行诊断</strong>
            <em>点击上方按钮生成当前书籍的环境诊断。</em>
          </div>
        ) : null}
      </div>
      <div className={styles.toolNotice}>诊断结果会保存到当前书籍资产中。</div>
    </section>
  );
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string };

function MarkdownContent({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div
      className={
        compact
          ? `${styles.markdownContent} ${styles.markdownContentCompact}`
          : styles.markdownContent
      }
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${Math.min(block.level + 2, 5)}` as
            | "h3"
            | "h4"
            | "h5";

          return <HeadingTag key={index}>{renderInlineMarkdown(block.text)}</HeadingTag>;
        }

        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          return <pre key={index}>{block.code}</pre>;
        }

        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push({ type: "code", code: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      const headingMarks = headingMatch[1] ?? "";
      const headingText = headingMatch[2] ?? "";

      blocks.push({
        type: "heading",
        level: headingMarks.length,
        text: headingText,
      });
      index += 1;
      continue;
    }

    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length) {
        const item = (lines[index] ?? "").trim();
        const itemMatch = item.match(/^([-*]|\d+\.)\s+(.+)$/);

        if (!itemMatch) break;

        items.push(itemMatch[2] ?? "");
        index += 1;
      }

      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      const nextTrimmed = nextLine.trim();

      if (
        !nextTrimmed ||
        nextTrimmed.startsWith("```") ||
        /^(#{1,4})\s+/.test(nextTrimmed) ||
        /^([-*]|\d+\.)\s+/.test(nextTrimmed)
      ) {
        break;
      }

      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: content }];
}

function renderInlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return part.split("\n").map((line, lineIndex, lineParts) => (
      <FragmentWithBreak
        key={`${index}-${lineIndex}`}
        line={line}
        showBreak={lineIndex < lineParts.length - 1}
      />
    ));
  });
}

function FragmentWithBreak({
  line,
  showBreak,
}: {
  line: string;
  showBreak: boolean;
}) {
  return (
    <>
      {line}
      {showBreak ? <br /> : null}
    </>
  );
}

function reviewSeverityLabel(severity: "info" | "warning" | "error") {
  if (severity === "error") return "严重";
  if (severity === "warning") return "警告";
  return "建议";
}

const KNOWLEDGE_ASSET_LABELS: Record<NovelKnowledgeAssetCategory, string> = {
  world: "世界观",
  character: "角色",
  foreshadowing: "伏笔",
  location: "地点",
  faction: "势力",
  item: "物品",
  term: "术语",
};

function isNovelKnowledgeAssetCategory(
  value: string,
): value is NovelKnowledgeAssetCategory {
  return Object.keys(KNOWLEDGE_ASSET_LABELS).includes(value);
}

function formatPendingCharacterStates(
  states: NovelPendingAssetDelta["characterStates"],
) {
  return states.map((state) => `${state.title}：${state.content}`).join("\n");
}

function parsePendingCharacterStates(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", ...rest] = line.split(/[：:]/);

      return {
        title: title.trim() || "未命名角色",
        content: rest.join("：").trim() || line,
      };
    });
}

function formatPendingAssetLines(items: string[]) {
  return items.join("\n");
}

function parsePendingAssetLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function NovelBookPanel({
  project,
  assets,
  chapters,
  chapterVersions,
  tasks,
  activeChapterId,
  stats,
  promptPreview,
  onChapterSelect,
  onChapterDraftSave,
  onChapterStatusChange,
  onChapterPublicationStatusChange,
  onChapterDelete,
  onChapterVersionRestore,
  onGenerateChapter,
  onReviseChapter,
  onRetryTask,
  onProjectChange,
  onRequestPrompt,
}: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters: StoredNovelChapter[];
  chapterVersions: StoredNovelChapterVersion[];
  tasks: StoredNovelTask[];
  activeChapterId: string;
  stats: ReturnType<typeof deriveNovelChapterProgress>;
  promptPreview: string;
  onChapterSelect: (chapterId: string) => void;
  onChapterDraftSave: (
    chapter: StoredNovelChapter,
    updates: Pick<StoredNovelChapter, "content" | "summary">,
  ) => Promise<void>;
  onChapterStatusChange: (
    chapter: StoredNovelChapter,
    status: StoredNovelChapter["status"],
  ) => Promise<void>;
  onChapterPublicationStatusChange: (
    chapter: StoredNovelChapter,
    status: NonNullable<StoredNovelChapter["publicationStatus"]>,
  ) => Promise<void>;
  onChapterDelete: (chapter: StoredNovelChapter) => Promise<void>;
  onChapterVersionRestore: (
    version: StoredNovelChapterVersion,
  ) => Promise<void>;
  onGenerateChapter: (target: NovelChapterWriteTarget) => Promise<void>;
  onReviseChapter: (selectedIssueIds?: string[]) => Promise<void>;
  onRetryTask: (task: StoredNovelTask) => void;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }) => Promise<string | null>;
}) {
  const chapterRows = mergeNovelChapterPlan(project, chapters);
  const activeRow =
    chapterRows.find((chapter) => chapter.key === activeChapterId) ??
    chapterRows.at(-1) ??
    null;
  const activeChapter = activeRow?.chapter ?? null;
  const latestVersion = chapterVersions[0] ?? null;
  const previousVersion = chapterVersions[1] ?? null;
  const [compareVersionId, setCompareVersionId] = useState("");
  const [isChapterEditorOpen, setIsChapterEditorOpen] = useState(false);
  const [chapterEditorContent, setChapterEditorContent] = useState("");
  const [chapterEditorSummary, setChapterEditorSummary] = useState("");
  const [isSavingChapterDraft, setIsSavingChapterDraft] = useState(false);
  const [chapterEditorSearch, setChapterEditorSearch] = useState("");
  const [chapterEditorReplacement, setChapterEditorReplacement] = useState("");
  const [chapterEditorSearchIndex, setChapterEditorSearchIndex] = useState(0);
  const [compareSearch, setCompareSearch] = useState("");
  const [isChapterEditorFullscreen, setIsChapterEditorFullscreen] =
    useState(false);
  const [chapterDraftSavedAt, setChapterDraftSavedAt] = useState("");
  const [hasRestoredLocalDraft, setHasRestoredLocalDraft] = useState(false);
  const [selectedReviewIssueIds, setSelectedReviewIssueIds] = useState<string[]>([]);
  const [reviewIssueFilter, setReviewIssueFilter] =
    useState<NovelReviewIssueFilter>("all");
  const [locatedReviewIssue, setLocatedReviewIssue] = useState<{
    issueKey: string;
    paragraphIndex: number;
    paragraph: string;
  } | null>(null);
  const chapterEditorTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const compareVersion = chapterVersions.find(
    (version) => version.id === compareVersionId,
  );
  const compareVersionIndex = compareVersion
    ? chapterVersions.findIndex((version) => version.id === compareVersion.id)
    : -1;
  const compareBaseVersion =
    compareVersionIndex >= 0 ? chapterVersions[compareVersionIndex + 1] : null;
  const compareView =
    compareVersion && compareBaseVersion
      ? buildNovelChapterVersionCompareView(compareBaseVersion, compareVersion)
      : null;
  const versionWordDelta =
    latestVersion && previousVersion
      ? latestVersion.wordCount - previousVersion.wordCount
      : 0;
  const activeReview =
    activeChapter?.reviews?.find(
      (review) => review.id === activeChapter.activeReviewId,
    ) ?? activeChapter?.reviews?.[0] ?? null;
  const reviewIssueViews = activeChapter
    ? buildNovelReviewIssueViews(
        activeChapter.reviews ?? [],
        activeChapter.activeReviewId,
      )
    : [];
  const filteredReviewIssueViews = filterNovelReviewIssueViews(
    reviewIssueViews,
    reviewIssueFilter,
  );
  const openReviewIssueCount = reviewIssueViews.filter(
    (issue) => !issue.resolved,
  ).length;
  const resolvedReviewIssueCount = reviewIssueViews.filter(
    (issue) => issue.resolved,
  ).length;
  const currentReviewIssueCount = reviewIssueViews.filter(
    (issue) => issue.isCurrentReview,
  ).length;
  const chapterDraftMeta = buildNovelChapterDraftMeta(
    chapterEditorContent,
    chapterEditorSummary,
  );
  const editorSearchState = buildNovelEditorSearchState(
    chapterEditorContent,
    chapterEditorSearch,
    chapterEditorSearchIndex,
  );
  const paragraphNavigation = buildNovelChapterParagraphNavigation(
    chapterEditorContent || activeChapter?.content || "",
    activeRow?.targetWords ?? project.chapterWordCount ?? 0,
  );
  const reviewIssueHighlights =
    activeChapter && reviewIssueViews.length > 0
      ? buildNovelReviewIssueHighlights(activeChapter.content, reviewIssueViews)
      : [];
  const generatedRows = chapterRows.filter((row) => row.chapter);
  const activeGeneratedIndex = activeChapter
    ? generatedRows.findIndex((row) => row.chapter?.id === activeChapter.id)
    : -1;
  const previousGeneratedRow =
    activeGeneratedIndex > 0 ? generatedRows[activeGeneratedIndex - 1] : null;
  const nextGeneratedRow =
    activeGeneratedIndex >= 0
      ? generatedRows[activeGeneratedIndex + 1] ?? null
      : null;
  const filteredComparePreviousLines =
    compareView && compareSearch.trim()
      ? compareView.previousLines.filter((line) =>
          line.text.toLowerCase().includes(compareSearch.trim().toLowerCase()),
        )
      : compareView?.previousLines ?? [];
  const filteredCompareNextLines =
    compareView && compareSearch.trim()
      ? compareView.nextLines.filter((line) =>
          line.text.toLowerCase().includes(compareSearch.trim().toLowerCase()),
        )
      : compareView?.nextLines ?? [];
  const chapterDraftStorageKey = activeChapter
    ? `sxy-novel-chapter-draft:${activeChapter.id}`
    : "";
  const isChapterDraftDirty =
    Boolean(activeChapter) &&
    (chapterEditorContent !== activeChapter?.content ||
      chapterEditorSummary !== activeChapter?.summary);

  useEffect(() => {
    const nextContent = activeChapter?.content ?? "";
    const nextSummary = activeChapter?.summary ?? "";
    let restoredDraft = false;
    let restoredSavedAt = "";

    if (activeChapter?.id && typeof window !== "undefined") {
      const draftKey = `sxy-novel-chapter-draft:${activeChapter.id}`;
      const rawDraft = window.localStorage.getItem(draftKey);

      if (rawDraft) {
        try {
          const draft = JSON.parse(rawDraft) as {
            content?: unknown;
            summary?: unknown;
            savedAt?: unknown;
          };
          const draftContent =
            typeof draft.content === "string" ? draft.content : nextContent;
          const draftSummary =
            typeof draft.summary === "string" ? draft.summary : nextSummary;

          if (draftContent !== nextContent || draftSummary !== nextSummary) {
            setChapterEditorContent(draftContent);
            setChapterEditorSummary(draftSummary);
            restoredDraft = true;
            restoredSavedAt =
              typeof draft.savedAt === "string" ? draft.savedAt : "";
          } else {
            window.localStorage.removeItem(draftKey);
          }
        } catch {
          window.localStorage.removeItem(draftKey);
        }
      }
    }

    if (!restoredDraft) {
      setChapterEditorContent(nextContent);
      setChapterEditorSummary(nextSummary);
    }
    setIsSavingChapterDraft(false);
    setChapterEditorSearch("");
    setChapterEditorReplacement("");
    setChapterEditorSearchIndex(0);
    setCompareSearch("");
    setChapterDraftSavedAt(restoredSavedAt);
    setHasRestoredLocalDraft(restoredDraft);
    setIsChapterEditorFullscreen(false);
    setSelectedReviewIssueIds([]);
    setReviewIssueFilter("all");
    setLocatedReviewIssue(null);
  }, [activeChapter?.id, activeChapter?.content, activeChapter?.summary]);

  useEffect(() => {
    if (
      !activeChapter ||
      !chapterDraftStorageKey ||
      !isChapterEditorOpen ||
      !isChapterDraftDirty ||
      typeof window === "undefined"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(
        chapterDraftStorageKey,
        JSON.stringify({
          content: chapterEditorContent,
          summary: chapterEditorSummary,
          savedAt,
        }),
      );
      setChapterDraftSavedAt(savedAt);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeChapter,
    chapterDraftStorageKey,
    chapterEditorContent,
    chapterEditorSummary,
    isChapterDraftDirty,
    isChapterEditorOpen,
  ]);

  useEffect(() => {
    if (!locatedReviewIssue || !isChapterEditorOpen) {
      return;
    }

    const textarea = chapterEditorTextAreaRef.current;
    if (!textarea) {
      return;
    }

    const start = chapterEditorContent.indexOf(locatedReviewIssue.paragraph);
    textarea.focus();
    if (start >= 0) {
      textarea.setSelectionRange(start, start + locatedReviewIssue.paragraph.length);
    }
  }, [chapterEditorContent, isChapterEditorOpen, locatedReviewIssue]);

  function locateReviewIssue(issue: (typeof reviewIssueViews)[number]) {
    if (!activeChapter) {
      return;
    }

    const location = findNovelReviewIssueParagraph(activeChapter.content, issue);
    if (!location) {
      setLocatedReviewIssue({
        issueKey: `${issue.reviewId}:${issue.id}`,
        paragraphIndex: -1,
        paragraph: "没有在正文中匹配到明确段落，可以根据原文片段手动定位。",
      });
      setIsChapterEditorOpen(true);
      return;
    }

    setLocatedReviewIssue({
      issueKey: `${issue.reviewId}:${issue.id}`,
      paragraphIndex: location.index,
      paragraph: location.paragraph,
    });
    setIsChapterEditorOpen(true);
  }

  function exportActiveChapterReview() {
    if (!activeChapter) {
      return;
    }

    downloadTextFile(
      `${project.title}-第${activeChapter.number}章-审稿报告.md`,
      buildNovelReviewExportMarkdown({
        bookTitle: project.title,
        chapter: activeChapter,
      }),
      "text/markdown;charset=utf-8",
    );
  }

  function applyReviewIssueSuggestion(issue: (typeof reviewIssueViews)[number]) {
    if (!activeChapter) {
      return;
    }

    const result = applyNovelReviewIssueSuggestionToContent(
      isChapterEditorOpen ? chapterEditorContent : activeChapter.content,
      issue,
    );

    if (!result.applied) {
      setLocatedReviewIssue({
        issueKey: `${issue.reviewId}:${issue.id}`,
        paragraphIndex: -1,
        paragraph: result.reason ?? "没有可应用的段落级修改建议。",
      });
      setIsChapterEditorOpen(true);
      return;
    }

    const paragraphs = result.content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    setChapterEditorContent(result.content);
    setLocatedReviewIssue({
      issueKey: `${issue.reviewId}:${issue.id}`,
      paragraphIndex: result.paragraphIndex,
      paragraph:
        paragraphs[result.paragraphIndex] ??
        "已应用建议，请检查章节正文后保存版本。",
    });
    setIsChapterEditorOpen(true);
  }

  function selectEditorSearchMatch(index: number) {
    const match = editorSearchState.matches[index];
    const textarea = chapterEditorTextAreaRef.current;
    if (!match || !textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
  }

  function moveEditorSearchMatch(direction: 1 | -1) {
    if (editorSearchState.count === 0) {
      return;
    }

    const nextIndex =
      (editorSearchState.activeIndex + direction + editorSearchState.count) %
      editorSearchState.count;
    setChapterEditorSearchIndex(nextIndex);
    window.setTimeout(() => selectEditorSearchMatch(nextIndex), 0);
  }

  function replaceEditorMatch(mode: "current" | "all") {
    if (editorSearchState.count === 0) {
      return;
    }

    const nextContent = replaceNovelEditorSearchMatches(
      chapterEditorContent,
      chapterEditorSearch,
      chapterEditorReplacement,
      mode,
      editorSearchState.activeIndex,
    );
    setChapterEditorContent(nextContent);
    setChapterEditorSearchIndex(0);
  }

  function jumpToParagraph(paragraphIndex: number) {
    const paragraph = paragraphNavigation.paragraphs[paragraphIndex];
    const textarea = chapterEditorTextAreaRef.current;

    if (!paragraph || !textarea) {
      return;
    }

    setIsChapterEditorOpen(true);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(paragraph.start, paragraph.end);
    }, 0);
  }

  function exportActiveChapter(format: "markdown" | "text" | "docx") {
    if (!activeChapter) {
      return;
    }

    const title = `第${activeChapter.number}章-${activeChapter.title}`;
    const markdown = [
      `# 第 ${activeChapter.number} 章 ${activeChapter.title}`,
      "",
      activeChapter.summary ? `> ${activeChapter.summary}` : "",
      "",
      activeChapter.content,
    ]
      .filter(Boolean)
      .join("\n");

    if (format === "markdown") {
      downloadTextFile(`${title}.md`, markdown, "text/markdown;charset=utf-8");
    } else if (format === "text") {
      downloadTextFile(`${title}.txt`, activeChapter.content, "text/plain;charset=utf-8");
    } else {
      downloadBytesFile(
        `${title}.docx`,
        createSimpleDocxFile(title, activeChapter.content),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    }
  }

  function restoreCompareLine(lineText: string) {
    if (!lineText.trim()) {
      return;
    }

    setChapterEditorContent((current) =>
      current.trim() ? `${current}\n\n${lineText}` : lineText,
    );
    setIsChapterEditorOpen(true);
  }

  function discardChapterLocalDraft() {
    if (!activeChapter) {
      return;
    }

    if (chapterDraftStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(chapterDraftStorageKey);
    }
    setChapterEditorContent(activeChapter.content);
    setChapterEditorSummary(activeChapter.summary);
    setChapterDraftSavedAt("");
    setHasRestoredLocalDraft(false);
    setChapterEditorSearchIndex(0);
  }

  async function saveChapterEditor() {
    if (!activeChapter || !isChapterDraftDirty || isSavingChapterDraft) {
      return;
    }

    setIsSavingChapterDraft(true);
    try {
      await onChapterDraftSave(activeChapter, {
        content: chapterEditorContent,
        summary: chapterEditorSummary,
      });
      if (chapterDraftStorageKey && typeof window !== "undefined") {
        window.localStorage.removeItem(chapterDraftStorageKey);
      }
      setChapterDraftSavedAt("");
      setHasRestoredLocalDraft(false);
      setIsChapterEditorOpen(false);
    } finally {
      setIsSavingChapterDraft(false);
    }
  }

  async function editAsset(
    label: string,
    key: keyof Pick<
      NovelProjectAssets,
      "outline" | "worldNotes" | "characters" | "settings"
    >,
  ) {
    const nextValue = await onRequestPrompt({
      title: label,
      initialValue: String(assets[key] ?? ""),
      multiline: true,
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    const nextAssets = {
      ...assets,
      [key]: nextValue,
    };
    const projectUpdates: Partial<InkosNovelProject> =
      key === "worldNotes"
        ? { world: nextValue }
        : key === "characters"
          ? { protagonist: nextValue }
          : key === "settings"
            ? { premise: nextValue }
            : {};

    await onProjectChange(projectUpdates, nextAssets);
  }

  async function saveAssets(
    nextAssets: NovelProjectAssets,
    projectUpdates: Partial<InkosNovelProject> = {},
  ) {
    await onProjectChange(projectUpdates, nextAssets);
  }

  async function addOutlineNode() {
    const title = await onRequestPrompt({
      title: "新增章节计划",
      message: "输入章节标题。",
      initialValue: `第 ${assets.outlineNodes.length + 1} 章`,
      confirmLabel: "创建",
    });

    if (!title?.trim()) {
      return;
    }

    const chapterNumber =
      Math.max(0, ...assets.outlineNodes.map((node) => node.chapterNumber)) + 1;
    const node: NovelOutlineNode = {
      id: `outline-${Date.now()}`,
      volume: `第 ${Math.max(1, Math.ceil(chapterNumber / 20))} 卷`,
      chapterNumber,
      title: title.trim(),
      goal: "推进主线并制造新的悬念。",
      conflict: "",
      characters: "",
      information: "",
      foreshadowing: "",
      targetWords: project.chapterWordCount ?? 3000,
      status: "planned",
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      outlineNodes: [...assets.outlineNodes, node],
    });
  }

  async function editOutlineNode(
    node: NovelOutlineNode,
    field: keyof Pick<
      NovelOutlineNode,
      | "title"
      | "volume"
      | "goal"
      | "conflict"
      | "characters"
      | "information"
      | "foreshadowing"
      | "targetWords"
    >,
  ) {
    const nextValue = await onRequestPrompt({
      title: `编辑章节计划：${node.title}`,
      message: field === "targetWords" ? "输入目标字数。" : undefined,
      initialValue: String(node[field] ?? ""),
      multiline: field !== "title" && field !== "volume" && field !== "targetWords",
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    const nextNode = {
      ...node,
      [field]:
        field === "targetWords"
          ? Math.max(500, Number(nextValue) || node.targetWords)
          : nextValue,
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      outlineNodes: assets.outlineNodes.map((item) =>
        item.id === node.id ? nextNode : item,
      ),
    });
  }

  async function deleteOutlineNode(node: NovelOutlineNode) {
    await saveAssets({
      ...assets,
      outlineNodes: assets.outlineNodes.filter((item) => item.id !== node.id),
    });
  }

  async function syncOutlineToProject() {
    const nextProject = syncNovelProjectFromOutlineNodes(
      project,
      assets.outlineNodes,
    );
    const outline = assets.outlineNodes
      .sort((left, right) => left.chapterNumber - right.chapterNumber)
      .map(
        (node) =>
          `${node.chapterNumber}. ${node.title}：${node.goal || node.information}`,
      )
      .join("\n");

    await saveAssets({ ...assets, outline }, nextProject);
  }

  async function createKnowledgeAsset() {
    const categoryInput = await onRequestPrompt({
      title: "新建设定资产",
      message: "类型可填 world / character / foreshadowing / location / faction / item / term。",
      initialValue: "character",
      confirmLabel: "下一步",
    });
    const category = categoryInput?.trim() ?? "";

    if (!isNovelKnowledgeAssetCategory(category)) {
      return;
    }

    const title = await onRequestPrompt({
      title: `新建${KNOWLEDGE_ASSET_LABELS[category]}`,
      initialValue: KNOWLEDGE_ASSET_LABELS[category],
      confirmLabel: "下一步",
    });

    if (!title?.trim()) {
      return;
    }

    const content = await onRequestPrompt({
      title: `填写${title.trim()}内容`,
      multiline: true,
      confirmLabel: "保存",
    });

    if (content === null) {
      return;
    }

    const nextAsset: NovelKnowledgeAsset = {
      id: `knowledge-${Date.now()}`,
      category,
      title: title.trim(),
      content,
      status: "active",
      tags: [],
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      knowledgeAssets: [nextAsset, ...assets.knowledgeAssets],
    });
  }

  async function editKnowledgeAsset(
    item: NovelKnowledgeAsset,
    field: keyof Pick<NovelKnowledgeAsset, "title" | "content" | "status" | "tags">,
  ) {
    const nextValue = await onRequestPrompt({
      title: `编辑${item.title}`,
      message:
        field === "tags"
          ? "多个标签用逗号分隔。"
          : field === "status"
            ? "可填 active / draft / resolved。"
            : undefined,
      initialValue:
        field === "tags" ? item.tags.join(", ") : String(item[field] ?? ""),
      multiline: field === "content",
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    const nextItem: NovelKnowledgeAsset = {
      ...item,
      [field]:
        field === "tags"
          ? nextValue
              .split(/[,，]/)
              .map((tag) => tag.trim())
              .filter(Boolean)
          : field === "status" &&
              ["active", "draft", "resolved"].includes(nextValue)
            ? (nextValue as NovelKnowledgeAsset["status"])
            : nextValue,
      updatedAt: new Date().toISOString(),
    };

    await saveAssets({
      ...assets,
      knowledgeAssets: assets.knowledgeAssets.map((asset) =>
        asset.id === item.id ? nextItem : asset,
      ),
    });
  }

  async function deleteKnowledgeAsset(item: NovelKnowledgeAsset) {
    await saveAssets({
      ...assets,
      knowledgeAssets: assets.knowledgeAssets.filter(
        (asset) => asset.id !== item.id,
      ),
    });
  }

  async function confirmPendingAssetDelta(item: NovelPendingAssetDelta) {
    await saveAssets(applyNovelPendingAssetDelta(assets, item.id));
  }

  async function dismissPendingAssetDelta(item: NovelPendingAssetDelta) {
    await saveAssets(dismissNovelPendingAssetDelta(assets, item.id));
  }

  async function editPendingAssetDelta(
    item: NovelPendingAssetDelta,
    field:
      | "summary"
      | "characterStates"
      | "newForeshadowing"
      | "resolvedForeshadowing"
      | "worldIncrements",
  ) {
    const titleMap = {
      summary: "编辑章节摘要",
      characterStates: "编辑角色状态",
      newForeshadowing: "编辑新增伏笔",
      resolvedForeshadowing: "编辑回收伏笔",
      worldIncrements: "编辑世界观增量",
    };
    const initialValue =
      field === "characterStates"
        ? formatPendingCharacterStates(item.characterStates)
        : field === "summary"
          ? item.summary
          : formatPendingAssetLines(item[field]);
    const nextValue = await onRequestPrompt({
      title: titleMap[field],
      message:
        field === "characterStates"
          ? "一行一个，格式：角色名：状态变化。"
          : field === "summary"
            ? undefined
            : "一行一个，可直接删除误提取的条目。",
      initialValue,
      multiline: true,
      confirmLabel: "保存",
    });

    if (nextValue === null) {
      return;
    }

    await saveAssets(
      updateNovelPendingAssetDelta(assets, item.id, {
        [field]:
          field === "characterStates"
            ? parsePendingCharacterStates(nextValue)
            : field === "summary"
              ? nextValue.trim()
              : parsePendingAssetLines(nextValue),
      }),
    );
  }

  async function updateContextSelection(
    updates: Partial<NovelContextSelection>,
  ) {
    await saveAssets({
      ...assets,
      contextSelection: {
        ...assets.contextSelection,
        ...updates,
      },
    });
  }

  return (
    <aside className={styles.bookContextPanel}>
      <section>
        <h2>书籍信息</h2>
        <div className={styles.bookProgress}>
          <span>生成进度</span>
          <strong>{stats.generatedPercent}%</strong>
          <em>
            已生成 {stats.generatedChapters} / {stats.totalChapters} 章
          </em>
          <div className={styles.bookProgressMetrics}>
            <span>已定稿 {stats.approvedChapters} 章</span>
            <span>待审稿 {stats.readyForReviewChapters} 章</span>
          </div>
        </div>
      </section>

      <section>
        <h2>章节</h2>
        <div className={styles.compactChapterList}>
          {chapterRows.length > 0 ? (
            chapterRows.map((chapter) => (
              <button
                key={chapter.key}
                className={
                  chapter.key === activeRow?.key
                    ? styles.activeCompactChapter
                    : ""
                }
                onClick={() => onChapterSelect(chapter.key)}
              >
                <span>{chapter.number}</span>
                <strong>{chapter.title}</strong>
                <em>
                  {INKOS_STATUS_LABELS[chapter.status]}
                  {chapter.generated ? ` · ${chapter.wordCount} 字` : " · 未生成"}
                </em>
              </button>
            ))
          ) : (
            <div>
              <span>-</span>
              <strong>暂无章节</strong>
              <em>点击“写下一章”后会自动保存正文</em>
            </div>
          )}
        </div>
      </section>

      {activeRow ? (
        <section>
          <div className={styles.chapterDetailHeader}>
            <h2>章节详情</h2>
            {activeChapter ? (
              <select
                value={activeChapter.status}
                onChange={(event) =>
                  void onChapterStatusChange(
                    activeChapter,
                    event.target.value as StoredNovelChapter["status"],
                  )
                }
              >
                {Object.entries(INKOS_STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={styles.chapterPlanBadge}>计划章节</span>
            )}
          </div>
          <div className={styles.chapterDetailMeta}>
            <strong>第 {activeRow.number} 章 · {activeRow.title}</strong>
            {activeChapter ? (
              <span>
                {activeChapter.wordCount} 字 / 更新于{" "}
                {formatNovelRelativeAge(activeChapter.updatedAt)}前
              </span>
            ) : (
              <span>
                目标 {activeRow.targetWords} 字 / {INKOS_STATUS_LABELS[activeRow.status]}
              </span>
            )}
          </div>
          <div className={styles.chapterDetailActions}>
            {activeChapter ? (
              <>
                <select
                  value={activeChapter.publicationStatus ?? "draft"}
                  onChange={(event) =>
                    void onChapterPublicationStatusChange(
                      activeChapter,
                      event.target
                        .value as NonNullable<StoredNovelChapter["publicationStatus"]>,
                    )
                  }
                >
                  <option value='draft'>未发布</option>
                  <option value='ready'>待发布</option>
                  <option value='published'>已发布</option>
                </select>
                <button
                  onClick={() => setIsChapterEditorOpen((isOpen) => !isOpen)}
                >
                  {isChapterEditorOpen ? "收起编辑器" : "编辑章节"}
                </button>
                <button
                  onClick={() =>
                    void onReviseChapter(
                      selectedReviewIssueIds.length > 0
                        ? selectedReviewIssueIds
                        : undefined,
                    )
                  }
                >
                  {selectedReviewIssueIds.length > 0
                    ? `修订选中问题 (${selectedReviewIssueIds.length})`
                    : "根据审稿修订"}
                </button>
                <button
                  className={styles.dangerTextButton}
                  onClick={() => void onChapterDelete(activeChapter)}
                >
                  删除
                </button>
                <button onClick={() => exportActiveChapter("markdown")}>
                  导出 MD
                </button>
                <button onClick={() => exportActiveChapter("text")}>
                  导出 TXT
                </button>
                <button onClick={() => exportActiveChapter("docx")}>
                  导出 docx
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  void onGenerateChapter({
                    number: activeRow.number,
                    title: activeRow.title,
                    focus: activeRow.focus,
                    targetWords: activeRow.targetWords,
                    reason: "planned",
                  })
                }
              >
                生成本章
              </button>
            )}
          </div>
          {activeChapter?.reviewNotes &&
          activeChapter.status === "ready-for-review" ? (
            <div className={styles.chapterRevisionNotice}>
              <strong>修订后建议重新审稿</strong>
              <span>
                当前章节已有审稿记录且状态为待审稿。再次点击“审稿”可以验证修订是否解决问题。
              </span>
            </div>
          ) : null}
          <div className={styles.chapterDetailBlock}>
            <span>{activeChapter ? "摘要" : "章节计划"}</span>
            <p>{activeChapter?.summary || activeRow.focus || "暂无计划。"}</p>
          </div>
          {activeChapter ? (
            <>
              {isChapterEditorOpen ? (
                <div
                  className={`${styles.chapterEditorPanel} ${
                    isChapterEditorFullscreen
                      ? styles.chapterEditorFullscreen
                      : ""
                  }`}
                >
                  <div className={styles.chapterEditorHeader}>
                    <div>
                      <strong>章节正文编辑器</strong>
                      <span>
                        {chapterDraftMeta.wordCount} 字 /{" "}
                        {chapterDraftMeta.paragraphCount} 段 /{" "}
                        {chapterDraftMeta.hasSummary ? "摘要完整" : "暂无摘要"}
                      </span>
                      <span>
                        目标 {paragraphNavigation.targetWords || activeRow.targetWords} 字 /{" "}
                        {paragraphNavigation.targetPercent}% 完成
                      </span>
                      <span>
                        {chapterDraftSavedAt
                          ? `自动保存于 ${formatNovelRelativeAge(chapterDraftSavedAt)}前`
                          : isChapterDraftDirty
                            ? "本地草稿等待自动保存"
                            : "已与章节版本同步"}
                      </span>
                    </div>
                    <div>
                      <button
                        disabled={!previousGeneratedRow}
                        onClick={() =>
                          previousGeneratedRow && onChapterSelect(previousGeneratedRow.key)
                        }
                      >
                        上一章
                      </button>
                      <button
                        disabled={!nextGeneratedRow}
                        onClick={() =>
                          nextGeneratedRow && onChapterSelect(nextGeneratedRow.key)
                        }
                      >
                        下一章
                      </button>
                      <button
                        onClick={() =>
                          setIsChapterEditorFullscreen((current) => !current)
                        }
                      >
                        {isChapterEditorFullscreen ? "退出全屏" : "全屏"}
                      </button>
                      <button
                        onClick={discardChapterLocalDraft}
                        disabled={
                          (!isChapterDraftDirty && !hasRestoredLocalDraft) ||
                          isSavingChapterDraft
                        }
                      >
                        还原
                      </button>
                      <button
                        className={styles.chapterEditorSaveButton}
                        onClick={() => void saveChapterEditor()}
                        disabled={!isChapterDraftDirty || isSavingChapterDraft}
                      >
                        {isSavingChapterDraft ? "保存中" : "保存版本"}
                      </button>
                    </div>
                  </div>
                  {hasRestoredLocalDraft ? (
                    <div className={styles.chapterDraftNotice}>
                      <div>
                        <strong>已恢复本地草稿</strong>
                        <span>
                          上次未保存的编辑已载入，可以继续保存为章节版本。
                        </span>
                      </div>
                      <button onClick={discardChapterLocalDraft}>丢弃草稿</button>
                    </div>
                  ) : null}
                  <div className={styles.chapterEditorTools}>
                    <label>
                      查找
                      <input
                        value={chapterEditorSearch}
                        onChange={(event) => {
                          setChapterEditorSearch(event.target.value);
                          setChapterEditorSearchIndex(0);
                        }}
                        placeholder="输入关键词"
                      />
                    </label>
                    <label>
                      替换为
                      <input
                        value={chapterEditorReplacement}
                        onChange={(event) =>
                          setChapterEditorReplacement(event.target.value)
                        }
                        placeholder="替换文本"
                      />
                    </label>
                    <span className={styles.chapterEditorSearchMeta}>
                      {editorSearchState.count > 0
                        ? `${editorSearchState.activeIndex + 1} / ${
                            editorSearchState.count
                          }`
                        : "0 / 0"}
                    </span>
                    <button
                      onClick={() => moveEditorSearchMatch(-1)}
                      disabled={editorSearchState.count === 0}
                    >
                      上一个
                    </button>
                    <button
                      onClick={() => moveEditorSearchMatch(1)}
                      disabled={editorSearchState.count === 0}
                    >
                      下一个
                    </button>
                    <button
                      onClick={() => replaceEditorMatch("current")}
                      disabled={editorSearchState.count === 0}
                    >
                      替换
                    </button>
                    <button
                      onClick={() => replaceEditorMatch("all")}
                      disabled={editorSearchState.count === 0}
                    >
                      全部替换
                    </button>
                  </div>
                  <label>
                    章节摘要
                    <textarea
                      rows={4}
                      value={chapterEditorSummary}
                      onChange={(event) =>
                        setChapterEditorSummary(event.target.value)
                      }
                    />
                  </label>
                  <div className={styles.chapterParagraphNavigator}>
                    <div>
                      <span>段落导航</span>
                      <em>
                        {paragraphNavigation.wordCount} /{" "}
                        {paragraphNavigation.targetWords || activeRow.targetWords} 字
                      </em>
                    </div>
                    <div className={styles.chapterWordProgress}>
                      <span
                        style={{
                          width: `${paragraphNavigation.targetPercent}%`,
                        }}
                      />
                    </div>
                    <div>
                      {paragraphNavigation.paragraphs.slice(0, 12).map((paragraph) => (
                        <button
                          key={paragraph.index}
                          type='button'
                          onClick={() => jumpToParagraph(paragraph.index)}
                        >
                          {paragraph.index + 1}. {paragraph.preview}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    章节正文
                    <textarea
                      ref={chapterEditorTextAreaRef}
                      rows={isChapterEditorFullscreen ? 28 : 18}
                      value={chapterEditorContent}
                      onChange={(event) =>
                        setChapterEditorContent(event.target.value)
                      }
                    />
                  </label>
                  {locatedReviewIssue ? (
                    <div className={styles.reviewIssueLocatedPanel}>
                      <strong>
                        {locatedReviewIssue.paragraphIndex >= 0
                          ? `已定位到第 ${locatedReviewIssue.paragraphIndex + 1} 段`
                          : "未匹配到明确段落"}
                      </strong>
                      <p>{locatedReviewIssue.paragraph}</p>
                    </div>
                  ) : null}
                  <div className={styles.chapterEditorPreview}>
                    <span>预览</span>
                    <MarkdownContent
                      content={
                        chapterEditorContent.trim() ||
                        "正文为空，保存前可以先补充内容。"
                      }
                      compact
                    />
                  </div>
                </div>
              ) : null}
              <div className={styles.chapterDetailBlock}>
                <span>正文预览</span>
                <MarkdownContent
                  content={
                    activeChapter.content.length > 600
                      ? `${activeChapter.content.slice(0, 600)}...`
                      : activeChapter.content
                  }
                  compact
                />
              </div>
              {activeChapter.reviewNotes ? (
                <div className={styles.chapterDetailBlock}>
                  <span>审稿记录</span>
                  {activeReview ? (
                    <div className={styles.reviewInsightCard}>
                      <div>
                        <strong>
                          {activeReview.verdict === "approved"
                            ? "审稿通过"
                            : "需要修订"}
                        </strong>
                        {activeReview.score !== undefined ? (
                          <em>{activeReview.score} 分</em>
                        ) : null}
                      </div>
                      <div className={styles.reviewInsightMeta}>
                        <span>未解决 {openReviewIssueCount}</span>
                        <span>已解决 {resolvedReviewIssueCount}</span>
                        <span>本轮 {currentReviewIssueCount}</span>
                      </div>
                      <div className={styles.reviewIssueFilters}>
                        {(
                          [
                            ["all", "全部"],
                            ["open", "未解决"],
                            ["resolved", "已解决"],
                            ["current", "本轮新增"],
                            ["history", "历史问题"],
                          ] satisfies Array<[NovelReviewIssueFilter, string]>
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            className={
                              reviewIssueFilter === value
                                ? styles.activeReviewIssueFilter
                                : ""
                            }
                            onClick={() => setReviewIssueFilter(value)}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          type='button'
                          onClick={exportActiveChapterReview}
                        >
                          导出报告
                        </button>
                      </div>
                      <MarkdownContent content={activeReview.summary} compact />
                      {reviewIssueHighlights.length > 0 ? (
                        <div className={styles.reviewHighlightList}>
                          <span>正文高亮定位</span>
                          {reviewIssueHighlights.slice(0, 6).map((highlight) => (
                            <button
                              key={highlight.key}
                              type='button'
                              onClick={() => jumpToParagraph(highlight.paragraphIndex)}
                            >
                              第 {highlight.paragraphIndex + 1} 段 ·{" "}
                              {highlight.issue.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {filteredReviewIssueViews.length > 0 ? (
                        <ul className={styles.reviewIssueList}>
                          {filteredReviewIssueViews.slice(0, 8).map((issue) => (
                            <li key={`${issue.reviewId}-${issue.id}`}>
                              <label className={styles.reviewIssueSelect}>
                                <input
                                  type='checkbox'
                                  disabled={issue.resolved}
                                  checked={selectedReviewIssueIds.includes(
                                    `${issue.reviewId}:${issue.id}`,
                                  )}
                                  onChange={(event) => {
                                    const key = `${issue.reviewId}:${issue.id}`;
                                    setSelectedReviewIssueIds((current) =>
                                      event.target.checked
                                        ? [...current, key]
                                        : current.filter((item) => item !== key),
                                    );
                                  }}
                                />
                                <b>{reviewSeverityLabel(issue.severity)}</b>
                              </label>
                              <span>{issue.detail}</span>
                              <div className={styles.reviewIssueStructure}>
                                <small>{issue.type ?? "other"}</small>
                                {issue.paragraphHint ? (
                                  <small>{issue.paragraphHint}</small>
                                ) : null}
                                {issue.excerpt ? (
                                  <small>原文：{issue.excerpt}</small>
                                ) : null}
                                {issue.suggestion ? (
                                  <small>建议：{issue.suggestion}</small>
                                ) : null}
                              </div>
                              <div className={styles.reviewIssueStatus}>
                                <small
                                  className={
                                    issue.resolved
                                      ? styles.reviewIssueResolved
                                      : styles.reviewIssueOpen
                                  }
                                >
                                  {issue.statusLabel}
                                </small>
                                <small className={styles.reviewIssueOrigin}>
                                  {issue.originLabel}
                                </small>
                                <button
                                  type='button'
                                  onClick={() => locateReviewIssue(issue)}
                                >
                                  定位
                                </button>
                                {issue.suggestion && !issue.resolved ? (
                                  <button
                                    type='button'
                                    onClick={() =>
                                      applyReviewIssueSuggestion(issue)
                                    }
                                  >
                                    应用建议
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>当前筛选下没有审稿问题。</p>
                      )}
                    </div>
                  ) : null}
                  <MarkdownContent content={activeChapter.reviewNotes} compact />
                </div>
              ) : null}
              <div className={styles.chapterDetailBlock}>
                <span>版本记录</span>
                {latestVersion && previousVersion ? (
                  <div className={styles.chapterVersionDelta}>
                    较上一版{" "}
                    {versionWordDelta >= 0 ? `+${versionWordDelta}` : versionWordDelta}{" "}
                    字 / {formatNovelChapterVersionSource(previousVersion.source)}
                    {" -> "}
                    {formatNovelChapterVersionSource(latestVersion.source)}
                  </div>
                ) : null}
                {chapterVersions.length > 0 ? (
                  <div className={styles.chapterVersionList}>
                    {chapterVersions.slice(0, 6).map((version, index) => (
                      <div key={version.id} className={styles.chapterVersionItem}>
                        <div>
                          <strong>
                            {formatNovelChapterVersionSource(version.source)}
                            {index === 0 ? " · 当前" : ""}
                          </strong>
                          <span>
                            {version.wordCount} 字 /{" "}
                            {formatNovelRelativeAge(version.createdAt)}前
                          </span>
                          {version.note ? <em>{version.note}</em> : null}
                        </div>
                        <button
                          disabled={index === 0}
                          onClick={() => void onChapterVersionRestore(version)}
                        >
                          恢复
                        </button>
                        <button
                          disabled={index >= chapterVersions.length - 1}
                          onClick={() =>
                            setCompareVersionId(
                              compareVersionId === version.id ? "" : version.id,
                            )
                          }
                        >
                          对比
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>暂无版本记录。生成、审稿、修订或手动编辑后会自动保存。</p>
                )}
                {compareVersion && compareBaseVersion && compareView ? (
                  <div className={styles.chapterVersionCompare}>
                    <div className={styles.chapterVersionCompareHeader}>
                      <div>
                        <strong>版本对比</strong>
                        <span>
                          {formatNovelChapterVersionSource(compareBaseVersion.source)}
                          {" -> "}
                          {formatNovelChapterVersionSource(compareVersion.source)}
                        </span>
                      </div>
                      <em>
                        字数{" "}
                        {compareView.wordDelta >= 0
                          ? `+${compareView.wordDelta}`
                          : compareView.wordDelta}
                        {" / "}
                        新增 {compareView.addedCount} / 移除{" "}
                        {compareView.removedCount}
                      </em>
                      <input
                        value={compareSearch}
                        onChange={(event) => setCompareSearch(event.target.value)}
                        placeholder='搜索差异'
                      />
                    </div>
                    {compareVersion.revisedFromReviewId ? (
                      <span>
                        处理审稿：{compareVersion.revisedFromReviewId}
                      </span>
                    ) : null}
                    <div className={styles.chapterVersionCompareGrid}>
                      <div>
                        <p>旧版本</p>
                        <div className={styles.chapterVersionCompareText}>
                          {filteredComparePreviousLines.slice(0, 80).map((line, index) => (
                            <span
                              key={`previous-${index}`}
                              className={
                                line.state === "removed"
                                  ? styles.removedCompareLine
                                  : styles.unchangedCompareLine
                              }
                            >
                              {line.text}
                              {line.state === "removed" ? (
                                <button
                                  type='button'
                                  onClick={() => restoreCompareLine(line.text)}
                                >
                                  恢复此段
                                </button>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p>新版本</p>
                        <div className={styles.chapterVersionCompareText}>
                          {filteredCompareNextLines.slice(0, 80).map((line, index) => (
                            <span
                              key={`next-${index}`}
                              className={
                                line.state === "added"
                                  ? styles.addedCompareLine
                                  : styles.unchangedCompareLine
                              }
                            >
                              {line.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className={styles.contextSectionHeader}>
          <h2>大纲与章节计划</h2>
          <div>
            <button onClick={() => void addOutlineNode()}>+ 章节</button>
            <button onClick={() => void syncOutlineToProject()}>
              同步计划
            </button>
          </div>
        </div>
        <div className={styles.outlineNodeList}>
          {assets.outlineNodes.slice(0, 8).map((node) => (
            <article key={node.id} className={styles.outlineNodeCard}>
              <div>
                <strong>
                  {node.chapterNumber}. {node.title}
                </strong>
                <span>
                  {node.volume} / {INKOS_STATUS_LABELS[node.status]} /{" "}
                  {node.targetWords} 字
                </span>
              </div>
              <p>{node.goal || node.information || "暂无章节目标。"}</p>
              <em>
                {[
                  node.conflict ? `冲突：${node.conflict}` : "",
                  node.characters ? `角色：${node.characters}` : "",
                  node.foreshadowing ? `伏笔：${node.foreshadowing}` : "",
                ]
                  .filter(Boolean)
                  .join(" / ") || "暂无冲突、角色或伏笔。"}
              </em>
              <div>
                <button onClick={() => void editOutlineNode(node, "title")}>
                  标题
                </button>
                <button onClick={() => void editOutlineNode(node, "goal")}>
                  目标
                </button>
                <button onClick={() => void editOutlineNode(node, "conflict")}>
                  冲突
                </button>
                <button onClick={() => void editOutlineNode(node, "characters")}>
                  角色
                </button>
                <button
                  onClick={() => void editOutlineNode(node, "foreshadowing")}
                >
                  伏笔
                </button>
                <button
                  onClick={() => void editOutlineNode(node, "targetWords")}
                >
                  字数
                </button>
                <button
                  className={styles.dangerTextButton}
                  onClick={() => void deleteOutlineNode(node)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
          {assets.outlineNodes.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无结构化章节计划，可以从项目 chapters 同步或手动新建。
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className={styles.contextSectionHeader}>
          <h2>设定资产</h2>
          <button onClick={() => void createKnowledgeAsset()}>+ 资产</button>
        </div>
        {assets.pendingAssetDeltas.length > 0 ? (
          <div className={styles.pendingAssetDeltaList}>
            {assets.pendingAssetDeltas.slice(0, 4).map((item) => (
              <article key={item.id} className={styles.pendingAssetDeltaCard}>
                <div>
                  <strong>
                    第 {item.chapterNumber} 章《{item.chapterTitle}》
                  </strong>
                  <span>待确认</span>
                </div>
                <p>{item.summary || "暂无摘要。"}</p>
                <ul>
                  {item.characterStates.map((state) => (
                    <li key={`character-${state.title}`}>
                      角色：{state.title} - {state.content}
                    </li>
                  ))}
                  {item.newForeshadowing.map((entry) => (
                    <li key={`new-${entry}`}>新增伏笔：{entry}</li>
                  ))}
                  {item.resolvedForeshadowing.map((entry) => (
                    <li key={`resolved-${entry}`}>回收伏笔：{entry}</li>
                  ))}
                  {item.worldIncrements.map((entry) => (
                    <li key={`world-${entry}`}>世界观：{entry}</li>
                  ))}
                </ul>
                <div>
                  <button onClick={() => void confirmPendingAssetDelta(item)}>
                    确认写入
                  </button>
                  <button
                    onClick={() => void editPendingAssetDelta(item, "summary")}
                  >
                    摘要
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "characterStates")
                    }
                  >
                    角色
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "newForeshadowing")
                    }
                  >
                    新伏笔
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "resolvedForeshadowing")
                    }
                  >
                    回收
                  </button>
                  <button
                    onClick={() =>
                      void editPendingAssetDelta(item, "worldIncrements")
                    }
                  >
                    世界观
                  </button>
                  <button
                    className={styles.dangerTextButton}
                    onClick={() => void dismissPendingAssetDelta(item)}
                  >
                    忽略
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <div className={styles.knowledgeAssetList}>
          {assets.knowledgeAssets.slice(0, 8).map((item) => (
            <article key={item.id} className={styles.knowledgeAssetCard}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {KNOWLEDGE_ASSET_LABELS[item.category]} / {item.status}
                </span>
              </div>
              <p>{item.content || "暂无内容。"}</p>
              {item.tags.length > 0 ? (
                <em>{item.tags.map((tag) => `#${tag}`).join(" ")}</em>
              ) : null}
              <div>
                <button onClick={() => void editKnowledgeAsset(item, "title")}>
                  标题
                </button>
                <button onClick={() => void editKnowledgeAsset(item, "content")}>
                  内容
                </button>
                <button onClick={() => void editKnowledgeAsset(item, "tags")}>
                  标签
                </button>
                <button onClick={() => void editKnowledgeAsset(item, "status")}>
                  状态
                </button>
                <button
                  className={styles.dangerTextButton}
                  onClick={() => void deleteKnowledgeAsset(item)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
          {assets.knowledgeAssets.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无设定资产。建议先添加世界观、角色和伏笔。
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2>写作上下文</h2>
        <div className={styles.contextSelectorGrid}>
          {(
            [
            ["includeOutline", "大纲"],
            ["includePreviousSummary", "上一章摘要"],
            ["includeWorld", "世界观"],
            ["includeCharacters", "角色"],
            ["includeForeshadowing", "伏笔"],
            ["includeReviewIssues", "审稿遗留"],
            ] satisfies Array<
              [
                keyof Pick<
                  NovelContextSelection,
                  | "includeOutline"
                  | "includePreviousSummary"
                  | "includeWorld"
                  | "includeCharacters"
                  | "includeForeshadowing"
                  | "includeReviewIssues"
                >,
                string,
              ]
            >
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type='checkbox'
                checked={Boolean(
                  assets.contextSelection[key as keyof NovelContextSelection],
                )}
                onChange={(event) =>
                  void updateContextSelection({
                    [key]: event.target.checked,
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className={styles.contextSelectorActions}>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "目标字数",
                initialValue: String(
                  assets.contextSelection.targetWords ??
                    project.chapterWordCount ??
                    3000,
                ),
                confirmLabel: "保存",
              });
              if (value !== null) {
                void updateContextSelection({
                  targetWords: Math.max(500, Number(value) || 3000),
                });
              }
            }}
          >
            字数 {assets.contextSelection.targetWords ?? project.chapterWordCount}
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "视角要求",
                initialValue: assets.contextSelection.viewpoint,
                confirmLabel: "保存",
              });
              if (value !== null) void updateContextSelection({ viewpoint: value });
            }}
          >
            视角
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "节奏要求",
                initialValue: assets.contextSelection.pacing,
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null) void updateContextSelection({ pacing: value });
            }}
          >
            节奏
          </button>
          <button
            onClick={async () => {
              const value = await onRequestPrompt({
                title: "本章高亮要求",
                initialValue: assets.contextSelection.highlights,
                multiline: true,
                confirmLabel: "保存",
              });
              if (value !== null)
                void updateContextSelection({ highlights: value });
            }}
          >
            高亮要求
          </button>
        </div>
      </section>

      <section>
        <h2>任务日志</h2>
        <div className={styles.taskLogList}>
          {tasks.slice(0, 5).map((task) => {
            const errorNotice = task.errorMessage
              ? buildNovelRecoverableErrorNotice(task.errorMessage)
              : null;
            const canRetryTask =
              task.status === "queued" ||
              task.status === "cancelled" ||
              (task.status === "error" && errorNotice?.canRetry !== false);

            return (
              <article key={task.id} className={styles.taskLogCard}>
                <div>
                  <strong>{task.label}</strong>
                  <span>{task.status}</span>
                </div>
                <em>
                  {formatNovelRelativeAge(task.startedAt)}前
                  {task.endedAt ? ` / 结束于 ${formatNovelRelativeAge(task.endedAt)}前` : ""}
                </em>
                {task.targetChapterNumber ? (
                  <em>
                    第 {task.targetChapterNumber} 章
                    {task.targetChapterTitle ? ` · ${task.targetChapterTitle}` : ""}
                  </em>
                ) : null}
                <ul>
                  {task.logs.slice(-4).map((log) => (
                    <li key={log.id}>{log.message}</li>
                  ))}
                </ul>
                {errorNotice ? (
                  <div className={styles.taskRecoveryHint}>
                    <strong>{errorNotice.title}</strong>
                    <p>{errorNotice.detail}</p>
                    <em>{errorNotice.recoveryAction}</em>
                  </div>
                ) : null}
                {canRetryTask ? (
                  <button
                    type='button'
                    className={styles.taskRetryButton}
                    onClick={() => onRetryTask(task)}
                  >
                    {task.status === "queued" ? "执行任务" : "重试任务"}
                  </button>
                ) : null}
              </article>
            );
          })}
          {tasks.length === 0 ? (
            <p className={styles.emptyMiniState}>
              暂无任务日志。写下一章、审稿或修订后会自动记录。
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2>设定</h2>
        <div className={styles.foundationList}>
          <button onClick={() => void editAsset("世界观设定", "worldNotes")}>
            世界观设定
          </button>
          <button onClick={() => void editAsset("卷纲规划", "outline")}>
            卷纲规划
          </button>
          <button onClick={() => void editAsset("状态卡/核心设定", "settings")}>
            状态卡
          </button>
          <button onClick={() => void editAsset("角色矩阵", "characters")}>
            角色矩阵
          </button>
        </div>
      </section>

      <section>
        <h2>上下文预览</h2>
        <MarkdownContent content={promptPreview} compact />
      </section>
    </aside>
  );
}

function ModelSettingsHome({
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

function ProviderDetail({
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

function ProviderCard({
  provider,
  onOpen,
}: {
  provider: LocalModelProvider;
  onOpen: () => void;
}) {
  return (
    <button className={styles.providerCard} onClick={onOpen}>
      <span>
        <strong>{provider.name}</strong>
        <em>{provider.baseUrl}</em>
      </span>
      <StatusPill
        status={isProviderConnected(provider) ? "ready" : "missing-api-key"}
      />
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    ready: "已连接",
    "missing-api-key": "未配置",
    "provider-disabled": "已停用",
  };

  return (
    <span
      className={status === "ready" ? styles.statusReady : styles.statusWarning}
    >
      {labelMap[status] ?? status}
    </span>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24'>
      <path d='M2.2 12s3.4-6 9.8-6 9.8 6 9.8 6-3.4 6-9.8 6-9.8-6-9.8-6Z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24'>
      <path d='M3 3l18 18' />
      <path d='M10.6 5.2A11 11 0 0 1 12 5c6.4 0 9.8 7 9.8 7a18 18 0 0 1-3.2 4.1' />
      <path d='M6.6 6.8A18 18 0 0 0 2.2 12s3.4 7 9.8 7a10.7 10.7 0 0 0 4.1-.8' />
      <path d='M9.9 9.9A3 3 0 0 0 14.1 14' />
    </svg>
  );
}

function ResultBanner({
  ok,
  title,
  message,
  latencyMs,
  sample,
}: {
  ok: boolean;
  title: string;
  message: string;
  latencyMs?: number;
  sample?: string;
}) {
  return (
    <div className={ok ? styles.testResultSuccess : styles.testResultError}>
      <strong>{title}</strong>
      <span>{message}</span>
      {latencyMs ? <em>{latencyMs} ms</em> : null}
      {sample ? <code>{sample}</code> : null}
    </div>
  );
}

function isProviderConnected(provider: LocalModelProvider) {
  return provider.enabled && Boolean(provider.apiKey);
}

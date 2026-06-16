"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  INKOS_STATUS_LABELS,
  buildInkosPromptPreview,
  createDemoInkosProject,
  deriveInkosProjectStats,
  getCurrentStage,
  type InkosNovelProject,
} from "@repo/inkos-adapter";
import styles from "./page.module.css";
import {
  DEFAULT_LOCAL_MODEL_SETTINGS,
  MODEL_SUGGESTIONS,
  listProviderModels,
  loadLocalModelSettings,
  saveLocalModelSettings,
  testProviderConnection,
  upsertProvider,
  type LocalModelProvider,
  type LocalModelSettings,
  type ModelConnectionTestResult,
  type ProviderModelsResult,
} from "../lib/model-settings";

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
      const result = await testProviderConnection(
        selectedProvider,
        modelOptions[0],
        "用一句中文回复：模型连接正常。",
      );
      setTestResult(result);

      if (result.ok) {
        const verifiedProvider = {
          ...selectedProvider,
          enabled: true,
        };
        handleProviderChange(verifiedProvider);
        await runListModels(verifiedProvider);
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
      const result = await listProviderModels(providerForRequest);
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
};

type ModelPickerGroup = {
  service: string;
  label: string;
  models: Array<{ id: string; name: string }>;
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
  sessions: Array<{
    id: string;
    title: string;
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

const NOVEL_BOOKS: NovelBookEntry[] = [
  {
    id: "crack-sun",
    title: "裂缝中的阳光",
    meta: "都市悬疑 / 现实异能",
    sessions: [
      { id: "new", title: "新会话", age: "刚刚" },
      { id: "draft-1", title: "第一卷推进", age: "1 天" },
      { id: "outline", title: "章节计划", age: "3 天" },
    ],
  },
  {
    id: "old-secret",
    title: "旧日秘路",
    meta: "奇幻 / 悬疑",
    sessions: [
      { id: "old-main", title: "新会话", age: "7 天" },
      { id: "old-arc", title: "《星门余烬》卷纲", age: "19 天" },
    ],
  },
];

function NovelStudio({
  settings,
  onManageModels,
}: {
  settings: LocalModelSettings;
  onManageModels: () => void;
}) {
  const [project] = useState<InkosNovelProject>(() => createDemoInkosProject());
  const [input, setInput] = useState("");
  const [activeTool, setActiveTool] = useState<NovelTool>("AI创作");
  const [activeBookId, setActiveBookId] = useState(NOVEL_BOOKS[0]?.id ?? "");
  const [activeSessionId, setActiveSessionId] = useState(
    NOVEL_BOOKS[0]?.sessions[0]?.id ?? "",
  );
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
  const [messages, setMessages] = useState<NovelChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "告诉我你想写什么：题材、世界观、主角、核心冲突，或者直接让我写下一章。我会按 InkOS 的创作流程帮你推进。",
    },
  ]);
  const currentStage = getCurrentStage(project);
  const stats = deriveInkosProjectStats(project);
  const promptPreview = buildInkosPromptPreview(project);

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

  function sendNovelMessage(text: string) {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "已收到。当前版本先把请求进入 InkOS Adapter 队列：后续会由服务端调用 @actalk/inkos-core 的 Planner / Composer / Reviewer 完成真实生成。",
      },
    ]);
    setInput("");
  }

  function runQuickAction(command: string) {
    sendNovelMessage(command);
  }

  const activeBook =
    NOVEL_BOOKS.find((book) => book.id === activeBookId) ?? NOVEL_BOOKS[0];

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

      {activeTool === "AI创作" ? (
        <section className={styles.novelChatLayout}>
          <NovelBookList
            books={NOVEL_BOOKS}
            activeBookId={activeBookId}
            activeSessionId={activeSessionId}
            onBookSelect={(bookId) => {
              const nextBook = NOVEL_BOOKS.find((book) => book.id === bookId);
              setActiveBookId(bookId);
              setActiveSessionId(nextBook?.sessions[0]?.id ?? "");
            }}
            onSessionSelect={(bookId, sessionId) => {
              setActiveBookId(bookId);
              setActiveSessionId(sessionId);
            }}
          />

          <section className={styles.chatSurface}>
            <header className={styles.chatContextBar}>
              <div>
                <strong>{activeBook?.title ?? project.title}</strong>
                <span>
                  {(activeBook?.meta ?? project.genre)} / {currentStage.label} /{" "}
                  {stats.progressPercent}% 定稿
                </span>
              </div>
              <em>Chat / InkOS</em>
            </header>

            <div className={styles.messageList}>
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === "user"
                      ? styles.userMessage
                      : styles.assistantMessage
                  }
                >
                  <strong>{message.role === "user" ? "你" : "InkOS"}</strong>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>

            <footer className={styles.chatComposer}>
              <div className={styles.composerQuickActions}>
                {["写下一章", "审稿", "生成大纲", "整理设定", "市场雷达"].map(
                  (action) => (
                    <button key={action} onClick={() => runQuickAction(action)}>
                      {action}
                    </button>
                  ),
                )}
              </div>
              <textarea
                rows={3}
                value={input}
                placeholder='告诉我你想写什么，或输入：写下一章'
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    sendNovelMessage(input);
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
                    disabled={!input.trim()}
                    onClick={() => sendNovelMessage(input)}
                  >
                    发送
                  </button>
                </div>
              </div>
            </footer>
          </section>

          <NovelBookPanel
            project={project}
            stats={stats}
            promptPreview={promptPreview}
          />
        </section>
      ) : (
        <NovelToolPanel tool={activeTool} project={project} />
      )}
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

function NovelBookList({
  books,
  activeBookId,
  activeSessionId,
  onBookSelect,
  onSessionSelect,
}: {
  books: NovelBookEntry[];
  activeBookId: string;
  activeSessionId: string;
  onBookSelect: (bookId: string) => void;
  onSessionSelect: (bookId: string, sessionId: string) => void;
}) {
  return (
    <aside className={styles.novelBookList}>
      <div className={styles.bookListHeader}>
        <span>书籍</span>
        <button>+ 新建书籍</button>
      </div>

      <div className={styles.bookListBody}>
        {books.map((book) => (
          <section key={book.id} className={styles.bookListGroup}>
            <button
              className={
                activeBookId === book.id ? styles.activeBookButton : ""
              }
              onClick={() => onBookSelect(book.id)}
            >
              <strong>{book.title}</strong>
              <span>{book.meta}</span>
            </button>
            {activeBookId === book.id ? (
              <div className={styles.sessionList}>
                {book.sessions.map((session) => (
                  <button
                    key={session.id}
                    className={
                      activeSessionId === session.id
                        ? styles.activeSessionButton
                        : ""
                    }
                    onClick={() => onSessionSelect(book.id, session.id)}
                  >
                    <span>{session.title}</span>
                    <em>{session.age}</em>
                  </button>
                ))}
                <button
                  className={styles.newSessionButton}
                  onClick={() => {
                    const firstSession = book.sessions[0];

                    if (firstSession) {
                      onSessionSelect(book.id, firstSession.id);
                    }
                  }}
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
  project,
}: {
  tool: Exclude<NovelTool, "AI创作">;
  project: InkosNovelProject;
}) {
  return (
    <section className={styles.novelToolPanel}>
      <header>
        <strong>{tool}</strong>
        <span>参考 InkOS Studio 的页面结构，数据暂以本地工作台状态承载。</span>
      </header>
      {tool === "题材" ? <GenreTool /> : null}
      {tool === "文风" ? <StyleTool project={project} /> : null}
      {tool === "导入" ? <ImportTool /> : null}
      {tool === "市场雷达" ? <RadarTool /> : null}
      {tool === "环境诊断" ? <DoctorTool project={project} /> : null}
    </section>
  );
}

function GenreTool() {
  const [selectedGenre, setSelectedGenre] = useState("urban-suspense");
  const genres = [
    {
      id: "urban-suspense",
      name: "都市悬疑",
      source: "project",
      language: "zh",
      chapterTypes: "开局钩子, 线索推进, 反转揭露",
      fatigueWords: "忽然, 竟然, 震惊",
      pacingRule: "每 1800-2500 字出现一次信息增量或冲突升级。",
    },
    {
      id: "xuanhuan",
      name: "玄幻",
      source: "builtin",
      language: "zh",
      chapterTypes: "修炼突破, 秘境探索, 宗门冲突",
      fatigueWords: "恐怖如斯, 倒吸冷气",
      pacingRule: "数值体系必须稳定，境界跃迁需要代价。",
    },
    {
      id: "fanfic",
      name: "同人衍生",
      source: "builtin",
      language: "zh",
      chapterTypes: "原作锚点, AU 偏移, 角色修复",
      fatigueWords: "崩坏, OOC",
      pacingRule: "先建立原作识别点，再安排差异化事件。",
    },
  ];
  const detail = genres.find((genre) => genre.id === selectedGenre) ?? genres[0]!;

  return (
    <div className={styles.toolTwoColumn}>
      <aside className={styles.toolListPanel}>
        <div className={styles.toolListHeader}>
          <strong>题材库</strong>
          <button>+ 新建题材</button>
        </div>
        {genres.map((genre) => (
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
            <input value={detail.name} readOnly />
          </label>
          <label>
            章节类型
            <input value={detail.chapterTypes} readOnly />
          </label>
          <label>
            疲劳词
            <input value={detail.fatigueWords} readOnly />
          </label>
          <label className={styles.fullField}>
            节奏规则
            <textarea rows={5} value={detail.pacingRule} readOnly />
          </label>
        </div>
      </section>
    </div>
  );
}

function StyleTool({ project }: { project: InkosNovelProject }) {
  const [sample, setSample] = useState(
    "雨停以后，裂缝还在城市中央发光。林照站在人群后面，看见自己的影子被切成两半。",
  );
  const sentenceLength = Math.max(8, Math.round(sample.length / 3));
  const diversity = Math.min(96, 48 + new Set(sample).size);

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
        <button className={styles.toolPrimaryButton}>分析文风</button>
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

function ImportTool() {
  const [tab, setTab] = useState<"chapters" | "canon" | "fanfic">("chapters");

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
          <input placeholder='章节拆分规则，例如：第\\d+章' />
          <textarea rows={12} placeholder='粘贴需要导入的章节正文...' />
          <button className={styles.toolPrimaryButton}>导入章节</button>
        </>
      ) : null}
      {tab === "canon" ? (
        <>
          <select defaultValue=''>
            <option value=''>选择原作书籍</option>
            <option value='old-secret'>旧日秘路</option>
          </select>
          <select defaultValue=''>
            <option value=''>选择衍生目标书籍</option>
            <option value='crack-sun'>裂缝中的阳光</option>
          </select>
          <button className={styles.toolPrimaryButton}>导入原作设定</button>
        </>
      ) : null}
      {tab === "fanfic" ? (
        <>
          <input placeholder='同人作品标题' />
          <div className={styles.formGrid}>
            <select defaultValue='canon'><option value='canon'>Canon</option><option value='au'>AU</option></select>
            <select defaultValue='urban'><option value='urban'>都市</option><option value='xuanhuan'>玄幻</option></select>
          </div>
          <textarea rows={10} placeholder='粘贴原作资料或世界观素材...' />
          <button className={styles.toolPrimaryButton}>初始化同人项目</button>
        </>
      ) : null}
    </section>
  );
}

function RadarTool() {
  const [scanned, setScanned] = useState(false);
  const recommendations = [
    ["番茄", "都市异能", "现实困境 + 低烈度异能切入，开局留悬念。", "78%"],
    ["七猫", "悬疑群像", "用家庭关系和旧案双线提高连续阅读动力。", "64%"],
  ];

  return (
    <div className={styles.toolTwoColumn}>
      <section className={styles.toolFormPanel}>
        <h2>市场扫描</h2>
        <p>扫描同题材趋势、标题简介卖点和章节留存风险。</p>
        <button className={styles.toolPrimaryButton} onClick={() => setScanned(true)}>
          开始扫描
        </button>
      </section>
      <section className={styles.toolResultPanel}>
        <h2>{scanned ? "推荐方向" : "历史结果"}</h2>
        {recommendations.map(([platform, genre, concept, score]) => (
          <article key={platform} className={styles.radarResultItem}>
            <strong>{platform} · {genre}</strong>
            <span>{score}</span>
            <p>{concept}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function DoctorTool({ project }: { project: InkosNovelProject }) {
  const checks = [
    ["项目配置", true, `已加载《${project.title}》`],
    ["书籍目录", true, `${project.chapters.length} 个章节节点`],
    ["模型配置", true, "读取全局模型配置"],
    ["生成链路", false, "等待服务端队列接入"],
  ];

  return (
    <section className={styles.toolFormPanel}>
      <div className={styles.doctorList}>
        {checks.map(([label, ok, detail]) => (
          <div key={String(label)}>
            <span className={ok ? styles.checkOk : styles.checkWarn}>
              {ok ? "✓" : "!"}
            </span>
            <strong>{label}</strong>
            <em>{detail}</em>
          </div>
        ))}
      </div>
      <div className={styles.toolNotice}>基础环境可用，生成链路后续接入 `@actalk/inkos-core` 服务端执行。</div>
    </section>
  );
}

function NovelBookPanel({
  project,
  stats,
  promptPreview,
}: {
  project: InkosNovelProject;
  stats: ReturnType<typeof deriveInkosProjectStats>;
  promptPreview: string;
}) {
  return (
    <aside className={styles.bookContextPanel}>
      <section>
        <h2>书籍信息</h2>
        <div className={styles.bookProgress}>
          <span>定稿进度</span>
          <strong>{stats.progressPercent}%</strong>
          <em>{stats.approvedChapters} / {project.targetChapters} 章</em>
        </div>
      </section>

      <section>
        <h2>章节</h2>
        <div className={styles.compactChapterList}>
          {project.chapters.map((chapter) => (
            <div key={chapter.number}>
              <span>{chapter.number}</span>
              <strong>{chapter.title}</strong>
              <em>{INKOS_STATUS_LABELS[chapter.status]}</em>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>设定</h2>
        <div className={styles.foundationList}>
          <span>世界观设定</span>
          <span>卷纲规划</span>
          <span>状态卡</span>
          <span>伏笔池</span>
          <span>角色矩阵</span>
        </div>
      </section>

      <section>
        <h2>上下文预览</h2>
        <pre>{promptPreview}</pre>
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
              value={provider.apiFormat === "ollama" ? "ollama" : "chat"}
              onChange={(event) =>
                onProviderChange({
                  ...provider,
                  apiFormat:
                    event.target.value === "ollama" ? "ollama" : "openai",
                })
              }
            >
              <option value='chat'>Chat / Completions</option>
              <option value='responses'>Responses</option>
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

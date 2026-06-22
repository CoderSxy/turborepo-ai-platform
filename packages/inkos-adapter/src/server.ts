import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type InkosCreationStageKey =
  | "foundation"
  | "outline"
  | "chapter-plan"
  | "draft"
  | "review"
  | "polish";

type InkosChapterStatus =
  | "planned"
  | "drafting"
  | "ready-for-review"
  | "approved";

type InkosChapter = {
  number: number;
  title: string;
  status: InkosChapterStatus;
  targetWords: number;
  focus: string;
};

type InkosNovelProject = {
  title: string;
  genre: string;
  platform: string;
  language: "zh" | "en";
  targetChapters: number;
  chapterWordCount: number;
  premise: string;
  protagonist: string;
  world: string;
  currentStage: InkosCreationStageKey;
  chapters: InkosChapter[];
};

type InkosProjectAssetsPatch = {
  outline?: string;
  worldNotes?: string;
  characters?: string;
  settings?: string;
  marketRadars?: Array<{
    id: string;
    platform: string;
    genre: string;
    concept: string;
    score: string;
    createdAt: string;
  }>;
  diagnostics?: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
    createdAt: string;
  }>;
};

type InkosCoreAction =
  | "outline"
  | "settings"
  | "write-chapter"
  | "revise-chapter"
  | "review"
  | "radar"
  | "diagnostics";

type InkosCoreModelConfig = {
  providerId: string;
  providerName: string;
  apiFormat: "openai" | "anthropic" | "gemini" | "ollama";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  stream?: boolean;
};

type InkosCoreActionInput = {
  action: InkosCoreAction;
  project: InkosNovelProject;
  assets?: InkosProjectAssetsPatch;
  model: InkosCoreModelConfig;
  instruction?: string;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

type InkosCoreActionResult = {
  ok: boolean;
  action: InkosCoreAction;
  message: string;
  content?: string;
  project?: InkosNovelProject;
  assetsPatch?: InkosProjectAssetsPatch;
  raw?: unknown;
};

type CoreBookConfig = {
  id: string;
  title: string;
  platform: "tomato" | "feilu" | "qidian" | "other";
  genre: string;
  status:
    | "incubating"
    | "outlining"
    | "active"
    | "paused"
    | "completed"
    | "dropped";
  targetChapters: number;
  chapterWordCount: number;
  language?: string;
  createdAt: string;
  updatedAt: string;
};

type CoreArchitectOutput = {
  storyBible: string;
  volumeOutline: string;
  bookRules: string;
  currentState: string;
  pendingHooks: string;
  storyFrame?: string;
  volumeMap?: string;
  rhythmPrinciples?: string;
  roles?: ReadonlyArray<{
    tier: "major" | "minor";
    name: string;
    content: string;
  }>;
};

type CoreArchitectAgent = {
  generateFoundation: (
    book: CoreBookConfig,
    externalContext?: string,
    reviewFeedback?: string,
    options?: Record<string, unknown>,
  ) => Promise<CoreArchitectOutput>;
};

type CoreWriteChapterOutput = {
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  preWriteCheck: string;
  postSettlement: string;
  updatedState: string;
  updatedLedger: string;
  updatedHooks: string;
  chapterSummary: string;
  updatedChapterSummaries?: string;
  updatedSubplots: string;
  updatedEmotionalArcs: string;
  updatedCharacterMatrix: string;
  postWriteErrors: ReadonlyArray<CoreIssue>;
  postWriteWarnings: ReadonlyArray<CoreIssue>;
  hookHealthIssues?: ReadonlyArray<CoreIssue>;
  tokenUsage?: unknown;
};

type CoreIssue = {
  severity?: "critical" | "warning" | "info";
  category?: string;
  code?: string;
  message?: string;
  description?: string;
  suggestion?: string;
};

type CoreAuditResult = {
  passed: boolean;
  issues: ReadonlyArray<{
    severity: "critical" | "warning" | "info";
    category: string;
    description: string;
    suggestion: string;
  }>;
  summary: string;
  overallScore?: number;
  tokenUsage?: unknown;
};

type CoreRadarResult = {
  recommendations: ReadonlyArray<{
    platform: string;
    genre: string;
    concept: string;
    confidence: number;
    reasoning: string;
    benchmarkTitles: ReadonlyArray<string>;
  }>;
  marketSummary: string;
  timestamp: string;
};

type CoreValidationResult = {
  warnings: ReadonlyArray<{
    category: string;
    description: string;
  }>;
  passed: boolean;
};

type InkosCoreModule = {
  createLLMClient: (config: Record<string, unknown>) => unknown;
  ArchitectAgent: new (options: CoreAgentOptions) => CoreArchitectAgent;
  WriterAgent: new (options: CoreAgentOptions) => {
    writeChapter: (input: {
      book: CoreBookConfig;
      bookDir: string;
      chapterNumber: number;
      externalContext?: string;
      chapterIntent?: string;
      wordCountOverride?: number;
      temperatureOverride?: number;
    }) => Promise<CoreWriteChapterOutput>;
  };
  ReviserAgent: new (options: CoreAgentOptions) => {
    reviseChapter: (
      bookDir: string,
      chapterContent: string,
      chapterNumber: number,
      issues: ReadonlyArray<{
        severity: "critical" | "warning" | "info";
        category: string;
        description: string;
        suggestion: string;
      }>,
      mode?: "auto" | "polish" | "rewrite" | "rework" | "anti-detect" | "spot-fix",
      genre?: string,
      options?: {
        chapterIntent?: string;
      },
    ) => Promise<{
      revisedContent: string;
      wordCount: number;
      fixedIssues: ReadonlyArray<string>;
      updatedState: string;
      updatedLedger: string;
      updatedHooks: string;
      tokenUsage?: unknown;
    }>;
  };
  ContinuityAuditor: new (options: CoreAgentOptions) => {
    auditChapter: (
      bookDir: string,
      chapterContent: string,
      chapterNumber: number,
      genre?: string,
      options?: {
        temperature?: number;
        chapterIntent?: string;
        truthFileOverrides?: {
          currentState?: string;
          ledger?: string;
          hooks?: string;
        };
      },
    ) => Promise<CoreAuditResult>;
  };
  RadarAgent: new (
    options: CoreAgentOptions,
    sources?: ReadonlyArray<unknown>,
  ) => {
    scan: () => Promise<CoreRadarResult>;
  };
  StateValidatorAgent: new (options: CoreAgentOptions) => {
    validate: (
      chapterContent: string,
      chapterNumber: number,
      oldState: string,
      newState: string,
      oldHooks: string,
      newHooks: string,
      language?: "zh" | "en",
      authorityContext?: {
        storyFrame?: string;
        bookRules?: string;
        chapterSummaries?: string;
      },
    ) => Promise<CoreValidationResult>;
  };
};

type CoreAgentOptions = {
  client: unknown;
  model: string;
  projectRoot: string;
  bookId?: string;
};

export async function runInkosCoreAction(
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  try {
    const core = await loadInkosCore();
    const client = core.createLLMClient(buildCoreLlmConfig(input.model));
    const book = buildCoreBookConfig(input.project);

    if (input.action === "outline" || input.action === "settings") {
      return await runArchitectAction(core, client, book, input);
    }

    if (input.action === "radar") {
      return await runRadarAction(core, client, input);
    }

    return await withTempBookWorkspace(input, book, async (bookDir) => {
      if (input.action === "write-chapter") {
        return await runWriteChapterAction(core, client, book, bookDir, input);
      }

      if (input.action === "review") {
        return await runReviewAction(core, client, book, bookDir, input);
      }

      if (input.action === "revise-chapter") {
        return await runReviseChapterAction(core, client, book, bookDir, input);
      }

      return await runDiagnosticsAction(core, client, book, bookDir, input);
    });
  } catch (error) {
    return {
      ok: false,
      action: input.action,
      message:
        error instanceof Error
          ? error.message
          : "InkOS Core 执行失败，请检查模型配置。",
    };
  }
}

async function loadInkosCore(): Promise<InkosCoreModule> {
  await ensureCoreRuntime();
  const core = (await import("@actalk/inkos-core")) as unknown;

  if (
    !isRecord(core) ||
    typeof core.createLLMClient !== "function" ||
    typeof core.ArchitectAgent !== "function" ||
    typeof core.WriterAgent !== "function" ||
    typeof core.ReviserAgent !== "function" ||
    typeof core.ContinuityAuditor !== "function" ||
    typeof core.RadarAgent !== "function" ||
    typeof core.StateValidatorAgent !== "function"
  ) {
    throw new Error("InkOS Core 加载失败：核心导出不完整。");
  }

  return core as InkosCoreModule;
}

async function ensureCoreRuntime() {
  const streamWeb = await import("node:stream/web");
  const globals = globalThis as unknown as Record<string, unknown>;

  globals.ReadableStream ??= streamWeb.ReadableStream;
  globals.WritableStream ??= streamWeb.WritableStream;
  globals.TransformStream ??= streamWeb.TransformStream;
}

function buildCoreLlmConfig(model: InkosCoreModelConfig): Record<string, unknown> {
  const provider =
    model.apiFormat === "anthropic"
      ? "anthropic"
      : model.providerId === "openai"
        ? "openai"
        : "custom";

  return {
    provider,
    service: model.providerId,
    model: model.model,
    apiKey: model.apiKey,
    baseUrl: model.baseUrl,
    temperature: model.temperature ?? 0.7,
    stream: model.stream ?? false,
    configSource: "studio",
    apiFormat: "chat",
  };
}

function buildCoreBookConfig(project: InkosNovelProject): CoreBookConfig {
  const now = new Date().toISOString();

  return {
    id: slugifyBookId(project.title),
    title: project.title,
    platform: inferCorePlatform(project.platform),
    genre: inferCoreGenreId(project.genre),
    status: project.currentStage === "foundation" ? "incubating" : "outlining",
    targetChapters: project.targetChapters,
    chapterWordCount: project.chapterWordCount,
    language: project.language,
    createdAt: now,
    updatedAt: now,
  };
}

async function runArchitectAction(
  core: InkosCoreModule,
  client: unknown,
  book: CoreBookConfig,
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  const agent = new core.ArchitectAgent({
    client,
    model: input.model.model,
    projectRoot: process.cwd(),
    bookId: book.id,
  });
  const output = await agent.generateFoundation(
    book,
    buildCoreExternalContext(input),
    undefined,
    {
      mode: input.action === "outline" ? "outline" : "foundation",
    },
  );
  const rolesText = formatCoreRoles(output.roles);
  const worldNotes = output.storyFrame || output.storyBible || input.project.world;
  const outline = output.volumeMap || output.volumeOutline;
  const settings = [
    output.bookRules,
    output.rhythmPrinciples,
    output.currentState,
    output.pendingHooks,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    action: input.action,
    message:
      input.action === "outline"
        ? "InkOS Core 已生成大纲。"
        : "InkOS Core 已整理设定。",
    content: formatArchitectContent(input.action, output),
    project: {
      ...input.project,
      currentStage: input.action === "outline" ? "outline" : "foundation",
      world: worldNotes || input.project.world,
      protagonist: rolesText || input.project.protagonist,
      premise: output.bookRules || input.project.premise,
    },
    assetsPatch: {
      outline: outline || input.assets?.outline,
      worldNotes,
      characters: rolesText || input.assets?.characters,
      settings: settings || input.assets?.settings,
    },
    raw: {
      storyBibleLength: output.storyBible.length,
      volumeOutlineLength: output.volumeOutline.length,
      rolesCount: output.roles?.length ?? 0,
    },
  };
}

async function runWriteChapterAction(
  core: InkosCoreModule,
  client: unknown,
  book: CoreBookConfig,
  bookDir: string,
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  const chapterNumber =
    parseTargetChapterNumber(input.instruction) ?? nextChapterNumber(input.project);
  const writer = new core.WriterAgent({
    client,
    model: input.model.model,
    projectRoot: process.cwd(),
    bookId: book.id,
  });
  const output = await writer.writeChapter({
    book,
    bookDir,
    chapterNumber,
    externalContext: buildCoreExternalContext(input),
    chapterIntent: input.instruction || input.assets?.outline || input.project.premise,
    wordCountOverride: input.project.chapterWordCount,
    temperatureOverride: input.model.temperature ?? 0.78,
  });
  const chapter: InkosChapter = {
    number: output.chapterNumber,
    title: output.title || `第 ${chapterNumber} 章`,
    status:
      output.postWriteErrors.length > 0 ? "drafting" : "ready-for-review",
    targetWords: input.project.chapterWordCount,
    focus: output.chapterSummary || output.preWriteCheck || "InkOS Core 章节草稿",
  };
  const settings = [
    input.assets?.settings,
    output.updatedState ? `## 当前状态\n${output.updatedState}` : "",
    output.updatedLedger ? `## 粒子账本\n${output.updatedLedger}` : "",
    output.updatedHooks ? `## 伏笔池\n${output.updatedHooks}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    action: input.action,
    message: "InkOS Core 已生成下一章。",
    content: formatWriteChapterContent(output),
    project: {
      ...input.project,
      currentStage: "review",
      chapters: upsertChapter(input.project.chapters, chapter),
    },
    assetsPatch: {
      outline: appendSection(
        input.assets?.outline,
        `第 ${output.chapterNumber} 章：${output.title}`,
        output.chapterSummary,
      ),
      settings,
      characters: output.updatedCharacterMatrix || input.assets?.characters,
    },
    raw: {
      wordCount: output.wordCount,
      warningCount: output.postWriteWarnings.length,
      errorCount: output.postWriteErrors.length,
      tokenUsage: output.tokenUsage,
    },
  };
}

async function runReviewAction(
  core: InkosCoreModule,
  client: unknown,
  book: CoreBookConfig,
  bookDir: string,
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  const chapterContent = findReviewTarget(input);

  if (!chapterContent) {
    throw new Error("没有找到可审稿内容，请先生成或粘贴一段章节正文。");
  }

  const chapterNumber = Math.max(1, nextChapterNumber(input.project) - 1);
  const auditor = new core.ContinuityAuditor({
    client,
    model: input.model.model,
    projectRoot: process.cwd(),
    bookId: book.id,
  });
  const audit = await auditor.auditChapter(
    bookDir,
    chapterContent,
    chapterNumber,
    book.genre,
    {
      temperature: input.model.temperature ?? 0.25,
      chapterIntent: buildCoreExternalContext(input),
      truthFileOverrides: {
        currentState: input.assets?.settings,
        hooks: input.assets?.outline,
      },
    },
  );
  const diagnostics = audit.issues.map((issue, index) => ({
    id: `review-${Date.now()}-${index}`,
    label: `${issue.severity.toUpperCase()} · ${issue.category}`,
    ok: issue.severity === "info",
    detail: `${issue.description}${issue.suggestion ? `；建议：${issue.suggestion}` : ""}`,
    createdAt: new Date().toISOString(),
  }));

  return {
    ok: true,
    action: input.action,
    message: audit.passed ? "InkOS Core 审稿通过。" : "InkOS Core 已完成审稿。",
    content: formatReviewContent(audit),
    project: {
      ...input.project,
      currentStage: audit.passed ? "polish" : "review",
    },
    assetsPatch: {
      diagnostics:
        diagnostics.length > 0
          ? diagnostics
          : [
              {
                id: `review-${Date.now()}-passed`,
                label: "审稿通过",
                ok: true,
                detail: audit.summary || "未发现明显连续性问题。",
                createdAt: new Date().toISOString(),
              },
            ],
    },
    raw: {
      passed: audit.passed,
      issueCount: audit.issues.length,
      overallScore: audit.overallScore,
      tokenUsage: audit.tokenUsage,
    },
  };
}

async function runReviseChapterAction(
  core: InkosCoreModule,
  client: unknown,
  book: CoreBookConfig,
  bookDir: string,
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  const chapterNumber =
    parseTargetChapterNumber(input.instruction) ??
    Math.max(1, nextChapterNumber(input.project) - 1);
  const chapterContent = extractInstructionSection(
    input.instruction,
    "## 原章节正文",
  )
    .replace(/^原章节正文[:：]\s*/u, "")
    .trim();
  const reviewNotes =
    extractInstructionSection(input.instruction, "## 审稿意见")
      .replace(/^审稿意见[:：]\s*/u, "")
      .trim() || "根据现有章节做连贯性和表达修订。";

  if (!chapterContent) {
    throw new Error("没有找到可修订章节正文，请先选择一个已生成章节。");
  }

  const reviser = new core.ReviserAgent({
    client,
    model: input.model.model,
    projectRoot: process.cwd(),
    bookId: book.id,
  });
  const reviseOutput = await reviser.reviseChapter(
    bookDir,
    chapterContent,
    chapterNumber,
    [
      {
        severity: "warning",
        category: "review-notes",
        description: reviewNotes,
        suggestion: reviewNotes,
      },
    ],
    "auto",
    book.genre,
    {
      chapterIntent: buildCoreExternalContext(input),
    },
  );
  const revisedContent = reviseOutput.revisedContent.trim();

  if (!revisedContent) {
    throw new Error("InkOS Core 没有返回修订正文。");
  }

  const settings = [
    input.assets?.settings,
    reviseOutput.updatedState &&
    reviseOutput.updatedState !== "(状态卡未更新)"
      ? `## 当前状态\n${reviseOutput.updatedState}`
      : "",
    reviseOutput.updatedLedger &&
    reviseOutput.updatedLedger !== "(账本未更新)"
      ? `## 粒子账本\n${reviseOutput.updatedLedger}`
      : "",
    reviseOutput.updatedHooks &&
    reviseOutput.updatedHooks !== "(伏笔池未更新)"
      ? `## 伏笔池\n${reviseOutput.updatedHooks}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    action: input.action,
    message: "InkOS Core 已根据审稿意见修订本章。",
    content: [
      `# 第 ${chapterNumber} 章修订稿`,
      revisedContent,
      reviseOutput.fixedIssues.length > 0
        ? `## 已处理问题\n${reviseOutput.fixedIssues.map((item) => `- ${item}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    project: {
      ...input.project,
      currentStage: "review",
    },
    assetsPatch: {
      settings: settings || input.assets?.settings,
    },
    raw: {
      wordCount: reviseOutput.wordCount,
      fixedIssues: reviseOutput.fixedIssues,
      tokenUsage: reviseOutput.tokenUsage,
    },
  };
}

async function runRadarAction(
  core: InkosCoreModule,
  client: unknown,
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  const radar = new core.RadarAgent({
    client,
    model: input.model.model,
    projectRoot: process.cwd(),
    bookId: slugifyBookId(input.project.title),
  });
  const result = await radar.scan();
  const createdAt = result.timestamp || new Date().toISOString();
  const marketRadars = result.recommendations.map((item, index) => ({
    id: `radar-${Date.now()}-${index}`,
    platform: item.platform,
    genre: item.genre,
    concept: [
      item.concept,
      item.reasoning ? `理由：${item.reasoning}` : "",
      item.benchmarkTitles.length
        ? `对标：${item.benchmarkTitles.join("、")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    score: `${Math.round(item.confidence * 100)}%`,
    createdAt,
  }));

  return {
    ok: true,
    action: input.action,
    message: "InkOS Core 已完成市场雷达扫描。",
    content: formatRadarContent(result),
    project: input.project,
    assetsPatch: {
      marketRadars: [
        ...marketRadars,
        ...(input.assets?.marketRadars ?? []),
      ],
    },
    raw: {
      recommendationCount: result.recommendations.length,
      timestamp: result.timestamp,
    },
  };
}

async function runDiagnosticsAction(
  core: InkosCoreModule,
  client: unknown,
  book: CoreBookConfig,
  _bookDir: string,
  input: InkosCoreActionInput,
): Promise<InkosCoreActionResult> {
  const chapterNumber = Math.max(1, nextChapterNumber(input.project) - 1);
  const chapterContent =
    findReviewTarget(input) ||
    input.assets?.outline ||
    buildServerPromptPreview(input.project);
  const validator = new core.StateValidatorAgent({
    client,
    model: input.model.model,
    projectRoot: process.cwd(),
    bookId: book.id,
  });
  const oldState = input.assets?.settings || input.project.premise;
  const newState = [
    input.assets?.settings,
    input.assets?.worldNotes,
    input.assets?.characters,
  ]
    .filter(Boolean)
    .join("\n\n");
  const oldHooks = input.assets?.outline || "";
  const newHooks = input.assets?.outline || input.project.premise;
  const validation = await validator.validate(
    chapterContent,
    chapterNumber,
    oldState,
    newState,
    oldHooks,
    newHooks,
    input.project.language,
    {
      storyFrame: input.assets?.worldNotes,
      bookRules: input.assets?.settings,
      chapterSummaries: input.assets?.outline,
    },
  );
  const now = new Date().toISOString();
  const diagnostics = [
    {
      id: `diagnostic-${Date.now()}-core`,
      label: "InkOS Core 状态校验",
      ok: validation.passed,
      detail: validation.passed
        ? "章节、状态卡和伏笔池没有发现硬冲突。"
        : "发现状态或伏笔冲突，请查看下方详情。",
      createdAt: now,
    },
    {
      id: `diagnostic-${Date.now()}-assets`,
      label: "书籍资产",
      ok: Boolean(input.assets?.outline || input.assets?.worldNotes || input.assets?.characters),
      detail: "已将 IndexedDB 中的大纲、世界观、角色资料映射到 InkOS Core 工作区。",
      createdAt: now,
    },
    ...validation.warnings.map((warning, index) => ({
      id: `diagnostic-${Date.now()}-warning-${index}`,
      label: warning.category || "校验提示",
      ok: false,
      detail: warning.description,
      createdAt: now,
    })),
  ];

  return {
    ok: true,
    action: input.action,
    message: "InkOS Core 已完成环境诊断。",
    content: formatDiagnosticsContent(validation),
    project: input.project,
    assetsPatch: {
      diagnostics,
    },
    raw: {
      passed: validation.passed,
      warningCount: validation.warnings.length,
    },
  };
}

async function withTempBookWorkspace<T>(
  input: InkosCoreActionInput,
  book: CoreBookConfig,
  run: (bookDir: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "sxy-inkos-"));
  const bookDir = join(root, book.id);

  try {
    await writeTempBookFiles(bookDir, input, book);
    return await run(bookDir);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function writeTempBookFiles(
  bookDir: string,
  input: InkosCoreActionInput,
  book: CoreBookConfig,
) {
  const storyDir = join(bookDir, "story");
  const outlineDir = join(storyDir, "outline");
  const roleDir = join(storyDir, "roles", "主要角色");
  const chaptersDir = join(bookDir, "chapters");

  await Promise.all([
    mkdir(outlineDir, { recursive: true }),
    mkdir(roleDir, { recursive: true }),
    mkdir(chaptersDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(bookDir, "book.json"), JSON.stringify(book, null, 2)),
    writeFile(join(outlineDir, "story_frame.md"), input.assets?.worldNotes || input.project.world || input.project.premise),
    writeFile(join(outlineDir, "volume_map.md"), input.assets?.outline || renderChapterPlan(input.project)),
    writeFile(join(storyDir, "story_bible.md"), input.assets?.worldNotes || input.project.world || input.project.premise),
    writeFile(join(storyDir, "volume_outline.md"), input.assets?.outline || renderChapterPlan(input.project)),
    writeFile(join(storyDir, "book_rules.md"), input.assets?.settings || input.project.premise),
    writeFile(join(storyDir, "current_state.md"), input.assets?.settings || input.project.premise),
    writeFile(join(storyDir, "pending_hooks.md"), input.assets?.outline || "暂无明确伏笔。"),
    writeFile(join(storyDir, "particle_ledger.md"), input.assets?.settings || "暂无粒子账本。"),
    writeFile(join(storyDir, "chapter_summaries.md"), renderChapterPlan(input.project)),
    writeFile(join(storyDir, "subplot_board.md"), input.assets?.outline || "暂无支线面板。"),
    writeFile(join(storyDir, "emotional_arcs.md"), input.assets?.characters || "暂无情绪弧线。"),
    writeFile(join(storyDir, "character_matrix.md"), input.assets?.characters || input.project.protagonist),
    writeFile(join(storyDir, "style_guide.md"), input.assets?.settings || input.project.premise),
    writeFile(join(roleDir, "主角.md"), input.assets?.characters || input.project.protagonist),
  ]);

  await Promise.all(
    input.project.chapters.map((chapter) =>
      writeFile(
        join(
          chaptersDir,
          `${String(chapter.number).padStart(4, "0")}-${sanitizeFileName(chapter.title)}.md`,
        ),
        `# ${chapter.title}\n\n${chapter.focus}`,
      ),
    ),
  );
}

function buildCoreExternalContext(input: InkosCoreActionInput): string {
  return [
    input.instruction ? `# 用户补充指令\n${input.instruction}` : "",
    `# 当前工程\n${buildServerPromptPreview(input.project)}`,
    input.assets?.outline ? `# 已有大纲\n${input.assets.outline}` : "",
    input.assets?.worldNotes ? `# 世界观资料\n${input.assets.worldNotes}` : "",
    input.assets?.characters ? `# 角色资料\n${input.assets.characters}` : "",
    input.assets?.settings ? `# 设定资料\n${input.assets.settings}` : "",
    input.recentMessages?.length
      ? `# 最近会话\n${input.recentMessages
          .slice(-8)
          .map((message) => `${message.role}: ${message.content}`)
          .join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildServerPromptPreview(project: InkosNovelProject): string {
  return [
    `书名：${project.title}`,
    `题材：${project.genre}`,
    `阶段：${project.currentStage}`,
    `世界观：${project.world}`,
    `主角：${project.protagonist}`,
    `核心设定：${project.premise}`,
    `目标：按 ${project.chapterWordCount} 字/章推进，共 ${project.targetChapters} 章。`,
  ].join("\n");
}

function formatArchitectContent(
  action: InkosCoreAction,
  output: CoreArchitectOutput,
): string {
  const sections =
    action === "outline"
      ? [
          ["全书故事框架", output.storyFrame || output.storyBible],
          ["卷纲 / 章节推进", output.volumeMap || output.volumeOutline],
          ["节奏原则", output.rhythmPrinciples],
          ["待回收伏笔", output.pendingHooks],
        ]
      : [
          ["故事圣经", output.storyBible],
          ["角色设定", formatCoreRoles(output.roles)],
          ["写作规则", output.bookRules],
          ["当前状态", output.currentState],
        ];

  return sections
    .filter(([, content]) => Boolean(content))
    .map(([title, content]) => `## ${title}\n\n${content}`)
    .join("\n\n");
}

function formatWriteChapterContent(output: CoreWriteChapterOutput): string {
  return [
    `# ${output.title}`,
    output.content,
    "## 章节摘要",
    output.chapterSummary,
    output.postWriteWarnings.length
      ? `## 写后提醒\n${output.postWriteWarnings.map(formatIssueLine).join("\n")}`
      : "",
    output.postWriteErrors.length
      ? `## 写后错误\n${output.postWriteErrors.map(formatIssueLine).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatReviewContent(audit: CoreAuditResult): string {
  return [
    `## 审稿结论\n${audit.passed ? "通过" : "需要修改"}${audit.overallScore !== undefined ? `，评分 ${audit.overallScore}` : ""}`,
    audit.summary ? `## 总结\n${audit.summary}` : "",
    audit.issues.length
      ? `## 问题清单\n${audit.issues
          .map(
            (issue, index) =>
              `${index + 1}. [${issue.severity}] ${issue.category}：${issue.description}${issue.suggestion ? `\n   建议：${issue.suggestion}` : ""}`,
          )
          .join("\n")}`
      : "## 问题清单\n未发现明显问题。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatRadarContent(result: CoreRadarResult): string {
  return [
    `## 市场概览\n${result.marketSummary}`,
    `## 推荐方向\n${result.recommendations
      .map(
        (item, index) =>
          `${index + 1}. ${item.platform} / ${item.genre} / ${Math.round(item.confidence * 100)}%\n${item.concept}\n${item.reasoning}`,
      )
      .join("\n\n")}`,
  ].join("\n\n");
}

function formatDiagnosticsContent(validation: CoreValidationResult): string {
  return [
    `## 诊断结论\n${validation.passed ? "通过" : "发现风险"}`,
    validation.warnings.length
      ? `## 风险提示\n${validation.warnings
          .map((warning, index) => `${index + 1}. ${warning.category}：${warning.description}`)
          .join("\n")}`
      : "## 风险提示\n未发现状态卡或伏笔池硬冲突。",
  ].join("\n\n");
}

function formatCoreRoles(roles: CoreArchitectOutput["roles"]): string {
  return (roles ?? [])
    .map(
      (role) =>
        `## ${role.tier === "major" ? "主要角色" : "次要角色"}：${role.name}\n${role.content}`,
    )
    .join("\n\n");
}

function formatIssueLine(issue: CoreIssue): string {
  const label = issue.code || issue.category || issue.severity || "issue";
  return `- [${label}] ${issue.message || issue.description || issue.suggestion || "未提供详情"}`;
}

function findReviewTarget(input: InkosCoreActionInput): string {
  const instruction = input.instruction?.trim();

  if (instruction && !["审稿", "帮我审稿", "review"].includes(instruction.toLowerCase())) {
    return instruction;
  }

  const assistantMessage = [...(input.recentMessages ?? [])]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.length > 80);

  if (assistantMessage) return assistantMessage.content;

  const userMessage = [...(input.recentMessages ?? [])]
    .reverse()
    .find((message) => message.role === "user" && message.content.length > 80);

  return userMessage?.content || input.assets?.outline || "";
}

function nextChapterNumber(project: InkosNovelProject): number {
  return Math.max(0, ...project.chapters.map((chapter) => chapter.number)) + 1;
}

function parseTargetChapterNumber(instruction?: string): number | null {
  const match = instruction?.match(/目标章号[:：]\s*(\d+)/);
  const chapterNumber = Number(match?.[1]);

  return Number.isInteger(chapterNumber) && chapterNumber > 0
    ? chapterNumber
    : null;
}

function extractInstructionSection(
  instruction: string | undefined,
  heading: string,
): string {
  if (!instruction) return "";

  const start = instruction.indexOf(heading);

  if (start < 0) return "";

  const contentStart = start + heading.length;
  const rest = instruction.slice(contentStart).trim();
  const nextHeading = rest.search(/\n##\s+/);

  return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
}

function upsertChapter(
  chapters: InkosChapter[],
  nextChapter: InkosChapter,
): InkosChapter[] {
  const withoutExisting = chapters.filter(
    (chapter) => chapter.number !== nextChapter.number,
  );

  return [...withoutExisting, nextChapter].sort(
    (first, second) => first.number - second.number,
  );
}

function appendSection(existing: string | undefined, title: string, content: string): string {
  return [existing, `## ${title}\n${content}`].filter(Boolean).join("\n\n");
}

function renderChapterPlan(project: InkosNovelProject): string {
  if (project.chapters.length === 0) {
    return `# 章节计划\n\n围绕「${project.premise}」推进第一卷。`;
  }

  return project.chapters
    .map((chapter) => `## 第 ${chapter.number} 章：${chapter.title}\n${chapter.focus}`)
    .join("\n\n");
}

function inferCoreGenreId(genre: string): string {
  const normalized = genre.toLowerCase();

  if (genre.includes("都市") || normalized.includes("urban")) return "urban";
  if (genre.includes("玄幻") || normalized.includes("xuanhuan")) return "xuanhuan";
  if (genre.includes("仙侠") || normalized.includes("xianxia")) return "xianxia";
  if (genre.includes("科幻") || normalized.includes("sci")) return "sci-fi";
  if (genre.includes("悬疑") || genre.includes("惊悚") || genre.includes("恐怖")) {
    return "horror";
  }
  if (genre.includes("历史")) return "history";
  if (genre.includes("奇幻") || normalized.includes("fantasy")) return "fantasy";

  return "other";
}

function inferCorePlatform(platform: string): CoreBookConfig["platform"] {
  if (platform.includes("番茄") || platform.toLowerCase().includes("tomato")) {
    return "tomato";
  }
  if (platform.includes("飞卢") || platform.toLowerCase().includes("feilu")) {
    return "feilu";
  }
  if (platform.includes("起点") || platform.toLowerCase().includes("qidian")) {
    return "qidian";
  }

  return "other";
}

function slugifyBookId(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `book-${Date.now()}`;
}

function sanitizeFileName(value: string): string {
  return value.trim().replace(/[/:*?"<>|\\]+/g, "-") || "chapter";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

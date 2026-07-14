import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, it } from "node:test";

await register("../node-test-resolve.mjs", import.meta.url);

const { createDefaultNovelAssets, validateCommitWriteChapterResultInput } =
  await import("../../../../lib/novel-store.ts");
const {
  evaluateAuditBlocking,
  parseChapterAudit,
  runWriteChapterPipeline,
  buildDefaultWriteChapterPipelineAdapters,
} = await import("./run-write-chapter-pipeline.ts");

/** @typedef {import("../../../../lib/novel-store.ts").StoredNovelBook} StoredNovelBook */
/** @typedef {import("../../../../lib/novel-store.ts").StoredNovelTask} StoredNovelTask */
/** @typedef {import("../types.ts").ChapterAudit} ChapterAudit */
/** @typedef {import("../types.ts").WriteChapterPipelineAdapters} WriteChapterPipelineAdapters */

const NOW = "2026-07-14T12:00:00.000Z";
const TASK_ID = "task-pipeline-1";

const DRAFT_CONTENT = [
  "# 第二章 试炼",
  "",
  "主角进入试炼场。",
  "",
  "## 章节摘要",
  "试炼开始。",
  "",
  "## 资产增量",
  "### 角色状态",
  "- 主角：进入试炼场",
  "### 新增伏笔",
  "- 神秘石碑",
  "### 回收伏笔",
  "",
  "### 世界观增量",
  "- 试炼规则",
].join("\n");

const REVISED_CONTENT = [
  "# 第二章 试炼",
  "",
  "主角带着明确动机进入试炼场。",
  "",
  "## 章节摘要",
  "试炼开始（修订）。",
  "",
  "## 资产增量",
  "### 角色状态",
  "- 主角：动机明确后进入试炼场",
  "### 新增伏笔",
  "- 神秘石碑（修订）",
  "### 回收伏笔",
  "",
  "### 世界观增量",
  "- 试炼规则（修订）",
].join("\n");

function buildPassAudit() {
  /** @type {ChapterAudit} */
  const audit = {
    totalScore: 88,
    dimensions: [
      { key: "continuity", score: 90, issues: [] },
      { key: "character", score: 85, issues: [] },
      { key: "plot", score: 88, issues: [] },
      { key: "style", score: 86, issues: [] },
      { key: "pacing", score: 84, issues: [] },
      { key: "foreshadowing", score: 87, issues: [] },
      { key: "length", score: 90, issues: [] },
    ],
  };
  return audit;
}

function buildCriticalAudit() {
  /** @type {ChapterAudit} */
  const audit = {
    totalScore: 52,
    dimensions: [
      {
        key: "plot",
        score: 40,
        issues: [
          {
            severity: "critical",
            evidence: "主角动机不足",
            suggestion: "补一处选择压力",
          },
        ],
      },
      { key: "continuity", score: 70, issues: [] },
      { key: "character", score: 65, issues: [] },
      { key: "style", score: 75, issues: [] },
      { key: "pacing", score: 68, issues: [] },
      { key: "foreshadowing", score: 72, issues: [] },
      { key: "length", score: 80, issues: [] },
    ],
  };
  return audit;
}

function buildBook() {
  const project = {
    title: "测试书",
    genre: "玄幻",
    premise: "少年修行",
    protagonist: "林凡",
    world: "修行世界",
    chapters: [
      {
        number: 2,
        title: "试炼",
        status: "planned",
        targetWords: 3000,
        focus: "进入试炼",
      },
    ],
    currentStage: "chapter-plan",
    chapterWordCount: 3000,
  };

  return {
    id: "book-1",
    title: project.title,
    genre: project.genre,
    premise: project.premise,
    project,
    assets: createDefaultNovelAssets(project),
    archived: false,
    sortIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildTask() {
  return {
    id: TASK_ID,
    bookId: "book-1",
    sessionId: "session-1",
    action: "write-chapter",
    label: "写下一章",
    status: "running",
    logs: [{ id: "log-1", message: "任务开始。", createdAt: NOW }],
    targetChapterNumber: 2,
    targetChapterTitle: "试炼",
    startedAt: NOW,
  };
}

function createRecordingAdapters(handlers) {
  const calls: string[] = [];
  const auditedContents: string[] = [];
  let auditCallIndex = 0;

  return {
    calls,
    auditedContents,
    adapters: {
      planChapter: async (context) => {
        calls.push("plan");
        return handlers.planChapter
          ? handlers.planChapter(context)
          : `第 ${context.target.number} 章 intent`;
      },
      draftChapter: async (context) => {
        calls.push("draft");
        return handlers.draftChapter
          ? handlers.draftChapter(context)
          : DRAFT_CONTENT;
      },
      auditChapter: async (context) => {
        calls.push(context.attempt === 1 ? "audit" : "audit-retry");
        auditedContents.push(context.content);
        if (handlers.auditChapter) {
          return handlers.auditChapter(context);
        }

        const responses = handlers.auditResponses ?? [
          JSON.stringify(buildPassAudit()),
        ];
        const response = responses[Math.min(auditCallIndex, responses.length - 1)]!;
        auditCallIndex += 1;
        return response;
      },
      reviseChapter: async (context) => {
        calls.push("revise");
        return handlers.reviseChapter
          ? handlers.reviseChapter(context)
          : handlers.reviseContent ?? REVISED_CONTENT;
      },
    },
  };
}

describe("parseChapterAudit", () => {
  it("parses structured JSON audits", () => {
    const parsed = parseChapterAudit(
      JSON.stringify({
        totalScore: 82,
        dimensions: [
          {
            key: "plot",
            score: 70,
            issues: [
              {
                severity: "warning",
                evidence: "节奏略慢",
                suggestion: "压缩过渡",
              },
            ],
          },
        ],
      }),
    );

    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.audit.totalScore, 82);
      assert.equal(parsed.audit.dimensions.length, 7);
    }
  });

  it("does not treat invalid output as a pass", () => {
    const parsed = parseChapterAudit("这不是审核报告");
    assert.equal(parsed.ok, false);
  });
});

describe("evaluateAuditBlocking", () => {
  it("flags critical issues and low scores", () => {
    const result = evaluateAuditBlocking(buildCriticalAudit(), {
      minTotalScore: 70,
      minDimensionScore: 60,
      maxRevisionAttempts: 1,
    });

    assert.equal(result.blocking, true);
    assert.match(result.reasons.join(" "), /critical|总分/);
  });
});

describe("runWriteChapterPipeline", () => {
  it("runs Writer → Auditor → facts → validation and prepares commit input", async () => {
    const { adapters, calls } = createRecordingAdapters({});
    const stages: string[] = [];

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      now: () => NOW,
      onStageChange: (update) => {
        stages.push(update.stage);
      },
    });

    assert.equal(result.terminal, "completed");
    if (result.terminal === "completed" || result.terminal === "completed_with_attention") {
      assert.ok(result.commitInput);
      assert.equal(result.commitInput.completedTask.status, "success");
      assert.equal(result.selectedVersion.content, DRAFT_CONTENT);
      assert.match(result.commitInput.finalChapter.content, /试炼场/);
      assert.doesNotThrow(() => {
        validateCommitWriteChapterResultInput(result.commitInput);
      });
    }

    assert.deepEqual(calls, ["plan", "draft", "audit"]);
    assert.deepEqual(
      stages.filter((stage) =>
        [
          "preparing_context",
          "planning",
          "drafting",
          "auditing",
          "extracting_facts",
          "syncing_assets",
          "validating_state",
          "committing",
          "completed",
        ].includes(stage),
      ),
      [
        "preparing_context",
        "planning",
        "drafting",
        "auditing",
        "extracting_facts",
        "syncing_assets",
        "validating_state",
        "committing",
        "completed",
      ],
    );
  });

  it("retries audit parsing once then completes with attention", async () => {
    const { adapters } = createRecordingAdapters({
      auditResponses: ["无法解析的审核输出", "仍然无法解析"],
    });

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      now: () => NOW,
    });

    assert.equal(result.terminal, "completed_with_attention");
    if (result.terminal === "completed_with_attention") {
      assert.equal(result.taskStatus, "completed_with_attention");
      assert.equal(result.commitInput.completedTask.status, "completed_with_attention");
      assert.match(result.attentionReason ?? "", /无法解析/);
    }
  });

  it("revises at most configured times and only syncs the final version", async () => {
    const { adapters, auditedContents } = createRecordingAdapters({
      auditResponses: [
        JSON.stringify(buildCriticalAudit()),
        JSON.stringify(buildPassAudit()),
      ],
    });

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      config: { maxRevisionAttempts: 1 },
      now: () => NOW,
    });

    assert.equal(result.terminal, "completed");
    if (result.terminal === "completed" || result.terminal === "completed_with_attention") {
      assert.equal(result.selectedVersion.content, REVISED_CONTENT);
      assert.match(result.commitInput.finalChapter.content, /明确动机/);
    }

    assert.deepEqual(auditedContents, [DRAFT_CONTENT, REVISED_CONTENT]);
  });

  it("marks attention when critical issues remain after max revisions", async () => {
    const { adapters } = createRecordingAdapters({
      auditResponses: [
        JSON.stringify(buildCriticalAudit()),
        JSON.stringify(buildCriticalAudit()),
      ],
    });

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      config: { maxRevisionAttempts: 1 },
      now: () => NOW,
    });

    assert.equal(result.terminal, "completed_with_attention");
    if (result.terminal === "completed_with_attention") {
      assert.match(result.attentionReason ?? "", /阻塞问题/);
      assert.equal(result.checkpoint.revisionAttempts, 1);
    }
  });

  it("persists chapter audit on commit input when pipeline produces structured audit", async () => {
    const { adapters } = createRecordingAdapters({});

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      now: () => NOW,
    });

    assert.equal(result.terminal, "completed");
    if (result.terminal === "completed" || result.terminal === "completed_with_attention") {
      assert.equal(result.commitInput.finalChapter.reviews.length, 1);
      assert.equal(
        result.commitInput.finalChapter.activeReviewId,
        result.commitInput.completedTask.auditId,
      );
      assert.equal(result.commitInput.finalChapterVersion.reviews.length, 1);
      assert.equal(result.commitInput.finalChapter.reviews[0]?.score, 88);
      assert.equal(result.commitInput.finalChapter.reviews[0]?.verdict, "approved");
    }
  });

  it("returns cancelled without commit artifacts when aborted before commit", async () => {
    const controller = new AbortController();
    const { adapters } = createRecordingAdapters({
      auditChapter: async () => {
        controller.abort();
        return JSON.stringify(buildPassAudit());
      },
    });

    const result = await runWriteChapterPipeline({
      book: buildBook(),
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      task: buildTask(),
      sessionId: "session-1",
      assistantMessageId: "assistant-1",
      label: "写下一章",
      startedAt: NOW,
      adapters,
      signal: controller.signal,
      now: () => NOW,
    });

    assert.equal(result.terminal, "cancelled");
    assert.equal("commitInput" in result, false);
    assert.match(result.errorMessage, /取消/);
  });
});

describe("buildDefaultWriteChapterPipelineAdapters", () => {
  it("appends structured-json constraint on audit retry attempts", async () => {
    const instructions = [];
    const adapters = buildDefaultWriteChapterPipelineAdapters({
      writeInstruction: "写章节",
      streamAction: async (_action, instruction) => {
        instructions.push(instruction);
        return JSON.stringify(buildPassAudit());
      },
    });

    await adapters.auditChapter({
      bookId: "book-1",
      project: buildBook().project,
      assets: buildBook().assets,
      chapters: [],
      target: {
        number: 2,
        title: "试炼",
        focus: "进入试炼",
        targetWords: 3000,
        reason: "planned",
      },
      taskId: TASK_ID,
      intent: "intent",
      content: DRAFT_CONTENT,
      attempt: 2,
    });

    assert.equal(instructions.length, 1);
    assert.match(
      instructions[0] ?? "",
      /请仅以结构化 JSON 重新输出审核报告，勿输出解释性散文/,
    );
  });
});

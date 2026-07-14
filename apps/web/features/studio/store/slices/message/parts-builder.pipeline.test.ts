import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { register } from "node:module";

await register("../../../actions/node-test-resolve.mjs", import.meta.url);

const { buildWriteChapterFinalAssistantParts } = await import("./parts-builder.ts");
const { buildWriteChapterPipelineTimelineView } = await import(
  "../../../actions/writing/write-chapter-pipeline-timeline.ts"
);

describe("buildWriteChapterFinalAssistantParts", () => {
  it("keeps audit warnings out of chapter prose", () => {
    const timeline = buildWriteChapterPipelineTimelineView({
      checkpoint: {
        stage: "completed_with_attention",
        stageTimeline: [],
        revisionAttempts: 1,
        auditParseAttempts: 1,
        draftVersionIds: ["draft-1"],
        attentionReason: "仍有阻塞问题未完全修复：主角动机不足",
      },
      audit: {
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
      },
      draftContent: "# 第二章 试炼\n\n正文。",
      terminal: "completed_with_attention",
      attentionReason: "仍有阻塞问题未完全修复：主角动机不足",
    });

    const parts = buildWriteChapterFinalAssistantParts({
      label: "写下一章",
      progressMessages: ["第 2 章《试炼》已保存"],
      resultContent: "# 第二章 试炼\n\n正文。",
      startedAt: "2026-07-14T12:00:00.000Z",
      completionSummary: "第 2 章《试炼》已保存",
      pipelineTimeline: timeline,
      attentionReason: timeline.attentionReason,
      terminal: "completed_with_attention",
    });

    const resultPart = parts.find((part) => part.type === "result");
    assert.ok(resultPart);
    assert.equal(resultPart.content, "# 第二章 试炼\n\n正文。");
    assert.doesNotMatch(resultPart.content, /主角动机不足|阻塞问题/);

    const progressPart = parts.find((part) => part.type === "progress");
    assert.ok(progressPart?.pipelineTimeline);
    assert.equal(progressPart.pipelineTimeline?.auditIssues?.length, 1);
  });
});

import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, it } from "node:test";

await register("../actions/node-test-resolve.mjs", import.meta.url);

const { fromStoredMessage, toStoredMessage } = await import("./message-bridge.ts");

describe("message-bridge parts persistence", () => {
  it("restores stored parts including pipelineTimeline on reload", () => {
    const parts = [
      {
        type: "progress",
        label: "写下一章",
        steps: [{ message: "第 2 章《试炼》已保存", at: 1 }],
        status: "completed",
        startedAt: "2026-07-14T12:00:00.000Z",
        completedAt: "2026-07-14T12:01:00.000Z",
        summary: "第 2 章《试炼》已保存",
        pipelineTimeline: {
          revisionCount: 0,
          auditTotalScore: 88,
        },
      },
      {
        type: "result",
        title: "写下一章",
        content: "# 第二章 试炼\n\n正文。",
      },
    ];

    const stored = {
      id: "assistant-1",
      sessionId: "session-1",
      role: "assistant" as const,
      content: "写下一章\n\n第 2 章《试炼》已保存\n\n# 第二章 试炼\n\n正文。",
      createdAt: "2026-07-14T12:01:00.000Z",
      status: "sent" as const,
      parts,
    };

    const restored = fromStoredMessage(stored);
    const progressPart = restored.parts.find((part) => part.type === "progress");
    assert.ok(progressPart?.pipelineTimeline);
    assert.equal(progressPart.pipelineTimeline?.auditTotalScore, 88);
  });

  it("persists structured parts when converting studio messages", () => {
    const studioMessage = {
      id: "assistant-2",
      role: "assistant" as const,
      parts: [
        {
          type: "progress" as const,
          label: "写下一章",
          steps: [{ message: "已保存", at: 1 }],
          status: "completed" as const,
          pipelineTimeline: {
            revisionCount: 1,
          },
        },
        {
          type: "result" as const,
          title: "写下一章",
          content: "正文",
        },
      ],
      createdAt: "2026-07-14T12:01:00.000Z",
    };

    const stored = toStoredMessage(studioMessage, "session-1");
    assert.ok(stored.parts?.length);
    assert.equal(stored.parts?.[0]?.type, "progress");
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  flattenPartsToContent,
  isLegacyCoreMarkdown,
} from "../../store/slices/message/parts-builder.ts";

test("flattenPartsToContent flattens progress steps", () => {
  const content = flattenPartsToContent([
    { type: "progress", label: "写下一章", steps: [{ message: "开始", at: 1 }] },
    { type: "result", title: "完成", content: "chapter body" },
  ]);
  assert.match(content, /## 写下一章/);
  assert.match(content, /- 开始/);
  assert.match(content, /chapter body/);
});

test("isLegacyCoreMarkdown detects old progress format", () => {
  const content = "## 写下一章\n\n- 等待任务开始";
  assert.equal(isLegacyCoreMarkdown(content), true);
  assert.equal(isLegacyCoreMarkdown("plain chat reply"), false);
});

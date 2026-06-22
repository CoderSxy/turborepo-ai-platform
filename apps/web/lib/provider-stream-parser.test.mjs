import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProviderTextStream } from "./provider-stream-parser.ts";

const encoder = new TextEncoder();

function makeChunkedStream(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

async function readText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

test("normalizes OpenAI-compatible delta.content SSE chunks", async () => {
  const upstream = makeChunkedStream([
    'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
    "data: [DONE]\n\n",
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "openai"));

  assert.equal(text, "你好");
});

test("falls back to OpenAI-compatible reasoning_content when content is absent", async () => {
  const upstream = makeChunkedStream([
    'data: {"choices":[{"delta":{"reasoning_content":"思考"}}]}\n\n',
    'data: {"choices":[{"delta":{"reasoning_content":"过程"}}]}\n\n',
    "data: [DONE]\n\n",
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "openai"));

  assert.equal(text, "思考过程");
});

test("prefers OpenAI-compatible content over reasoning_content", async () => {
  const upstream = makeChunkedStream([
    'data: {"choices":[{"delta":{"reasoning_content":"隐藏"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"正文"}}]}\n\n',
    'data: {"choices":[{"delta":{"reasoning_content":"忽略"}}]}\n\n',
    "data: [DONE]\n\n",
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "openai"));

  assert.equal(text, "正文");
});

test("normalizes Anthropic content_block_delta text_delta SSE chunks", async () => {
  const upstream = makeChunkedStream([
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"第一"}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"段"}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "anthropic"));

  assert.equal(text, "第一段");
});

test("normalizes Ollama JSON line chunks", async () => {
  const upstream = makeChunkedStream([
    '{"message":{"content":"本地"}}\n',
    '{"message":{"content":"模型"}}\n',
    '{"done":true}\n',
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "ollama"));

  assert.equal(text, "本地模型");
});

test("handles multi-line data SSE events", async () => {
  const upstream = makeChunkedStream([
    'event: message\n',
    'data: {"choices":[{"delta":{"content":',
    '"多行"}}]}\n\n',
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "openai"));

  assert.equal(text, "多行");
});

test("keeps partial SSE events buffered across chunks", async () => {
  const upstream = makeChunkedStream([
    'data: {"choices":[{"delta":{"content":"分',
    '片"}}]}\n\n',
  ]);

  const text = await readText(normalizeProviderTextStream(upstream, "openai"));

  assert.equal(text, "分片");
});

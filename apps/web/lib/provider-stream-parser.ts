import type { ModelApiFormat } from "./model-settings";

type ParsedProviderStreamEvent = {
  readonly event?: string;
  readonly data?: string;
};

export function normalizeProviderTextStream(
  body: ReadableStream<Uint8Array> | null,
  apiFormat: ModelApiFormat,
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const streamState = {
    emittedContent: false,
    reasoningContent: "",
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!body) {
        controller.close();
        return;
      }

      const reader = body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parsed =
            apiFormat === "ollama"
              ? parseJsonLineEvents(buffer)
              : parseSseEvents(buffer);
          buffer = parsed.rest;
          enqueueTextDeltas(
            controller,
            encoder,
            parsed.events,
            apiFormat,
            streamState,
          );
        }

        const tail = decoder.decode();
        const finalBuffer = buffer + tail;
        const finalParsed =
          apiFormat === "ollama"
            ? parseJsonLineEvents(`${finalBuffer}\n`)
            : parseSseEvents(`${finalBuffer}\n\n`);
        enqueueTextDeltas(
          controller,
          encoder,
          finalParsed.events,
          apiFormat,
          streamState,
        );

        if (!streamState.emittedContent && streamState.reasoningContent) {
          controller.enqueue(encoder.encode(streamState.reasoningContent));
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

function enqueueTextDeltas(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  events: ParsedProviderStreamEvent[],
  apiFormat: ModelApiFormat,
  streamState: {
    emittedContent: boolean;
    reasoningContent: string;
  },
) {
  for (const event of events) {
    const delta = extractStreamText(event.data ?? "", apiFormat);

    if (!delta.text) continue;

    if (delta.kind === "reasoning") {
      streamState.reasoningContent += delta.text;
      continue;
    }

    streamState.emittedContent = true;
    controller.enqueue(encoder.encode(delta.text));
  }
}

function parseSseEvents(buffer: string): {
  readonly events: ParsedProviderStreamEvent[];
  readonly rest: string;
} {
  const chunks = buffer.split(/\n\n/);
  const rest = chunks.pop() ?? "";
  const events: ParsedProviderStreamEvent[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    let eventName: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }

    if (eventName || dataLines.length > 0) {
      events.push({
        ...(eventName ? { event: eventName } : {}),
        ...(dataLines.length > 0 ? { data: dataLines.join("\n") } : {}),
      });
    }
  }

  return { events, rest };
}

function parseJsonLineEvents(buffer: string): {
  readonly events: ParsedProviderStreamEvent[];
  readonly rest: string;
} {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";
  const events = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((data) => ({ data }));

  return { events, rest };
}

function extractStreamText(
  payload: string,
  apiFormat: ModelApiFormat,
): { text: string; kind: "content" | "reasoning" } {
  const trimmed = payload.trim();

  if (!trimmed) return emptyStreamText();

  const data = trimmed.startsWith("data:")
    ? trimmed.slice("data:".length).trim()
    : trimmed;

  if (!data || data === "[DONE]") return emptyStreamText();

  try {
    const json = JSON.parse(data);

    if (apiFormat === "ollama") {
      return contentStreamText(extractTextPart(json.message?.content));
    }

    if (apiFormat === "anthropic") {
      if (
        json.type === "content_block_delta" &&
        json.delta?.type === "text_delta"
      ) {
        return contentStreamText(
          typeof json.delta?.text === "string" ? json.delta.text : "",
        );
      }

      return emptyStreamText();
    }

    if (
      json.type === "response.output_text.delta" &&
      typeof json.delta === "string"
    ) {
      return contentStreamText(json.delta);
    }

    const delta = json.choices?.[0]?.delta;
    const content = extractTextPart(delta?.content);

    if (content) {
      return contentStreamText(content);
    }

    return reasoningStreamText(extractTextPart(delta?.reasoning_content));
  } catch {
    return emptyStreamText();
  }
}

function contentStreamText(text: string) {
  return { text, kind: "content" as const };
}

function reasoningStreamText(text: string) {
  return { text, kind: "reasoning" as const };
}

function emptyStreamText() {
  return contentStreamText("");
}

function extractTextPart(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return "";

        const part = item as { text?: unknown; content?: unknown };

        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .join("");
  }

  return "";
}

/**
 * AI providers for AI notes with the host's own key. The browser calls the provider
 * directly: the key stays on this device, and FaceOn's server never sees it or the
 * transcript. All five accept calls from web pages (CORS).
 */
import { NOTES_SCHEMA } from "./notes";

export const PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "openrouter",
] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const isProvider = (value: unknown): value is ProviderId =>
  PROVIDERS.some((id) => id === value);

/**
 * What the settings show for each: its name, models to pick from, where to get a key, and
 * whether FaceOn transcribes meetings with it (rather than only on each person's device).
 */
export const PROVIDER_INFO: Record<
  ProviderId,
  {
    name: string;
    models: readonly string[];
    keyUrl: string;
    transcribes: boolean;
  }
> = {
  openai: {
    name: "OpenAI",
    models: ["gpt-5-mini", "gpt-5", "gpt-5-nano"],
    keyUrl: "https://platform.openai.com/api-keys",
    transcribes: false,
  },
  anthropic: {
    name: "Anthropic",
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"],
    keyUrl: "https://console.anthropic.com/settings/keys",
    transcribes: false,
  },
  google: {
    name: "Google",
    models: ["gemini-3.8-flash", "gemini-4-argon", "gemini-3.5-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
    transcribes: false,
  },
  deepseek: {
    name: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyUrl: "https://platform.deepseek.com/api_keys",
    transcribes: false,
  },
  openrouter: {
    name: "OpenRouter",
    models: ["openrouter/auto"],
    keyUrl: "https://openrouter.ai/keys",
    transcribes: false,
  },
};

/** The model a provider is asked for when nobody chose one: the first listed. */
export const defaultModel = (provider: ProviderId): string =>
  PROVIDER_INFO[provider].models[0] ?? "";

export type ProviderCall = {
  provider: ProviderId;
  key: string;
  model: string;
  system: string;
  prompt: string;
  /** A short answer, for testing the key. */
  brief?: boolean;
};

/** The HTTP request for one call to a provider. */
export function providerRequest(call: ProviderCall): {
  url: string;
  init: RequestInit;
} {
  const json = { "content-type": "application/json" };
  const chat = [
    { role: "system", content: call.system },
    { role: "user", content: call.prompt },
  ];
  switch (call.provider) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        init: {
          method: "POST",
          headers: { ...json, authorization: `Bearer ${call.key}` },
          body: JSON.stringify({
            model: call.model,
            messages: chat,
            ...(call.brief
              ? { max_completion_tokens: 16 }
              : {
                  response_format: {
                    type: "json_schema",
                    json_schema: {
                      name: "meeting_notes",
                      schema: NOTES_SCHEMA,
                      strict: true,
                    },
                  },
                }),
          }),
        },
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        init: {
          method: "POST",
          headers: {
            ...json,
            "x-api-key": call.key,
            "anthropic-version": "2023-06-01",
            // Anthropic asks pages that call it directly to say so.
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: call.model,
            max_tokens: call.brief ? 16 : 8192,
            system: call.system,
            messages: [{ role: "user", content: call.prompt }],
          }),
        },
      };
    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(call.model)}:generateContent`,
        init: {
          method: "POST",
          headers: { ...json, "x-goog-api-key": call.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: call.system }] },
            contents: [{ role: "user", parts: [{ text: call.prompt }] }],
            generationConfig: call.brief
              ? { maxOutputTokens: 16 }
              : { responseMimeType: "application/json" },
          }),
        },
      };
    case "deepseek":
    case "openrouter":
      return {
        url:
          call.provider === "deepseek"
            ? "https://api.deepseek.com/chat/completions"
            : "https://openrouter.ai/api/v1/chat/completions",
        init: {
          method: "POST",
          headers: { ...json, authorization: `Bearer ${call.key}` },
          body: JSON.stringify({
            model: call.model,
            messages: chat,
            ...(call.brief ? { max_tokens: 16 } : {}),
            // DeepSeek's JSON mode; OpenRouter's models vary, so the prompt asks instead.
            ...(call.provider === "deepseek" && !call.brief
              ? { response_format: { type: "json_object" } }
              : {}),
          }),
        },
      };
  }
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The text of a provider's answer; null when there's none. */
export function answerText(provider: ProviderId, body: unknown): string | null {
  const root = record(body);
  let text: string | undefined;
  if (provider === "anthropic") {
    text = list(root?.content)
      .map((part) => record(part))
      .filter((part) => part?.type === "text")
      .map((part) => String(part?.text ?? ""))
      .join("");
  } else if (provider === "google") {
    const content = record(record(list(root?.candidates)[0])?.content);
    text = list(content?.parts)
      .map((part) => String(record(part)?.text ?? ""))
      .join("");
  } else {
    const message = record(record(list(root?.choices)[0])?.message);
    text = typeof message?.content === "string" ? message.content : undefined;
  }
  return text ? text : null;
}

/** Why a call failed, in words the settings and the notes panel can show. */
export type ProviderFailure =
  "key" | "model" | "limit" | "unreachable" | "other";

export function failureOf(status: number): ProviderFailure {
  if (status === 401 || status === 403) return "key";
  if (status === 404) return "model";
  if (status === 402 || status === 429) return "limit";
  return "other";
}

export class ProviderError extends Error {
  constructor(
    readonly failure: ProviderFailure,
    /** What the provider said, shown as is. */
    readonly detail: string,
  ) {
    super(detail || failure);
    this.name = "ProviderError";
  }
}

/** The provider's own words about a failure, where it gives some. */
export function errorDetail(body: unknown): string {
  const error = record(body)?.error;
  if (typeof error === "string") return error;
  const message = record(error)?.message;
  return typeof message === "string" ? message.slice(0, 300) : "";
}

/** Calls a provider and returns its answer's text. */
export async function callProvider(
  call: ProviderCall,
  signal?: AbortSignal,
): Promise<string> {
  const { url, init } = providerRequest(call);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: signal ?? null });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProviderError("unreachable", "");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ProviderError(failureOf(response.status), errorDetail(body));
  }
  const text = answerText(call.provider, body);
  if (text === null && !call.brief) throw new ProviderError("other", "");
  return text ?? "";
}

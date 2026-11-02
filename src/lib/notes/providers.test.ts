import { afterEach, describe, expect, it, vi } from "vitest";

import {
  answerText,
  callProvider,
  defaultModel,
  errorDetail,
  failureOf,
  ProviderError,
  providerRequest,
  PROVIDERS,
  type ProviderCall,
} from "./providers";

const call = (provider: ProviderCall["provider"]): ProviderCall => ({
  provider,
  key: "sk-test",
  model: "some-model",
  system: "Be brief.",
  prompt: "Notes, please.",
});
const bodyOf = (init: RequestInit) =>
  JSON.parse(String(init.body)) as Record<string, unknown>;
const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

describe("providerRequest", () => {
  it("sends the key only to the provider, in its own header", () => {
    expect(headersOf(providerRequest(call("openai")).init).authorization).toBe(
      "Bearer sk-test",
    );
    expect(
      headersOf(providerRequest(call("deepseek")).init).authorization,
    ).toBe("Bearer sk-test");
    expect(
      headersOf(providerRequest(call("openrouter")).init).authorization,
    ).toBe("Bearer sk-test");
    expect(
      headersOf(providerRequest(call("anthropic")).init)["x-api-key"],
    ).toBe("sk-test");
    expect(
      headersOf(providerRequest(call("google")).init)["x-goog-api-key"],
    ).toBe("sk-test");
    for (const provider of PROVIDERS) {
      const { url } = providerRequest(call(provider));
      expect(new URL(url).protocol).toBe("https:");
      expect(url).not.toContain("sk-test");
    }
  });

  it("asks OpenAI for the notes' JSON Schema", () => {
    const body = bodyOf(providerRequest(call("openai")).init);
    expect(body).toMatchObject({
      model: "some-model",
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Notes, please." },
      ],
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
  });

  it("tells Anthropic the page calls it directly", () => {
    const { init } = providerRequest(call("anthropic"));
    expect(headersOf(init)["anthropic-dangerous-direct-browser-access"]).toBe(
      "true",
    );
    expect(bodyOf(init)).toMatchObject({
      system: "Be brief.",
      max_tokens: 8192,
    });
  });

  it("asks Google for JSON, with the model in the address", () => {
    const { url, init } = providerRequest(call("google"));
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/some-model:generateContent",
    );
    expect(bodyOf(init)).toMatchObject({
      systemInstruction: { parts: [{ text: "Be brief." }] },
      generationConfig: { responseMimeType: "application/json" },
    });
  });

  it("uses DeepSeek's JSON mode", () => {
    expect(
      bodyOf(providerRequest(call("deepseek")).init).response_format,
    ).toEqual({
      type: "json_object",
    });
  });

  it("keeps a key test short", () => {
    const brief = { ...call("openai"), brief: true };
    expect(bodyOf(providerRequest(brief).init)).toMatchObject({
      max_completion_tokens: 16,
    });
    expect(bodyOf(providerRequest(brief).init).response_format).toBeUndefined();
  });
});

describe("answerText", () => {
  it("reads each provider's answer", () => {
    expect(
      answerText("openai", { choices: [{ message: { content: "A" } }] }),
    ).toBe("A");
    expect(
      answerText("anthropic", {
        content: [
          { type: "text", text: "A" },
          { type: "text", text: "B" },
        ],
      }),
    ).toBe("AB");
    expect(
      answerText("google", {
        candidates: [{ content: { parts: [{ text: "G" }] } }],
      }),
    ).toBe("G");
  });

  it("is null when there's no answer", () => {
    expect(answerText("openai", { choices: [] })).toBeNull();
    expect(answerText("google", null)).toBeNull();
  });
});

describe("failures", () => {
  it("say what went wrong", () => {
    expect(failureOf(401)).toBe("key");
    expect(failureOf(404)).toBe("model");
    expect(failureOf(429)).toBe("limit");
    expect(failureOf(500)).toBe("other");
    expect(errorDetail({ error: { message: "Invalid API key" } })).toBe(
      "Invalid API key",
    );
    expect(errorDetail({ error: "Nope" })).toBe("Nope");
    expect(errorDetail(null)).toBe("");
  });
});

describe("callProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the answer's text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: "{}" } }] }),
      ),
    );
    await expect(callProvider(call("openai"))).resolves.toBe("{}");
  });

  it("names a refused key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { message: "Incorrect API key" } },
          { status: 401 },
        ),
      ),
    );
    const failure = await callProvider(call("openai")).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ProviderError);
    expect(failure).toMatchObject({
      failure: "key",
      detail: "Incorrect API key",
    });
  });

  it("says when the provider can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(callProvider(call("google"))).rejects.toMatchObject({
      failure: "unreachable",
    });
  });
});

describe("defaultModel", () => {
  it("is each provider's first model", () => {
    expect(defaultModel("openai")).toBe("gpt-5-mini");
    expect(defaultModel("openrouter")).toBe("openrouter/auto");
  });
});

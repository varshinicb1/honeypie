import { describe, expect, test } from "vitest";
import { createAIGateway } from "./index.js";

describe("AI gateway local-only mode", () => {
  test("routes completion and structured output to deterministic local fallback", async () => {
    const gateway = createAIGateway({ mode: "local", provider: "anthropic", seed: 123 });

    const completion = await gateway.complete({ purpose: "copywriting", prompt: "Describe Counter Plus" });
    const structured = await gateway.structuredOutput({
      purpose: "copywriting",
      prompt: "Generate store copy",
      fallback: { headline: "Counter Plus", subtitle: "Track simple counts" }
    });

    expect(completion.provider).toBe("local");
    expect(completion.text).toContain("Counter Plus");
    expect(structured).toEqual({ headline: "Counter Plus", subtitle: "Track simple counts" });
    expect(gateway.usage().totalTokens).toBe(0);
  });
});

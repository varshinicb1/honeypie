export interface CompletionRequest {
  purpose: "copywriting" | "vision" | "formFill" | string;
  prompt: string;
}

export interface CompletionResult {
  provider: string;
  text: string;
}

export interface StructuredRequest<T> {
  purpose: string;
  prompt: string;
  fallback: T;
}

export interface AIUsage {
  provider: string;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AIGateway {
  complete(req: CompletionRequest): Promise<CompletionResult>;
  structuredOutput<T>(req: StructuredRequest<T>): Promise<T>;
  usage(): AIUsage;
}

export interface AIGatewayOptions {
  mode: "cloud" | "local";
  provider: string;
  seed?: number;
}

export function createAIGateway(options: AIGatewayOptions): AIGateway {
  const provider = options.mode === "local" ? "local" : options.provider;
  return {
    async complete(req) {
      if (provider === "local") {
        return {
          provider,
          text: localCompletion(req.prompt)
        };
      }
      throw new Error(`AI provider '${provider}' is not wired yet; use --local-only for deterministic fallback mode.`);
    },
    async structuredOutput(req) {
      return req.fallback;
    },
    usage() {
      return { provider, totalTokens: 0, estimatedCostUsd: 0 };
    }
  };
}

function localCompletion(prompt: string): string {
  const subject = prompt.replace(/\s+/g, " ").trim();
  return `Local-only fallback summary for ${subject || "this app"}.`;
}

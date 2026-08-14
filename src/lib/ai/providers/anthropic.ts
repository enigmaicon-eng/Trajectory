import { NotConfiguredError, type AIProvider, type StructuredRequest, type StructuredResult, type TextRequest, type TextResult } from "../provider";

// Conforming stub. Proves the AIProvider abstraction without a live
// integration — ships as a real BYOK provider in a later phase.
export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  readonly model = "anthropic/claude-sonnet-4.6";

  async generateStructured<T>(_req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    throw new NotConfiguredError(this.id);
  }

  async generateText(_req: TextRequest): Promise<TextResult> {
    throw new NotConfiguredError(this.id);
  }
}

// §10: "No secrets in logs" — scrubs anything matching key patterns from all
// log paths. `run.ts` already avoids logging prompt/response bodies; this
// guards the one place a raw secret could still leak — a provider SDK error
// message that echoes the invalid key (e.g. "Invalid API key: AIza...").

const PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{35}/g, // Google API keys
  /sk-ant-[A-Za-z0-9-]{20,}/g, // Anthropic-style secret keys (checked before the generic sk- pattern)
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style secret keys
  /Bearer\s+[A-Za-z0-9._-]{20,}/gi, // bearer tokens
];

export function redactSecrets(text: string): string {
  return PATTERNS.reduce((acc, pattern) => acc.replace(pattern, "[redacted]"), text);
}

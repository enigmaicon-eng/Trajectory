export class QuotaExceededError extends Error {
  constructor(public readonly moduleClass: "light" | "heavy", public readonly resetsAt: Date) {
    super(`${moduleClass} quota exceeded`);
    this.name = "QuotaExceededError";
  }
}

export class AIValidationError extends Error {
  constructor(message: string, public readonly issues: unknown) {
    super(message);
    this.name = "AIValidationError";
  }
}

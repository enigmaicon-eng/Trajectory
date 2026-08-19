// Shared button treatment for every <button> and button-styled <a> in the
// app: a 44px minimum touch target (§17.1) and a visible focus ring on
// keyboard focus (§18.2 — WCAG 2.2 AA), so neither has to be re-derived (or
// drift) at each call site. §0.4: the accent appears at most three times per
// screen (primary action, current-day marker, active nav) — "primary" is one
// of those three, so every other variant stays ink/neutral.
const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40 disabled:pointer-events-none";

const SMALL =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40 disabled:pointer-events-none";

export function buttonClass(
  variant: "primary" | "secondary" | "ghost" | "text" = "secondary",
  size: "default" | "small" = "default",
): string {
  const base = size === "small" ? SMALL : BASE;
  if (variant === "text") {
    // §0.4: destructive/quiet actions are text, not buttons — no border, no fill.
    return "inline-flex min-h-11 items-center gap-1 text-sm text-ink-muted underline decoration-rule underline-offset-2 transition-colors duration-150 ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
  }
  const variantClass =
    variant === "primary"
      ? "bg-accent text-accent-ink hover:bg-accent-strong"
      : variant === "secondary"
        ? "border border-rule text-ink hover:bg-paper-raised"
        : "text-ink-muted hover:bg-paper-raised";
  return `${base} ${variantClass}`;
}

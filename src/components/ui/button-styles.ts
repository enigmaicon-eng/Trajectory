// Shared button treatment for every <button> and button-styled <a> in the
// app: a 44px minimum touch target (§6.4) and a visible focus ring on
// keyboard focus (§6.4 accessibility — WCAG 2.2 AA), so neither has to be
// re-derived (or drift) at each of the ~25 call sites.
const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none";

const SMALL =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none";

export function buttonClass(
  variant: "primary" | "secondary" | "ghost" = "secondary",
  size: "default" | "small" = "default",
): string {
  const base = size === "small" ? SMALL : BASE;
  const variantClass =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "secondary"
        ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        : "text-neutral-600 hover:bg-neutral-100";
  return `${base} ${variantClass}`;
}

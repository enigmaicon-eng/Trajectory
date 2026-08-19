import type { Database } from "@/lib/db/types.generated";

type NodeHealth = Database["public"]["Enums"]["node_health"];
type NodeStatus = Database["public"]["Enums"]["node_status"];

// §0.4: "Health is never color-only." Shape + word, always — the interface
// must survive greyscale printing and be legible with any color vision
// deficiency (AC-9.33).
const HEALTH: Record<NodeHealth, { glyph: string; label: string; colorClass: string }> = {
  on_track: { glyph: "○", label: "on track", colorClass: "text-health-on" },
  at_risk: { glyph: "◐", label: "at risk", colorClass: "text-health-risk" },
  off_track: { glyph: "●", label: "off track", colorClass: "text-health-off" },
  unknown: { glyph: "·", label: "not enough data", colorClass: "text-ink-faint" },
};

export function HealthMark({ health, className = "" }: { health: NodeHealth; className?: string }) {
  const m = HEALTH[health];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${m.colorClass} ${className}`}>
      <span aria-hidden="true">{m.glyph}</span>
      <span>{m.label}</span>
    </span>
  );
}

// Same shape+word convention applied to a goal_node's execution status,
// which is a different axis (progress, not risk) but uses the same visual
// grammar so the vocabulary is learned once (§7).
const STATUS: Record<NodeStatus, { glyph: string; label: string; colorClass: string }> = {
  complete: { glyph: "●", label: "complete", colorClass: "text-health-on" },
  in_progress: { glyph: "◐", label: "in progress", colorClass: "text-ink" },
  not_started: { glyph: "○", label: "not started", colorClass: "text-ink-faint" },
  blocked: { glyph: "◐", label: "blocked", colorClass: "text-health-risk" },
  dropped: { glyph: "—", label: "dropped", colorClass: "text-ink-faint" },
};

export function StatusMark({ status, className = "" }: { status: NodeStatus; className?: string }) {
  const m = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${m.colorClass} ${className}`}>
      <span aria-hidden="true">{m.glyph}</span>
      <span>{m.label}</span>
    </span>
  );
}

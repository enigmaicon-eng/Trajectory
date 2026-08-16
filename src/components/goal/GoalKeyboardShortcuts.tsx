"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTypingTarget } from "@/components/ui/CommandPalette";

const ROUTES: Record<string, string> = { t: "today", w: "week", m: "map" };

/** §6.4: "T today, W week, M map" — single-key shortcuts scoped to one goal. */
export function GoalKeyboardShortcuts({ goalId }: { goalId: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const segment = ROUTES[e.key.toLowerCase()];
      if (!segment) return;
      e.preventDefault();
      router.push(`/goals/${goalId}/${segment}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goalId, router]);

  return null;
}

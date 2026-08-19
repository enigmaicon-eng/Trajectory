"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// §2.1 "the ⋯ menu holds: Roadmap, Reflect, History, Account. Quiet by
// design." A native <details> would be simplest, but it doesn't close on
// outside click or Escape without extra wiring, so this is a small
// disclosure button instead — still no external dependency.
export function GoalMenu({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ⋯
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="More"
          className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-rule bg-paper-raised py-1 shadow-sm"
        >
          {[
            { href: `/goals/${goalId}/map`, label: "Roadmap" },
            { href: `/goals/${goalId}/reflect`, label: "Reflect" },
            { href: `/goals/${goalId}/history`, label: "History" },
            { href: "/settings/account", label: "Account" },
          ].map((item) => (
            <Link
              key={item.href}
              role="menuitem"
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 text-sm text-ink hover:bg-paper"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

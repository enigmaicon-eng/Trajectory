"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Destination {
  label: string;
  href: string;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * §6.4: "Cmd/Ctrl+K command palette." Mounted once at the root layout so it
 * works everywhere; destinations expand to include the current goal's
 * sections when the path is /goals/[id]/*.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const goalId = useMemo(() => {
    const match = pathname?.match(/^\/goals\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const destinations = useMemo<Destination[]>(() => {
    const base: Destination[] = [{ label: "Your goals", href: "/goals" }];
    if (goalId) {
      base.push(
        { label: "Today", href: `/goals/${goalId}/today` },
        { label: "This week", href: `/goals/${goalId}/week` },
        { label: "Goal map", href: `/goals/${goalId}/map` },
        { label: "Reflect", href: `/goals/${goalId}/reflect` },
        { label: "History", href: `/goals/${goalId}/history` },
      );
    }
    base.push(
      { label: "Provider keys", href: "/settings/ai" },
      { label: "Account", href: "/settings/account" },
    );
    return base;
  }, [goalId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter((d) => d.label.toLowerCase().includes(q));
  }, [destinations, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) {
            setQuery("");
            setActiveIndex(0);
          }
          return next;
        });
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focusing the input is a genuine external-system side effect (not a
  // setState-in-effect cascade) — it only runs once per open.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  if (!open) return null;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const dest = filtered[activeIndex];
      if (dest) go(dest.href);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-lg border border-rule bg-paper-raised shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Go to..."
          aria-label="Search destinations"
          className="w-full border-b border-rule bg-paper-raised px-4 py-3 text-base text-ink outline-none"
        />
        <ul role="listbox" className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-2 text-sm text-ink-muted">No matches</li>
          )}
          {filtered.map((d, i) => (
            <li key={d.href} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(d.href)}
                className={`flex min-h-11 w-full items-center px-4 text-left text-sm text-ink ${
                  i === activeIndex ? "bg-paper" : ""
                }`}
              >
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { isTypingTarget };

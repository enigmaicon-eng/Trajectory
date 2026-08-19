"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// §2.1: "the active item carries the accent and a 2px underline." One of the
// three places the accent is allowed to appear on a screen.
export function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname?.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 text-sm transition-colors duration-150 ease-out ${
        active ? "border-accent font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

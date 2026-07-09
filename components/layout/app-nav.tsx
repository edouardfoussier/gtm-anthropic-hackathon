"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Shared top bar across every surface: brand + the three primary
 * destinations (graph search, targets CRM, sends dashboard). Highlights the
 * active surface so it's always clear where you are and where you can go.
 */
const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Graph" },
  { href: "/targets", label: "Targets" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="relative z-50 flex items-center justify-between gap-6">
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="font-display text-xl uppercase tracking-tight"
        >
          AutoDeck
        </Link>
        <nav className="flex items-center gap-5 text-xs font-medium uppercase tracking-[0.2em]">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors",
                  active
                    ? "text-accent-orange"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">{children}</div>
    </header>
  );
}

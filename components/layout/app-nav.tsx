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

export function AppNav({
  children,
  context,
}: {
  children?: React.ReactNode;
  /** Optional run context shown next to the brand, e.g. the targeted company. */
  context?: string;
}) {
  const pathname = usePathname();

  return (
    <header className="relative z-50 flex items-center justify-between gap-6">
      <div className="flex flex-col">
        <Link
          href="/"
          className="font-display text-3xl uppercase leading-none tracking-tight md:text-4xl"
        >
          AutoDeck
        </Link>
        {context ? (
          <span className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-accent-orange">
            {context}
          </span>
        ) : null}
      </div>

      <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-6 text-xs font-medium uppercase tracking-[0.2em]">
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

      <div className="flex items-center gap-4">{children}</div>
    </header>
  );
}

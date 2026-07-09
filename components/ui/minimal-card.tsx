import { cn } from "@/lib/utils";

/**
 * Editorial card: no shadow, no gradient, hairline border only.
 * See AGENTS.md D009 — "Minimal cards (no shadows, borders, or gradients)"
 * is honored by keeping the border to a single 1px hairline, never a shadow.
 */
export function MinimalCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-border bg-card p-6 text-card-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

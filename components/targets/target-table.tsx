import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { Lead } from "@/lib/leads";

/**
 * Editorial CRM table (Twenty-style structure, AutoDeck styling). The whole row
 * links to the reach-out flow via a stretched link on the name cell; the
 * "Reach out" button sits above it (z-10) so it stays independently clickable.
 */
export function TargetTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Signal</th>
            <th className="px-4 py-3 font-medium text-right">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="group relative border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/reachout/${lead.id}`}
                  className="font-medium after:absolute after:inset-0"
                >
                  {lead.firstName} {lead.lastName}
                </Link>
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {lead.company || <span aria-hidden>—</span>}
              </td>

              <td className="px-4 py-3">
                {lead.hot ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent-orange">
                    🔥 Hot lead
                  </span>
                ) : (
                  <span className="text-muted-foreground">{lead.stage}</span>
                )}
              </td>

              <td className="max-w-[360px] px-4 py-3 text-muted-foreground">
                {lead.signal ? (
                  lead.signal
                ) : (
                  <span aria-hidden className="text-muted-foreground/50">
                    —
                  </span>
                )}
              </td>

              <td className="px-4 py-3 text-right">
                <Link
                  href={`/reachout/${lead.id}`}
                  className={cn(
                    buttonVariants({
                      variant: lead.hot ? "default" : "outline",
                      size: "sm",
                    }),
                    "relative z-10",
                  )}
                >
                  Reach out
                  <ArrowUpRight />
                </Link>
              </td>
            </tr>
          ))}

          {leads.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No targets yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

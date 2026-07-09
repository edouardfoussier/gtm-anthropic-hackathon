"use client";

import { useQueue } from "@/components/queue/queue-context";
import { cn } from "@/lib/utils";
import type { QueueStatus } from "@/lib/types";

const STATUS_LABEL: Record<QueueStatus, string> = {
  queued: "Queued",
  generating: "Generating deck",
  ready: "Ready to send",
};

const STATUS_DOT_CLASS: Record<QueueStatus, string> = {
  queued: "bg-muted-foreground",
  generating: "bg-accent-orange animate-pulse",
  ready: "bg-accent-orange",
};

export function QueueSidebar() {
  const { items } = useQueue();

  return (
    <aside className="relative z-30 flex w-80 shrink-0 flex-col gap-4 border-l border-border bg-card p-6">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        02 — Pipeline queue
      </span>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Contact a person on the graph to queue their video pitch.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 border border-border bg-background p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {item.contact.name}
                </span>
                <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      STATUS_DOT_CLASS[item.status],
                    )}
                  />
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {item.companyName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

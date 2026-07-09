"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProspectStats } from "@/lib/analytics";

const POLL_MS = 3000;
const TOAST_MS = 6000;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function chaching(): void {
  try {
    const audio = new Audio("/chaching.mp3");
    audio.volume = 1;
    audio.play().catch(() => {});
  } catch {
    /* no sound available */
  }
}

export function Dashboard() {
  const [stats, setStats] = useState<ProspectStats[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const wasWatching = useRef<Set<string>>(new Set<string>());
  const started = useRef(false);

  useEffect(() => {
    let active = true;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        const data = (await res.json()) as { stats: ProspectStats[] };
        if (!active) return;

        for (const s of data.stats) {
          const was = wasWatching.current.has(s.id);
          if (s.watchingNow && !was && started.current) {
            setToast(`🎬 ${s.firstName} @ ${s.company} is watching — ${fmtTime(s.watchedSeconds)}`);
            chaching();
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => setToast(null), TOAST_MS);
          }
          if (s.watchingNow) wasWatching.current.add(s.id);
          else wasWatching.current.delete(s.id);
        }
        started.current = true;
        setStats(data.stats);
      } catch {
        /* keep last known state */
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(toastTimer);
    };
  }, []);

  const sent = stats.filter((s) => s.sent);
  const rows = sent.length > 0 ? sent : stats;

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="border border-accent bg-accent/10 px-4 py-3 text-sm font-medium text-foreground">
          {toast}
        </div>
      )}

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Prospect</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Opened</th>
              <th className="px-4 py-3 font-medium">Views</th>
              <th className="px-4 py-3 font-medium">Watched</th>
              <th className="px-4 py-3 font-medium">Callback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {s.watchingNow && (
                      <span className="inline-block size-2 animate-pulse rounded-full bg-accent" />
                    )}
                    <Link
                      href={`/v/${s.id}`}
                      className="font-medium underline-offset-4 hover:text-accent-orange hover:underline"
                    >
                      {s.firstName}
                    </Link>
                    <span className="text-muted-foreground">· {s.company}</span>
                    <Link
                      href={`/v/${s.id}`}
                      aria-label={`Open ${s.firstName}'s video page`}
                      className="text-muted-foreground transition-colors hover:text-accent-orange"
                    >
                      ↗
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3">{s.sent ? "✓" : "—"}</td>
                <td className="px-4 py-3">{s.opened ? "✓" : "—"}</td>
                <td className="px-4 py-3 tabular-nums">
                  {s.plays > 0 ? `${s.plays}× · ${s.viewers} viewer${s.viewers === 1 ? "" : "s"}` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {s.watchedSeconds > 0 ? (
                    <span className={s.watchingNow ? "text-accent-orange" : ""}>
                      {fmtTime(s.watchedSeconds)}
                      {s.watchingNow ? " · live" : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.callbackRequested ? (
                    <span className="text-accent-orange">
                      ✓{s.callbackWhen ? ` ${new Date(s.callbackWhen).toLocaleString()}` : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No videos sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

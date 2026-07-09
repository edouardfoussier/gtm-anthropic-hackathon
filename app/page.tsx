"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { PeopleGraph } from "@/components/graph/people-graph";
import { SignalGlobe } from "@/components/graph/signal-globe";
import type { DemoFrame } from "@/components/graph/demo-frames";
import type { PersonNode } from "@/components/graph/types";
import { Button } from "@/components/ui/button";
import { QueueSidebar } from "@/components/queue/queue-sidebar";
import { QueueProvider, useQueue } from "@/components/queue/queue-context";
import type { RealProspect } from "@/lib/mock-prospect";
import { buildDemoRun } from "@/lib/demo-run";
import type { Prospect } from "@/lib/types";

function HomeInner() {
  const router = useRouter();
  const { enqueue, items } = useQueue();
  const [companyInput, setCompanyInput] = useState("");
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [frames, setFrames] = useState<DemoFrame[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [realProspects, setRealProspects] = useState<RealProspect[]>([]);
  // The pipeline queue sidebar stays hidden until the visitor queues someone.
  const [queueSidebarUnlocked, setQueueSidebarUnlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prospects")
      .then((res) => res.json())
      .then((data: { prospects: RealProspect[] }) => {
        if (!cancelled) setRealProspects(data.prospects);
      })
      .catch(() => {
        /* real-prospect matching is a nice-to-have — mock flow still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-advance the staged run: apply the next frame after its delay.
  useEffect(() => {
    if (!autoPlaying || !frames || cursor >= frames.length) return;
    const t = setTimeout(() => setCursor((c) => c + 1), frames[cursor].delay);
    return () => clearTimeout(t);
  }, [autoPlaying, frames, cursor]);

  const applied = useMemo(
    () => (frames ? frames.slice(0, cursor) : []),
    [frames, cursor],
  );
  const logs = useMemo(() => applied.map((f) => f.log), [applied]);
  const people = applied.reduce<PersonNode[] | undefined>(
    (p, f) => f.people ?? p,
    undefined,
  );

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = companyInput.trim();
    if (!name) return;
    const run = buildDemoRun(name, realProspects);
    setProspect(run.prospect);
    setFrames(run.frames);
    setCursor(0);
    setAutoPlaying(true);
  }

  function handleReplay() {
    setCursor(0);
    setAutoPlaying(true);
  }

  function handleNewSearch() {
    setProspect(null);
    setFrames(null);
    setCursor(0);
    setAutoPlaying(false);
    setCompanyInput("");
    setQueueSidebarUnlocked(false);
  }

  function handlePersonClick(personId: string) {
    if (!prospect) return;
    const contact = prospect.contacts.find((c) => c.id === personId);
    if (!contact) return;
    // Real prospects go straight into the real generation pipeline; everyone
    // else is queued locally in the pipeline sidebar.
    if (contact.juryId) {
      router.push(`/reachout/${contact.juryId}`);
      return;
    }
    enqueue(prospect.companyName, contact);
    setQueueSidebarUnlocked(true);
  }

  const expanded = prospect !== null;

  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col">
        <PageShell className="flex flex-1 flex-col">
          <AppNav context={expanded && prospect ? prospect.companyName : undefined}>
            {expanded ? (
              <button
                type="button"
                onClick={handleNewSearch}
                className="border border-border bg-background/90 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm hover:text-foreground"
              >
                New search
              </button>
            ) : null}
          </AppNav>

          <main className="relative flex flex-1 flex-col items-center justify-center gap-10 py-16">
            {expanded ? (
              <PeopleGraph
                className="absolute inset-0 z-0"
                people={people}
                onPersonClick={handlePersonClick}
              />
            ) : (
              <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
                <SignalGlobe
                  expanded={false}
                  className="h-[560px] w-[560px] md:h-[720px] md:w-[720px]"
                />
              </div>
            )}

            {!expanded ? (
              <>
                <div className="pointer-events-none relative z-20 flex flex-col items-center gap-3 text-center">
                  <h1 className="max-w-3xl text-5xl leading-[0.95] md:text-7xl">
                    Type a company.
                    <br />
                    We&apos;ll pitch the right person.
                  </h1>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="group relative z-20 flex w-full max-w-xl items-center gap-3 rounded-xl border border-border border-b-[3px] border-b-foreground/40 bg-background px-5 py-4 shadow-[0_4px_0_0_var(--border),0_10px_24px_-12px_rgba(0,0,0,0.35)] transition-all focus-within:translate-y-0.5 focus-within:shadow-[0_2px_0_0_var(--border),0_6px_16px_-12px_rgba(0,0,0,0.35)]"
                >
                  <input
                    type="text"
                    value={companyInput}
                    onChange={(event) => setCompanyInput(event.target.value)}
                    placeholder="Target a company…"
                    className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                  />
                  <Button type="submit" size="lg">
                    Find signal
                  </Button>
                </form>
              </>
            ) : null}

            {logs.length > 0 ? (
              <div className="absolute bottom-2 left-0 z-10 flex w-full max-w-sm flex-col gap-1.5">
                {logs.slice(-6).map((log, i, shown) => {
                  const absoluteIndex = logs.length - shown.length + i;
                  const isLast = i === shown.length - 1;
                  return (
                    <div
                      key={absoluteIndex}
                      className="animate-in fade-in slide-in-from-bottom-2 flex items-baseline gap-2 border-l border-foreground/15 pl-3 duration-500"
                    >
                      <span
                        className={
                          isLast
                            ? "text-[10px] font-medium text-accent-orange"
                            : "text-[10px] font-medium text-muted-foreground/60"
                        }
                      >
                        {String(absoluteIndex + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={
                          isLast
                            ? "text-xs text-foreground"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {log}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {expanded ? (
              <div className="absolute bottom-2 right-0 z-10 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleReplay}
                  className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-accent-orange"
                >
                  Replay
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/targets")}
                  disabled={items.length === 0}
                  title={
                    items.length === 0
                      ? "Queue at least one contact to continue"
                      : "Go to Targets"
                  }
                  className="inline-flex items-center gap-2 border border-b-[3px] border-border border-b-foreground/40 bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] shadow-[0_2px_0_0_var(--border)] transition-all hover:text-accent-orange active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : null}
          </main>

          <footer className="relative z-30 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Sillage · FullEnrich · Claude</span>
          </footer>
        </PageShell>
      </div>

      {queueSidebarUnlocked ? <QueueSidebar /> : null}
    </div>
  );
}

export default function Home() {
  return (
    <QueueProvider>
      <HomeInner />
    </QueueProvider>
  );
}

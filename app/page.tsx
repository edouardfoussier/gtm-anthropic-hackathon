"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PeopleGraph } from "@/components/graph/people-graph";
import { SignalGlobe } from "@/components/graph/signal-globe";
import type { DemoFrame } from "@/components/graph/demo-frames";
import type { PersonNode } from "@/components/graph/types";
import { Button } from "@/components/ui/button";
import { ContactDrawer } from "@/components/prospect/contact-drawer";
import { QueueSidebar } from "@/components/queue/queue-sidebar";
import { QueueProvider } from "@/components/queue/queue-context";
import type { RealProspect } from "@/lib/mock-prospect";
import { buildDemoRun } from "@/lib/demo-run";
import type { Prospect } from "@/lib/types";

export default function Home() {
  const [companyInput, setCompanyInput] = useState("");
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [frames, setFrames] = useState<DemoFrame[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [realProspects, setRealProspects] = useState<RealProspect[]>([]);
  // The pipeline queue sidebar stays hidden until the visitor has clicked at
  // least one contact — it shouldn't show up just because a search ran.
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = companyInput.trim();
    if (!name) return;
    const run = buildDemoRun(name, realProspects);
    setProspect(run.prospect);
    setFrames(run.frames);
    setCursor(0);
    setAutoPlaying(true);
    setActiveContactId(null);
  }

  function handleStep() {
    if (!frames) return;
    setAutoPlaying(false);
    setCursor((c) => Math.min(c + 1, frames.length));
  }

  function handleReplay() {
    setCursor(0);
    setAutoPlaying(true);
    setActiveContactId(null);
  }

  function handleNewSearch() {
    setProspect(null);
    setFrames(null);
    setCursor(0);
    setAutoPlaying(false);
    setCompanyInput("");
    setActiveContactId(null);
    setQueueSidebarUnlocked(false);
  }

  function handlePersonClick(personId: string) {
    setActiveContactId(personId);
    setQueueSidebarUnlocked(true);
  }

  const expanded = prospect !== null;

  return (
    <QueueProvider>
      <div className="flex flex-1">
        <div className="flex flex-1 flex-col">
          <PageShell className="flex flex-1 flex-col">
            <header className="relative z-50 flex items-center justify-between">
              <span className="flex items-baseline gap-3">
                <span className="font-display text-xl uppercase tracking-tight">
                  GetAutoDeck
                </span>
                {expanded && prospect ? (
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    / {prospect.companyName}
                  </span>
                ) : null}
              </span>
              <div className="flex items-center gap-4">
                {expanded ? (
                  <button
                    type="button"
                    onClick={handleNewSearch}
                    className="border border-border bg-background/90 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm hover:text-foreground"
                  >
                    New search
                  </button>
                ) : null}
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  GTM Autopilot
                </span>
              </div>
            </header>

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
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
                      01 — Target
                    </span>
                    <h1 className="max-w-3xl text-5xl leading-[0.95] md:text-7xl">
                      Type a company.
                      <br />
                      Watch the pipeline build itself.
                    </h1>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="relative z-20 flex w-full max-w-xl items-center gap-2 border-b border-foreground/20 bg-background/80 pb-3 backdrop-blur-sm"
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
                <div className="absolute bottom-2 right-0 z-10 flex gap-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <button
                    type="button"
                    onClick={handleStep}
                    className="transition-colors hover:text-accent-orange"
                  >
                    Step
                  </button>
                  <button
                    type="button"
                    onClick={handleReplay}
                    className="transition-colors hover:text-accent-orange"
                  >
                    Replay
                  </button>
                </div>
              ) : null}
            </main>

            <footer className="relative z-30 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span>Sillage · FullEnrich · Claude</span>
              <span>Autopilot — off</span>
            </footer>
          </PageShell>
        </div>

        {queueSidebarUnlocked ? <QueueSidebar /> : null}
      </div>

      {prospect ? (
        <ContactDrawer
          prospect={prospect}
          contactId={activeContactId}
          onClose={() => setActiveContactId(null)}
        />
      ) : null}
    </QueueProvider>
  );
}

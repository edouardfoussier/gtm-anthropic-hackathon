"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PeopleGraph } from "@/components/graph/people-graph";
import {
  buildDemoFrames,
  type DemoFrame,
} from "@/components/graph/demo-frames";
import type { PersonNode } from "@/components/graph/types";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [companyInput, setCompanyInput] = useState("");
  const [runCompany, setRunCompany] = useState<string | null>(null);
  const [frames, setFrames] = useState<DemoFrame[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);

  // Auto-advance: apply the next frame after its delay.
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

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = companyInput.trim() || "Qonto";
    setRunCompany(name);
    setFrames(buildDemoFrames(name));
    setCursor(0);
    setAutoPlaying(true);
  }

  function handleStep() {
    if (!frames) return;
    setAutoPlaying(false);
    setCursor((c) => Math.min(c + 1, frames.length));
  }

  function handleReplay() {
    setCursor(0);
    setAutoPlaying(true);
  }

  return (
    <PageShell className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <span className="flex items-baseline gap-3">
          <span className="font-display text-xl uppercase tracking-tight">
            AutoDeck
          </span>
          {frames && runCompany ? (
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              / {runCompany}
            </span>
          ) : null}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          GTM Autopilot
        </span>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center gap-10 py-16">
        <PeopleGraph className="absolute inset-0 z-0" people={people} />

        {!frames ? (
          <div className="pointer-events-none z-10 flex flex-col items-center gap-3 text-center">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
              01 — Target
            </span>
            <h1 className="max-w-3xl text-5xl leading-[0.95] md:text-7xl">
              Type a company.
              <br />
              Watch the pipeline build itself.
            </h1>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <form
          onSubmit={handleSubmit}
          className={
            frames
              ? "z-10 flex w-full max-w-md items-center gap-2 border-b border-foreground/20 pb-3"
              : "z-10 flex w-full max-w-xl items-center gap-2 border-b border-foreground/20 pb-3"
          }
        >
          <input
            type="text"
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            placeholder="Target a company…"
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="lg">
            Find signal
          </Button>
        </form>

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

        {frames ? (
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

      <footer className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Sillage · FullEnrich · Claude</span>
        <span>Autopilot — off</span>
      </footer>
    </PageShell>
  );
}

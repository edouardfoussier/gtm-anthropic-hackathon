"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Circle, ExternalLink, Loader2 } from "lucide-react";
import { MinimalCard } from "@/components/ui/minimal-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 1500;

type Presenter = "tom" | "edouard" | "mathis";
type JobStatus = "running" | "done" | "error";

interface JobStep {
  step: string;
  detail: string;
  at: string;
}

interface Job {
  jobId: string;
  prospectId: string;
  status: JobStatus;
  steps: JobStep[];
  deck?: unknown;
  videoUrl?: string;
  error?: string;
  createdAt: string;
}

interface DeckSlide {
  headline: string;
  voiceover: string;
}

type SlideField = keyof DeckSlide;

const CHANNELS: { id: string; label: string; recommended?: boolean }[] = [
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn", recommended: true },
  { id: "x", label: "X" },
  { id: "cold-call", label: "Cold call" },
];

const PRESENTERS: { id: Presenter; name: string; role: string }[] = [
  { id: "tom", name: "Tom", role: "Co-founder" },
  { id: "edouard", name: "Edouard", role: "Co-founder" },
  { id: "mathis", name: "Mathis", role: "Co-founder" },
];

/** Canonical engine step order; used to derive checklist progress. */
const ENGINE_ORDER = ["deck", "slides", "tts", "avatar", "assemble", "done"];

/** Narrow the untyped job.deck into the fields the editor renders. */
function readDeckSlides(deck: unknown): DeckSlide[] | null {
  if (typeof deck !== "object" || deck === null) return null;
  const slides = (deck as Record<string, unknown>).slides;
  if (!Array.isArray(slides)) return null;
  const parsed: DeckSlide[] = [];
  for (const slide of slides) {
    if (typeof slide !== "object" || slide === null) return null;
    const s = slide as Record<string, unknown>;
    if (typeof s.headline !== "string" || typeof s.voiceover !== "string") return null;
    parsed.push({ headline: s.headline, voiceover: s.voiceover });
  }
  return parsed;
}

function progressIndex(steps: JobStep[]): number {
  let max = -1;
  for (const s of steps) {
    const idx = ENGINE_ORDER.indexOf(s.step);
    if (idx > max) max = idx;
  }
  return max;
}

export function ReachoutFlow({
  prospectId,
  firstName,
  company,
  title,
}: {
  prospectId: string;
  firstName: string;
  company: string;
  title: string;
}) {
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    () => new Set<string>(["email"]),
  );
  const [presenter, setPresenter] = useState<Presenter>("tom");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Script edits are stored as overrides keyed by "index:field" so the deck the
  // pipeline produced stays the source of truth and edits survive re-renders.
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Poll the job file until the pipeline finishes; keep last state on failure.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      try {
        const res = await fetch(`/api/generate/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Job;
          if (cancelled) return;
          setJob(data);
          if (data.status === "done" || data.status === "error") return;
        }
      } catch {
        /* transient failure — keep last state and keep polling */
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  function toggleChannel(id: string): void {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate(): Promise<void> {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospectId,
          presenter,
          channels: [...selectedChannels],
        }),
      });
      if (!res.ok) throw new Error(`generate failed (${res.status})`);
      const data = (await res.json()) as { jobId?: string };
      if (!data.jobId) throw new Error("no jobId returned");
      setJob(null);
      setEdits({});
      setJobId(data.jobId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function updateSlide(index: number, field: SlideField, value: string): void {
    setEdits((prev) => ({ ...prev, [`${index}:${field}`]: value }));
  }

  const status: JobStatus | "idle" = job?.status ?? (jobId ? "running" : "idle");
  const latestDetail = job?.steps.at(-1)?.detail ?? "";

  const deckSlides = readDeckSlides(job?.deck);
  const displayedSlides: DeckSlide[] =
    deckSlides?.map((slide, i) => ({
      headline: edits[`${i}:headline`] ?? slide.headline,
      voiceover: edits[`${i}:voiceover`] ?? slide.voiceover,
    })) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
          01 — Compose the reach-out
        </span>
        <h1 className="text-5xl leading-[0.95] md:text-6xl">
          Reach out to {firstName}.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          A personalized video pitch for {company}
          {title ? `, ${title}` : ""}. Pick your channels and presenter, then let
          the pipeline build and send it.
        </p>
      </div>

      <ConfigCard
        channels={selectedChannels}
        onToggleChannel={toggleChannel}
        presenter={presenter}
        onSelectPresenter={setPresenter}
        onGenerate={handleGenerate}
        submitting={submitting}
        disabled={status === "running"}
        submitError={submitError}
      />

      {status === "running" && job !== null && (
        <ChecklistLoader
          steps={job.steps}
          firstName={firstName}
          title={title}
          latestDetail={latestDetail}
        />
      )}

      {status === "error" && (
        <MinimalCard className="border-destructive/40">
          <p className="text-sm text-destructive">
            Generation failed: {job?.error ?? "unknown error"}
          </p>
        </MinimalCard>
      )}

      {displayedSlides.length > 0 && (
        <ScriptEditor slides={displayedSlides} onChange={updateSlide} />
      )}

      {status === "done" && job?.videoUrl && (
        <ResultCard videoUrl={job.videoUrl} prospectId={prospectId} />
      )}
    </div>
  );
}

function ConfigCard({
  channels,
  onToggleChannel,
  presenter,
  onSelectPresenter,
  onGenerate,
  submitting,
  disabled,
  submitError,
}: {
  channels: Set<string>;
  onToggleChannel: (id: string) => void;
  presenter: Presenter;
  onSelectPresenter: (id: Presenter) => void;
  onGenerate: () => void;
  submitting: boolean;
  disabled: boolean;
  submitError: string | null;
}) {
  return (
    <MinimalCard className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Channels
        </span>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => {
            const active = channels.has(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onToggleChannel(channel.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {channel.label}
                {channel.recommended && (
                  <span
                    className={cn(
                      "text-[0.6rem] font-medium uppercase tracking-[0.15em]",
                      active ? "text-accent-foreground/80" : "text-accent-orange",
                    )}
                  >
                    Recommended
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Presenter
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESENTERS.map((p) => {
            const active = presenter === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPresenter(p.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-0.5 border px-4 py-2 text-left transition-colors",
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                <span className="font-display text-sm uppercase tracking-tight">{p.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    active ? "text-accent-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {p.role}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          onClick={onGenerate}
          disabled={submitting || disabled || channels.size === 0}
          className="self-start"
        >
          {submitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ArrowRight />
          )}
          Generate &amp; send
        </Button>
        {submitError && <p className="text-sm text-destructive">{submitError}</p>}
      </div>
    </MinimalCard>
  );
}

function ChecklistLoader({
  steps,
  firstName,
  title,
  latestDetail,
}: {
  steps: JobStep[];
  firstName: string;
  title: string;
  latestDetail: string;
}) {
  const stages: { key: string; label: string }[] = [
    {
      key: "deck",
      label: `Fetching company information · analysing pain points · adapting speech to ${title || "their role"}`,
    },
    { key: "slides", label: "Designing branded slides" },
    { key: "tts", label: `Cloning the voice for ${firstName}` },
    { key: "assemble", label: "Editing the video" },
    { key: "done", label: "Ready to send" },
  ];

  const progress = progressIndex(steps);
  // Active stage = the furthest stage whose engine step has begun.
  let activeStage = 0;
  stages.forEach((stage, i) => {
    if (ENGINE_ORDER.indexOf(stage.key) <= progress) activeStage = i;
  });

  return (
    <MinimalCard className="flex flex-col gap-5">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Building the pitch
      </span>
      <ul className="flex flex-col gap-3">
        {stages.map((stage, i) => {
          const done = i < activeStage;
          const active = i === activeStage;
          return (
            <li
              key={stage.key}
              className={cn(
                "flex items-start gap-3 text-sm",
                done && "text-foreground",
                active && "animate-pulse text-foreground",
                !done && !active && "text-muted-foreground",
              )}
            >
              <span className="mt-0.5 shrink-0">
                {done ? (
                  <Check className="size-4 text-accent-orange" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin text-accent-orange" />
                ) : (
                  <Circle className="size-4 text-muted-foreground/50" />
                )}
              </span>
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ul>
      {latestDetail && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {latestDetail}
        </p>
      )}
    </MinimalCard>
  );
}

function ScriptEditor({
  slides,
  onChange,
}: {
  slides: DeckSlide[];
  onChange: (index: number, field: SlideField, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
        02 — Review the script
      </span>
      <div className="grid gap-4 md:grid-cols-2">
        {slides.map((slide, i) => (
          <MinimalCard key={i} className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Slide {i + 1}
            </span>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Headline</span>
              <textarea
                value={slide.headline}
                onChange={(e) => onChange(i, "headline", e.target.value)}
                rows={2}
                className="w-full resize-none border border-border bg-background p-2 font-display text-lg uppercase leading-tight tracking-tight outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Voiceover</span>
              <textarea
                value={slide.voiceover}
                onChange={(e) => onChange(i, "voiceover", e.target.value)}
                rows={3}
                className="w-full resize-none border border-border bg-background p-2 text-sm outline-none focus:border-accent"
              />
            </label>
          </MinimalCard>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  videoUrl,
  prospectId,
}: {
  videoUrl: string;
  prospectId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
        03 — Ready to send
      </span>
      <video src={videoUrl} controls className="aspect-video w-full border border-border" />
      <div className="flex flex-col gap-1">
        <a
          href={`/v/${prospectId}`}
          className="inline-flex items-center gap-2 text-sm text-accent-orange underline-offset-4 hover:underline"
        >
          Open share page
          <ExternalLink className="size-4" />
        </a>
        <span className="text-xs text-muted-foreground">
          your own visits don&apos;t count in analytics
        </span>
      </div>
    </div>
  );
}

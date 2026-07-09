import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { MinimalCard } from "@/components/ui/minimal-card";
import { VideoPlayer } from "@/components/share/video-player";
import { CallbackForm } from "@/components/share/callback-form";
import { getProspect } from "@/lib/prospects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getProspect(id);
  if (!p) return { title: "AutoDeck" };
  return {
    title: `A message for ${p.firstName} · AutoDeck`,
    description: `${p.sender.name} made you a personalized video pitch for ${p.company}.`,
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prospect = await getProspect(id);
  if (!prospect) notFound();

  const { firstName, company, title, videoUrl, posterUrl, sender } = prospect;

  return (
    <PageShell className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <span className="font-display text-xl uppercase tracking-tight">AutoDeck</span>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          for {company}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 py-12">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
            01 — A message for you
          </span>
          <h1 className="text-5xl leading-[0.95] md:text-6xl">For {firstName}.</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            {sender.name} built you a personalized pitch for {company}
            {title ? `, ${title}` : ""}. It plays automatically — tap for sound.
          </p>
        </div>

        <VideoPlayer src={videoUrl} poster={posterUrl} prospectId={id} />

        <div className="grid gap-4 md:grid-cols-2">
          <MinimalCard className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              From
            </span>
            <div>
              <p className="font-display text-lg uppercase tracking-tight">{sender.name}</p>
              <p className="text-sm text-muted-foreground">{sender.role}</p>
            </div>
            <a
              href={`mailto:${sender.email}`}
              className="text-sm text-accent-orange underline-offset-4 hover:underline"
            >
              {sender.email}
            </a>
          </MinimalCard>

          <MinimalCard className="flex flex-col gap-4">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              02 — Want to talk?
            </span>
            <CallbackForm prospectId={id} senderName={sender.name} />
          </MinimalCard>
        </div>
      </main>

      <footer className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>AutoDeck · GTM Autopilot</span>
        <span>Powered by Claude · Sillage · FullEnrich</span>
      </footer>
    </PageShell>
  );
}

import { PageShell } from "@/components/layout/page-shell";
import { DotSphere } from "@/components/graph/dot-sphere";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <PageShell className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <span className="font-display text-xl uppercase tracking-tight">
          AutoDeck
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          GTM Autopilot
        </span>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center gap-10 py-16">
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <DotSphere className="h-[560px] w-[560px] md:h-[720px] md:w-[720px]" />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
            01 — Target
          </span>
          <h1 className="max-w-3xl text-5xl leading-[0.95] md:text-7xl">
            Type a company.
            <br />
            Watch the pipeline build itself.
          </h1>
        </div>

        <form className="flex w-full max-w-xl items-center gap-2 border-b border-foreground/20 pb-3">
          <input
            type="text"
            placeholder="Target a company…"
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="lg">
            Find signal
          </Button>
        </form>
      </main>

      <footer className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Sillage · FullEnrich · Claude</span>
        <span>Autopilot — off</span>
      </footer>
    </PageShell>
  );
}

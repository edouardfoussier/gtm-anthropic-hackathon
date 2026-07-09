import { PageShell } from "@/components/layout/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata = {
  title: "Dashboard · AutoDeck",
};

export default function DashboardPage() {
  return (
    <PageShell className="flex flex-1 flex-col">
      <AppNav />

      <main className="flex flex-1 flex-col gap-8 py-12">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
            Live — sent pitches
          </span>
          <h1 className="text-4xl leading-[0.95] md:text-5xl">Who&apos;s watching.</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Every personalized video, live: opened, watch-time, and callback requests —
            updating as prospects engage.
          </p>
        </div>

        <Dashboard />
      </main>

      <footer className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>AutoDeck · GTM Autopilot</span>
        <span>Powered by Claude · Sillage · FullEnrich</span>
      </footer>
    </PageShell>
  );
}

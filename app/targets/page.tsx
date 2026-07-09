import { PageShell } from "@/components/layout/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { TargetTable } from "@/components/targets/target-table";
import { getLeads } from "@/lib/leads";

export const metadata = {
  title: "Targets · AutoDeck",
};

export default async function TargetsPage() {
  const leads = await getLeads();

  return (
    <PageShell className="flex flex-1 flex-col">
      <AppNav />

      <main className="flex flex-1 flex-col gap-8 py-12">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
            01 — Your targets
          </span>
          <h1 className="text-4xl leading-[0.95] md:text-5xl">Who to reach.</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Your book of accounts, ranked by real-time intent from Sillage. Deel
            is on a public hiring tear — reach out before the window closes.
          </p>
        </div>

        <TargetTable leads={leads} />
      </main>

      <footer className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>AutoDeck · GTM Autopilot</span>
        <span>Powered by Claude · Sillage · FullEnrich</span>
      </footer>
    </PageShell>
  );
}

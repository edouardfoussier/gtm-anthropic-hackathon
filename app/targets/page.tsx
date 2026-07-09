import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { TargetTable } from "@/components/targets/target-table";
import { getLeads } from "@/lib/leads";

export const metadata = {
  title: "Targets · AutoDeck",
};

export default async function TargetsPage() {
  const leads = await getLeads();

  return (
    <PageShell className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <span className="font-display text-xl uppercase tracking-tight">
          AutoDeck
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          CRM
        </span>
      </header>

      <nav className="mt-6 flex items-center gap-6 border-b border-border text-sm font-medium">
        <span className="-mb-px border-b-2 border-accent pb-3 text-foreground">
          Targets
        </span>
        <span className="cursor-default pb-3 text-muted-foreground/50">
          Campaigns
        </span>
        <Link
          href="/dashboard"
          className="pb-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
        </Link>
      </nav>

      <main className="flex flex-1 flex-col gap-8 py-12">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
            01 — Your targets
          </span>
          <h1 className="text-4xl leading-[0.95] md:text-5xl">Who to reach.</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Your book of accounts, ranked by intent. Elizabeth at Photoroom is
            heating up — reach out before the window closes.
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

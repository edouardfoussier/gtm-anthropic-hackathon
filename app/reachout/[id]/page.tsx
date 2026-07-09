import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { ReachoutFlow } from "@/components/reachout/reachout-flow";
import { getProspect } from "@/lib/prospects";

export default async function ReachoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prospect = await getProspect(id);
  if (!prospect) notFound();

  return (
    <PageShell className="flex flex-1 flex-col">
      <AppNav>
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-b-[3px] border-border border-b-foreground/40 bg-background px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground shadow-[0_2px_0_0_var(--border)] transition-all hover:text-accent-orange active:translate-y-0.5 active:shadow-none"
        >
          <span aria-hidden="true">←</span>
          Back to run
        </Link>
      </AppNav>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 py-12">
        <ReachoutFlow
          prospectId={id}
          firstName={prospect.firstName}
          company={prospect.company}
          title={prospect.title}
        />
      </main>
    </PageShell>
  );
}

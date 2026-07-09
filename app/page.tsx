"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PeopleGraph } from "@/components/graph/people-graph";
import type { PersonNode, PersonStatus } from "@/components/graph/types";
import { Button } from "@/components/ui/button";
import { ContactDrawer } from "@/components/prospect/contact-drawer";
import { QueueSidebar } from "@/components/queue/queue-sidebar";
import { QueueProvider } from "@/components/queue/queue-context";
import { buildMockProspect, type RealProspect } from "@/lib/mock-prospect";
import type { Prospect, RelationshipKind } from "@/lib/types";

/** The company itself is the graph's root node — every contact reports to it. */
const COMPANY_ROOT_ID = "__company__";

const RELATIONSHIP_STATUS: Record<RelationshipKind, PersonStatus> = {
  decision_maker: "picked",
  champion: "enriched",
  signal_source: "active",
};

function toPeopleNodes(prospect: Prospect): PersonNode[] {
  const companyNode: PersonNode = {
    id: COMPANY_ROOT_ID,
    name: prospect.companyName,
    title: "Target company",
    status: "active",
    seniority: 1,
  };

  const contactNodes: PersonNode[] = prospect.contacts.map((contact) => {
    const relationship = prospect.relationships.find(
      (r) => r.contactId === contact.id,
    );
    return {
      id: contact.id,
      name: contact.name,
      title: contact.title || (contact.juryId ? "Real prospect" : ""),
      status: relationship ? RELATIONSHIP_STATUS[relationship.kind] : "pending",
      seniority: relationship?.kind === "decision_maker" ? 2 : 3,
      reportsTo: COMPANY_ROOT_ID,
      sublabel: contact.email,
    };
  });

  return [companyNode, ...contactNodes];
}

export default function Home() {
  const [companyInput, setCompanyInput] = useState("");
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [realProspects, setRealProspects] = useState<RealProspect[]>([]);

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

  const people = useMemo(
    () => (prospect ? toPeopleNodes(prospect) : undefined),
    [prospect],
  );

  function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault();
    if (!companyInput.trim()) return;
    setProspect(buildMockProspect(companyInput.trim(), realProspects));
  }

  function handlePersonClick(personId: string) {
    if (personId === COMPANY_ROOT_ID) return;
    setActiveContactId(personId);
  }

  const expanded = prospect !== null;

  return (
    <QueueProvider>
      <div className="flex flex-1">
        <div className="flex flex-1 flex-col">
          <PageShell className="flex flex-1 flex-col">
            <header className="relative z-50 flex items-center justify-between">
              <span className="font-display text-xl uppercase tracking-tight">
                GetAutoDeck
              </span>
              <div className="flex items-center gap-4">
                {expanded ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProspect(null);
                      setCompanyInput("");
                    }}
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
              <PeopleGraph
                className="absolute inset-0 z-0"
                people={people}
                onPersonClick={handlePersonClick}
              />

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
            </main>

            <footer className="relative z-30 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span>Sillage · FullEnrich · Claude</span>
              <span>Autopilot — off</span>
            </footer>
          </PageShell>
        </div>

        {expanded ? <QueueSidebar /> : null}
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

import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { MinimalCard } from "@/components/ui/minimal-card";
import { Button } from "@/components/ui/button";
import { setSession } from "@/lib/session";

export const metadata = {
  title: "Sign in · AutoDeck",
};

async function signIn(): Promise<void> {
  "use server";
  // Fake auth: any email is accepted, no validation. Just set the session.
  await setSession();
  redirect("/targets");
}

export default function LoginPage() {
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

      <main className="flex flex-1 items-center justify-center py-16">
        <MinimalCard className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
              Welcome back
            </span>
            <h1 className="text-4xl leading-[0.95]">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              One place to see who to reach and pitch them on autopilot.
            </p>
          </div>

          <form action={signIn} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Work email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="border-b border-foreground/20 bg-transparent pb-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
              />
            </label>

            <Button type="submit" size="lg" className="w-full">
              Continue
            </Button>
          </form>
        </MinimalCard>
      </main>

      <footer className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Sillage · FullEnrich · Claude</span>
        <span>Autopilot — ready</span>
      </footer>
    </PageShell>
  );
}

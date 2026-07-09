# Backfire — Product Brief

When a competitor lands in a cluster of our ARR, Backfire maps the contagion across the account galaxy, whitewashes false positives, arms defense plays with a verified human entry point, and reallocates scarce Sillage tracking slots as a counter-fire into the competitor's own base. Nothing is ever sent without a human GO: the weapon has no trigger by design.

## Event

Agentic GTM Hackathon, Station F, July 9 2026. Build 9:30-17:30. Pitch 18:00: 1:30 pitch + 1:30 demo + 2:00 Q&A. Team of 4. Track 2 (Expansion: account health, upsell triggers, early churn, cross-sell), with an offensive counter-strike twist.

## The pain

A competitor never signs one of your customers in isolation: it runs a playbook segment by segment, and competitive churn propagates in clusters (same persona, same product gap, same budget cycle). The CRM shows it account by account, never as a map, so the pattern is discovered at the second or third churn, two quarters too late. Nobody tools the question "where does the fire spread next, and where do we counter-attack".

## Hard constraint: three load-bearing bricks

- **Sillage (MCP)**: market signals on up to 20 tracked accounts (job changes, fundraising, hiring, competitor activity, decision-maker power map). Three distinct roles: detector (signals on the book), test instrument (the Critic requests targeted evidence on a specific neighbor), and arbitrated resource (the 20 slots are an observation budget the agent splits between defense and counter-fire).
- **FullEnrich (MCP)**: waterfall enrichment as the actionability gate. A defense play stays frozen until the waterfall returns a verified email + mobile for the right person today, which is often a new decision-maker because the historical contact is stale.
- **Claude**: four sub-agents with separated responsibilities. Strategist (playbook inference, justified similarity, plays), Critic (challenges every supposed exposure, requests evidence, clears or confirms), Playwright (defense play assembly), Quartermaster (slot allocation under constraint with justification per move).

## The agentic loop (what makes it non-deterministic)

1. Detection: a Sillage signal lands on a book account.
2. Playbook inference: which segment, which angle, why now.
3. Contagion test: the Critic evaluates each neighbor (justified similarity + real signals) and issues a verdict: exposed (orange) or **cleared (green)**. Cleared accounts are the visible falsification proving this is not astrology.
4. Defense plays: per confirmed domino, a sourced diagnosis, a maneuver, 3 talking angles, and a verified contact. GO / NO-GO.
5. Draft after GO: the human GO, and only it, unlocks an editable draft. Copy button, no send button.
6. Counter-fire: slots reallocate toward the competitor's customers that most resemble our closed-won accounts.

Every observation revises the plan: a new signal can recolor the map live.

## Jury and scoring (4 x 25 pts)

- **Business impact**: the pain above, felt weekly by every Head of Sales.
- **Depth of AI use**: key judge created smolagents. Rewards a visible plan-observe-revise loop, penalizes agentic wrappers on deterministic tasks. Our answer: the Critic loop and the slot arbitration are irreducible to a pipeline; the audit log shows the reasoning.
- **Depth of Sillage + FullEnrich use**: both CEOs are judges; stubbed tools lose points. Our answer: only the CRM history is fabricated; signals, enrichment, and reasoning are real. Sillage's CEO thesis (anti-spam, human-in-the-loop, never full-auto) is embodied: silence while nothing changes, draft locked behind GO.
- **Presentation**: GTM exec judges (Dataiku, Photoroom, Airtable, Deel). They want a real pain, a hero number, a crisp "so what", and they penalize walls of generated text. Our answer: a map with three meaningful colors, verdicts, GO/NO-GO.

## Pitch structure (1:30)

1. **0:00-0:20, the pain**: "When a competitor signs one of your customers, it is never an isolated event: it is a playbook unrolling segment by segment. You find out at the next churn, two quarters too late. Meanwhile your CRM shows a healthy book."
2. **0:20-0:50, the solution**: contagion map, Critic that clears false positives, defense plays gated on verified contacts, counter-fire reallocation.
3. **0:50-1:05, restraint as a feature**: "The agent never sends anything. It stops exactly where human judgment begins. The weapon has no trigger: that is a design choice."
4. **1:05-1:30, the number**: hero number below.

## Demo script (1:30)

0:00 galaxy of the book renders → 0:10 one account pulses red (real Sillage signal on screen) → 0:25 orange perimeter draws neighbor by neighbor, the Critic clears one account which turns green → 0:45 click a domino: play, GO, the draft appears → 1:05 counter-fire panel: three slots reallocate, two counter-targets arm → 1:20 hero number.

**Hero number**: "38% of your ARR in the contagion radius. 2 accounts cleared, 3 defenses armed, 2 counter-targets locked. Zero messages sent without a human GO."

## Q&A prep (the three likely questions)

- "How do you know it is a playbook and not noise?" The Critic, and the cleared accounts prove it: the system says no.
- "Why no auto-send?" Design choice: the agent prepares the ammunition, the human decides the shot, and the weapon has no trigger.
- "What is mocked?" Only the CRM history. The companies are real, the signals are real, the enrichment is real, the reasoning is real.

## Timeline (owners: P1 front, P2 agent core, P3 MCP + data, P4 counter-fire + pitch)

- **9:30-10:30, all four**: explore both MCPs for real (tool schemas, signal types, freshness, waterfall hit rate on 3 personas). Reverse-engineer the book from available signals. Apply the pivot rule (D004) by 10:30: if competitor-activity signals are weak, the trigger becomes champion job change.
- **10:30-15:30, parallel**: P1 galaxy + play panel + GO-then-draft component. P2 four agents + verdict schemas + loop. P3 adapters + fixture recording + book. P4 slot-allocation logic + demo script + pitch. If the team is 3: counter-fire simplifies to an agent-reprioritized static list, P2 absorbs.
- **15:30-16:30, integration**: one demo flow end-to-end, live MCP with fixture fallback, run twice.
- **16:30-17:30, code freeze**: three timed pitch rehearsals, Q&A prep.

## Demo checklist

- [ ] Contagion loop proven end-to-end on real Sillage signals (load-bearing)
- [ ] A cleared account visibly turns green during the run (falsification moment)
- [ ] Play stays frozen until FullEnrich verifies, then arms (enrichment load-bearing, not decorative)
- [ ] GO unlocks the draft; confirm no send affordance exists anywhere
- [ ] Counter-fire: at least one slot reallocation shown with its justification
- [ ] Full run-through from clean state, twice; then kill the network and replay the canned path
- [ ] Pitch lands the hero number

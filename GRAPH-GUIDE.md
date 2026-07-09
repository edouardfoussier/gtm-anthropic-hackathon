# Graph guide — the people constellation (nodes, bubbles, links)

Handover doc for the Three.js contact graph on `feat-ui-three-js`. Read `AGENTS.md` first for the project-wide rules; this file covers only the graph and how to drive it. Everything lives in `components/graph/` + `app/page.tsx`.

## What it is

The centerpiece of the judged demo: a **people-only org constellation**. Every person at the target company is a "bubble" — a **particle mini-sphere** (dozens of dots on a Fibonacci shell) that condenses into place. Bubbles are sized by **role seniority**, linked to their manager by a **reporting line**, and when Claude picks the best contact, that bubble **ignites orange particle-by-particle** and its reporting line flows with orange dots while everyone else dims.

Design constraints that are LOCKED (D012/D015): editorial style, off-white `#F7F7F5` bg, near-black `#111111`, ONE orange `#FF6500`. **Never use bloom/additive glow** — physically invisible on a light background (verified, see `docs/research-SYNTHESIS-effects-plan.md` if the `docs/` folder exists locally; it's git-ignored). All effects are "ink on paper": opaque geometry + motion.

## File map

| File | Role |
|---|---|
| `components/graph/types.ts` | **The data contract (D001).** Only plain data crosses it — nothing outside `components/graph/` may import Three.js. |
| `components/graph/people-graph.tsx` | The whole renderer: scene, layout, shaders, links, labels, camera, dispose. One React component, vanilla Three.js inside. |
| `components/graph/demo-frames.ts` | Staged mock story (the fake "adapters returning"). This is what you edit to change the demo narrative. |
| `app/page.tsx` | Demo state machine: plays frames on timers, feeds `people` to the graph, renders the activity feed + Step/Replay/New-target controls. |

## The data contract — how you manage nodes

A node ("bubble") is a `PersonNode` (`components/graph/types.ts`):

```ts
{
  id: "p-cro",              // stable key — the graph diffs on it
  name: "Marc Delacroix",
  title: "CRO",
  status: "active",         // pending | active | picked | enriched | dim
  seniority: 2,             // 1 (biggest, most senior) … 4 (smallest)
  reportsTo: "p-ceo",       // org link → line to the manager. Absent = root (center)
  sublabel: "m@qonto.com",  // optional third label line (orange) — used after enrichment
}
```

The component takes **the full desired state** each time: `<PeopleGraph people={PersonNode[]} />`. It diffs internally:

- **id not seen before** → bubble spawns: particles stream out of its parent's position and converge (`easeOutBack`, staggered). Its reporting line draws in alongside.
- **id already present** → status/labels update in place (smooth color/opacity transitions; no re-spawn).
- **id missing from the array** → bubble is removed and disposed.
- `people={undefined}` or `[]` → empty map; the idle dust field fades back in.

So "managing nodes" = producing successive `PersonNode[]` snapshots. You never touch Three.js.

### Statuses (what they look like)

| status | bubble | link to manager |
|---|---|---|
| `pending` | ink @ 30% | ink @ 14% |
| `active` | ink @ 85% | ink @ 28% |
| `picked` | **orange ignition sweep** + pulse | turns orange, flow dots travel along it |
| `enriched` | same as picked (set `sublabel` to the email/phone) | same as picked |
| `dim` | ink @ 22% (the not-chosen) | ink @ 8% |

The orange never snaps: a `uAccent` uniform ramps 0→1.25 over ~1.1s and each particle flips when the ramp passes its own stagger value — the same wave order the bubble was born with.

### Layout (automatic, deterministic)

- Root (no `reportsTo`, first one) sits at the **center**.
- Its direct reports spread on a golden-angle ring at `LEVEL_1_DIST`.
- Deeper reports push outward near their parent's direction (`LEVEL_2_DIST`, cone fan per sibling).
- Positions are decided **at spawn, in discovery order** — feed people parent-before-child (CEO first) or a child whose parent isn't on the map yet falls back to the outer ring.
- The whole world slowly rotates; the camera auto-dollies to fit (aspect-aware: wide screens keep the camera closer so bubbles look bigger).

## Tuning knobs (all constants at the top of `people-graph.tsx`)

- `TIER` — per-seniority: cluster `radius`, particle `dots`, point `size`, `labelPad` (px between bubble and label).
- `LEVEL_1_DIST` / `LEVEL_2_DIST` / `LEVEL_1_Y_SPREAD` — spacing of the constellation.
- `CONVERGE_SECONDS` — bubble build-up duration. Accent ramp speed is `accentRate` in the tick (`dt / 1.1`).
- `CAMERA_IDLE_Z` / `CAMERA_MAX_Z` — dolly range. `IDLE_ROTATION_SPEED` — world spin (halved automatically while people are shown).
- `STATUS_STYLE` / `LINK_STYLE` — colors/opacities per status. Palette is locked (D015): ink + one orange only.
- `DUST_COUNT` — idle particle field density (shows only when the map is empty).

## The demo state machine (`app/page.tsx` + `demo-frames.ts`)

`buildDemoFrames(company)` returns an ordered list of frames:

```ts
{ delay: 850,                  // ms after the previous frame
  log: "Sillage · signal — …", // activity-feed line
  people?: PersonNode[] }      // OPTIONAL full snapshot; omitted = keep previous
```

The page applies frames one by one (`cursor` state): `people` = last snapshot seen, `logs` = all lines so far. Controls: **Step** (pause + advance one frame), **Replay** (cursor→0, replays; bubbles rebuild identically — randomness is seeded), **New target** (back to idle/form).

To change the mock story: edit `PEOPLE` (the 7-person org, discovery order = array order) and the frame list in `demo-frames.ts`. `PICKED_ID` selects who ignites.

## Wiring the REAL pipeline later (v0 judged path)

The graph is intentionally dumb — the real flow just emits the same shapes the mock does:

1. Sillage `getPeople(company)` → map to `PersonNode[]` with `status: "active"`, `seniority` derived from title, `reportsTo` if the org data has it (else omit → ring layout).
2. Claude orchestrator pick → re-emit the same array with the chosen id `status: "picked"`, rest `"dim"`.
3. FullEnrich result → chosen id `status: "enriched"`, `sublabel: email`.
4. Signals → activity-feed lines only (no graph machinery).

Stream each step as it returns — the graph animates progressively by design (D014). Keep the mock path (`demo-frames.ts`) working forever: it is the stage fallback.

## Gotchas (hard-won)

- **No bloom / no `AdditiveBlending`** on the light bg — it clips to white and vanishes. Use opaque ink/orange + motion.
- Label elements are DOM nodes created in TS with Tailwind classes **as literal strings** — Tailwind scans source files, so keep class names literal (no string concatenation) or styles silently disappear.
- Props reach the render loop via **refs + a version counter** (`peopleRef`/`peopleVersionRef`), synced once per frame. Don't read React state inside the tick. ESLint (`react-hooks/refs`) forbids writing refs during render — update them in `useEffect`.
- Everything is disposed on unmount (geometries, materials, label divs). If you add a Three object, add its disposal to `removePerson`/the effect cleanup or dev-mode double-mount will leak WebGL contexts.
- Randomness is seeded (`mulberry32`) so Replay looks identical. Don't introduce `Math.random()` in the scene.
- The canvas is `alpha: true` — the page provides the off-white. If you ever add postprocessing, you must set `scene.background` first.
- Run `npx tsc --noEmit && npm run lint && npm run build && npx tsx scripts/smoke.ts` before every commit (AGENTS.md rule).

## History / decisions

Built on `feat-ui-three-js` from Tom's design system (`cbe4394`). Iterations: satellite clusters around a big company sphere (`a66a394`) → people-only org constellation (`8ec9723`) → run-view polish + progressive ignition (`0c0b6fe`) → spacing/size + aspect-aware camera (`223d3ce`). When this merges to `main`, append **D016** to the AGENTS.md decision log: graph layout locked as "people-only org constellation: seniority-sized particle mini-spheres, reporting-line links, picked path in orange".

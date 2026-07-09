# AutoDeck video-engine API

A standalone HTTP service that runs the AutoDeck pipeline (`engine/src/pipeline.ts`)
on a real machine. It exists because the pipeline **needs `ffmpeg` and a writable
filesystem** to render slides, narrate them, composite the avatar PIP, and mux the
final `.mp4`.

> **Cloudflare Workers / Vercel Edge / any serverless runtime CANNOT run this.**
> There is no `ffmpeg` binary, no persistent/writable disk, no long-lived process,
> and execution time is capped well below the multi-minute render. This service is
> meant for a plain VM (e.g. Google Compute Engine) or a container host.

It is a zero-extra-dependency Node server (`node:http` only). Everything it needs
comes from the repo's existing engine dependencies.

## Endpoints

| Method | Path            | Description |
|--------|-----------------|-------------|
| GET    | `/health`       | `{ ok: true }` liveness probe |
| POST   | `/generate`     | Body `{ prospectId: string, voiceId?: string }` → `202 { jobId }`. Looks the prospect up in `engine/data/jury.json`, then runs the pipeline fire-and-forget. |
| GET    | `/jobs/:jobId`  | The job record (`status`, `steps[]`, `deck?`, `videoUrl?`, `error?`) or `404`. Poll this for progress. |
| GET    | `/videos/:file` | Streams `engine/out/<stem>/<file>` (`stem` = filename without extension). Serves `.mp4` and `.jpg`. `404` if missing. |

CORS is open (`Access-Control-Allow-Origin: *`) and `OPTIONS` is handled, so a
browser frontend on another origin can call it directly.

Job state is **in-memory** — a restart clears it. Fine for a single-box demo.

## VM deploy (Google Compute Engine)

1. **Create the VM** (Debian/Ubuntu, e.g. `e2-standard-2`, enough disk for renders).

2. **Install Node 22 + ffmpeg:**

   ```bash
   # Node 22 (NodeSource)
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs ffmpeg
   node --version   # v22.x
   ffmpeg -version
   ```

3. **Clone the repo and install deps** (run at the repo root — the server reuses
   the engine's dependencies):

   ```bash
   git clone <repo-url> autodeck && cd autodeck
   npm ci
   ```

4. **Create `.env.local` at the repo root** with the pipeline keys (never commit it):

   ```
   ANTHROPIC_API_KEY=...
   GRADIUM_API_KEY=...
   GRADIUM_VOICE_ID=...
   FAL_KEY=...            # omit/empty → slides-only, no avatar
   ```

   `engine/src/env.ts` loads `.env.local` (then `.env`) from the repo root
   automatically, regardless of how the process is launched.

5. **Run it:**

   ```bash
   PORT=8787 npx tsx server/index.ts
   # → {"event":"server_start","at":"...","port":8787}
   ```

   For a long-lived process use a supervisor (`systemd`, `pm2`, or `tmux` for a
   hackathon). Example one-liner smoke test from another shell:

   ```bash
   curl localhost:8787/health                                   # {"ok":true}
   curl -XPOST localhost:8787/generate \
     -H 'content-type: application/json' \
     -d '{"prospectId":"elizabeth-coleon"}'                     # {"jobId":"..."}
   curl localhost:8787/jobs/<jobId>                             # poll until status:"done"
   ```

### Docker (alternative)

Build with the **repo root as context** (the image needs the engine source and the
root lockfile):

```bash
docker build -f server/Dockerfile -t autodeck-server .
docker run --rm -p 8787:8787 --env-file .env.local autodeck-server
```

The image installs `ffmpeg` via apt and runs `npx tsx server/index.ts`.

## Firewall

Open TCP **8787** to the machine so the frontend can reach it:

```bash
gcloud compute firewall-rules create autodeck-engine \
  --allow=tcp:8787 \
  --source-ranges=0.0.0.0/0 \
  --description="AutoDeck video-engine API"
```

Lock `--source-ranges` down to your frontend/office IPs if you can. The service
has no auth — a reachable URL is the only gate — so do not expose it broadly for
long.

## Wire the frontend to it

Set this on the Next.js app (Vercel env var or local `.env.local`):

```
ENGINE_API_URL=http://<vm-external-ip>:8787
```

When `ENGINE_API_URL` is set, `POST /api/generate` forwards the request to this
service and returns its `{ jobId }`. Remote jobs are then polled at
`${ENGINE_API_URL}/jobs/{jobId}`, and the rendered video is served from
`${ENGINE_API_URL}/videos/{id}.mp4`. When `ENGINE_API_URL` is unset, the app keeps
its existing local detached-spawn behavior.

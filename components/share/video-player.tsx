"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Autoplaying share-page player. Browsers block autoplay WITH sound, so we
 * autoplay muted (the "auto-launch" wow) and surface a prominent one-tap unmute.
 * Fires view/progress tracking events via keepalive fetch so the dashboard can
 * show "watching now / watched Nx".
 */
const PROGRESS_INTERVAL_S = 5;

function track(prospectId: string, event: string, currentTime: number): void {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: prospectId, event, currentTime: Math.round(currentTime) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking is best-effort */
  }
}

export function VideoPlayer({
  src,
  poster,
  prospectId,
}: {
  src: string;
  poster: string;
  prospectId: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastProgress = useRef(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    ref.current?.play().catch(() => {
      /* some browsers block even muted autoplay until interaction */
    });
  }, []);

  function handleTimeUpdate(): void {
    const t = ref.current?.currentTime ?? 0;
    if (t - lastProgress.current >= PROGRESS_INTERVAL_S) {
      lastProgress.current = t;
      track(prospectId, "progress", t);
    }
  }

  function unmute(): void {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    v.play().catch(() => {});
    track(prospectId, "unmute", v.currentTime);
  }

  return (
    <div className="relative w-full overflow-hidden border border-border bg-black">
      <video
        ref={ref}
        src={src}
        poster={poster}
        autoPlay
        muted
        playsInline
        controls
        onPlay={() => track(prospectId, "play", ref.current?.currentTime ?? 0)}
        onTimeUpdate={handleTimeUpdate}
        className="aspect-video w-full"
      />
      {muted && (
        <button
          type="button"
          onClick={unmute}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90"
        >
          🔊 Tap for sound
        </button>
      )}
    </div>
  );
}

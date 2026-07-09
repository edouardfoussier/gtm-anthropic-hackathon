// Small shared helpers.

/** Reject if `p` doesn't settle within `ms`. Callers catch → mock fallback (never hang the UI). */
export function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

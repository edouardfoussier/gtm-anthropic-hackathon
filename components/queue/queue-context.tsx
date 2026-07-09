"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Contact, QueueItem, QueueStatus } from "@/lib/types";

const GENERATING_DELAY_MS = 1800;
const READY_DELAY_MS = 3600;

// Survives client navigation + tab refresh so drafts aren't lost when the user
// opens a reach-out and comes back. Cleared when the tab closes (sessionStorage).
const STORAGE_KEY = "autodeck:queue";

interface QueueContextValue {
  items: QueueItem[];
  enqueue: (companyName: string, contact: Contact) => void;
}

const QueueContext = createContext<QueueContextValue | null>(null);

function loadQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    if (!Array.isArray(parsed)) return [];
    // Timers don't survive a reload — any draft we started is, by the time the
    // user is back, effectively ready. Settle everything that wasn't finished.
    return parsed.map((item) =>
      item.status === "ready" ? item : { ...item, status: "ready" as const },
    );
  } catch {
    return [];
  }
}

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Rehydrate on mount (client only, after SSR) so there's no hydration
  // mismatch: the server can't read sessionStorage, so we render empty first
  // and fill in once mounted. This one-shot sync is the intended exception to
  // the "no setState in effect" rule.
  useEffect(() => {
    const restored = loadQueue();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only hydration
    if (restored.length > 0) setItems(restored);
    setHydrated(true);
  }, []);

  // Persist on every change, but only once we've rehydrated — otherwise the
  // initial empty state would clobber a queue saved by a previous view.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / disabled — the in-memory queue still works */
    }
  }, [items, hydrated]);

  const setStatus = useCallback((id: string, status: QueueStatus) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }, []);

  const enqueue = useCallback(
    (companyName: string, contact: Contact) => {
      const id = `${contact.id}-${Date.now()}`;
      setItems((prev) => [
        ...prev,
        { id, companyName, contact, status: "queued", queuedAt: Date.now() },
      ]);

      timeouts.current.push(
        setTimeout(() => setStatus(id, "generating"), GENERATING_DELAY_MS),
      );
      timeouts.current.push(
        setTimeout(() => setStatus(id, "ready"), READY_DELAY_MS),
      );
    },
    [setStatus],
  );

  return (
    <QueueContext.Provider value={{ items, enqueue }}>
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error("useQueue must be used within a QueueProvider");
  }
  return context;
}

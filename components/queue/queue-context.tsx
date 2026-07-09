"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { Contact, QueueItem, QueueStatus } from "@/lib/types";

const GENERATING_DELAY_MS = 1800;
const READY_DELAY_MS = 3600;

interface QueueContextValue {
  items: QueueItem[];
  enqueue: (companyName: string, contact: Contact) => void;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

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

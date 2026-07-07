"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * Toast system — <ToastProvider> at the app root exposes useToast(); call
 * toast({ tone, title, description }) from client handlers or after a server
 * action resolves. The live region is aria-live="polite" so screen readers
 * announce without stealing focus. Auto-dismisses; each toast is also manually
 * dismissible. Tones map to the status ramp (no green — success uses blue).
 */

type Tone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const TONES: Record<Tone, { cls: string; Icon: typeof Info }> = {
  success: { cls: "border-accent/30 text-accent", Icon: CheckCircle2 },
  error: { cls: "border-accent-danger/40 text-accent-danger", Icon: TriangleAlert },
  info: { cls: "border-line text-ink", Icon: Info },
};

const ToastContext = createContext<
  ((t: Omit<Toast, "id">) => void) | null
>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...t, id }]);
      // auto-dismiss; errors linger a little longer than confirmations
      const ttl = t.tone === "error" ? 6000 : 4000;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const { cls, Icon } = TONES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cx(
                "pointer-events-auto flex items-start gap-2.5 rounded-lg border border-l-4 bg-surface p-3 shadow-lg animate-toast-in",
                cls,
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-ink/60">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded p-0.5 text-ink/40 hover:bg-paper2 hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

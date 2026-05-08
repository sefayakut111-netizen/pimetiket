"use client";

/**
 * Toast — kısa-süreli bilgilendirme bildirimi.
 *
 * useToast() hook ile çağırılır:
 *   const { toast } = useToast();
 *   toast.success("Sepete eklendi");
 *   toast.error("Bağlantı koptu");
 *
 * <ToastProvider> RootLayout'ta sarılır; render fixed top-right,
 * max 3 stack, 3sn auto-dismiss.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "warning" | "error" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastApi {
  success: (msg: string) => void;
  warning: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

interface ToastCtxValue {
  toast: ToastApi;
}

const ToastCtx = createContext<ToastCtxValue | null>(null);

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: "bg-yesil-soft text-yesil ring-yesil/30",
  warning: "bg-sari-soft text-[#7A560A] ring-sari/30",
  error: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
  info: "bg-gri-100 text-gri-700 ring-gri-200",
};

const VARIANT_ICON: Record<ToastVariant, ReactNode> = {
  success: <Icon.Check size={16} />,
  warning: <Icon.Info size={14} />,
  error: <Icon.Info size={14} />,
  info: <Icon.Info size={14} />,
};

const MAX_STACK = 3;
const TTL_MS = 3000;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId++;
      setItems((arr) => {
        const next = [...arr, { id, variant, message }];
        // FIFO — eskileri at, max stack koru
        return next.length > MAX_STACK ? next.slice(-MAX_STACK) : next;
      });
      window.setTimeout(() => {
        setItems((arr) => arr.filter((t) => t.id !== id));
      }, TTL_MS);
    },
    []
  );

  const toast: ToastApi = {
    success: (m) => push("success", m),
    warning: (m) => push("warning", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <ToastViewport items={items} />
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx.toast;
}

// ============================================================
// Viewport
// ============================================================

function ToastViewport({ items }: { items: ToastItem[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  // Mount animation — fade-up + slight scale
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 10);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex items-start gap-2.5 px-3.5 py-2.5",
        "rounded-xl ring-1 shadow-1 max-w-[320px] text-[13px] font-medium",
        "transition-all duration-200 ease-out",
        mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4",
        VARIANT_CLASS[item.variant]
      )}
    >
      <span className="shrink-0 mt-px">{VARIANT_ICON[item.variant]}</span>
      <span className="leading-snug">{item.message}</span>
    </div>
  );
}

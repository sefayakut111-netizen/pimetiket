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

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  /** Sefa 20 May v68 UX paket C #5: Undo action (sepetten kaldırma sonrası) */
  action?: ToastAction;
  /** Kendi TTL'i (undoable için 5sn) */
  ttlMs?: number;
}

interface ToastApi {
  success: (msg: string) => void;
  warning: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  /** Sefa 20 May v68 UX paket C #5: "X kaldırıldı · ↩ Geri al" pattern.
   *  Default TTL 5sn (undo için daha uzun). */
  undoable: (msg: string, onUndo: () => void, ttlMs?: number) => void;
}

interface ToastCtxValue {
  toast: ToastApi;
}

const ToastCtx = createContext<ToastCtxValue | null>(null);

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: "bg-yesil-soft text-yesil ring-yesil/30",
  warning: "bg-sari-soft text-sari-koyu ring-sari/30",
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
    (
      variant: ToastVariant,
      message: string,
      opts?: { action?: ToastAction; ttlMs?: number }
    ) => {
      const id = nextId++;
      setItems((arr) => {
        const next = [
          ...arr,
          { id, variant, message, action: opts?.action, ttlMs: opts?.ttlMs },
        ];
        return next.length > MAX_STACK ? next.slice(-MAX_STACK) : next;
      });
      window.setTimeout(() => {
        setItems((arr) => arr.filter((t) => t.id !== id));
      }, opts?.ttlMs ?? TTL_MS);
    },
    []
  );

  const toast: ToastApi = {
    success: (m) => push("success", m),
    warning: (m) => push("warning", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
    undoable: (m, onUndo, ttlMs = 5000) =>
      push("info", m, {
        action: { label: "Geri al", onClick: onUndo },
        ttlMs,
      }),
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
      className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[100] flex flex-col-reverse gap-2 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-[380px]"
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
  const [actionFired, setActionFired] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 10);
    return () => window.clearTimeout(id);
  }, []);

  const handleAction = () => {
    if (actionFired || !item.action) return;
    setActionFired(true);
    item.action.onClick();
  };

  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex items-center gap-2.5 px-3.5 py-2.5",
        "rounded-xl ring-1 shadow-1 max-w-[360px] text-[13px] font-medium",
        "transition-all duration-200 ease-out",
        mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4",
        VARIANT_CLASS[item.variant]
      )}
    >
      <span className="shrink-0">{VARIANT_ICON[item.variant]}</span>
      <span className="leading-snug flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={handleAction}
          disabled={actionFired}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12.5px] font-bold",
            "underline underline-offset-2 hover:no-underline",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label={item.action.label}
        >
          <span aria-hidden="true">↩</span> {item.action.label}
        </button>
      )}
    </div>
  );
}

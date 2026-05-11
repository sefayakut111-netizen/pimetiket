/**
 * Pim Etiket — Modal primitive
 *
 * A11y kurallar (WCAG 2.1.2 + 2.4.3):
 *   - role="dialog" + aria-modal + aria-labelledby (başlığa bağlanır)
 *   - Esc tuşu kapatır
 *   - Açıldığında ilk focusable element'e auto-focus
 *   - Tab/Shift+Tab modal içinde kalır (focus trap)
 *   - Kapanınca açıldığı element'e focus geri döner
 *   - body scroll lock
 *
 * Kullanım:
 *   <Modal open={x} onClose={() => set(false)} title="Yeni fason">
 *     <form ...>
 *   </Modal>
 *
 * Eski custom modal'lar bunu kullanmaya migrate edilmeli (admin/fason,
 * /odeme TC skip vb).
 */

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { Card } from "./Card";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Genişlik sınıfı, varsayılan max-w-[520px] */
  maxWidthClassName?: string;
  /** Backdrop'a tıklanınca kapatılsın mı, varsayılan true */
  closeOnBackdrop?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-[520px]",
  closeOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Esc + focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ilk focusable'a focus
    const t = setTimeout(() => {
      if (!dialogRef.current) return;
      const first =
        dialogRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }, 10);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      // focus restore
      previousFocusRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop) onClose();
      }}
    >
      <Card
        padding="p-6"
        className={`${maxWidthClassName} w-full max-h-[90vh] overflow-y-auto`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <h3 id={titleId} className="text-lg font-semibold mb-4">
            {title}
          </h3>
          {children}
        </div>
      </Card>
    </div>
  );
}

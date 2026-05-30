/**
 * InfoTooltip — "?" ikonu + hover/focus tooltip (UX uzman 2.4).
 *
 * SelectableCard <button> içinde kullanıldığı için tetikleyici <button>
 * değil <span role="button"> — iç içe button hydration hatasını önler.
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  text: string;
  iconClassName?: string;
}

export function InfoTooltip({
  text,
  iconClassName = "text-gri-500 hover:text-pim-mercan",
}: InfoTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((v) => !v);
  };

  return (
    <span className="relative inline-flex">
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label="Bilgi"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            toggle(e);
          }
        }}
        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ring-1 ring-current text-[9px] font-bold leading-none transition-colors cursor-help shrink-0 ${iconClassName}`}
      >
        ?
      </span>
      {open &&
        mounted &&
        pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top - 8,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              maxWidth: 220,
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="w-max px-2.5 py-1.5 rounded-lg bg-lacivert text-white text-[11.5px] leading-snug shadow-mercan font-normal text-left whitespace-normal"
          >
            {text}
            <span
              aria-hidden
              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent"
              style={{ borderTopColor: "var(--color-lacivert)" }}
            />
          </div>,
          document.body
        )}
    </span>
  );
}

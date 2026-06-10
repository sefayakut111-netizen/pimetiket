"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export const EDITOR_ONBOARD_STORAGE_KEY = "pim_editor_onboarded";

const STEPS: { target: string; text: string }[] = [
  {
    target: '[data-onboard="file"]',
    text: "Sol panelden görsel yükle.",
  },
  {
    target: '[data-onboard="blade"]',
    text: "Bıçağı seç — hazır şablon veya otomatik.",
  },
  {
    target: '[data-onboard="size"]',
    text: "Sol paneldeki Boyut sekmesinden boyutlandır.",
  },
  {
    target: '[data-onboard="export"]',
    text: "Üstten Sticker veya Etiket'e ekle.",
  },
];

interface EditorCoachmarkProps {
  open: boolean;
  onComplete: () => void;
  onDismissSession: () => void;
}

export function EditorCoachmark({
  open,
  onComplete,
  onDismissSession,
}: EditorCoachmarkProps) {
  const titleId = useId();
  const [step, setStep] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLast = step >= STEPS.length - 1;

  const measure = useCallback(() => {
    const el = document.querySelector(STEPS[step]?.target ?? "");
    setAnchor(el?.getBoundingClientRect() ?? null);
  }, [step]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    measure();
    const onLayout = () => measure();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismissSession();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismissSession]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, step]);

  if (!open) return null;

  const tooltipTop = anchor
    ? Math.min(anchor.bottom + 10, window.innerHeight - 160)
    : window.innerHeight / 2 - 80;
  const tooltipLeft = anchor
    ? Math.min(
        Math.max(12, anchor.left + anchor.width / 2 - 140),
        window.innerWidth - 292
      )
    : window.innerWidth / 2 - 140;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div
        className="absolute inset-0 bg-lacivert/35 pointer-events-auto"
        aria-hidden
        onClick={onDismissSession}
      />

      {anchor ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-pim-mercan ring-offset-2 ring-offset-white/80"
          style={{
            top: anchor.top - 4,
            left: anchor.left - 4,
            width: anchor.width + 8,
            height: anchor.height + 8,
          }}
        />
      ) : null}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "pointer-events-auto fixed w-[min(280px,calc(100vw-24px))] rounded-lg",
          "bg-white p-4 shadow-2 ring-1 ring-gri-200 outline-none"
        )}
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p
          id={titleId}
          className="text-[12px] font-semibold text-gri-600 tabular-nums"
        >
          {step + 1} / {STEPS.length}
        </p>
        <p className="mt-2 text-[13.5px] leading-snug text-lacivert">
          {STEPS[step]?.text}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Geri
            </Button>
          ) : null}
          {isLast ? (
            <Button type="button" variant="primary" size="sm" onClick={onComplete}>
              Anladım
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              İleri
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function isEditorOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(EDITOR_ONBOARD_STORAGE_KEY) === "1";
}

export function markEditorOnboarded(): void {
  localStorage.setItem(EDITOR_ONBOARD_STORAGE_KEY, "1");
}

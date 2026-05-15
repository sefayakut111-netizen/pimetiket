/**
 * Stepper — konfigüratör ilerleme göstergeleri (etiket + sticker).
 *
 * İki varyant export ediliyor:
 *   - <StepProgress>: yatay (mobile + desktop fallback)
 *   - <VerticalStepProgress>: dikey rail (desktop only)
 *
 * Props:
 *   - steps:        UI label dizisi (örn ["Malzeme","Kaplama",...])
 *   - stepIds:      FormSection orijinal numaraları (touched lookup için)
 *   - activeStep:   Şu an aktif olan UI index (1-N)
 *   - completedSet: Tamamlanan FormSection numaraları (touched)
 *   - onStepClick:  UI index alır, scroll-to tetikler
 */

"use client";

import { cn } from "@/lib/cn";

interface StepperProps {
  steps: readonly string[];
  stepIds: readonly number[];
  activeStep: number;
  completedSet: Set<number>;
  onStepClick: (stepIndex: number) => void;
}

export function StepProgress({
  steps,
  stepIds,
  activeStep,
  completedSet,
  onStepClick,
}: StepperProps) {
  const total = steps.length;
  const progressPct = (Math.max(1, activeStep) / total) * 100;
  const activeLabel = steps[activeStep - 1] ?? steps[0];

  return (
    <div>
      {/* Mobile: compact bar + text */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-pim-mercan">
            Adım {activeStep} / {total}
          </span>
          <span className="text-[12.5px] font-semibold text-lacivert">
            {activeLabel}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gri-200 overflow-hidden">
          <div
            className="h-full bg-pim-mercan rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>
      </div>

      {/* Desktop: numara row + tıklanabilir label */}
      <div
        className="hidden md:block"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={activeStep}
        aria-label={`Konfigürasyon adımı ${activeStep} / ${total}: ${activeLabel}`}
      >
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => {
            const stepNum = i + 1;
            const sectionId = stepIds[i];
            const isActive = stepNum === activeStep;
            const isDone = completedSet.has(sectionId) && !isActive;
            return (
              <div key={stepNum} className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => onStepClick(stepNum)}
                  aria-label={`${steps[i]} adımına git`}
                  className={cn(
                    "shrink-0 grid place-items-center rounded-full",
                    "text-[11px] font-bold tabular-nums transition-all duration-200",
                    "hover:scale-110 active:scale-95 cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-pim-mercan focus:ring-offset-2",
                    isActive
                      ? "w-6 h-6 bg-pim-mercan text-white ring-2 ring-pim-mercan-tint"
                      : isDone
                        ? "w-5 h-5 bg-pim-mercan text-white"
                        : "w-5 h-5 bg-gri-200 text-gri-700 hover:bg-gri-300"
                  )}
                >
                  {stepNum}
                </button>
                {i < total - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "flex-1 h-px transition-colors",
                      isDone || isActive ? "bg-pim-mercan" : "bg-gri-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div
          className="grid gap-1.5 mt-1.5"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {steps.map((label, i) => {
            const stepNum = i + 1;
            const sectionId = stepIds[i];
            const isActive = stepNum === activeStep;
            const isDone = completedSet.has(sectionId) && !isActive;
            return (
              <button
                key={stepNum}
                type="button"
                onClick={() => onStepClick(stepNum)}
                className={cn(
                  "text-[10.5px] font-semibold tabular-nums truncate text-left",
                  "transition-colors hover:text-pim-mercan cursor-pointer",
                  isActive
                    ? "text-pim-mercan"
                    : isDone
                      ? "text-lacivert"
                      : "text-gri-500"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VerticalStepProgress({
  steps,
  stepIds,
  activeStep,
  completedSet,
  onStepClick,
}: StepperProps) {
  const total = steps.length;
  return (
    <nav
      role="navigation"
      aria-label="Konfigürasyon adımları"
      className="flex flex-col"
    >
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const sectionId = stepIds[i];
        const isActive = stepNum === activeStep;
        const isDone = completedSet.has(sectionId) && !isActive;
        const isLast = i === total - 1;
        return (
          <button
            key={stepNum}
            type="button"
            onClick={() => onStepClick(stepNum)}
            aria-current={isActive ? "step" : undefined}
            aria-label={`${stepNum}. adım: ${label}${
              isDone ? " (tamamlandı)" : isActive ? " (aktif)" : ""
            }`}
            className={cn(
              "group relative flex items-start gap-3 py-2 pr-3",
              "text-left transition-colors",
              "focus:outline-none focus-visible:bg-pim-mercan-tint/40 rounded-r-lg"
            )}
          >
            <div className="relative flex flex-col items-center shrink-0 pt-0.5">
              <span
                aria-hidden
                className={cn(
                  "rounded-full grid place-items-center shrink-0",
                  "transition-all duration-200 font-bold tabular-nums",
                  "group-hover:scale-110 group-active:scale-95",
                  isActive
                    ? "w-7 h-7 bg-pim-mercan text-white text-[12px] ring-[3px] ring-pim-mercan-tint"
                    : isDone
                      ? "w-6 h-6 bg-pim-mercan text-white"
                      : "w-6 h-6 bg-gri-200 text-gri-700 text-[11px] group-hover:bg-gri-300"
                )}
              >
                {isDone ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2.5 6L5 8.5L9.5 4"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  stepNum
                )}
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "w-0.5 grow min-h-[24px] mt-1 transition-colors",
                    isDone || isActive ? "bg-pim-mercan" : "bg-gri-200"
                  )}
                />
              )}
            </div>

            <div className="flex-1 pt-px">
              <div
                className={cn(
                  "text-[12.5px] font-semibold transition-colors leading-tight",
                  isActive
                    ? "text-pim-mercan"
                    : isDone
                      ? "text-lacivert"
                      : "text-gri-500 group-hover:text-pim-mercan"
                )}
              >
                {label}
              </div>
              <div
                className={cn(
                  "text-[10.5px] mt-0.5 transition-colors uppercase tracking-[0.04em]",
                  isActive
                    ? "text-pim-mercan/80"
                    : isDone
                      ? "text-yesil"
                      : "text-gri-500"
                )}
              >
                {isActive ? "Şu an" : isDone ? "Tamam" : `Adım ${stepNum}`}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

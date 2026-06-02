/**
 * Konfigüratör eksik adım vurgusu — scroll + burst animasyonu.
 * Sticker ve etiket yapilandir sayfalarında paylaşılır.
 */

import { findFirstIncompleteStep } from "@/lib/use-sequential-steps";

const BURST_CLASS = "configurator-step-burst";
const BURST_MS = 2500;

export function getFirstPendingStepId(
  stepIds: readonly number[],
  touchedSteps: Set<number>,
  optionalStepIds?: ReadonlySet<number>
): number | undefined {
  return findFirstIncompleteStep(stepIds, touchedSteps, { optionalStepIds });
}

export function scrollToConfiguratorStep(
  stepDomId: number,
  scrollToUiStep: (uiStepIndex: number) => void,
  stepIds: readonly number[]
): void {
  const idx = stepIds.indexOf(stepDomId);
  if (idx >= 0) scrollToUiStep(idx + 1);
}

export function burstConfiguratorStepAttention(stepDomId: number): void {
  const el = document.getElementById(`step-${stepDomId}`);
  if (!el) return;
  el.classList.remove(BURST_CLASS);
  // Reflow — aynı sınıfı yeniden tetikle
  void el.offsetWidth;
  el.classList.add(BURST_CLASS);
  window.setTimeout(() => {
    el.classList.remove(BURST_CLASS);
  }, BURST_MS);
}

export function focusPendingConfiguratorStep(
  stepDomId: number,
  scrollToUiStep: (uiStepIndex: number) => void,
  stepIds: readonly number[]
): void {
  scrollToConfiguratorStep(stepDomId, scrollToUiStep, stepIds);
  burstConfiguratorStepAttention(stepDomId);
}

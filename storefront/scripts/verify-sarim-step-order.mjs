/**
 * Rulo stepIds kilit zinciri smoke test (SARIM-SIRA prompt B3/B4).
 * node scripts/verify-sarim-step-order.mjs
 */

import {
  useSequentialSteps,
  isStepComplete,
} from "../src/lib/use-sequential-steps.ts";

const stepIds = [1, 2, 7, 6, 8, 4, 5];
const stepLabels = [
  "Malzeme",
  "Kaplama",
  "Tasarım",
  "Boyut",
  "Adet",
  "Sarım yönü",
  "Sarım detayı",
];
const optionalStepIds = new Set([7]);

function mk(touched) {
  const touchedSteps = new Set(touched);
  const { isLocked } = useSequentialSteps({
    stepIds,
    stepLabels,
    touchedSteps,
    optionalStepIds,
    prerequisiteForFirst: true,
    locale: "tr",
  });
  return { isLocked, touchedSteps };
}

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL:", name);
    failed++;
  } else {
    console.log("OK:", name);
  }
}

// Başlangıç: sadece malzeme açık
{
  const { isLocked } = mk([]);
  assert("step-1 açık", !isLocked(1));
  assert("step-2 kilitli", isLocked(2));
  assert("step-8 kilitli", isLocked(8));
  assert("step-4 kilitli", isLocked(4));
}

// Malzeme+kaplama → boyut açık (tasarım opsiyonel atlanır — B4)
{
  const { isLocked } = mk([1, 2]);
  assert("step-7 açık (opsiyonel)", !isLocked(7));
  assert("step-6 boyut açık (tasarım atlandı)", !isLocked(6));
  assert("step-8 adet kilitli", isLocked(8));
}

// Boyut → adet
{
  const { isLocked } = mk([1, 2, 6]);
  assert("step-8 adet açık", !isLocked(8));
  assert("step-4 sarım hâlâ kilitli", isLocked(4));
}

// Adet → sarım yönü (B3 kritik)
{
  const { isLocked } = mk([1, 2, 6, 8]);
  assert("step-4 sarım yönü açık", !isLocked(4));
  assert("step-5 sarım detay kilitli", isLocked(5));
}

// Sarım yönü → sarım detay
{
  const { isLocked } = mk([1, 2, 6, 8, 4]);
  assert("step-5 sarım detay açık", !isLocked(5));
}

// step-5 touched olmadan complete sayılmaz (B1)
assert(
  "step-5 default complete değil",
  !isStepComplete(5, new Set([1, 2, 6, 8, 4]))
);

// URL pre-fill: shape → boyut unlocked sayılmamalı, adet kilitli kalmalı
{
  const unlocked = new Set([6]);
  const { isLocked } = useSequentialSteps({
    stepIds,
    stepLabels,
    touchedSteps: new Set([1, 2]),
    unlockedSteps: unlocked,
    optionalStepIds: optionalStepIds,
    prerequisiteForFirst: true,
    locale: "tr",
  });
  assert("URL shape prefill: adet kilitli", isLocked(8));
  assert("URL shape prefill: sarım kilitli", isLocked(4));
}

// Tabaka stepIds sarım içermez
const tabakaIds = [1, 2, 7, 6, 8];
assert("tabaka stepIds sarım yok", !tabakaIds.includes(4) && !tabakaIds.includes(5));

if (failed) {
  console.error("\n" + failed + " assertion(s) failed");
  process.exit(1);
}
console.log("\nAll lock-chain checks passed.");

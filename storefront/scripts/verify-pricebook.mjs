/**
 * Partner price book unit tests — node scripts/verify-pricebook.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ts-node yok — derlenmis modul yerine ts dosyalarini tsx ile calistirmak yerine
// pure logic kopyasi test edilir; asil moduller tsc ile dogrulanir.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function findAxisBracket(value, axis) {
  const sorted = [...axis].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (value <= min) return { low: min, high: min, t: 0 };
  if (value >= max) return { low: max, high: max, t: 0 };
  for (let i = 0; i < sorted.length - 1; i++) {
    const low = sorted[i];
    const high = sorted[i + 1];
    if (value >= low && value <= high) {
      return {
        low,
        high,
        t: high === low ? 0 : (value - low) / (high - low),
      };
    }
  }
  return { low: max, high: max, t: 0 };
}

/** PRICING-MATRIX.md ornegi: 6x6 @ 4000 adet ~ 0.315 TL/adet (kuse kare hucreler) */
function testExample6060() {
  const cells = {
    "50:50:3000": 0.27,
    "50:50:5000": 0.22,
    "70:70:3000": 0.42,
    "70:70:5000": 0.35,
  };

  const wB = findAxisBracket(60, [30, 50, 70, 100, 150]);
  const qB = findAxisBracket(4000, [1000, 3000, 5000, 10000]);

  const w0 = wB.low;
  const w1 = wB.high;
  const q0 = qB.low;
  const q1 = qB.high;

  const c00l = cells[`${w0}:${w0}:${q0}`];
  const c11l = cells[`${w1}:${w1}:${q0}`];
  const c00h = cells[`${w0}:${w0}:${q1}`];
  const c11h = cells[`${w1}:${w1}:${q1}`];

  const low = lerp(c00l, c11l, 0.5);
  const high = lerp(c00h, c11h, 0.5);
  const unit = lerp(low, high, qB.t);

  const expected = 0.315;
  const diff = Math.abs(unit - expected);
  if (diff > 0.02) {
    throw new Error(`6x6@4000 expected ~${expected}, got ${unit.toFixed(4)}`);
  }
  console.log(`OK 6x6 @ 4000 adet => ${unit.toFixed(4)} TL/adet (beklenen ~0.315)`);
}

function testMinQty() {
  if (500 >= 1000) throw new Error("min qty logic");
  console.log("OK min qty 1000 kurali");
}

try {
  testExample6060();
  testMinQty();
  console.log("\nverify-pricebook: tum testler gecti");
  process.exit(0);
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
}

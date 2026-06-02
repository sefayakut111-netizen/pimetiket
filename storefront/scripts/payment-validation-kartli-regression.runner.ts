/**
 * Checkout recalc regresyon — Kartlı sticker client/sunucu fiyat hizası.
 * PayTR veya canlı DB gerektirmez; FALLBACK_STICKER_CONFIG kullanır.
 */
import { quoteStickerFromConfig } from "../src/lib/customer-pricing-from-config";
import { FALLBACK_STICKER_CONFIG } from "../src/lib/pricing-config-types";
import { expectedCartLineFromPerDesignQuote } from "../src/lib/design-count-pricing";
import type { StickerCutType } from "../src/lib/sticker-customer-pricing";

const RECALC_TOLERANCE_PCT = 0.02;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertRecalcPasses(args: {
  cut: StickerCutType;
  width: number;
  height: number;
  qty: number;
}) {
  const input = {
    width: args.width,
    height: args.height,
    qty: args.qty,
    material: "vinil" as const,
    finish: "parlak" as const,
    cut: args.cut,
  };

  const fromConfig = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, input);
  assert(fromConfig?.ok === true, `${args.cut}: config quote failed`);

  if (!fromConfig || !fromConfig.ok) return;

  const cartLine = expectedCartLineFromPerDesignQuote(
    fromConfig.unitPrice,
    args.qty,
    1
  );
  const totalTol = Math.max(0.5, cartLine.total * RECALC_TOLERANCE_PCT);
  assert(
    Math.abs(cartLine.total - fromConfig.total) <= totalTol,
    `${args.cut}: cart line ${cartLine.total} vs quote ${fromConfig.total}`
  );
}

export function runRegressionTests() {
  assertRecalcPasses({
    cut: "kartli",
    width: 75,
    height: 75,
    qty: 25,
  });
  assertRecalcPasses({
    cut: "diecut",
    width: 75,
    height: 75,
    qty: 25,
  });
  assertRecalcPasses({
    cut: "kisscut",
    width: 60,
    height: 60,
    qty: 50,
  });
  assertRecalcPasses({
    cut: "tabaka",
    width: 50,
    height: 50,
    qty: 100,
  });

  const kartli = quoteStickerFromConfig(FALLBACK_STICKER_CONFIG, {
    width: 75,
    height: 75,
    qty: 25,
    material: "vinil",
    finish: "parlak",
    cut: "kartli",
  });
  assert(kartli?.ok === true, "kartli quote must succeed");

  console.log("[payment-validation-kartli-regression] OK");
  if (kartli?.ok) {
    console.log(`  kartli 75×75 config total: ${kartli.total.toFixed(2)} ₺`);
  }
}

runRegressionTests();

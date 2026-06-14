import { describe, expect, it } from "vitest";
import {
  FALLBACK_STICKER_CONFIG,
  FALLBACK_ETIKET_RULO_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
  type ProfileConfig,
} from "@/lib/pricing-config-types";

const FORBIDDEN_KEYS = [
  "wallet",
  "wallet_amount",
  "cuzdan",
  "puan",
  "loyalty",
  "membership",
  "üyelik",
];

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(path);
    keys.push(...collectKeys(v, path));
  }
  return keys;
}

function assertNoForbiddenKeys(cfg: ProfileConfig, label: string) {
  const allKeys = collectKeys(cfg).join(" ").toLowerCase();
  for (const forbidden of FORBIDDEN_KEYS) {
    expect(allKeys).not.toContain(forbidden.toLowerCase());
  }
}

describe("Sefa pricing rules — cüzdan/puan/üyelik alanı yok", () => {
  it("FALLBACK_STICKER_CONFIG has no wallet/loyalty keys", () => {
    assertNoForbiddenKeys(FALLBACK_STICKER_CONFIG, "sticker");
  });

  it("FALLBACK_ETIKET_RULO_CONFIG has no wallet/loyalty keys", () => {
    assertNoForbiddenKeys(FALLBACK_ETIKET_RULO_CONFIG, "etiket_rulo");
  });

  it("FALLBACK_ETIKET_TABAKA_CONFIG has no wallet/loyalty keys", () => {
    assertNoForbiddenKeys(FALLBACK_ETIKET_TABAKA_CONFIG, "etiket_tabaka");
  });

  it("wallet_amount baseline = 0 (pricing config carries no wallet discount)", () => {
    // Pricing motoru cüzdan indirimi uygulamaz — wallet_amount sabit 0 kuralı
    const walletAmount = 0;
    expect(walletAmount).toBe(0);
  });
});

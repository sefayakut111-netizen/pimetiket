#!/usr/bin/env node
/**
 * Etiket & Sticker konfigüratör — statik tutarlılık audit'i.
 * Çalıştır: node scripts/product-configurator-audit.mjs
 * Opsiyonel: PRODUCT_CARDS_URL=https://pimetiket.com/api/product-cards
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASE_URL = process.env.PRODUCT_CARDS_URL?.replace(/\/api\/product-cards.*/, "") ?? "https://pimetiket.com";

function read(p) {
  return readFileSync(p, "utf8");
}

const ETIKET_YAP = read(join(ROOT, "src/app/etiket/yapilandir/page.tsx"));
const STICKER_YAP = read(join(ROOT, "src/app/sticker/yapilandir/page.tsx"));
const ETIKET_PAGE = read(join(ROOT, "src/app/etiket/page.tsx"));
const STICKER_PAGE = read(join(ROOT, "src/app/sticker/page.tsx"));

const EXPECTED_ETIKET = [
  { key: "rulo-diecut", params: { form: "rulo", shape: "diecut" } },
  { key: "rulo-clear", params: { form: "rulo", shape: "clear" } },
  { key: "rulo-circle", params: { form: "rulo", shape: "circle" } },
  { key: "rulo-square", params: { form: "rulo", shape: "square" } },
  { key: "rulo-rectangle", params: { form: "rulo", shape: "rectangle" } },
  { key: "rulo-oval", params: { form: "rulo", shape: "oval" } },
  { key: "tabaka-circle", params: { form: "tabaka", shape: "circle" } },
  { key: "tabaka-diecut", params: { form: "tabaka", shape: "diecut" } },
  { key: "tabaka-oval", params: { form: "tabaka", shape: "oval" } },
  { key: "tabaka-rectangle", params: { form: "tabaka", shape: "rectangle" } },
  { key: "tabaka-square", params: { form: "tabaka", shape: "square" } },
];

const EXPECTED_STICKER = [
  { key: "diecut", params: { cut: "diecut", shape: "diecut" } },
  { key: "circle", params: { cut: "diecut", shape: "circle" } },
  { key: "rectangle", params: { cut: "diecut", shape: "rectangle" } },
  { key: "square", params: { cut: "diecut", shape: "square" } },
  { key: "oval", params: { cut: "diecut", shape: "oval" } },
  { key: "bumper", params: { cut: "diecut", shape: "bumper" } },
  { key: "kisscut", params: { cut: "diecut", shape: "diecut" } },
  { key: "clear", params: { cut: "diecut", shape: "diecut", material: "transparan" } },
  { key: "holo", params: { cut: "diecut", shape: "diecut", material: "holo" } },
  { key: "glitter", params: { cut: "diecut", shape: "diecut", material: "simli" } },
  { key: "sheet", params: { cut: "tabaka", shape: "square" } },
];

function buildQs(params) {
  return new URLSearchParams(params).toString();
}

function extractFormSectionOrder(src) {
  return [...src.matchAll(/id="(step-\d+)"/g)].map((m) => m[1]);
}

function extractVisibleFormSections(src) {
  const blocks = [...src.matchAll(/<FormSection[\s\S]*?id="(step-\d+)"[\s\S]*?(?:<\/FormSection>|$)/g)];
  return blocks.map((m) => m[1]);
}

const ETIKET_RULO_STEP_IDS = [1, 2, 7, 6, 8, 4, 5];
const ETIKET_TABAKA_STEP_IDS = [1, 2, 7, 6, 8];
const STICKER_STEP_IDS = [3, 4, 7, 5, 6];

const findings = [];

function add(severity, area, msg) {
  findings.push({ severity, area, msg });
}

// --- Step DOM order (etiket rulo: visible sections only) ---
const etiketDom = extractFormSectionOrder(ETIKET_YAP);
const etiketVisible = etiketDom.filter((id) => {
  const n = Number(id.replace("step-", ""));
  return ETIKET_RULO_STEP_IDS.includes(n);
});
const expectedEtiketDom = ETIKET_RULO_STEP_IDS.map((n) => `step-${n}`);
if (JSON.stringify(etiketVisible) !== JSON.stringify(expectedEtiketDom)) {
  add("P1", "etiket/yapilandir", `Rulo DOM step sırası uyumsuz: ${etiketVisible.join(",")} !== ${expectedEtiketDom.join(",")}`);
}

const stickerDom = extractFormSectionOrder(STICKER_YAP);
const stickerVisible = stickerDom.filter((id) => {
  const n = Number(id.replace("step-", ""));
  return STICKER_STEP_IDS.includes(n);
});
const expectedStickerDom = STICKER_STEP_IDS.map((n) => `step-${n}`);
if (JSON.stringify(stickerVisible) !== JSON.stringify(expectedStickerDom)) {
  add("P1", "sticker/yapilandir", `Sticker DOM step sırası uyumsuz: ${stickerVisible.join(",")} !== ${expectedStickerDom.join(",")}`);
}

// Hidden flags
if (!/SHOW_ETIKET_FORM_FACTOR_PICKER = false/.test(read(join(ROOT, "src/lib/etiket-feature-flags.ts")))) {
  add("P2", "etiket-feature-flags", "SHOW_ETIKET_FORM_FACTOR_PICKER beklenen false değil");
}
if (!/SHOW_STICKER_CUT_MODE_PICKER = false/.test(read(join(ROOT, "src/lib/sticker-feature-flags.ts")))) {
  add("P2", "sticker-feature-flags", "SHOW_STICKER_CUT_MODE_PICKER beklenen false değil");
}

// Material matrix (etiket)
const hiddenMats = read(join(ROOT, "src/lib/etiket-feature-flags.ts")).match(
  /HIDDEN_ETIKET_MATERIALS[^[]*\[([^\]]*)\]/
)?.[1];
if (hiddenMats && !hiddenMats.includes("kraft")) {
  add("P2", "etiket-feature-flags", "kraft gizli malzeme listesinde yok");
}

// Hardcoded card counts (array body only — avoid dbCardToEtiketCard false positives)
function countEtiketCards(form) {
  const re =
    form === "rulo"
      ? /const RULO_CARDS: EtiketCard\[\] = \[([\s\S]*?)\];/
      : /const TABAKA_CARDS: EtiketCard\[\] = \[([\s\S]*?)\];/;
  const block = ETIKET_PAGE.match(re)?.[1] ?? "";
  return (block.match(/shape:/g) ?? []).length;
}
const ruloCount = countEtiketCards("rulo");
const tabakaCount = countEtiketCards("tabaka");
if (ruloCount !== 6) add("P1", "etiket/page", `Hardcoded rulo kart sayısı ${ruloCount} (beklenen 6)`);
if (tabakaCount !== 5) add("P1", "etiket/page", `Hardcoded tabaka kart sayısı ${tabakaCount} (beklenen 5)`);
const stickerHardcoded = (STICKER_PAGE.match(/query: "/g) ?? []).length;
if (stickerHardcoded !== 11) add("P1", "sticker/page", `Hardcoded sticker kart sayısı ${stickerHardcoded} (beklenen 11)`);

// Kiss-cut pricing note
if (/kisscut.*diecut|diecut.*kisscut/i.test(STICKER_YAP) === false) {
  add("P3", "sticker/yapilandir", "Kiss-cut pricing map referansı bulunamadı (manuel kontrol)");
}

// Sticker sheet title drift (hardcoded vs known DB)
if (STICKER_PAGE.includes("Sticker Sayfası") && STICKER_PAGE.includes("Tabaka Sticker") === false) {
  add("P2", "sticker/page", "Hardcoded son kart 'Sticker Sayfası' — DB'de 'Tabaka Sticker' olabilir (hydrate drift)");
}

// Image paths exist (sample check)
const imgPaths = [
  ...ETIKET_PAGE.matchAll(/imageSrc: "([^"]+)"/g).map((m) => m[1]),
  ...STICKER_PAGE.matchAll(/imageSrc: "([^"]+)"/g).map((m) => m[1]),
];
for (const p of imgPaths) {
  const local = join(ROOT, "public", p.replace(/^\//, ""));
  if (!existsSync(local)) {
    add("P2", "grid-images", `Kart görseli eksik: ${p}`);
  }
}

// Remote product_cards API
let remoteOk = true;
try {
  const etRes = await fetch(`${BASE_URL}/api/product-cards?product_type=etiket`);
  const stRes = await fetch(`${BASE_URL}/api/product-cards?product_type=sticker`);
  if (!etRes.ok) {
    add("P1", "api/product-cards", `Etiket API HTTP ${etRes.status}`);
    remoteOk = false;
  }
  if (!stRes.ok) {
    add("P1", "api/product-cards", `Sticker API HTTP ${stRes.status}`);
    remoteOk = false;
  }
  if (remoteOk) {
    const etJson = await etRes.json();
    const stJson = await stRes.json();
    const etCards = etJson.cards ?? [];
    const stCards = stJson.cards ?? [];
    if (etCards.length !== 11) add("P1", "api/product-cards", `Etiket DB kart sayısı ${etCards.length} !== 11`);
    if (stCards.length !== 11) add("P1", "api/product-cards", `Sticker DB kart sayısı ${stCards.length} !== 11`);

    for (const exp of EXPECTED_ETIKET) {
      const card = etCards.find((c) => c.key === exp.key);
      if (!card) {
        add("P1", "api/product-cards", `Etiket key eksik: ${exp.key}`);
        continue;
      }
      for (const [k, v] of Object.entries(exp.params)) {
        if (card.query_params?.[k] !== v) {
          add("P1", "api/product-cards", `${exp.key} query_params.${k}: ${card.query_params?.[k]} !== ${v}`);
        }
      }
      if (/�/.test(card.title_tr ?? "") || /�/.test(card.desc_tr ?? "")) {
        add("P2", "api/product-cards", `${exp.key} bozuk encoding (title/desc)`);
      }
    }
    for (const exp of EXPECTED_STICKER) {
      const card = stCards.find((c) => c.key === exp.key);
      if (!card) {
        add("P1", "api/product-cards", `Sticker key eksik: ${exp.key}`);
        continue;
      }
      for (const [k, v] of Object.entries(exp.params)) {
        if (card.query_params?.[k] !== v) {
          add("P1", "api/product-cards", `${exp.key} query_params.${k}: ${card.query_params?.[k]} !== ${v}`);
        }
      }
    }
    const sheet = stCards.find((c) => c.key === "sheet");
    if (sheet && sheet.title_tr && sheet.title_tr !== "Sticker Sayfası") {
      add("P2", "api/product-cards", `sheet kartı DB title_tr '${sheet.title_tr}' — beklenen 'Sticker Sayfası' (Mig 082)`);
    }
  }
} catch (e) {
  add("P2", "api/product-cards", `Remote fetch başarısız: ${e.message}`);
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  etiketRuloStepIds: ETIKET_RULO_STEP_IDS,
  etiketTabakaStepIds: ETIKET_TABAKA_STEP_IDS,
  stickerStepIds: STICKER_STEP_IDS,
  etiketDomVisible: etiketVisible,
  stickerDomVisible: stickerVisible,
  hardcoded: { rulo: ruloCount, tabaka: tabakaCount, sticker: stickerHardcoded },
  findings,
  findingCounts: {
    P0: findings.filter((f) => f.severity === "P0").length,
    P1: findings.filter((f) => f.severity === "P1").length,
    P2: findings.filter((f) => f.severity === "P2").length,
    P3: findings.filter((f) => f.severity === "P3").length,
  },
}, null, 2));

process.exit(findings.some((f) => f.severity === "P0" || f.severity === "P1") ? 1 : 0);

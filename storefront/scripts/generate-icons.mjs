#!/usr/bin/env node
/**
 * PWA icon + favicon üretici.
 * Source: public/pim/pim-etiket-mark-dark.svg
 * Çıktı:  public/{favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, icon-512-maskable.png}
 *
 * Çalıştır: node scripts/generate-icons.mjs
 * Source SVG değiştiğinde tekrar koştur.
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "public", "pim", "pim-etiket-mark-dark.svg");
const PUB = join(ROOT, "public");
const BG = { r: 245, g: 235, b: 217, alpha: 1 }; // #F5EBD9 krem — manifest background_color ile aynı

async function svgToPng(size, outName, opts = {}) {
  const svg = readFileSync(SRC);
  let img = sharp(svg, { density: 300 }).resize(size, size, {
    fit: "contain",
    background: BG,
  });
  if (opts.maskable) {
    // Safe zone: logo merkez %80 — kenarda %10 padding
    const inner = Math.round(size * 0.8);
    img = sharp(svg, { density: 300 })
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round((size - inner) / 2),
        bottom: Math.round((size - inner) / 2),
        left: Math.round((size - inner) / 2),
        right: Math.round((size - inner) / 2),
        background: BG,
      });
  }
  await img.png({ compressionLevel: 9 }).toFile(join(PUB, outName));
  console.log(`✓ ${outName} (${size}×${size}${opts.maskable ? ", maskable" : ""})`);
}

async function buildFavicon() {
  // 16, 32, 48 PNG buffer'ları üret, png-to-ico ile birleştir
  const sizes = [16, 32, 48];
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp(readFileSync(SRC), { density: 300 })
        .resize(s, s, { fit: "contain", background: BG })
        .png({ compressionLevel: 9 })
        .toBuffer()
    )
  );
  const ico = await pngToIco(buffers);
  writeFileSync(join(PUB, "favicon.ico"), ico);
  console.log(`✓ favicon.ico (16+32+48 multi-size)`);
}

(async () => {
  await svgToPng(180, "apple-touch-icon.png");
  await svgToPng(192, "icon-192.png");
  await svgToPng(512, "icon-512.png");
  await svgToPng(512, "icon-512-maskable.png", { maskable: true });
  await buildFavicon();
  console.log("\n🎉 Tüm icon'lar üretildi → public/");
})();

#!/usr/bin/env node
/**
 * upload-cards.mjs — Midjourney kart görsellerini toplu yükle
 *
 * Sefa 20 May v68: Midjourney'den indirilen 11-12 kart görselini
 * tek komutla public/etiket-cards/ veya public/sticker-cards/ altına
 * doğru isimlerle kopyalar.
 *
 * Usage:
 *   node scripts/upload-cards.mjs <kategori> <kaynak-klasor>
 *
 * Örnekler:
 *   node scripts/upload-cards.mjs etiket ~/Downloads/midjourney
 *   node scripts/upload-cards.mjs sticker ~/Downloads/midjourney
 *   node scripts/upload-cards.mjs sablonlar ~/Downloads/midjourney
 *
 * Eşleme (etiket):
 *   1.png → rulo-diecut.png
 *   2.png → rulo-clear.png
 *   3.png → rulo-circle.png
 *   ... (sırayla)
 *
 * NOT: Midjourney indirilen dosyalar genelde "username_brand-prompt_xxx.png"
 * formatında. Bu script dosyaları LISTING SIRASINA göre eşler — kaynak
 * klasördeki PNG'leri alfabetik sırada okur, sırayla isimlendirir.
 *
 * Önce kaynak klasörü alfabetik sırada hazırla (rename 01-die.png,
 * 02-clear.png... gibi) veya manuel mapping kullan.
 */

import { readdirSync, copyFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ============================================================
// Kart eşlemeleri — her kategori için sıralı dosya adları
// ============================================================

const MAPPINGS = {
  etiket: [
    "rulo-diecut.png",
    "rulo-clear.png",
    "rulo-circle.png",
    "rulo-square.png",
    "rulo-rectangle.png",
    "rulo-oval.png",
    "tabaka-circle.png",
    "tabaka-diecut.png",
    "tabaka-oval.png",
    "tabaka-rectangle.png",
    "tabaka-square.png",
  ],
  sticker: [
    "diecut.png",
    "circle.png",
    "rectangle.png",
    "square.png",
    "oval.png",
    "bumper.png",
    "kisscut.png",
    "clear.png",
    "holo.png",
    "simli.png",
    "sheets.png",
  ],
  sablonlar: [
    "zeytinyagi.png",
    "bal-recel.png",
    "kozmetik.png",
    "kahve.png",
    "cay.png",
    "mum.png",
    "pet.png",
    "ciftlik.png",
    "anne-bebek.png",
    "hediye.png",
    "kurumsal.png",
    "etkinlik.png",
  ],
};

const PUBLIC_DIRS = {
  etiket: "public/etiket-cards",
  sticker: "public/sticker-cards",
  sablonlar: "public/sablonlar-cards",
};

// ============================================================
// CLI
// ============================================================

const args = process.argv.slice(2);
const [category, sourceDir] = args;

if (!category || !sourceDir) {
  console.error("Kullanım: node scripts/upload-cards.mjs <kategori> <kaynak-klasor>");
  console.error("Kategoriler: etiket | sticker | sablonlar");
  process.exit(1);
}

const mapping = MAPPINGS[category];
const destDir = PUBLIC_DIRS[category];

if (!mapping || !destDir) {
  console.error(`Bilinmeyen kategori: ${category}`);
  console.error("Kategoriler: etiket | sticker | sablonlar");
  process.exit(1);
}

const sourceAbs = resolve(sourceDir);
const destAbs = resolve(ROOT, destDir);

if (!existsSync(sourceAbs)) {
  console.error(`Kaynak klasör bulunamadı: ${sourceAbs}`);
  process.exit(1);
}

if (!existsSync(destAbs)) {
  mkdirSync(destAbs, { recursive: true });
  console.log(`✓ Dest klasör oluşturuldu: ${destAbs}`);
}

// Kaynak klasördeki PNG'leri alfabetik sırada al
const sourceFiles = readdirSync(sourceAbs)
  .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
  .sort();

console.log(`\n📁 Kaynak: ${sourceAbs}`);
console.log(`📁 Hedef:  ${destAbs}`);
console.log(`📦 Kategori: ${category} — ${mapping.length} kart bekleniyor`);
console.log(`🔍 Bulunan: ${sourceFiles.length} görsel\n`);

if (sourceFiles.length < mapping.length) {
  console.warn(
    `⚠️  Eksik dosya: ${mapping.length - sourceFiles.length} görsel daha gerek\n`
  );
}

if (sourceFiles.length > mapping.length) {
  console.warn(
    `⚠️  Fazla dosya: İlk ${mapping.length} görsel kullanılacak, ${
      sourceFiles.length - mapping.length
    } fazla atlanacak\n`
  );
}

// Sırayla kopyala
const copyCount = Math.min(sourceFiles.length, mapping.length);
for (let i = 0; i < copyCount; i++) {
  const src = join(sourceAbs, sourceFiles[i]);
  const dst = join(destAbs, mapping[i]);
  copyFileSync(src, dst);
  console.log(`✓ ${basename(sourceFiles[i])} → ${mapping[i]}`);
}

console.log(`\n✅ ${copyCount} görsel kopyalandı.`);
console.log(`\n📋 Sıradaki adım:`);
console.log(`   1. git add ${destDir}`);
console.log(`   2. Bana haber ver: "${category} görselleri hazır"`);
console.log(`   3. Ben src/app/${category}/page.tsx'te imageSrc path'lerini güncelleyeyim.\n`);

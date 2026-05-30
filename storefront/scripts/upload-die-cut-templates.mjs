#!/usr/bin/env node
/**
 * upload-die-cut-templates.mjs — Kesim bıçağı şablonlarını R2'ye yükle (390 dosya).
 *
 * Usage:
 *   node scripts/upload-die-cut-templates.mjs "C:\\Users\\msı\\Desktop\\Pim-Etiket-Bicak-Sablonlari"
 *   node scripts/upload-die-cut-templates.mjs <kaynak> --dry
 *
 * ENV (.env.local): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

try {
  process.loadEnvFile?.(resolve(process.cwd(), ".env.local"));
} catch {
  /* Node < 20.6 — env vars must be set externally */
}

const SRC = process.argv[2];
const DRY = process.argv.includes("--dry");
if (!SRC) {
  console.error("Kaynak klasör ver.");
  process.exit(1);
}

const SETS = {
  kisscut: "KissCut-CutContour-Magenta",
  thrucut: "ThruCut-Mavi",
};
const FORMATS = { pdf: "PDF", ai: "AI", eps: "EPS" };
const CATEGORIES = ["Yuvarlak", "Kare", "Dikdortgen", "Oval", "Bumper"];
const CT = {
  pdf: "application/pdf",
  ai: "application/illustrator",
  eps: "application/postscript",
};

const R2_BUCKET = process.env.R2_BUCKET ?? "pim-etiket-archive";
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  forcePathStyle: true,
});

let ok = 0;
let fail = 0;
let skip = 0;

for (const [set, setDir] of Object.entries(SETS)) {
  for (const [fmt, fmtDir] of Object.entries(FORMATS)) {
    for (const cat of CATEGORIES) {
      const dir = join(SRC, setDir, fmtDir, cat);
      if (!existsSync(dir)) {
        console.warn("YOK:", dir);
        continue;
      }
      for (const file of readdirSync(dir)) {
        if (!file.toLowerCase().endsWith("." + fmt)) continue;
        const key = `templates/die-cut/${set}/${fmt}/${cat.toLowerCase()}/${file}`;
        if (DRY) {
          console.log("[dry]", key);
          skip++;
          continue;
        }
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: R2_BUCKET,
              Key: key,
              Body: readFileSync(join(dir, file)),
              ContentType: CT[fmt],
              CacheControl: "public, max-age=31536000, immutable",
            })
          );
          ok++;
          if (ok % 50 === 0) console.log(`  ...${ok} yüklendi`);
        } catch (e) {
          fail++;
          console.error("FAIL:", key, e.message);
        }
      }
    }
  }
}

console.log(`\nBitti. ok=${ok} fail=${fail} skip(dry)=${skip}`);

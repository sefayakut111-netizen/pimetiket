#!/usr/bin/env node
/**
 * Bağlam önbelleği üretici — docs/SISTEM-BAGIMLILIK-HARITASI.md
 *
 * Amaç: Claude/Cursor oturumlarının her seferinde glob/grep ile keşif yapmak
 * yerine TEK dosya okuyarak sistemi tanıması (token tasarrufu).
 *
 * Çalıştır:  npm run context:map   (veya node scripts/generate-context-map.mjs)
 * Ne zaman:  büyük refactor / yeni route / yeni lib modülü sonrası; Z raporunda.
 *
 * Bağımlılık yok — saf Node (fs tarama + import regex).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "docs", "SISTEM-BAGIMLILIK-HARITASI.md");

const exts = [".ts", ".tsx"];
const skipDirs = new Set(["node_modules", ".next", "tests", "__tests__"]);

/** src altındaki tüm ts/tsx dosyalarını topla */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!skipDirs.has(name)) walk(p, acc);
    } else if (exts.some((e) => name.endsWith(e)) && !name.includes(".test.")) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(SRC);
const norm = (p) => relative(ROOT, p).split(sep).join("/");

/** import yolunu gerçek dosyaya çöz */
function resolveImport(fromFile, spec) {
  let base = null;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // dış paket
  const cands = [
    base + ".ts", base + ".tsx",
    join(base, "index.ts"), join(base, "index.tsx"),
  ];
  for (const c of cands) {
    try { if (statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

// ---- Graf kur ----
const inDegree = new Map(); // hedef → kaç dosya import ediyor
const lineCount = new Map();
let edgeCount = 0;
const importRe = /(?:^|\n)\s*(?:import|export)[^"'`;]*?from\s+["']([^"']+)["']/g;

for (const f of files) {
  const src = readFileSync(f, "utf8");
  lineCount.set(f, src.split("\n").length);
  for (const m of src.matchAll(importRe)) {
    const target = resolveImport(f, m[1]);
    if (target) {
      edgeCount++;
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }
}

// ---- Sayfa route'ları ----
const pages = files
  .filter((f) => /[\\/]app[\\/].*page\.tsx$/.test(f))
  .map((f) => {
    const url = "/" + norm(f)
      .replace(/^src\/app\//, "")
      .replace(/\/page\.tsx$/, "")
      .replace(/\([^)]+\)\//g, "");
    return { url: url === "/page.tsx" || url === "/" ? "/" : url, file: norm(f) };
  })
  .sort((a, b) => a.url.localeCompare(b.url));

// ---- API route'ları (+ method + guard tespiti) ----
const apis = files
  .filter((f) => /[\\/]app[\\/]api[\\/].*route\.ts$/.test(f))
  .map((f) => {
    const src = readFileSync(f, "utf8");
    const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g)]
      .map((m) => m[1]).join(",") || "?";
    const guard =
      /assertPermission\(\s*["']([^"']+)["']/.exec(src)?.[1] ??
      (/assert-admin|assertAdmin/.test(src) ? "admin" :
       /assertPartner|partner-guard/.test(src) ? "partner" :
       /getUser\(|requireAuth|auth\.uid/.test(src) ? "auth" :
       /CRON_SECRET|x-cron/.test(src) ? "cron" : "-");
    const url = "/" + norm(f).replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
    return { url, methods, guard };
  })
  .sort((a, b) => a.url.localeCompare(b.url));

// ---- Hub modülleri (en çok import edilen) ----
const hubs = [...inDegree.entries()]
  .filter(([f]) => f.includes(sep + "src" + sep))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([f, n]) => ({ file: norm(f), n }));

// ---- Mega dosyalar ----
const mega = [...lineCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([f, n]) => ({ file: norm(f), n }));

// poc.html özel durumu (src dışında ama editörün kalbi)
let pocLines = 0;
try { pocLines = readFileSync(join(ROOT, "public", "poc.html"), "utf8").split("\n").length; } catch {}

// ---- lib modül envanteri ----
const libDirs = {};
for (const f of files) {
  const m = norm(f).match(/^src\/lib\/([^/]+)\//);
  if (m) libDirs[m[1]] = (libDirs[m[1]] ?? 0) + 1;
}
const libRows = Object.entries(libDirs).sort((a, b) => b[1] - a[1]);

// ---- git bilgisi ----
let commit = "?";
try { commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch {}
const today = new Date().toISOString().slice(0, 10);

// ---- Markdown üret ----
const md = `# SİSTEM BAĞIMLILIK HARİTASI (bağlam önbelleği)
> ÜRETİLMİŞ DOSYA — elle düzenleme. Yenile: \`npm run context:map\`
> Üretim: ${today} · commit ${commit} · ${files.length} dosya · ${edgeCount} iç import ilişkisi
> AMAÇ: oturum başında BUNU oku; glob/grep keşfine token yakma. Soru→bölüm: "X sayfası nerede"→§1 · "API var mı/guard'ı ne"→§2 · "merkezi modül"→§3 · "lib'de ne var"→§5

## §1 Sayfa route'ları (${pages.length})
| URL | Dosya |
|---|---|
${pages.map((p) => `| ${p.url} | ${p.file} |`).join("\n")}

## §2 API uçları (${apis.length}) — method · guard
guard: settings/orders/… = assertPermission modülü · admin = assert-admin · partner · auth = login şart · cron = CRON_SECRET · "-" = açık/elle kontrol et
| Endpoint | M | Guard |
|---|---|---|
${apis.map((a) => `| ${a.url} | ${a.methods} | ${a.guard} |`).join("\n")}

## §3 Hub modülleri (en çok import edilen 30 — buraya dokunmak = geniş etki)
| # | Dosya | İçeri bağ |
|---|---|---|
${hubs.map((h, i) => `| ${i + 1} | ${h.file} | ${h.n} |`).join("\n")}

## §4 Mega dosyalar (satır — refactor adayları / dikkatli düzenle)
| Dosya | Satır |
|---|---|
| public/poc.html (EDİTÖR ÇEKİRDEĞİ — iframe POC) | ${pocLines} |
${mega.map((m2) => `| ${m2.file} | ${m2.n} |`).join("\n")}

## §5 lib/ modül envanteri (dosya sayısı)
${libRows.map(([d, n]) => `- **lib/${d}** (${n})`).join("\n")}

## §6 Sabit bilgiler (el ile korunan blok — script üzerine yazar, değişiklikleri scripte işle)
- Marka: mercan #ef3e56 · lacivert #141524 · krem #f5ebd9/#faf4e8 · Nunito · logo public/pim/*.svg (PimAsset.tsx registry)
- Editör: public/poc.html iframe + src/components/editor/EditorShell.tsx · OpenCV main-thread (worker YOK) · denetim: EDITOR-V2-DENETIM-2026-06-10.md (masaüstü)
- Fiyat: 3 AYRI modül (sticker / rulo-etiket / tabaka-etiket) — ASLA karıştırma · pricing_config tek kaynak
- Yasak: cüzdan/puan/üyelik indirimi · persona dropdown · "Bursa" · bot menüsü (CLAUDE.md sefaRules)
- Şema/domain soruları: docs/DOMAIN-SCHEMA-REFERENCE.md + smart-context/manifest.json (/baglam)
`;

writeFileSync(OUT, md, "utf8");
console.log(`✓ ${relative(ROOT, OUT)} yenilendi — ${files.length} dosya, ${edgeCount} ilişki, ${pages.length} sayfa, ${apis.length} API`);

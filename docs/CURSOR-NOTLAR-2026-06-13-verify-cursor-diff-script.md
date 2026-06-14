# Cursor Görevi — `scripts/verify-cursor-diff.mjs` (deterministik diff/migration doğrulama aracı)

> 13 Haz 2026 · Amaç: düşük-risk Cursor diff'lerini **LLM olmadan, mekanik** doğrulamak → pahalı adversaryal workflow yalnız yüksek-risk (migration/para/güvenlik) için saklanır. Token tasarrufu aracı.
> Branch: `claude/file-review-updates-vnd6og`. Tek yeni dosya + manifest klasörü. Migration YOK.

## Ne yapacak
Bir **manifest JSON** alıp şu mekanik kontrolleri çalıştırır, her birine ✅/🔴 basar, biri bile fail ise exit 1:
1. **build** — `tsc --noEmit` temiz mi
2. **denyInChanged** — yasak pattern'ler commit'in değişen dosyalarında GEÇMEMELİ (don't-list)
3. **requireInFile** — beklenen pattern'ler belirtilen dosyada GEÇMELİ
4. **dbChecks** — Supabase Management API ile SQL çalıştırıp sonucu doğrula (migration objesi var mı vb.)

## Dosya 1 — `storefront/scripts/verify-cursor-diff.mjs` (YENİ)
Çalıştırma: `node --env-file=.env.agent scripts/verify-cursor-diff.mjs scripts/verify-manifests/<task>.json`

Davranış:
```
1. Manifest JSON'u argv[2]'den oku (yoksa hata + exit 1).
2. results = []  // {label, ok, detail}

3. BUILD (manifest.build === true ise):
   - child_process spawnSync("npx", ["tsc","--noEmit","-p","tsconfig.json"], {cwd: storefront kökü, encoding:"utf8"})
   - ok = status === 0; detail = ilk 500 char stderr/stdout (hata varsa)

4. DEĞİŞEN DOSYALAR (denyInChanged veya requireInFile varsa):
   - manifest.commit verildiyse: `git show --name-only --format= <commit>` → dosya listesi
   - yoksa: `git diff --name-only HEAD~1 HEAD`
   - her değişen dosyayı oku (varsa), tek string'de birleştir (changedBlob)

5. denyInChanged (string[] regex): her pattern için new RegExp(p) changedBlob'da EŞLEŞMEMELİ.
   ok = eşleşme yok; detail = eşleşen dosya:satır (varsa)

6. requireInFile ([{file, pattern}]): her biri için dosyayı oku, new RegExp(pattern) EŞLEŞMELİ.
   ok = eşleşme var

7. dbChecks ([{label, sql, expect}]): Management API POST
   - URL: https://api.supabase.com/v1/projects/${REF}/database/query
   - REF: manifest.projectRef ?? "ucmpwxnoaqjpzhijnxtp"
   - headers: Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, Content-Type: application/json
   - body: JSON.stringify({ query: check.sql })
   - rows = await res.json()
   - expect şekilleri (biri):
     * { includes: "str" }    → JSON.stringify(rows) içinde str var mı
     * { notIncludes: "str" } → yok mu
     * { rowCount: N }        → rows.length === N
     * { scalar: v }          → rows[0]?[ilk-key] == v  (gevşek eşitlik; count(*) "0" gibi)
   - SUPABASE_ACCESS_TOKEN yoksa: bu bölümü ATLA (uyarı yaz), build/grep yine çalışsın

8. Her result'ı yaz: `${ok?"✅":"🔴"} ${label}${ok?"":" — "+detail}`
9. const failed = results.filter(r=>!r.ok).length
   console.log(`\n${failed===0?"✅ TÜMÜ GEÇTİ":"🔴 "+failed+" KONTROL DÜŞTÜ"} (${results.length} kontrol)`)
   process.exit(failed===0 ? 0 : 1)
```

Desen: `apply-migrations-185.mjs` (Management API fetch + .env.agent loader) + `spawnSync` build. Hiçbir DB **yazımı** YOK (yalnız SELECT/okuma). Yeni bağımlılık ekleme (built-in fetch/child_process/fs).

## Dosya 2 — `storefront/scripts/verify-manifests/_example.json` (YENİ, şablon)
```json
{
  "build": true,
  "commit": "<sha veya boş>",
  "projectRef": "ucmpwxnoaqjpzhijnxtp",
  "denyInChanged": ["assertAiBudget", "force:\\s*true"],
  "requireInFile": [
    { "file": "storefront/src/app/api/.../route.ts", "pattern": "casUpdate" }
  ],
  "dbChecks": [
    { "label": "mig index var", "sql": "select indexname from pg_indexes where indexname='X'", "expect": { "includes": "X" } },
    { "label": "mükerrer 0", "sql": "select count(*) as n from ...", "expect": { "scalar": "0" } }
  ]
}
```

## Dosya 3 — `storefront/package.json` script ekle
`"verify:cursor-diff": "node --env-file=.env.agent scripts/verify-cursor-diff.mjs"` (manifest yolu argüman olarak verilir: `npm run verify:cursor-diff scripts/verify-manifests/faz4.json`).

## DİKKAT
- ❌ DB'ye YAZMA — yalnız SELECT/okuma (Management API query salt-okunur kullanımı).
- ❌ SUPABASE_ACCESS_TOKEN yoksa patlatma — dbChecks'i atla, build/grep devam etsin.
- ❌ Yeni npm bağımlılığı ekleme (built-in modüller yeter).
- ❌ `.env.agent`'ı commit'e ekleme (zaten .gitignore'da olmalı — teyit et).
- ❌ Push etme.

## Sıra
1. Cursor: 3 dosyayı oluştur, `npm run build` (script kendisi build'i bozmaz — ayrı dosya). Commit (push yok).
2. Claude: script'i bir manifest'le deneyip çalıştığını doğrular (kendisi bu aracın ilk kullanıcısı).

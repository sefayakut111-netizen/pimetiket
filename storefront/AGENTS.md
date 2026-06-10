<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pim Etiket — Agent Rehberi

## Akıllı Bağlam (Smart Context)

**⚡ Önce bağlam önbelleğini oku:** `docs/SISTEM-BAGIMLILIK-HARITASI.md` — tüm sayfa/API route'ları (guard'larıyla), hub modüller, mega dosyalar tek dosyada. Keşif grep'ine başlamadan buna bak. Yenile: `npm run context:map`.

Cursor ve Claude **ortak manifest** kullanır: `smart-context/manifest.json`

| Araç | Nasıl tetiklenir |
|------|------------------|
| **Cursor** | `.cursor/rules/*.mdc` — dosya glob'una göre otomatik |
| **Claude Code** | `/baglam [dosya veya konu]` slash komutu |
| **CLI** | `npm run context -- --path <dosya>` |

### CLI örnekleri

```bash
npm run context -- --path src/app/odeme/page.tsx
npm run context -- --git-diff
npm run context -- --query "fiyat motoru"
npm run context -- --json --path src/lib/pim/personas.ts
```

### Domain haritası (14 alan)

pricing · pim · order · configurator · admin · database · auth · mail · legal · i18n · agents · partner · **integrations** · frontend-ui

Dış API / timeout / PayTR / OpenAI çalışırken: `integrations` domain + `docs/API-INTEGRATION-FIXES.md`

Manifest güncellemek için `smart-context/manifest.json` düzenle — Cursor rules ve `/baglam` otomatik takip eder.

**Modüler şema:** API yazarken domain'in `schemaMigrations` listesine odaklan — `docs/DOMAIN-SCHEMA-REFERENCE.md` · Kalıcı kayıt: `docs/SCHEMA-TYPES-AGENT-GUIDE.md`

## Denetim

```
/denetle                  → son commit, smart trigger
/denetle <dosya>          → spesifik dosya
/denetle muhendis+marka   → filtre modu
```

## Sefa kuralları

- Cüzdan/puan/üyelik indirimi YASAK · Persona dropdown YASAK · Tek akıllı Pim
- Dalkavuk YASAK · "Süresiz" YASAK · Yapay empati YASAK · "Bursa" YASAK
- Bot menüsü ve hazır chip YASAK

**Şema tuzağı:** `types.ts` ve migration'larda geçmiş tablolar (ör. `coupons`, `coupon_uses`, `referrals`) görünebilir; cüzdan/puan/üyelik indirimi yine **YASAK**. Ayrıntı: **`CLAUDE.md` → “Şema ≠ Ürün Kararı”**.

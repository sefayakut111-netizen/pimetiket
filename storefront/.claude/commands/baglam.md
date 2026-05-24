---
description: Akıllı Bağlam (Smart Context) — dosya veya konuya göre ilgili doküman, hub ve agent'ları filtreler. Cursor ile ortak manifest kullanır.
---

## Pim Etiket — Akıllı Bağlam Filtreleme

Kullanıcı `/baglam [hedef]` çağırdığında bu workflow çalışır.

### 1) Hedef tespiti

Argüman yoksa git diff'teki değişen dosyalar kullanılır:

```bash
npm run context -- --git-diff
```

Argüman varsa:
- `/baglam src/app/odeme/page.tsx` → tek dosya
- `/baglam sipariş ödeme` → keyword arama (--query)
- `/baglam src/lib/pim/**` → glob pattern
- `/baglam git` → değişen dosyalar (--git-diff)

### 2) Manifest çalıştır

Storefront root'tan:

```bash
npm run context -- --path "<hedef>"
# veya
npm run context -- --query "<hedef>"
# veya
npm run context -- --git-diff
```

Manifest tek kaynak: `smart-context/manifest.json`

### 3) Filtrelenmiş bağlamı yükle

CLI çıktısındaki sırayla **sadece ilgili** dosyaları oku — tüm docs/ klasörünü tarama:

1. **alwaysRead** → `AGENTS.md`, `CLAUDE.md`
2. **docs** → domain'e özel dokümanlar (max 3-4, gereksiz okuma yapma)
3. **schemaMigrations / schemaTables / typeRefs** → `supabase/migrations/` + `types.ts` filtre listesi (modüler geliştirme)
4. **hubs** → kritik bağımlılık dosyaları (değişiklik yapmadan önce)
5. **claudeAgents** → ilgili `.claude/agents/*.md` dosyalarını context'e al

### 4) Kullanıcıya özet sun

```markdown
# 🧠 Akıllı Bağlam — [domain adları]

**Hedef:** [dosya/konu]
**Filtrelenen domain:** N adet

## Yüklenen bağlam
- Dokümanlar: [...]
- Şema (migration + tablo): [...]  ← manifest schemaMigrations
- Hub dosyalar: [...]
- Agent perspektifleri: [...]

## Domain özeti
[Kısa 2-3 cümle — bu alanda neye dikkat edilmeli. API yazılacaksa: types.ts + domain migration'ları referans al.]

## Hazırım
Bağlam yüklendi. Ne yapmamı istiyorsun?
```

### 5) Smart Context kuralları

- **Token tasarrufu:** Eşleşmeyen domain dokümanlarını OKUMA
- **Belirsiz hedef:** 2+ domain eşleşirse hepsini yükle ama özet tut
- **Hiç eşleşme yok:** Sadece core (AGENTS.md + Sefa kuralları)
- **Mega-component uyarısı:** configurator, odeme, siparis sayfalarında minimal diff hatırlat

### Domain → Cursor rule eşlemesi

| Domain | Cursor rule |
|--------|-------------|
| pricing | `.cursor/rules/pricing.mdc` |
| pim | `.cursor/rules/pim-chat.mdc` |
| order | `.cursor/rules/order-flow.mdc` |
| configurator | `.cursor/rules/configurator.mdc` |
| admin/partner | `.cursor/rules/admin-panel.mdc` |
| database/auth | `.cursor/rules/database.mdc` |
| mail | `.cursor/rules/mail.mdc` |
| legal | `.cursor/rules/legal.mdc` |
| i18n | `.cursor/rules/i18n.mdc` |
| agents | `.cursor/rules/agents-audit.mdc` |
| frontend-ui | `.cursor/rules/frontend-ui.mdc` |

Cursor bu kuralları dosya glob'una göre otomatik yükler. Claude bu komutla aynı manifest'i manuel tetikler.

### Örnek

Kullanıcı: `/baglam src/app/etiket/yapilandir/page.tsx`

1. `npm run context -- --path src/app/etiket/yapilandir/page.tsx` çalıştır
2. Eşleşen: configurator + frontend-ui
3. Oku: DOSYA-AKISI.md, AKIS-V2-SEFA-22MAY.md, frontend.md, ux-ui.md
4. Hub: etiket/yapilandir/page.tsx, sticker/yapilandir/page.tsx
5. Özet sun, kullanıcıya sor

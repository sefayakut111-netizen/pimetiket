# Pim Etiket — Dış Servisler Envanteri

> Son güncelleme: 28 Mayıs 2026
> Kaynak: `.env.example`, `.env.local`, `vercel.json`, `wrangler.jsonc`, `package.json`, `docs/HESAP-KAYITLARI.md`, `smart-context/manifest.json`
> İlgili: [`HESAP-KAYITLARI.md`](./HESAP-KAYITLARI.md) (asıl hesap kayıt dosyası)

---

## 🟢 ÜCRETSİZ (Free Tier)

| Servis | Hesap | Plan | Kullanım | Entegrasyon |
|--------|-------|------|----------|-------------|
| **Vercel** | sefayakut111@gmail.com | Hobby (free) | Hosting + deploy + 24 cron job | API + cron, `vercel.json` |
| **GitHub** | sefayakut111-netizen | Free | Repo: `sefayakut111-netizen/pimetiket` | Git push |
| **Supabase** | sefayakut111@gmail.com | Free | DB + Auth + Storage (89+ migration, Frankfurt, project `ucmpwxnoaqjpzhijnxtp`) | API (`@supabase/ssr`, `@supabase/supabase-js`) |
| **Cloudflare R2** | CF `0f6a9d339ee7f173c9294bcfb46be424` | Free (10 GB) | Cold archive bucket `pim-etiket-archive` | API (`@aws-sdk/client-s3`) — şu an `R2_ARCHIVE_DRY_RUN=true` (canlı değil) |
| **Cloudflare Workers (Pages)** | aynı CF acct | Free | Alternatif deploy (`open-next.config.ts`) | wrangler, `wrangler.jsonc` |
| **Resend** (transactional mail) | pimetiket@gmail.com | Free (3.000 mail/ay) | Sipariş bildirimleri (8 event webhook) | API + webhook (`/api/webhooks/resend`), `resend` + `@react-email/*` SDK |
| **Sentry** | bilinmiyor | Free (5.000 event/ay) | Hata izleme | API (`@sentry/nextjs` v10.52) |
| **Vercel Analytics + Speed Insights** | sefayakut111@gmail.com | Hobby | Sayfa analitiği | Otomatik (`@vercel/analytics`, `@vercel/speed-insights`) |
| **Anthropic Claude** | sefayakut111@gmail.com | Pay-as-you-go | **Sadece dev/code-review** — prod'da değil | API (Claude Code CLI) |

---

## 🔴 ÜCRETLİ (Kullandıkça veya Sabit Ücret)

| Servis | Hesap | Plan | Kullanım | Entegrasyon |
|--------|-------|------|----------|-------------|
| **OpenAI** | büyük ihtimal pimetiket@gmail.com | Pay-as-you-go | Pim chat + AI QC + cutline vision fallback (gpt-4o, gpt-4o-mini) | API (`@ai-sdk/openai`, `@ai-sdk/react`, `ai`) |
| **PayTR** | bilinmiyor (Mağaza No: **703934**) | Standard | Ödeme — **şu an SANDBOX** (`PAYTR_TEST_MODE=1`) | iFrame API + callback webhook |
| **GoDaddy** (domain) | bilinmiyor | — | `pimetiket.com` kaydı (~₺200/yıl) | Manuel DNS |
| **Google Workspace** | info@pimetiket.com | bilinmiyor | Gelen mail (KVKK + müşteri yazışması) | Manuel inbox |

---

## ⚪ HAZIR AMA HENÜZ KULLANILMAYAN (env stub var, kod kısmen)

| Servis | Durum | Not |
|--------|-------|-----|
| **PostHog** | Env stub commented | `NEXT_PUBLIC_POSTHOG_KEY` — analytics geliştirme commit fa3679f'te kod var ama key boş |
| **GA4** | Env stub commented | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` — analytics kodu hazır, key gerekli |
| **Netgsm** (SMS) | Env stub var | `NETGSM_USERCODE/PASSWORD/HEADER` — SMS gönderim kodu yok |
| **Yurtıçi Kargo** | `YURTICI_DRY_RUN=true` | SOAP API entegrasyon kodu var, canlı değil (`docs/YURTICI-KARGO-SETUP.md`) |
| **Replicate** (arka plan kaldırma) | Env stub var | `REPLICATE_API_TOKEN` rezerve, kullanım yok |
| **Paraşüt** (e-fatura) | Sadece HESAP-KAYITLARI'da liste | Entegre değil |
| **WhatsApp Business** | API yok | "WhatsApp'tan yaz" manuel link, business API entegrasyonu yok |
| **Midjourney** | Manuel kullanım | Grid/lifestyle görselleri için, API yok |
| **Upstash Redis** | Otomatik binding | Rate limit (`src/lib/rate-limit.ts`) — Vercel KV/Upstash auto-binding |

---

## 📧 HESAP STRATEJİSİ

| E-posta | Ana Kullanım | Servisler |
|---------|--------------|-----------|
| **sefayakut111@gmail.com** | Kişisel ana hesap | Vercel, GitHub, Supabase, Anthropic |
| **pimetiket@gmail.com** | Throwaway iş hesabı | Resend + tüm 3. parti kayıtlar |
| **info@pimetiket.com** | Outbound mail "from" + müşteri yazışması | Google Workspace |
| **sefa@pimetiket.com** | Admin bildirim alıcısı | (Resend admin notif) |
| **dmarc@pimetiket.com** | DMARC raporları | (Otomatik) |
| **unsubscribe@pimetiket.com** | Mail listesi çıkış | (Otomatik) |

---

## 🚨 GÜVENLİK UYARISI

`.env.local` ve `.env.agent` dosyaları **canlı production key'leri** içeriyor:

| Anahtar | Bulunduğu yer |
|---------|---------------|
| Supabase service-role JWT | `.env.local` |
| OpenAI `sk-proj-...` | `.env.local`, `.env.agent` |
| Resend `re_8BJEU4r1...` | `.env.local` |
| R2 credentials | `.env.local` |
| Vercel PAT (`vcp_...`) | `.env.agent` |
| Supabase PAT (`sbp_...`) | `.env.agent` |

`HESAP-KAYITLARI.md` **"secrets repo'ya KOYULAMAZ"** kuralı koyuyor. Doğrulama:

```bash
git check-ignore .env.local .env.agent
```

Eğer commit edildilerse hepsi **rotate** edilmeli (özellikle Supabase service-role ve OpenAI key).

---

## 💰 AYLIK TAHMİNİ MALİYET

| Kalem | Tahmin (USD) |
|-------|--------------|
| OpenAI (gpt-4o + 4o-mini) | $20–100 (kullanıma bağlı) |
| PayTR komisyon | satış başına %1-3 |
| Vercel | $0 (Hobby) — Pro'ya geçince $20/ay |
| GoDaddy domain | ~$10/yıl |
| **Toplam başlangıç** | ~$30–150/ay |

**Ölçeklenme notu:** Vercel Hobby sınırı (100 GB bandwidth + 6K function exec/saat) launch sonrası yetmezse **Pro** ($20/ay) gerekli. Resend 3K mail/ay aşılırsa **Pro** ($20/ay → 50K). Sentry 5K event/ay aşılırsa **Team** ($26/ay).

---

## 🔌 ENTEGRASYON TÜRLERİ ÖZET

| Tür | Servisler |
|-----|-----------|
| **Tam otomatik (API + webhook)** | Vercel cron, Supabase, OpenAI, Resend, PayTR, Sentry, R2 |
| **API ile çağrı (event yok)** | Anthropic Claude (dev), Vercel Analytics |
| **Manuel yönetim** | Google Workspace inbox, GoDaddy DNS, Midjourney, WhatsApp |
| **Hazır kod + bekliyor** | Netgsm, Yurtıçi Kargo, Replicate |
| **Sadece env stub** | PostHog, GA4, Paraşüt |

---

## REFERANS DOSYALAR

| Dosya | İçerik |
|-------|--------|
| `docs/HESAP-KAYITLARI.md` | Asıl hesap kayıt + secret yönetim politikası |
| `docs/GO-LIVE.md` | Launch checklist + manuel adımlar |
| `docs/R2-PRODUCTION.md` | R2 archive setup |
| `docs/RESEND-SETUP.md` | Mail domain doğrulama + webhook |
| `docs/POSTHOG-SETUP.md` | PostHog hazırlık (henüz aktif değil) |
| `docs/YURTICI-KARGO-SETUP.md` | Kargo SOAP API hazırlığı |
| `docs/API-INTEGRATION-FIXES.md` | Dış API timeout + retry stratejileri |
| `smart-context/manifest.json` | `integrations` domain haritası |
| `.env.example` | Tüm env değişkenlerinin şablonu |
| `vercel.json` | 24 cron job + function timeout konfigürasyonu |

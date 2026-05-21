# 🔑 Pim Etiket — Hesap Kayıtları

> **Amaç:** Hangi servise hangi email/hesap ile kayıtlıyız — merkezi liste.
> Şifre/API key/PAT/token **YAZILMAZ** — onlar Vercel env, 1Password,
> Bitwarden gibi şifre yöneticisinde tutulur.
>
> **Güncel tut:** Yeni servis açtığında buraya da yaz. Hesap email'i
> değişirse satırı güncelle.

**Son güncelleme:** 21 Mayıs 2026

---

## 🎭 Roller

| Rol | Email | Notlar |
|---|---|---|
| **Solo founder / sahip** | `sefayakut111@gmail.com` | Sefa Yakut, kişisel Gmail |
| **Sistem maili (giden)** | `info@pimetiket.com` | Resend "from" adresi |
| **Sistem maili (servis kayıtları)** | `pimetiket@gmail.com` | 3. parti servis kayıtları için ayrı Gmail |
| **Destek/iletişim (gelen)** | `info@pimetiket.com` | Müşteri yanıtları, KVKK talepleri |
| **DMARC raporları** | `dmarc@pimetiket.com` | Mail teslimat raporları |
| **Şikayet/abuse** | `unsubscribe@pimetiket.com` | List-Unsubscribe mailto fallback |

> ℹ️ **Strateji:** Servis hesap email'leri için `pimetiket@gmail.com` kullanılır
> (kişisel Gmail karışmasın). Kritik bildirimler `sefayakut111@gmail.com`'a
> forward edilebilir.

---

## 🌐 Domain & DNS

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Domain registrar** (pimetiket.com) | ? | ? | ? | _Sefa doldur_ |
| **Cloudflare** (DNS) | ? | Free | https://dash.cloudflare.com | _Sefa doldur_ |

---

## 🚀 Hosting & Build

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Vercel** | `sefayakut111@gmail.com` | Hobby (free) | https://vercel.com | Proje: `pimetiket` |
| **GitHub** | `sefayakut111-netizen` | Free | https://github.com | Repo: `sefayakut111-netizen/pimetiket` |

---

## 🗄️ Veritabanı

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Supabase** | `sefayakut111@gmail.com` | Free | https://supabase.com/dashboard | Project ref: `ucmpwxnoaqjpzhijnxtp` |

---

## 📧 Mail

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Resend** | `pimetiket@gmail.com` | Free (3.000 mail/ay) | https://resend.com | Domain: pimetiket.com (verified) · API key `re_8BJEU4r1...` (16 May 2026) · Webhook aktif 21 May 2026 · 8 event subscribed · **Tüm sistem aktif** (3/3 yeşil pill /admin/mail-health) |
| **Google Workspace** (Gmail) | `info@pimetiket.com` | ? | https://admin.google.com | İnsan mailleri (Sefa'nın elden cevapladığı), KVKK talepleri |

---

## 💳 Ödeme

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **PayTR** | ? | Standart | https://www.paytr.com/magaza | Merchant ID gerekli · Test modunda aktif, canlı bekleniyor |
| **Paraşüt** (fatura) | ? | ? | https://parasut.com | _Henüz entegre değil — Sefa ileride bağlayacak_ |

---

## 📦 Kargo

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Yurtıçi Kargo** | ? | Anlaşmalı | https://www.yurticikargo.com | SOAP API · Username/Password Yurtıçi tarafından verilir · Henüz aktif değil |

---

## 🤖 AI

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **OpenAI** | ? | Pay-as-you-go | https://platform.openai.com | Pim AI sohbet + AI QC için · gpt-4o-mini kullanılıyor |
| **Anthropic** (Claude) | `sefayakut111@gmail.com` | Pay-as-you-go | https://console.anthropic.com | Geliştirme/code review için, sistemde yok |

---

## ☁️ Storage & Backup

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Cloudflare R2** (cold storage) | ? | Free tier (10 GB) | https://dash.cloudflare.com/?to=/:account/r2 | 90+ gün hareketsiz müşteri verisi · `pim-etiket-archive` bucket · Henüz aktif değil |

---

## 📊 Analytics & Monitoring

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Sentry** | ? | Free (5k event/ay) | https://sentry.io | Hata izleme · DSN Vercel env'de |
| **Vercel Analytics** | (Vercel hesabı) | Hobby | Vercel dashboard | Web vitals + funnel |
| **PostHog** | ? | Free tier | https://eu.i.posthog.com | _Opsiyonel, henüz aktif değil_ |
| **GA4** | ? | Free | https://analytics.google.com | _Opsiyonel, henüz aktif değil_ |

---

## 📱 SMS / Telefon

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Netgsm** | ? | ? | https://netgsm.com.tr | Müşteri SMS bildirimi · Sefa kararı: mail varsa SMS gerekmez, ileride |

---

## 🎨 Tasarım & İçerik

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **Midjourney** | ? | ? | https://midjourney.com | Lifestyle görseller için (etiket grid SVG'leri) |

---

## 📲 Sosyal Medya

| Servis | Handle | Notlar |
|---|---|---|
| **Instagram** | ? | _Sefa doldur_ |
| **X / Twitter** | ? | _Sefa doldur_ |
| **TikTok** | ? | _Sefa doldur_ |
| **YouTube** | ? | _Sefa doldur_ |
| **LinkedIn** | ? | Şirket sayfası |

---

## 🛠️ Diğer araçlar

| Servis | Email | Plan | Login | Notlar |
|---|---|---|---|---|
| **1Password / Bitwarden** | ? | ? | ? | Şifreler ve API key'ler burada saklanmalı |

---

## 🚨 Güvenlik notu

Bu dosya **public repo'da bulunur** ama sadece email + servis adı içerir.
**ASLA buraya yazma:**
- ❌ Şifreler
- ❌ API key'ler (RESEND_API_KEY, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY...)
- ❌ Webhook secret'ları
- ❌ PayTR merchant_salt / merchant_key
- ❌ KVKK kapsamındaki müşteri verisi

**Doğru yer:**
- 🔐 Vercel → Settings → Environment Variables (env'ler)
- 🔐 1Password / Bitwarden / iCloud Keychain (login şifreleri)
- 🔐 Supabase Dashboard (database credentials, JWT secret)

Eğer bu dosyayı git history'den temizlemek gerekirse:
```bash
# DİKKAT: history rewrite, ekipte koordine et
git filter-repo --invert-paths --path storefront/docs/HESAP-KAYITLARI.md
```

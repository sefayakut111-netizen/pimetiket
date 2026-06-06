# Redeploy & Doğrulama — Bekleyen Commit'ler + Simli Fix

> **Durum (6 Haz):** `origin/main` = 6440165 ama canlı = `c00837f`. Vercel webhook kaçmış — bugünkü 2 commit (app-health + P1/P2) prod'a gitmemiş. Simli fix de eklenince hepsi tek redeploy ile canlıya alınacak.

## 📦 Canlıya gitmeyi bekleyen commit'ler
| SHA | İçerik | Durum |
|-----|--------|-------|
| `a5117e0` | app-health denetçisi (otomatik smoke cron) | GitHub'da ✅, prod'a gitmedi ❌ |
| `6440165` | P1/P2 observability + route error.tsx | GitHub'da ✅, prod'a gitmedi ❌ |
| (yeni) | **Simli senkron fix** (kapatılan malzeme müşteride gizlensin) | Cursor'a verilecek |

---

## 🔢 SIRA

### 1. Cursor'a simli fix'i ver
```
@CURSOR-PROMPT-SIMLI-SENKRON-FIX.md sırayla uygula
```
→ Cursor push edince a5117e0 + 6440165 + simli fix hepsi GitHub'da birikir.
> (Simli fix'i atlamak istersen bu adımı geç, direkt 2'ye — ama madem redeploy yapıyorsun, katmak verimli.)

### 2. Vercel'den manuel redeploy
- Vercel dashboard → **pimetiket-storefront** → **Deployments**
- En üstteki deployment → sağdaki **⋯** → **Redeploy**
- **"Use existing build cache" → KAPALI** (temiz build)
- **Redeploy** onayla

> ⚠️ Boş commit push YAPMA — webhook kaçmışsa o da kaçabilir. Dashboard redeploy garantili.

### 3. Bana "redeploy yaptım" de
→ Aşağıdaki doğrulama listesini ben çalıştırırım.

---

## ✅ Redeploy Sonrası Doğrulama (Claude çalıştırır)

| # | Test | Beklenen | Kim |
|---|------|----------|-----|
| 1 | **Health SHA** | `/api/health` → version ≠ `c00837f` (en üst commit) | Claude (curl) |
| 2 | **App-health cron** | `/api/cron/app-health` + `Authorization: Bearer $CRON_SECRET` → JSON (404 değil) | Sen (curl) veya atla |
| 3 | **Sticker konfigüratör** | render OK + **Simli GİZLİ** (admin'de active=false) | Claude (Chrome) |
| 4 | **vinil/transparan/holo** | GÖRÜNÜYOR (graceful fallback etkilenmedi) | Claude (Chrome) |
| 5 | **Etiket konfigüratör** | `/etiket/yapilandir` render OK | Claude (Chrome) |
| 6 | **Onay sayfası** | mevcut sipariş varsa `/onay/[id]` — error.tsx akışı bozmamalı | Claude (Chrome) |
| 7 | **Simli toggle çift yönlü** | admin'de simli tekrar AÇ → müşteride görünmeli (opsiyonel) | Sen + Claude |

### #2 için CRON_SECRET (sende)
```powershell
curl -H "Authorization: Bearer $env:CRON_SECRET" https://pimetiket.com/api/cron/app-health
```
> CRON_SECRET'ı GitHub secret'tan biliyorsun. Çıktıyı bana yapıştır ya da bu maddeyi atla — gerisini Chrome'la ben yaparım.

---

## 🚨 Eğer redeploy de işe yaramazsa (webhook tamamen kopuksa)
- Vercel → Project Settings → Git → bağlantı durumu kontrol
- Vercel → Project Settings → Git → "Ignored Build Step" var mı (yanlış filtre commit'leri atlıyor olabilir)
- Son çare: Vercel CLI `vercel --prod` (Sefa lokal)

---

**Referans:**
- Deploy teşhisi: GitHub deployments c00837f'te durmuş, a5117e0/6440165 yok
- Simli fix: `CURSOR-PROMPT-SIMLI-SENKRON-FIX.md`
- Kök neden (simli): `StickerConfiguratorClient.tsx:412-428` missing mantığı active=false'u geri ekliyordu

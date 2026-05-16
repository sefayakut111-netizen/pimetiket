# Pim Etiket — Auditor Sistemi Kurulum Notları

> Domain denetçi agent sistemi (9 agent). Bu dosya hangi env'lerin
> Vercel'de ayarlı olduğunu ve eksik olanları gösterir.

---

## ✅ Hazır env'ler (Vercel production)

| Env | Amaç |
|---|---|
| `CRON_SECRET` | Vercel Cron auth |
| `AUDITOR_NOTIFY_EMAILS` | Sefa'nın mail adresi (sefayakut111@gmail.com) |
| `RESEND_API_KEY` | Mail gönderimi |
| `RESEND_FROM_EMAIL` | "Pim Etiket <info@pimetiket.com>" |
| `OPENAI_API_KEY` | Design QC + Pim chat |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client |
| `NEXT_PUBLIC_SITE_URL` | Mail içindeki linkler |
| `CLOUDFLARE_API_TOKEN` | block_ip handler |
| `CLOUDFLARE_ACCOUNT_ID` | CF API çağrıları için |

## ⏳ Eksik olan ve etkisi

| Env | Amaç | Yoksa ne olur |
|---|---|---|
| `CLOUDFLARE_BLOCKED_IPS_LIST_ID` | block_ip target list | block_ip aksiyonu "partial" döner — audit kalır, gerçek block atlanır |

Bu env için **iki adım** gerek:
1. CF API token izin yükseltmesi (`Account · Account Filter Lists · Edit` ekle)
2. CF'de `pimetiket_blocked_ips` IP list oluştur, ID Vercel'e ekle
3. WAF rule: `if ip.src in $pimetiket_blocked_ips → Block`

**Cloudflare token nasıl alınır:**
1. Cloudflare → My Profile → API Tokens → Create Custom Token
2. İzinler:
   - `Account · Account Filter Lists · Edit`
   - `Account · Account Settings · Read`
3. Account Resource: Pim Etiket account
4. Token oluştur → bana ver, Vercel'e ekleyeceğim

**IP list oluşturma:**
1. Cloudflare → Account → Configurations → Lists
2. "Create List" → Type: IP → İsim: `pimetiket_blocked_ips`
3. List ID'sini al → Vercel'e `CLOUDFLARE_BLOCKED_IPS_LIST_ID` olarak ekle
4. WAF rule oluştur: "if ip.src in $pimetiket_blocked_ips → block"

---

## 🤖 9 Agent ve cron schedule'ları

> NOT: Vercel Hobby plan günde 1 cron limiti — security ve workflow
> ideal değerlerinden düşürüldü. Pro plan'a ($20/ay) geçilirse
> orijinal değerlere döner.

| Agent | Cron | Açıklama |
|---|---|---|
| 🛡️ security | `0 1 * * *` | Günlük 01:00 — brute force, spoof, bot |
| ⚙️ workflow | `0 5 * * *` | Günlük 05:00 — stuck order, SLA |
| 💰 finance | `0 9 * * *` | Günlük 09:00 — gece hesap kapanışı |
| 💸 ai_cost | `30 9 * * *` | Günlük 09:30 — AI maliyet |
| ⚖️ compliance | `0 10 * * *` | Günlük 10:00 — KVKK SLA |
| 🧹 data_hygiene | `0 3 * * 0` | Pazar 03:00 — DB temizlik |
| 😊 customer_health | `0 10 * * 1` | Pazartesi 10:00 — müşteri sağlık |
| 📈 seo | `0 11 * * 3` | Çarşamba 11:00 — görünürlük |
| 🎨 brand | `0 14 * * 5` | Cuma 14:00 — marka tutarlılığı |
| 📨 daily-digest | `0 8 * * *` | Günlük 08:00 — tek mail, 9 agent özeti |

## 📧 Mail strateji (Sefa'nın inbox spam'ı önleyici)

| Tetik | Mail gider mi? |
|---|---|
| Cron + info-only sonuç | ❌ Hayır (gürültü engellendi) |
| Cron + warning/critical | ✅ Evet (gerçek sorun) |
| Manuel "Şimdi çalıştır" | ✅ Her zaman (test için) |
| Pending action oluştu | ✅ Onay isteme maili |
| Daily Digest | ✅ Her sabah 08:00 (9 agent özeti) |

**Beklenen günlük mail sayısı (sağlıklı sistem):**
1 daily digest + 0-3 alert = günde 1-4 mail.

## 📍 Admin sayfaları

- `/admin/denetciler` — 9 kart dashboard
- `/admin/denetciler/bekleyen` — onay kuyruğu
- `/admin/denetciler/[auditor]` — detay + trend graf
- `/admin/denetciler/ertelenenler` — karar arşivi (snoozed/rejected/applied)
- `/admin/denetciler/gecmis` — tüm geçmiş, filter + paginate

## 🔧 10 Action handler

`block_ip`, `lock_admin_account`, `notify_sefa`, `expire_stale_intents`,
`extend_coupon_expiry`, `retrigger_stuck_order`, `cancel_no_design_order`,
`process_kvkk_deletion`, `archive_old_files`, `cleanup_orphan_cart`

---

**İlk test:** `/admin/denetciler/security` → "▶ Şimdi çalıştır" → bulgu görür → `/admin/denetciler/bekleyen` → onay/red ver.

---

## 🔧 Debug — Sorun çıkarsa nereye bak

### "Agent çalışmıyor / cron tetiklemiyor"
1. **Vercel Dashboard → Project → Crons sekmesi**
   - Cron schedule görünüyor mu?
   - Son çalışma zamanı + status
2. **Vercel Dashboard → Functions → /api/cron/auditors/[name]**
   - Log'larda 401 → CRON_SECRET yanlış
   - Log'larda 501 → auditor factory eksik
3. Manuel test: `/admin/denetciler/<name>` → "▶ Şimdi çalıştır"
   - Bu cron'u bypass eder, doğrudan agent çalıştırır

### "Mail gelmiyor"
1. **Resend Dashboard → Domains**
   - `pimetiket.com` status: **verified** olmalı (pending değil)
2. **Resend Dashboard → Logs → Sent**
   - Mail kaydı var mı? Yoksa kod tarafı sorunu.
   - Varsa "Delivered" mı, "Bounced" mı?
3. **Gmail Spam klasörü** kontrol
4. Compliance auditor → mail_infra check → durumu raporlar

### "Block_ip aksiyonu çalışmıyor (partial)"
- `CLOUDFLARE_API_TOKEN` Vercel'de var mı?
- Token izinleri: `Account · Account Filter Lists · Edit` gerek
- `CLOUDFLARE_BLOCKED_IPS_LIST_ID` Vercel'de var mı?
- CF'de `pimetiket_blocked_ips` IP list oluşturulmuş mu?

### "KVKK silme aksiyonu çalışmıyor"
- Migration 041 push edildi mi?
- `fn_process_kvkk_deletion` RPC var mı?
- Test: SELECT * FROM pg_proc WHERE proname = 'fn_process_kvkk_deletion';

### "Auditor karar verdim ama uygulanmadı"
- `/admin/denetciler/ertelenenler` → "Uygulananlar" tabını kontrol et
- `apply_error` kolonu varsa hata mesajı orada
- `auditor_action_log` tablosu detaylı log tutar

---

## 📊 Sistem mimarisi özeti

```
Cron schedule (vercel.json)
      ↓
GET /api/cron/auditors/[name]
      ↓
auth: Bearer CRON_SECRET
      ↓
AUDITOR_FACTORIES[name]() → SecurityAuditor / FinanceAuditor / ...
      ↓
auditor.run({ triggerType: "cron" })
      ↓
1. auditor_runs INSERT (status=running)
2. runChecks() — finding'ler üret
3. auditor_findings INSERT (toplu)
4. auditor_pending_actions INSERT (suggestedAction olanlar)
5. auditor_runs UPDATE (status=success + counts)
6. Mail tetik (warning/critical varsa veya manuel ise)
7. Onay isteme mail (pending action varsa)
```

Onay zinciri:
```
Sefa /admin/denetciler/bekleyen → ApprovalCard görür
      ↓
POST /api/admin/auditors/pending/[id]/decide
      ↓
status = approved → executePendingAction() → handler çalışır
      ↓
auditor_action_log INSERT
      ↓
sendActionAppliedNotification() — sonuç maili
```

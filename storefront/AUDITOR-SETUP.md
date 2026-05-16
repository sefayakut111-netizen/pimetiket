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

| Agent | Cron | Açıklama |
|---|---|---|
| 🛡️ security | `0 * * * *` | Saatlik — brute force, spoof, bot |
| ⚙️ workflow | `0 */4 * * *` | 4 saatlik — stuck order, SLA |
| 💰 finance | `0 9 * * *` | Günlük 09:00 — gece hesap kapanışı |
| 💸 ai_cost | `30 9 * * *` | Günlük 09:30 — AI maliyet |
| ⚖️ compliance | `0 10 * * *` | Günlük 10:00 — KVKK SLA |
| 🧹 data_hygiene | `0 3 * * 0` | Pazar 03:00 — DB temizlik |
| 😊 customer_health | `0 10 * * 1` | Pazartesi 10:00 — müşteri sağlık |
| 📈 seo | `0 11 * * 3` | Çarşamba 11:00 — görünürlük |
| 🎨 brand | `0 14 * * 5` | Cuma 14:00 — marka tutarlılığı |

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

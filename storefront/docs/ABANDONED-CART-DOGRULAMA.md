# Abandoned Cart Cron — Doğrulama Raporu

**Tarih:** 10 Haziran 2026  
**Kapsam:** Sadece doğrulama (fix yok)

## 1. Endpoint ve kod

| Öğe | Durum |
|-----|--------|
| Route | `GET /api/cron/detect-abandoned-carts` — mevcut, `assertCronAuth` + `withCronRun` |
| Tetik kriteri | `cart_items` 24–72 saat aralığı, sipariş yok, son 7 günde mail yok, min sepet 100₺ |
| Aksiyon | `sendAbandonedCart` → `fason_mail_outbox` (`customer_abandoned_cart`) |
| Guest sepet | Hariç (localStorage) |

## 2. Vercel schedule

`vercel.json` içinde kayıtlı:

```json
{ "path": "/api/cron/detect-abandoned-carts", "schedule": "0 10 * * *" }
```

Günde 1 kez, UTC 10:00 (TR yaz saati ~13:00).

`src/lib/cron-registry.ts` ile uyumlu.

## 3. Canlı çalışma (cron_runs)

Son 5 koşu — hepsi **success**:

| started_at (UTC) | summary | items_processed |
|------------------|---------|-----------------|
| 2026-06-10 10:41 | Abandoned cart adayı yok | 0 |
| 2026-06-09 10:40 | Abandoned cart adayı yok | 0 |
| 2026-06-08 10:06 | Abandoned cart adayı yok | 0 |
| 2026-06-03 10:41 | Abandoned cart adayı yok | 0 |
| 2026-06-02 10:33 | Abandoned cart adayı yok | 0 |

**Sonuç:** Cron Vercel'den düzenli tetikleniyor; hata yok. Son çalışmada **0 mail** kuyruğa alındı (uygun aday sepet yok).

## 4. Outbox geçmişi

`fason_mail_outbox` WHERE `template_key = 'customer_abandoned_cart'` → **0 kayıt**.

Henüz hiç terk sepet maili kuyruğa girmemiş (aday yok veya kriterler eşleşmemiş).

## 5. Resend env

- Kod: `RESEND_API_KEY` yoksa `resend.ts` mail göndermez, outbox'ta bekler (`process-mail-outbox` cron ile).
- Prod env değerleri bu raporda okunmadı; Vercel dashboard'dan `RESEND_API_KEY` + `RESEND_FROM_EMAIL` doğrulanmalı.
- `docs/RESEND-SETUP.md` abandoned cart akışını dokümante ediyor.

## 6. Özet

| Kontrol | Sonuç |
|---------|--------|
| Kod çalışıyor mu? | Evet — cron success |
| vercel.json schedule? | Evet — `0 10 * * *` |
| Son koşuda kuyruklanan mail | **0** |
| Outbox geçmişi | Boş |
| Resend canlı mı? | Kod hazır; prod key ayrı doğrulanmalı |

**Risk:** Düşük trafik / kısa sepet penceresi (24–72h) nedeniyle mail hiç tetiklenmemiş olabilir — bu beklenen davranış, cron arızası değil.

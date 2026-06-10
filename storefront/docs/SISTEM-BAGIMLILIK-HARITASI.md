# SİSTEM BAĞIMLILIK HARİTASI (bağlam önbelleği)
> ÜRETİLMİŞ DOSYA — elle düzenleme. Yenile: `npm run context:map`
> Üretim: 2026-06-10 · commit a4acd31f · 949 dosya · 2696 iç import ilişkisi
> AMAÇ: oturum başında BUNU oku; glob/grep keşfine token yakma. Soru→bölüm: "X sayfası nerede"→§1 · "API var mı/guard'ı ne"→§2 · "merkezi modül"→§3 · "lib'de ne var"→§5

## §1 Sayfa route'ları (123)
| URL | Dosya |
|---|---|
| / | src/app/page.tsx |
| /admin | src/app/admin/page.tsx |
| /admin/aboneler | src/app/admin/aboneler/page.tsx |
| /admin/agents/design-qc-test | src/app/admin/agents/design-qc-test/page.tsx |
| /admin/ai-qc | src/app/admin/ai-qc/page.tsx |
| /admin/arsiv | src/app/admin/arsiv/page.tsx |
| /admin/arsiv/[userId] | src/app/admin/arsiv/[userId]/page.tsx |
| /admin/audit-log | src/app/admin/audit-log/page.tsx |
| /admin/ayarlar | src/app/admin/ayarlar/page.tsx |
| /admin/blog | src/app/admin/blog/page.tsx |
| /admin/calisanlar | src/app/admin/calisanlar/page.tsx |
| /admin/debug/design-qc-test | src/app/admin/debug/design-qc-test/page.tsx |
| /admin/denetciler | src/app/admin/denetciler/page.tsx |
| /admin/denetciler/[auditor] | src/app/admin/denetciler/[auditor]/page.tsx |
| /admin/denetciler/bekleyen | src/app/admin/denetciler/bekleyen/page.tsx |
| /admin/denetciler/ertelenenler | src/app/admin/denetciler/ertelenenler/page.tsx |
| /admin/denetciler/gecmis | src/app/admin/denetciler/gecmis/page.tsx |
| /admin/destek | src/app/admin/destek/page.tsx |
| /admin/fason | src/app/admin/fason/page.tsx |
| /admin/fason/[partnerId] | src/app/admin/fason/[partnerId]/page.tsx |
| /admin/fason/yeni | src/app/admin/fason/yeni/page.tsx |
| /admin/finans | src/app/admin/finans/page.tsx |
| /admin/fiyat-hesapla | src/app/admin/fiyat-hesapla/page.tsx |
| /admin/fiyat-hesapla-etiket | src/app/admin/fiyat-hesapla-etiket/page.tsx |
| /admin/fiyat-hesapla-tabaka | src/app/admin/fiyat-hesapla-tabaka/page.tsx |
| /admin/fiyatlar | src/app/admin/fiyatlar/page.tsx |
| /admin/galeri | src/app/admin/galeri/page.tsx |
| /admin/gorseller | src/app/admin/gorseller/page.tsx |
| /admin/iadeler | src/app/admin/iadeler/page.tsx |
| /admin/icerik | src/app/admin/icerik/page.tsx |
| /admin/kargo | src/app/admin/kargo/page.tsx |
| /admin/kargo/[orderId] | src/app/admin/kargo/[orderId]/page.tsx |
| /admin/kuponlar | src/app/admin/kuponlar/page.tsx |
| /admin/kuyruk | src/app/admin/kuyruk/page.tsx |
| /admin/kvkk-talepleri | src/app/admin/kvkk-talepleri/page.tsx |
| /admin/mail-health | src/app/admin/mail-health/page.tsx |
| /admin/musteriler | src/app/admin/musteriler/page.tsx |
| /admin/musteriler/[id] | src/app/admin/musteriler/[id]/page.tsx |
| /admin/odemeler | src/app/admin/odemeler/page.tsx |
| /admin/odemeler/[id] | src/app/admin/odemeler/[id]/page.tsx |
| /admin/profil | src/app/admin/profil/page.tsx |
| /admin/prova | src/app/admin/prova/page.tsx |
| /admin/prova/[orderId] | src/app/admin/prova/[orderId]/page.tsx |
| /admin/raporlar | src/app/admin/raporlar/page.tsx |
| /admin/siparis-ekle | src/app/admin/siparis-ekle/page.tsx |
| /admin/siparisler | src/app/admin/siparisler/page.tsx |
| /admin/siparisler/[id] | src/app/admin/siparisler/[id]/page.tsx |
| /admin/sistem/bakim | src/app/admin/sistem/bakim/page.tsx |
| /admin/sistem/cronlar | src/app/admin/sistem/cronlar/page.tsx |
| /admin/sistem/denetciler | src/app/admin/sistem/denetciler/page.tsx |
| /admin/sistem/performans | src/app/admin/sistem/performans/page.tsx |
| /admin/tasarimlar | src/app/admin/tasarimlar/page.tsx |
| /admin/test-siparis-simulator | src/app/admin/test-siparis-simulator/page.tsx |
| /admin/trafik | src/app/admin/trafik/page.tsx |
| /admin/urunler | src/app/admin/urunler/page.tsx |
| /admin/yardim-talepleri | src/app/admin/yardim-talepleri/page.tsx |
| /admin/yedekler | src/app/admin/yedekler/page.tsx |
| /admin/yorumlar | src/app/admin/yorumlar/page.tsx |
| /adreslerim | src/app/adreslerim/page.tsx |
| /auth | src/app/auth/page.tsx |
| /auth/mfa-challenge | src/app/auth/mfa-challenge/page.tsx |
| /ayarlar/2fa | src/app/ayarlar/2fa/page.tsx |
| /ayarlar/verilerim | src/app/ayarlar/verilerim/page.tsx |
| /bakim | src/app/bakim/page.tsx |
| /bildirim-tercihleri | src/app/bildirim-tercihleri/page.tsx |
| /bildirim-tercihleri/cikis | src/app/bildirim-tercihleri/cikis/page.tsx |
| /blog | src/app/blog/page.tsx |
| /blog/[slug] | src/app/blog/[slug]/page.tsx |
| /blog/konu/[tag] | src/app/blog/konu/[tag]/page.tsx |
| /cayma-hakki | src/app/cayma-hakki/page.tsx |
| /cerez | src/app/cerez/page.tsx |
| /demo | src/app/demo/page.tsx |
| /destek | src/app/destek/page.tsx |
| /editor | src/app/editor/page.tsx |
| /etiket | src/app/etiket/page.tsx |
| /etiket/[type] | src/app/etiket/[type]/page.tsx |
| /etiket/yapilandir | src/app/etiket/yapilandir/page.tsx |
| /fason/[token] | src/app/fason/[token]/page.tsx |
| /fatura-bilgileri | src/app/fatura-bilgileri/page.tsx |
| /firma-bilgileri | src/app/firma-bilgileri/page.tsx |
| /galeri | src/app/galeri/page.tsx |
| /gizlilik | src/app/gizlilik/page.tsx |
| /hakkimizda | src/app/hakkimizda/page.tsx |
| /iade-degisim-politikasi | src/app/iade-degisim-politikasi/page.tsx |
| /iade-talep | src/app/iade-talep/page.tsx |
| /iadelerim | src/app/iadelerim/page.tsx |
| /iletisim | src/app/iletisim/page.tsx |
| /kvkk | src/app/kvkk/page.tsx |
| /malzeme/[slug] | src/app/malzeme/[slug]/page.tsx |
| /malzemeler | src/app/malzemeler/page.tsx |
| /mesafeli-satis | src/app/mesafeli-satis/page.tsx |
| /nasil-uretiyoruz | src/app/nasil-uretiyoruz/page.tsx |
| /odeme | src/app/odeme/page.tsx |
| /odeme-sonuc | src/app/odeme-sonuc/page.tsx |
| /on-bilgilendirme | src/app/on-bilgilendirme/page.tsx |
| /onay/[orderId] | src/app/onay/[orderId]/page.tsx |
| /onay/[orderId]/duzenle/[itemId] | src/app/onay/[orderId]/duzenle/[itemId]/page.tsx |
| /onay/[orderId]/tamamlandi | src/app/onay/[orderId]/tamamlandi/page.tsx |
| /panelim | src/app/panelim/page.tsx |
| /partner | src/app/partner/page.tsx |
| /partner/ayarlar | src/app/partner/ayarlar/page.tsx |
| /partner/giris | src/app/partner/giris/page.tsx |
| /partner/siparisler | src/app/partner/siparisler/page.tsx |
| /partner/siparisler/[id] | src/app/partner/siparisler/[id]/page.tsx |
| /partner/siparisler/[id]/duzenle/[itemId] | src/app/partner/siparisler/[id]/duzenle/[itemId]/page.tsx |
| /profil | src/app/profil/page.tsx |
| /sablonlar | src/app/sablonlar/page.tsx |
| /sartlar | src/app/sartlar/page.tsx |
| /sepet | src/app/sepet/page.tsx |
| /sifre-sifirla | src/app/sifre-sifirla/page.tsx |
| /siparis/[id] | src/app/siparis/[id]/page.tsx |
| /siparis/[id]/tasarim-yukle | src/app/siparis/[id]/tasarim-yukle/page.tsx |
| /siparislerim | src/app/siparislerim/page.tsx |
| /sss | src/app/sss/page.tsx |
| /sticker | src/app/sticker/page.tsx |
| /sticker/[type] | src/app/sticker/[type]/page.tsx |
| /sticker/yapilandir | src/app/sticker/yapilandir/page.tsx |
| /studio | src/app/studio/page.tsx |
| /tasarimlarim | src/app/tasarimlarim/page.tsx |
| /telif-sikayet | src/app/telif-sikayet/page.tsx |
| /terim-sozlugu | src/app/terim-sozlugu/page.tsx |
| /yorum-yaz/[orderId] | src/app/yorum-yaz/[orderId]/page.tsx |
| /yorumlar | src/app/yorumlar/page.tsx |

## §2 API uçları (241) — method · guard
guard: settings/orders/… = assertPermission modülü · admin = assert-admin · partner · auth = login şart · cron = CRON_SECRET · "-" = açık/elle kontrol et
| Endpoint | M | Guard |
|---|---|---|
| /api/admin/activity-feed | GET | orders |
| /api/admin/ai-qc/decide | POST | ai_qc |
| /api/admin/ai-qc/history | GET | ai_qc |
| /api/admin/ai-qc/queue | GET | ai_qc |
| /api/admin/archive/customers | GET | archive |
| /api/admin/archive/files | GET | archive |
| /api/admin/archive/r2-status | GET | archive |
| /api/admin/archive/signed-url | POST | archive |
| /api/admin/auditors | GET | auditors |
| /api/admin/auditors/[name] | GET | auditors |
| /api/admin/auditors/[name]/run | POST | auditors |
| /api/admin/auditors/daily-digest | POST | auditors |
| /api/admin/auditors/pending | GET | auditors |
| /api/admin/auditors/pending/[id]/decide | POST | auditors |
| /api/admin/auditors/run-all | POST | auditors |
| /api/admin/auditors/runs | GET | auditors |
| /api/admin/auditors/test-mail | POST | auditors |
| /api/admin/backups | GET | backups |
| /api/admin/blog | GET,POST,PATCH,DELETE | blog |
| /api/admin/blog/upload-cover | POST | blog |
| /api/admin/blog/upload-image | POST | blog |
| /api/admin/cart-stats | GET | orders |
| /api/admin/coupons | GET,POST,PATCH,DELETE | coupons |
| /api/admin/coupons/migrate | POST | coupons |
| /api/admin/cron-status | GET | settings |
| /api/admin/cron-status/trigger | POST | settings |
| /api/admin/customer-stats | GET | customers |
| /api/admin/customers | GET | customers |
| /api/admin/customers/[id] | GET,PATCH,DELETE | customers |
| /api/admin/customers/[id]/activity-log | GET,POST | customers |
| /api/admin/customers/[id]/grant-credit | GET,POST,PUT,PATCH,DELETE | admin |
| /api/admin/customers/[id]/notes | POST,DELETE | customers |
| /api/admin/customers/[id]/reset-password | POST | customers |
| /api/admin/customers/[id]/send-email | POST | customers |
| /api/admin/customers/[id]/suspend | POST | customers |
| /api/admin/customers/[id]/tags | POST,DELETE | customers |
| /api/admin/customers/bulk/email | POST | customers |
| /api/admin/customers/diagnostic | GET | customers |
| /api/admin/customers/export | GET | customers |
| /api/admin/dashboard-aggregate | GET | dashboard |
| /api/admin/designs | GET | designs |
| /api/admin/designs/repair-stuck | GET,POST | designs |
| /api/admin/fason/assign | POST | fason |
| /api/admin/fason/assignments | GET | fason |
| /api/admin/fason/assignments/[id]/revoke | POST | fason |
| /api/admin/fason/partners | GET,POST | fason |
| /api/admin/fason/partners/[id] | GET,PATCH | fason |
| /api/admin/fason/partners/[id]/capabilities/verify | POST | fason |
| /api/admin/fason/partners/[id]/communications | GET,POST,PATCH,DELETE | fason |
| /api/admin/fason/partners/[id]/contract | POST | fason |
| /api/admin/fason/partners/[id]/contract/download | GET | fason |
| /api/admin/fason/partners/[id]/file-transfers | GET,POST | fason |
| /api/admin/fason/partners/[id]/mail-log | GET | fason |
| /api/admin/fason/partners/[id]/pause | POST | fason |
| /api/admin/fason/partners/[id]/performance | GET | fason |
| /api/admin/fason/partners/[id]/resume | POST | fason |
| /api/admin/fason/partners/[id]/terminate | POST | fason |
| /api/admin/fason/suggest | GET | fason |
| /api/admin/financials/monthly-pack | GET | finans |
| /api/admin/financials/summary | GET | finans |
| /api/admin/funnel-metrics | GET | reports |
| /api/admin/gallery | GET,POST | gallery |
| /api/admin/gallery/[id] | PATCH,DELETE | gallery |
| /api/admin/gallery/reorder | POST | gallery |
| /api/admin/gallery/upload-url | POST | gallery |
| /api/admin/help-requests | GET | help_requests |
| /api/admin/help-requests/[id]/respond | POST | help_requests |
| /api/admin/impersonate/partner | POST | fason |
| /api/admin/kvkk-requests | GET | kvkk |
| /api/admin/kvkk-requests/[id]/process | POST | kvkk |
| /api/admin/kvkk/delete-audit | GET | kvkk |
| /api/admin/mail-health | GET | mail_health |
| /api/admin/mail-health/test-send | POST | mail_health |
| /api/admin/mail-suppressions | POST,DELETE | mail_health |
| /api/admin/mail-templates | GET,POST | mail_health |
| /api/admin/operation-queue | GET | orders |
| /api/admin/orders/[id] | GET | orders |
| /api/admin/orders/[id]/proof | GET | proof |
| /api/admin/orders/[id]/remind-proof | POST | proof |
| /api/admin/orders/[id]/status | POST | orders |
| /api/admin/orders/[id]/tracking | GET,POST | orders |
| /api/admin/orders/[id]/upload-design | POST | orders |
| /api/admin/orders/[id]/upload-proof | POST | proof |
| /api/admin/orders/bulk-status | POST | orders |
| /api/admin/orders/bypass-checkout | POST | manual_order |
| /api/admin/orders/list | GET | orders |
| /api/admin/orders/manual | POST | manual_order |
| /api/admin/partner-production-summary | GET | fason |
| /api/admin/payments | GET | finans |
| /api/admin/payments/[id] | GET | finans |
| /api/admin/payments/refund | POST | finans |
| /api/admin/pricebook | GET,PUT | pricing |
| /api/admin/pricing | GET,PUT | pricing |
| /api/admin/pricing/publish | POST | pricing |
| /api/admin/pricing/revert | POST | pricing |
| /api/admin/print-job/[orderId]/manifest | GET | shipments |
| /api/admin/product-cards | GET,PATCH | products |
| /api/admin/product-cards/reorder | POST | products |
| /api/admin/prova/readiness | GET | proof |
| /api/admin/prova/reminder-log | GET | proof |
| /api/admin/returns | GET | returns |
| /api/admin/returns/[id]/status | POST | returns |
| /api/admin/reviews | GET | reviews |
| /api/admin/reviews/[id] | PATCH | reviews |
| /api/admin/search | GET | orders |
| /api/admin/settings | GET,PATCH | settings |
| /api/admin/shipments | GET | shipments |
| /api/admin/shipments/[orderId]/override | POST | shipments |
| /api/admin/shipments/bulk-poll | POST | shipments |
| /api/admin/shipments/geo-distribution | GET | shipments |
| /api/admin/shipments/stats | GET | shipments |
| /api/admin/shipping/label/[orderId] | GET | shipments |
| /api/admin/site-images | GET,POST,PATCH,DELETE | site_images |
| /api/admin/staff | GET | staff |
| /api/admin/staff/[userId] | PATCH,DELETE | staff |
| /api/admin/subscribers | GET | subscribers |
| /api/admin/support | GET,POST | help_requests |
| /api/admin/support/[id] | PATCH | help_requests |
| /api/admin/system-health | GET | settings |
| /api/admin/system-overview | GET | settings |
| /api/admin/test/simulate-checkout | POST | manual_order |
| /api/admin/traffic | GET | dashboard |
| /api/admin/traffic/gsc | GET | dashboard |
| /api/admin/traffic/realtime | GET | dashboard |
| /api/agents/cutline-generate | POST | - |
| /api/agents/design-qc | POST | ai_qc |
| /api/auth/auto-confirm | POST | - |
| /api/auth/log-failed-login | POST | - |
| /api/blog | GET | - |
| /api/cart/reprice | POST | auth |
| /api/cart/upload-preview | POST | auth |
| /api/cron/admin-daily-summary | GET | cron |
| /api/cron/app-health | GET | cron |
| /api/cron/archive-inactive | GET | cron |
| /api/cron/auditors/[name] | GET | cron |
| /api/cron/auditors/daily-digest | GET | cron |
| /api/cron/auto-refund | GET | cron |
| /api/cron/cleanup-orphan-previews | GET | - |
| /api/cron/cleanup-stale-uploads | GET | - |
| /api/cron/cleanup-temp-designs | GET | - |
| /api/cron/detect-abandoned-carts | GET | cron |
| /api/cron/fason-deadline-reminder | GET | cron |
| /api/cron/instagram-sync | GET | - |
| /api/cron/kvkk-delete-audit | GET | cron |
| /api/cron/paytr-reconciler | GET | admin |
| /api/cron/poll-shipments | GET | cron |
| /api/cron/process-mail-outbox | GET | cron |
| /api/cron/purge-expired-designs | GET | cron |
| /api/cron/refresh-fason-scores | GET | cron |
| /api/cron/request-reviews | GET | cron |
| /api/cron/seo-indexing | GET | cron |
| /api/cron/upload-reminders | GET | cron |
| /api/customer/design-files/[id]/restore-url | POST | auth |
| /api/customer/kvkk-archive-delete | POST | customers |
| /api/customer/notifications | GET | auth |
| /api/design/enhance | POST | auth |
| /api/design/enhance/accept | POST | auth |
| /api/design/reprint-from-file | POST | auth |
| /api/design/temp-upload-complete | POST,DELETE | auth |
| /api/design/temp-upload-init | POST | auth |
| /api/design/upload-complete | POST | auth |
| /api/design/upload-init | POST | auth |
| /api/design/upload-init-r2 | POST | auth |
| /api/dev/mock-checkout | POST | auth |
| /api/editor/background | GET | auth |
| /api/editor/bg-remove | POST | auth |
| /api/editor/design-file/[tempId] | GET | auth |
| /api/editor/pim-command | POST | auth |
| /api/editor/save | POST | auth |
| /api/fason/download/[token] | GET | - |
| /api/fason/info/[token] | GET | - |
| /api/fason/update | POST | - |
| /api/health | GET | - |
| /api/lead/subscribe | POST | - |
| /api/loyalty/me | GET | auth |
| /api/loyalty/reprint-coupon | POST | auth |
| /api/mail/unsubscribe | POST,GET | - |
| /api/me/kvkk-requests | GET,POST | auth |
| /api/me/kvkk-requests/[id]/cancel | POST | auth |
| /api/me/permissions | GET | auth |
| /api/me/returns | POST | auth |
| /api/orders/[id]/advance-status | POST | auth |
| /api/orders/[id]/cancel | POST | auth |
| /api/orders/[id]/help-requests | GET | auth |
| /api/orders/[id]/invoice-pdf | GET | auth |
| /api/orders/[id]/items/[itemId]/design-file | GET | auth |
| /api/orders/[id]/items/[itemId]/design-url | GET | auth |
| /api/orders/[id]/proof | GET | auth |
| /api/orders/[id]/proof-respond | POST | auth |
| /api/orders/[id]/proof/[itemId]/approve | POST | auth |
| /api/orders/[id]/proof/[itemId]/background | GET | auth |
| /api/orders/[id]/proof/[itemId]/background/dismiss | POST | auth |
| /api/orders/[id]/proof/[itemId]/background/remove | POST | auth |
| /api/orders/[id]/proof/[itemId]/cmyk-preview | GET | auth |
| /api/orders/[id]/proof/[itemId]/design-url | GET | auth |
| /api/orders/[id]/proof/[itemId]/enhance-dismiss | POST | auth |
| /api/orders/[id]/proof/[itemId]/enhance-hint | GET | auth |
| /api/orders/[id]/proof/[itemId]/help | POST | auth |
| /api/orders/[id]/proof/[itemId]/preview-png | GET | auth |
| /api/orders/[id]/proof/[itemId]/preview-url | GET | auth |
| /api/orders/[id]/proof/[itemId]/production-export | GET | auth |
| /api/orders/[id]/proof/[itemId]/save-edit | POST | auth |
| /api/orders/[id]/proof/[itemId]/view | POST | auth |
| /api/orders/[id]/proof/consistency | GET | auth |
| /api/orders/[id]/proof/finalize | POST | auth |
| /api/orders/[id]/proof/validation | GET | auth |
| /api/orders/[id]/redistribute-slot | POST | auth |
| /api/orders/[id]/upload-status | GET | auth |
| /api/orders/admin-bypass-promote | POST | manual_order |
| /api/partner/auth/otp-request | POST | - |
| /api/partner/auth/otp-verify | POST | - |
| /api/partner/dashboard | GET | - |
| /api/partner/orders | GET | - |
| /api/partner/orders/[id] | GET | - |
| /api/partner/orders/[id]/items/[itemId]/decide | POST | - |
| /api/partner/orders/[id]/items/[itemId]/upload-revision | POST | - |
| /api/partner/orders/[id]/status | POST | - |
| /api/partner/settings | GET,PATCH | - |
| /api/partner/settings/verify-email | POST | - |
| /api/payment/abandon | POST | auth |
| /api/payment/callback | POST,GET | admin |
| /api/payment/init | POST | auth |
| /api/payment/refund | POST | finans |
| /api/payment/status | GET | auth |
| /api/pim/chat | POST | auth |
| /api/pim/cutline-feedback | POST | auth |
| /api/pim/cutline-vision-fallback | POST | auth |
| /api/pim/memory | GET,PUT | auth |
| /api/pim/memory/migrate | POST | auth |
| /api/pim/summarize | POST | auth |
| /api/product-cards | GET | - |
| /api/public/instagram | GET | - |
| /api/public/pricebook | GET | - |
| /api/public/settings | GET | admin |
| /api/sablonlar/kesim/download | GET | auth |
| /api/search | GET | auth |
| /api/search/intent | POST | - |
| /api/support/create | POST | auth |
| /api/support/my-tickets | GET | auth |
| /api/view-mode | POST | admin |
| /api/webhooks/resend | POST,GET | - |

## §3 Hub modülleri (en çok import edilen 30 — buraya dokunmak = geniş etki)
| # | Dosya | İçeri bağ |
|---|---|---|
| 1 | src/lib/supabase/admin.ts | 166 |
| 2 | src/components/ui/index.ts | 155 |
| 3 | src/lib/cn.ts | 132 |
| 4 | src/lib/supabase/assert-permission.ts | 128 |
| 5 | src/components/Icon.tsx | 115 |
| 6 | src/lib/supabase/types.ts | 95 |
| 7 | src/lib/supabase/server.ts | 89 |
| 8 | src/components/Pim.tsx | 66 |
| 9 | src/lib/storage/design-files.ts | 44 |
| 10 | src/lib/i18n/context.tsx | 44 |
| 11 | src/lib/agents/_shared/types.ts | 33 |
| 12 | src/lib/supabase/client.ts | 33 |
| 13 | src/lib/customer-order.ts | 32 |
| 14 | src/lib/customer-cart.ts | 28 |
| 15 | src/lib/pricing-config-types.ts | 28 |
| 16 | src/lib/mail/templates/base.tsx | 28 |
| 17 | src/lib/storage/r2-client.ts | 24 |
| 18 | src/lib/order.ts | 23 |
| 19 | src/lib/cron-auth.ts | 22 |
| 20 | src/lib/seo/page-metadata.ts | 20 |
| 21 | src/lib/cron-logger.ts | 19 |
| 22 | src/lib/pricing-engine/index.ts | 18 |
| 23 | src/lib/design-file-types.ts | 17 |
| 24 | src/lib/audit-log-server.ts | 17 |
| 25 | src/lib/supabase/auth-bridge.ts | 16 |
| 26 | src/lib/http/external-timeouts.ts | 16 |
| 27 | src/lib/rate-limit.ts | 15 |
| 28 | src/lib/templates/die-cut-templates.ts | 15 |
| 29 | src/lib/site-url.ts | 15 |
| 30 | src/lib/admin-order-filters.ts | 14 |

## §4 Mega dosyalar (satır — refactor adayları / dikkatli düzenle)
| Dosya | Satır |
|---|---|
| public/poc.html (EDİTÖR ÇEKİRDEĞİ — iframe POC) | 5367 |
| src/lib/supabase/types.ts | 4874 |
| src/app/etiket/yapilandir/page.tsx | 3488 |
| src/app/sticker/yapilandir/StickerConfiguratorClient.tsx | 3276 |
| src/app/onay/[orderId]/page.tsx | 2924 |
| src/app/odeme/page.tsx | 2483 |
| src/app/admin/page.tsx | 2297 |
| src/app/siparis/[id]/page.tsx | 2099 |
| src/lib/mail/notifications.ts | 1765 |
| src/app/admin/siparis-ekle/page.tsx | 1695 |
| src/components/editor/EditorShell.tsx | 1617 |
| src/components/admin/fason/partner-detail-view.tsx | 1576 |
| src/components/admin/pricing/RuloCalculator.tsx | 1523 |
| src/components/admin/pricing/StickerCalculator.tsx | 1510 |
| src/app/panelim/page.tsx | 1390 |
| src/app/admin/ai-qc/page.tsx | 1335 |

## §5 lib/ modül envanteri (dosya sayısı)
- **lib/mail** (41)
- **lib/agents** (33)
- **lib/proof** (17)
- **lib/editor** (15)
- **lib/fason** (15)
- **lib/pim** (11)
- **lib/seo** (11)
- **lib/supabase** (11)
- **lib/payment** (9)
- **lib/storage** (9)
- **lib/pricing-engine** (6)
- **lib/design-preview** (5)
- **lib/search** (5)
- **lib/shipping** (5)
- **lib/analytics** (4)
- **lib/i18n** (4)
- **lib/instagram** (4)
- **lib/auth** (3)
- **lib/admin** (2)
- **lib/http** (2)
- **lib/kvkk** (2)
- **lib/security** (2)
- **lib/sss** (2)
- **lib/support** (2)
- **lib/cart** (1)
- **lib/design** (1)
- **lib/finance** (1)
- **lib/format** (1)
- **lib/hooks** (1)
- **lib/invoice** (1)
- **lib/locations** (1)
- **lib/sms** (1)
- **lib/templates** (1)
- **lib/upload** (1)
- **lib/validation** (1)

## §6 Sabit bilgiler (el ile korunan blok — script üzerine yazar, değişiklikleri scripte işle)
- Marka: mercan #ef3e56 · lacivert #141524 · krem #f5ebd9/#faf4e8 · Nunito · logo public/pim/*.svg (PimAsset.tsx registry)
- Editör: public/poc.html iframe + src/components/editor/EditorShell.tsx · OpenCV main-thread (worker YOK) · denetim: EDITOR-V2-DENETIM-2026-06-10.md (masaüstü)
- Fiyat: 3 AYRI modül (sticker / rulo-etiket / tabaka-etiket) — ASLA karıştırma · pricing_config tek kaynak
- Yasak: cüzdan/puan/üyelik indirimi · persona dropdown · "Bursa" · bot menüsü (CLAUDE.md sefaRules)
- Şema/domain soruları: docs/DOMAIN-SCHEMA-REFERENCE.md + smart-context/manifest.json (/baglam)

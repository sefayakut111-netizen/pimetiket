# Supabase Migration Apply Rehberi — 1 Haziran turu

**Durum:** 128-134 arası 7 migration GIT'te + KOD canlıda, ama **Supabase'de apply EDİLMEDİ.**
Bu yüzden fix'lerin yarısı şu an gerçekte çalışmıyor. Aşağıdaki sırayla apply et.

## ⚠️ Neden acil (apply edilmezse şu an canlıda)
- **128, 129** → P0 güvenlik açıkları HÂLÂ AÇIK (yetki tablosu korumasız + herkes sahte partner kurar)
- **130** → kupon kodu UYGULANMIYOR (kod RPC çağırıyor, RPC yok → indirim kaybolur)
- **134** → müşteri YANLIŞ fiyat görüyor (view yok → fallback fiyata düşüyor, admin'in canlı fiyatı değil)
- 131/132/133 → fix'ler henüz devrede değil (eski davranış sürüyor)

## NASIL APPLY EDİLİR
1. Supabase Dashboard → projen → sol menü **SQL Editor** → **New query**
2. Her migration dosyasının TAM içeriğini kopyala → editöre yapıştır → **Run**
3. "Success. No rows returned" görmen normal (bunlar şema değişikliği).
4. Hata alırsan DURMA — aşağıdaki "Hata olursa" bölümüne bak, bana hata mesajını gönder.

## SIRA (küçükten büyüğe — ZORUNLU sıra)

| Sıra | Dosya | Ne yapıyor | Apply sonrası test |
|---|---|---|---|
| 1 | `128_admin_role_permissions_rls.sql` | Yetki tablosuna RLS | — |
| 2 | `129_partner_create_admin_guard.sql` | Partner oluşturmaya admin guard | /admin'den test partner kur → çalışmalı |
| 3 | `130_fn_apply_coupon_admin.sql` | Atomik kupon RPC | Kuponlu test sipariş → indirim uygulanmalı |
| 4 | `131_proof_sla_proof_uploaded_at.sql` | SLA saati düzeltme | — |
| 5 | `132_fason_token_max_use.sql` | Fason token limiti | — |
| 6 | `133_fn_auto_advance_search_path.sql` | search_path güvenlik | — |
| 7 | `134_pricing_live_view.sql` | Pricing view (fiyat fix) | /sticker → admin'deki canlı fiyat görünmeli (fallback değil) |

Dosya yolları: `pim-etiket/core/storefront/supabase/migrations/`

## ✅ APPLY BİTİNCE — bana "apply bitti" de
O zaman:
1. **types.ts regen** (Görev 8) yaptırırım: `npm run supabase:types` + commit
2. **Görev 9 (manuel sen):** Dashboard → Storage → `design-previews` bucket → Policies:
   - `design_previews_auth_delete` (bucket-only) varsa → **SİL**
   - `design_previews_owner_delete_v2` (path guard'lı) → var mı **doğrula**, yoksa ekle

## Hata olursa (sık görülenler)
- **`42501 insufficient_privilege`** (Storage/role komutu) → 130/132'de olabilir; bana hata satırını gönder, alternatif veririm.
- **`column ... does not exist`** → bir önceki migration apply edilmemiş demektir; sırayı atladın mı kontrol et.
- **`type ... already exists` / `already exists`** → o migration zaten kısmen çalışmış; genelde güvenli, devam et ama bana söyle.
- **`enum ... add value` transaction hatası** (Mig 134 `audit_action`) → ayrı çalıştır: önce sadece `alter type ... add value` satırını Run et, sonra kalan view kısmını.

## NOT
Migration'lar idempotent yazıldı (`if not exists`, `create or replace`, `drop policy if exists`) — yanlışlıkla 2 kez çalıştırsan da çoğu güvenli. Yine de sırayı bozma.

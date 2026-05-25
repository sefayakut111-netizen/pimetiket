# Cursor P2 Görev Listesi — 25 Mayıs 2026

> Bu dosya Claude Code (mimari) tarafından hazırlanmıştır.
> Cursor bu talimatları sırayla uygulayacak.
> Her görev bağımsız commit edilebilir.
> Genel kurallar: CLAUDE.md sefaRules geçerli, cüzdan/puan/üyelik indirimi YASAK.

---

## GÖREV 1/5 — 36 Saat SLA Partner Sisteminde (KRİTİK BUG)

### Sorun

`fn_assign_order_to_fason` (Mig 024, satır 127-136) sipariş status'unu `in_production`'a çekiyor:

```sql
-- Mig 024, satır 127-136
if v_order.status in ('paid', 'qc_pending', 'qc_flagged',
                      'operator_review', 'proof_pending') then
  update public.orders
    set status = 'in_production'
    where id = p_order_id;
```

Ama `fn_process_proof_pending_sla` (Mig 070, satır 41-47) sadece `proof_pending` status'u kontrol ediyor:

```sql
-- Mig 070, satır 41-47
where status = 'proof_pending'
  and proof_uploaded_at is not null
  and proof_uploaded_at < now() - interval '12 hours'
```

**Sonuç:** Bir sipariş `proof_pending` iken partner'a atanırsa, status `in_production` olur ve 36 saat SLA cron'u bu siparişi hiç yakalamaz. Müşteri prova onayı vermese bile otomatik iade yapılmaz.

### Çözüm

Yeni migration dosyası oluştur: `supabase/migrations/095_fix_sla_partner_guard.sql`

```sql
-- ============================================================
-- Migration 095 — fn_assign_order_to_fason: proof_pending guard
--
-- BUG FIX: proof_pending status'undaki siparişler partner'a atanmamalı.
-- Müşteri henüz prova onayı vermemiş — 36 saat SLA aktif.
-- Atama sadece proof_approved veya ready_to_ship'ten yapılabilir.
-- ============================================================

create or replace function public.fn_assign_order_to_fason(
  p_order_id text,
  p_fason_partner_id uuid,
  p_estimated_delivery text default null
)
returns table(
  assignment_id uuid,
  fason_token text,
  order_status_before text,
  order_status_after text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_fason record;
  v_assignment_id uuid;
  v_token text;
begin
  -- Siparişi kilitle
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı: %', p_order_id;
  end if;

  -- ✅ YENİ GUARD: proof_pending siparişler atanmamalı (36sa SLA aktif)
  if v_order.status = 'proof_pending' then
    raise exception 'Sipariş proof_pending durumunda — müşteri onayı bekleniyor, partner ataması yapılamaz. Order: %', p_order_id;
  end if;

  -- Fason partner kontrol
  select * into v_fason
  from public.fason_partners
  where id = p_fason_partner_id
    and status = 'active';

  if not found then
    raise exception 'Aktif fason partner bulunamadı: %', p_fason_partner_id;
  end if;

  -- Sözleşme kontrolü (Mig 086 P0.7)
  if v_fason.contract_signed_at is null and v_fason.contract_pdf_url is null then
    raise exception 'Partner sözleşme imzalamamış: %', p_fason_partner_id;
  end if;

  -- Assignment oluştur
  v_assignment_id := gen_random_uuid();
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.order_assignments (
    id, order_id, fason_partner_id, status, fason_token,
    fason_token_expires_at, estimated_delivery
  ) values (
    v_assignment_id, p_order_id, p_fason_partner_id, 'assigned', v_token,
    now() + interval '14 days',
    p_estimated_delivery
  );

  -- Mail outbox
  insert into public.mail_outbox (
    template_key, recipient_type, recipient_id, metadata
  )
  select 'fason_assignment_' || ct.contact_type,
         'partner_contact', ct.id,
         jsonb_build_object(
           'order_id', p_order_id,
           'partner_name', v_fason.name,
           'token', v_token,
           'estimated_delivery', p_estimated_delivery
         )
  from public.partner_contacts ct
  where ct.partner_id = p_fason_partner_id
    and ct.contact_type in ('operator', 'owner');

  -- Event log
  insert into public.order_events (
    order_id, event_type, status_after, actor_role, summary, detail
  ) values (
    p_order_id, 'fason_assigned', 'fason_assigned', 'system',
    'Sipariş fason partnere atandı: ' || v_fason.name,
    jsonb_build_object(
      'assignment_id', v_assignment_id,
      'fason_id', p_fason_partner_id,
      'fason_name', v_fason.name,
      'estimated_delivery', p_estimated_delivery
    )
  );

  -- Status güncelle — proof_pending ARTIK LİSTEDE YOK
  if v_order.status in ('paid', 'qc_pending', 'qc_flagged',
                        'operator_review', 'proof_approved',
                        'ready_to_ship') then
    update public.orders
      set status = 'in_production'
      where id = p_order_id;
    order_status_after := 'in_production';
  else
    order_status_after := v_order.status;
  end if;

  assignment_id := v_assignment_id;
  fason_token := v_token;
  order_status_before := v_order.status;
  return next;
end;
$$;
```

**Özet değişiklik:** `proof_pending` status'u atama listesinden çıkarıldı + explicit raise exception eklendi.

### Test

Apply sonrası doğrulama:
```sql
-- proof_pending sipariş partner'a atanamaz olmalı:
-- select * from fn_assign_order_to_fason('test-order', 'test-partner-uuid');
-- HATA: "Sipariş proof_pending durumunda" beklenir
```

---

## GÖREV 2/5 — Partner Capabilities Admin Onayı

### Sorun

`partner_capabilities` tablosunda (Mig 067, satır 111-120) `is_verified` kolonu yok. Partner self-declare ediyor, `fn_find_best_partner` direkt kullanıyor → niteliksiz partner'a sipariş gidebilir.

### Çözüm

**Dosya 1:** `supabase/migrations/096_partner_capabilities_approval.sql`

```sql
-- ============================================================
-- Migration 096 — partner_capabilities admin onay mekanizması
-- ============================================================

-- 1) Yeni kolonlar
alter table public.partner_capabilities
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

-- 2) Mevcut kayıtları backfill (mevcut atamalar bozulmasın)
update public.partner_capabilities
  set is_verified = true,
      verified_at = now()
  where is_verified = false;

-- 3) fn_find_best_partner güncellemesi — sadece onaylı capability'ler
-- NOT: Bu fonksiyon Mig 067'de tanımlı. Burada CREATE OR REPLACE ile
-- WHERE koşuluna is_verified = true ekleniyor.
-- Mevcut fn_find_best_partner'ın tam imzası korunmalı.
-- Aşağıdaki sadece WHERE kısmına ek:

-- fn_find_best_partner içindeki capability join'ine ekle:
-- AND pc.is_verified = true

-- ÖNEMLİ: fn_find_best_partner fonksiyonunun tam metnini 067_partner_extension.sql
-- satır 260-310'dan kopyala, WHERE koşuluna `AND pc.is_verified = true` ekle,
-- CREATE OR REPLACE olarak bu migration'a yaz.

-- 4) Lookup index güncelle
drop index if exists partner_capabilities_lookup_idx;
create index partner_capabilities_verified_lookup_idx
  on public.partner_capabilities(capability_type, capability_value)
  where is_verified = true;
```

**ÖNEMLİ:** `fn_find_best_partner` fonksiyonunun TAM METNİNİ `supabase/migrations/067_partner_extension.sql` satır 260-310'dan al, kopyala, sadece capability JOIN/WHERE kısmına `AND pc.is_verified = true` ekle. Fonksiyon imzası ve diğer mantık aynı kalmalı.

**Dosya 2:** `src/app/api/admin/fason/partners/[id]/capabilities/verify/route.ts`

```typescript
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: partnerId } = await params;
  const body = await req.json();
  const { capabilityId, verified } = body as {
    capabilityId: string;
    verified: boolean;
  };

  if (!capabilityId || typeof verified !== "boolean") {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Capability'nin bu partner'a ait olduğunu doğrula
  const { data: cap } = await admin
    .from("partner_capabilities")
    .select("id, partner_id")
    .eq("id", capabilityId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!cap) {
    return NextResponse.json({ error: "Capability bulunamadı" }, { status: 404 });
  }

  const { error } = await admin
    .from("partner_capabilities")
    .update({
      is_verified: verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? auth.user.id : null,
    })
    .eq("id", capabilityId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: auth.user.id,
    actor_role: auth.role,
    action: verified ? "partner_capability_verified" : "partner_capability_unverified",
    resource_type: "partner_capability",
    resource_id: capabilityId,
    metadata: { partner_id: partnerId },
  });

  return NextResponse.json({ ok: true });
}
```

**Dosya 3:** Admin UI güncellemesi — `/admin/fason` partner detay sayfasında her capability satırının yanına:
- `is_verified === true` → yeşil ✅ rozeti + "Onaylı" text
- `is_verified === false` → sarı ⏳ rozeti + "Onayla" butonu
- Buton tıklanınca `POST /api/admin/fason/partners/[id]/capabilities/verify` çağır

Mevcut partner detay sayfasını bul (muhtemelen `/src/app/admin/fason/page.tsx` veya alt sayfası) ve capability listesine bu rozet + buton ekle.

---

## GÖREV 3/5 — Product Cards Encoding Fix (Mig 075 Apply + Client Guard)

### Adım 1: Migration 075'i Uygula

Dosya zaten mevcut: `supabase/migrations/075_product_cards_encoding_fix.sql`

Supabase Dashboard → SQL Editor → dosya içeriğini yapıştır → Run.

Doğrulama:
```sql
SELECT key, title_tr FROM product_cards
WHERE title_tr LIKE '%' || chr(65533) || '%';
-- Boş dönmeli
```

### Adım 2: Client-Side Encoding Guard

`src/app/etiket/page.tsx` ve `src/app/sticker/page.tsx` dosyalarında DB'den gelen kartları kullanan yerde guard ekle:

```typescript
function hasBrokenEncoding(s: string): boolean {
  return s.includes('�') || s.includes('�');
}

function guardCards<T extends { title_tr?: string; desc_tr?: string }>(
  dbCards: T[],
  fallback: T[]
): T[] {
  if (dbCards.length === 0) return fallback;
  const broken = dbCards.some(
    (c) =>
      (c.title_tr && hasBrokenEncoding(c.title_tr)) ||
      (c.desc_tr && hasBrokenEncoding(c.desc_tr))
  );
  return broken ? fallback : dbCards;
}
```

Bu fonksiyonu DB kartlarının kullanıldığı yerde çağır. Her iki sayfada da `RULO_CARDS`, `TABAKA_CARDS`, `STICKER_CARDS` gibi hardcoded fallback array'ler mevcut — onları ikinci parametre olarak ver.

---

## GÖREV 4/5 — Bumper Sticker Render Guard

### Dosya
`src/app/sticker/yapilandir/page.tsx`

### Sorun
URL: `/sticker/yapilandir?form=&shape=bumper` — `form` parametresi boş string gelince render sorunu olabilir.

### Çözüm

Satır ~460 civarı, `searchParams` useEffect içinde `form` parametresi kontrolü ekle:

```typescript
// Mevcut kod (satır ~460-463):
const cut = searchParams.get("cut");
if (cut === "tabaka" || cut === "diecut" || cut === "kisscut") {
  setCutMode(cut);
}

// ÜSTÜNE EKLE — form parametresi boş string guard:
const formParam = searchParams.get("form");
if (formParam !== null && formParam.length === 0) {
  // Boş form parametresi → varsayılan diecut'a düş
  setCutMode("diecut");
}
```

Ayrıca `shape` param kontrolünde (satır ~464-474) geçersiz değer guard'ı ekle:

```typescript
const sp = searchParams.get("shape");
if (sp === "diecut") {
  setShape("die");
} else if (sp && (SHAPE_IDS as readonly string[]).includes(sp)) {
  setShape(sp as ShapeId);
} else if (sp && !(SHAPE_IDS as readonly string[]).includes(sp)) {
  // Geçersiz shape → default square
  setShape("square");
}
```

Ve `initialDims` hesabında (satır ~531-535) SSR guard'ını güçlendir:

```typescript
const initialDims = (() => {
  if (typeof window === "undefined") return { w: 75, h: 75 };
  const urlShape = new URLSearchParams(window.location.search).get("shape");
  if (urlShape === "bumper") return { w: BUMPER_PRESET_WIDTH, h: BUMPER_PRESET_HEIGHT };
  return { w: 75, h: 75 };
})();
```

---

## GÖREV 5/5 — `as never` Type Cast Temizlik

### Bağlam
146 instance / 61 dosya. `types.ts` 24 Mayıs'ta regenerate edildi, doğru tipler mevcut. `as never` artık gereksiz.

### Strateji
Her dosyada `as never` bul → Supabase client call'ındaki tablo adını `Tables<'tablo_adi'>`, `TablesInsert<'tablo_adi'>`, veya `TablesUpdate<'tablo_adi'>` ile değiştir.

### Referans pattern (zaten düzeltilmiş dosya)
`src/app/api/payment/callback/route.ts` — burada `TablesInsert<'payments'>` kullanılıyor.

### Import
```typescript
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
```

### Dosya grupları (öncelik sırasıyla)

**Grup A — Admin API routes (~25 dosya):**
`src/app/api/admin/` altındaki tüm `route.ts` dosyalarında `as never` ara ve düzelt.

**Grup B — Cron routes (~10 dosya):**
`src/app/api/cron/` altındaki tüm `route.ts` dosyalarında `as never` ara ve düzelt.

**Grup C — Lib helpers (~15 dosya):**
`src/lib/` altındaki dosyalarda `as never` ara ve düzelt.

**Grup D — Component dosyaları (~11 dosya):**
`src/components/` ve `src/app/` altındaki page/component dosyalarında `as never` ara ve düzelt.

### Doğrulama
Her grup sonrası:
```bash
npx tsc --noEmit
```
Exit 0 olmalı. Hata çıkarsa tipi düzelt, **`as never` geri ekleme**.

### Yaygın pattern'ler

```typescript
// ESKİ:
await admin.from("orders").update({ status: "cancelled" } as never).eq("id", orderId);

// YENİ:
await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId);

// ESKİ:
await admin.rpc("fn_process_proof_pending_sla" as never);

// YENİ:
await admin.rpc("fn_process_proof_pending_sla");

// Eğer RPC types.ts'te yoksa (eski migration):
// @ts-expect-error — RPC henüz types.ts'te tanımlı değil
await admin.rpc("fn_some_old_rpc");
```

`as never` yerine `@ts-expect-error` SADECE types.ts'te olmayan RPC'ler için kullan. Tablo INSERT/UPDATE/SELECT'lerde hiçbir zaman `as never` kalmamalı.

---

## Uygulama Sırası

1. **Görev 1** — SLA bug fix (migration 095) → en kritik
2. **Görev 2** — Partner capabilities onay (migration 096 + API + UI)
3. **Görev 3** — Encoding fix (migration 075 apply + client guard)
4. **Görev 4** — Bumper guard (tek dosya değişikliği)
5. **Görev 5** — `as never` temizlik (61 dosya, büyük hacim)

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*

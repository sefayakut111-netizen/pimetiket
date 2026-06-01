# Pim Hafıza V2 — Üye sohbet hafızası sunucuya taşınır

Müşteri-Pim'in hafızası cihaza-bağımlıdan (localStorage) sunucu-tabanlıya geçer. Mimari:
`docs/PIM-HAFIZA-V2-MIMARI.md`. **Sistem bunu zaten öngörmüş** — Mig 028 `fn_anonymize_old_pim_conversations()`
stub'ı `pim_conversations` tablosunu bekliyor, Mig 027 KVKK bayrağı `pim_chat` hazır.

## HEDEF (Sefa)
1. **Üye → cihaz bağımsız hafıza** (cihaz değişince unutmasın)
2. **Baştan sarmama** — uzun sohbet özetlenir, bağlam korunur
3. **Logout → ekrandan gizle, sunucuda tut** — tekrar girişte geri gel

## İLKELER (uygula, değiştirme)
- **Anonim = localStorage (MEVCUT, dokunma)** — giriş yapmamış kullanıcı bugünkü davranış aynı.
- **Üye = server-side (yeni)** — login varsa `pim_conversations`.
- **Sefa kuralı:** Pim "Beni hatırla?" diye SORMAZ (sessiz tut, KVKK m.5/2-c). Cüzdan/puan yok.
- Migration: dosya yaz + push, **apply Sefa Supabase'de manuel**. Sıradaki no = `supabase/migrations/` en yüksek (134) + 1 = **135**.

---

## GÖREV 1/6 — Migration: pim_conversations tablosu

#### Yeni: `supabase/migrations/135_pim_conversations.sql`

```sql
-- Mig 135: pim_conversations — üye Pim sohbet hafızası (server-side, cihaz bağımsız)
create table if not exists public.pim_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text,
  facts jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  last_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pim_conversations_user_idx
  on public.pim_conversations(user_id) where user_id is not null;
create index if not exists pim_conversations_updated_idx
  on public.pim_conversations(updated_at);

alter table public.pim_conversations enable row level security;

drop policy if exists "pim_conv_own_select" on public.pim_conversations;
create policy "pim_conv_own_select" on public.pim_conversations
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "pim_conv_own_insert" on public.pim_conversations;
create policy "pim_conv_own_insert" on public.pim_conversations
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "pim_conv_own_update" on public.pim_conversations;
create policy "pim_conv_own_update" on public.pim_conversations
  for update to authenticated using (user_id = auth.uid());

-- updated_at otomatik (mevcut set_updated_at trigger fonksiyonu varsa onu kullan)
drop trigger if exists trg_pim_conv_updated on public.pim_conversations;
create trigger trg_pim_conv_updated before update on public.pim_conversations
  for each row execute function public.set_updated_at();
```

> ÖNCE doğrula: `public.set_updated_at()` fonksiyonu var mı (başka tablolarda kullanılıyor mu)? Yoksa updated_at trigger'ını mevcut projedeki pattern'le yaz veya basit `now()` set eden inline fonksiyon ekle.

**Doğrulama:** Müşteri kendi satırını SELECT/UPDATE eder; başka user'ın satırı 0 döner. Mig 028 `fn_anonymize_old_pim_conversations` artık gerçek tabloda çalışır.

---

## GÖREV 2/6 — API: /api/pim/memory (GET + PUT + migrate)

#### Yeni: `src/app/api/pim/memory/route.ts` (GET, PUT)

- `GET` → `createServerClient()` + `getUser()`; login yoksa 401. Login varsa `pim_conversations`'tan kendi satırı (`select * where user_id=auth.uid() maybeSingle`). Yoksa boş şablon `{displayName:null, facts:[], history:[], lastSummary:null}`.
- `PUT` → body `{displayName?, facts?, history?, lastSummary?}`. **Clamp:** `history` son 40, `facts` son 30, `lastSummary` ≤ 2000 char, her message content ≤ 4000 char. Upsert (`onConflict: user_id`). RLS ikinci kat güvenlik.
- Rate-limit PUT: `pim-mem:${userId}` 30/dk (write spam önle).

#### Yeni: `src/app/api/pim/memory/migrate/route.ts` (POST)

- İlk login'de anonim localStorage snapshot'ı server'a TAŞI (bir kez).
- Body: anonim `{displayName, facts, history}`. Server'da kayıt YOKSA oluştur (merge: anonim geçmiş + boş server). Kayıt VARSA dokunma (zaten taşınmış — duplicate-safe, idempotent).
- `getUser()` zorunlu; clamp aynı kurallar.

**Doğrulama:** `npx tsc` temiz. Login user GET → kendi hafızası; anonim GET → 401. migrate iki kez çağrılınca ikincisi no-op.

---

## GÖREV 3/6 — Provider pattern: pim/memory.ts genişlet

#### Dosya: `src/lib/pim/memory.ts`

Mevcut localStorage fonksiyonları KALIR (anonim). Üstüne provider soyutlaması ekle:

```ts
export interface PimMemoryProvider {
  read(): Promise<PimMemory>;
  appendMessage(msg: Omit<PimMessage, "id" | "createdAt">): Promise<void>;
  upsertFact(fact: Omit<PimFact, "learnedAt">): Promise<void>;
  setSummary(summary: string): Promise<void>;
}
```

- `LocalMemoryProvider` — mevcut sync fonksiyonları Promise'e sarar (anonim).
- `ServerMemoryProvider` — `/api/pim/memory` GET/PUT çağırır; local bir cache + debounced PUT (her mesajda ağ çağrısı yapma, ~1sn debounce ile batch yaz).
- `getPimMemoryProvider(isAuthenticated: boolean)` factory.

> Kod yorumu zaten diyor (memory.ts:11): "Auth + Supabase geldiğinde aynı interface ile server-side memory'ye geçecek." Bu o geçiş — interface'i koru.

**Doğrulama:** Anonim akış birebir eski davranış; üye akış server'a yazıp okur.

---

## GÖREV 4/6 — Sohbet özeti (baştan sarmama)

#### Yeni: `src/app/api/pim/summarize/route.ts` (POST) + PimChat tetik

`lastConversationSummary` alanı VAR (`personas.ts:432` prompt'a enjekte ediliyor) ama dolduran kod YOK.

- `history` uzunluğu **20 mesajı** aşınca: en eski ~yarısını `gpt-4o-mini` ile 2-3 cümle özetle (Türkçe, marka sesi kısa). Mevcut `last_summary` varsa onu da bağlama kat (kümülatif özet).
- Özet → `last_summary`'ye yaz, özetlenen mesajları history'den düş (provider üzerinden).
- Tetik: `PimChat onFinish`'te history uzunluğu kontrol → eşik aşılırsa **arka planda** summarize (kullanıcıyı bekletme, `void`).
- Maliyet: ~$0.0001/özet (mini, seyrek). System prompt: "Bu sohbeti 2-3 cümlede özetle, müşterinin tercihleri + bağlam. Dalkavuk yok, kısa."

**Doğrulama:** 25 mesajlık sohbette eski mesajlar özetlenir; Pim sonraki yanıtta bağlamı korur (özet prompt'a girer).

---

## GÖREV 5/6 — PimChat.tsx: provider + logout + ilk-login migrate

#### Dosya: `src/components/pim/PimChat.tsx`

- **Mount** (satır ~174): `getUser()` ile login kontrol → provider seç (`getPimMemoryProvider`). `readMemory()` doğrudan çağrıları provider'a çevir.
- **prepareSendMessagesRequest** (satır ~137): memory snapshot provider'dan (`await provider.read()` → snapshot).
- **onFinish** (satır ~149): `appendMessage` → `provider.appendMessage`. Sonra history eşik kontrolü → gerekirse `void summarize()`.
- **İlk login:** auth state "signed in"e geçince + server kaydı boşsa → `POST /api/pim/memory/migrate` (anonim localStorage'ı bir kez taşı), sonra ServerProvider'a geç.
- **Logout hook:** auth state "signed out"a düşünce:
  - `setMessages([])` (ekranı temizle)
  - provider'ı Local'e çevir
  - **ÜYE geçmişini ekrandan kaldır** ama server'da DOKUNMA (tekrar girişte geri gelir)
  - Anonim localStorage ayrı kalır (varsa)

> Supabase auth state dinleme: `supabase.auth.onAuthStateChange` (client). Mevcut auth context/hook varsa onu kullan.

**Doğrulama (canlı):** Üye giriş → sohbet → logout → pencere temizlenir (anonim Pim) → tekrar giriş → **geçmiş geri gelir**. Farklı cihazda giriş → aynı geçmiş.

---

## GÖREV 6/6 — KVKK silme bağlama

#### Dosya: `/ayarlar/verilerim` ilgili silme endpoint'i + Mig 027 bayrağı

- "Pim sohbet geçmişim" granular silme → `pim_conversations` DELETE (`where user_id=auth.uid()`).
- Mig 027 KVKK silme bayrağı `pim_chat:true` geldiğinde bu DELETE tetiklensin (mevcut silme akışına bağla).
- KVKK aydınlatma `/kvkk` Bölüm 6 "Pim asistanı sohbet geçmişi" zaten listeli — METNE DOKUNMA.

**Doğrulama:** `/ayarlar/verilerim`'den Pim geçmişi silme → server kaydı gider; sonraki sohbet sıfırdan.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` sonra `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "feat(pim): hafiza V2 — uye server-side memory + sohbet ozeti + logout gizle/sunucuda tut + KVKK silme"`
4. `git push origin main` → Vercel deploy.
5. **Migration (Görev 1):** push edildi, **Supabase'de apply EDİLMEDİ** → Sefa'ya bildir: "Mig 135 Studio'da apply et."
6. Deploy READY → commit hash + canlı URL + apply bekleyen Mig 135 bildir.

> Git kökü `pim-etiket/core/`. Anonim akış bozulmamalı (regresyon testi: çıkışta Pim hâlâ çalışır).
> Sefa canlıda test: üye giriş→sohbet→logout→tekrar giriş geçmiş geri geliyor mu + farklı cihaz.

## DOSYA LİSTESİ
**Yeni:** `135_pim_conversations.sql`, `api/pim/memory/route.ts`, `api/pim/memory/migrate/route.ts`, `api/pim/summarize/route.ts`
**Düzenlenecek:** `lib/pim/memory.ts` (provider), `components/pim/PimChat.tsx` (provider+logout+migrate), `/ayarlar/verilerim` silme (KVKK), Mig 027 silme akışı bağlama

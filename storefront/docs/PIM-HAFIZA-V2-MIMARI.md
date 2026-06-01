# Pim Hafıza V2 — Mimari Tasarım

> Müşteriyle konuşan Pim'in hafızasını cihaza-bağımlıdan sunucu-tabanlıya taşır.
> Hedef: üye → cihaz bağımsız hatırlama + baştan sarmama (özet) + logout'ta ekrandan gizle/sunucuda tut.
> Sistem bunu zaten ÖNGÖRMÜŞ: Mig 028 `fn_anonymize_old_pim_conversations()` stub'ı `pim_conversations`
> tablosunu bekliyor; KVKK silme bayrağı `pim_chat: false` (Mig 027) hazır.

## Sorun (gerçek kod)

- `PimChat.tsx` hafızayı **her zaman** `readMemory()` ile localStorage'dan çekiyor — login durumu HİÇ kontrol edilmiyor.
- Server-side `pim_conversations` tablosu **yok** (Mig 028 stub tablo gelince çalışacak şekilde bekliyor).
- `lastConversationSummary` alanı **var ama dolduran kod yok** → uzun sohbette MAX_HISTORY=40 üstü sessizce düşüyor (Pim bağlam kaybediyor).
- `upsertFact` tanımlı ama LLM "şunu hatırla" akışı bağlanmamış → Pim gerçekten öğrenmiyor.

## Tasarım ilkeleri

1. **Anonim = localStorage (mevcut, dokunma).** Giriş yapmamış kullanıcı için bugünkü davranış aynı kalır.
2. **Üye = server-side (yeni).** Login varsa hafıza `pim_conversations` tablosundan; cihaz bağımsız.
3. **Login geçişinde merge.** Anonim localStorage geçmişi, ilk login'de server'a bir kez taşınır (kayıp olmasın).
4. **Logout = ekrandan gizle, sunucuda tut.** Sohbet penceresi temizlenir, anonim Pim'e döner; geçmiş server'da kalır, tekrar girişte geri gelir. (Sefa kararı.)
5. **Özet = baştan sarmama.** Sohbet uzayınca eski mesajlar mini-LLM ile özetlenir; prompt'a "geçmiş özeti + son N mesaj" gider. Maliyet kontrollü.
6. **KVKK uyumlu.** Silme `/ayarlar/verilerim` → `pim_chat:true` bayrağı + Mig 028 anonimleştirme. 6 ay anonim / 24 ay sil (mevcut politika).
7. **Sefa kuralları korunur.** "Beni hatırla?" diye SORMAZ (sessiz tut, m.5/2-c). Cüzdan/puan yok.

---

## 1) DB katmanı — yeni migration `<N>_pim_conversations.sql`

```sql
-- pim_conversations: üye Pim sohbet hafızası (server-side, cihaz bağımsız)
create table if not exists public.pim_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- NULL = anonimleştirilmiş (Mig 028)
  display_name text,
  facts jsonb not null default '[]',           -- [{key,value,learnedAt}] — max 30 (app cap)
  history jsonb not null default '[]',          -- [{role,content,persona,createdAt}] — son N (app cap)
  last_summary text,                            -- eski mesajların LLM özeti
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pim_conversations_user_idx
  on public.pim_conversations(user_id) where user_id is not null;
create index if not exists pim_conversations_updated_idx
  on public.pim_conversations(updated_at);

alter table public.pim_conversations enable row level security;

-- Müşteri sadece KENDİ kaydını okur/yazar
drop policy if exists "pim_conv_own_select" on public.pim_conversations;
create policy "pim_conv_own_select" on public.pim_conversations
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "pim_conv_own_upsert" on public.pim_conversations;
create policy "pim_conv_own_insert" on public.pim_conversations
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "pim_conv_own_update" on public.pim_conversations;
create policy "pim_conv_own_update" on public.pim_conversations
  for update to authenticated using (user_id = auth.uid());

-- updated_at trigger (mevcut moddu_at trigger pattern'i varsa onu kullan)
```

> Mig 028 `fn_anonymize_old_pim_conversations()` ZATEN bu tabloyu bekliyor — tablo gelince otomatik çalışır
> (6 aydan eski → user_id NULL). Mig 027 KVKK silme bayrağı `pim_chat` → bu tabloya delete bağlanır.
> RLS: müşteri kendi satırı; admin/service-role bypass (silme/anonimleştirme RPC'leri için).

---

## 2) API katmanı — `/api/pim/memory` (yeni)

| Method | İş |
|---|---|
| `GET /api/pim/memory` | Login user'ın `pim_conversations` satırını döndür (yoksa boş). `getUser()` ile auth; RLS zaten korur. |
| `PUT /api/pim/memory` | Upsert: history + facts + display_name + last_summary kaydet. Body app cap'lerine clamp'lenir (history ≤ 40, facts ≤ 30, summary ≤ 2KB). |
| `POST /api/pim/memory/migrate` | İlk login'de anonim localStorage snapshot'ı server'a bir kez taşı (merge, duplicate-safe). |

- Hepsi `createServerClient()` + `getUser()` — anonim çağrı 401, RLS ikinci kat güvenlik.
- Rate-limit: PUT için makul (write spam önle).

---

## 3) Memory katmanı — `pim/memory.ts` genişlet (provider pattern)

Mevcut localStorage fonksiyonları KALIR (anonim). Üstüne **storage provider** soyutlaması:

```ts
// Login durumuna göre backend seç — interface aynı, kaynak değişir
interface PimMemoryProvider {
  read(): Promise<PimMemory>;
  appendMessage(msg): Promise<void>;
  upsertFact(fact): Promise<void>;
  setSummary(s: string): Promise<void>;
}
// LocalMemoryProvider (mevcut, anonim) | ServerMemoryProvider (yeni, üye, /api/pim/memory)
```

- `PimChat` mount'ta: `getUser()` → varsa ServerProvider, yoksa LocalProvider.
- Kod yorumu zaten diyor: *"Auth + Supabase geldiğinde aynı interface ile server-side memory'ye geçecek"* — bu o geçiş.

---

## 4) Sohbet özeti — baştan sarmama (`/api/pim/summarize` veya onFinish hook)

- Sohbet `history` belli eşiği (ör. 20 mesaj) aşınca: en eski yarıyı `gpt-4o-mini` ile **2-3 cümle özetle** → `last_summary`'ye yaz, o mesajları history'den düş.
- `buildSystemPromptWithMemory` zaten `lastConversationSummary`'yi prompt'a enjekte ediyor (personas.ts:432) — sadece DOLDURAN kod eksik.
- Maliyet: özet ~$0.0001/sohbet (mini, seyrek). `ai_cost` auditor izler.
- Tetik: `onFinish`'te history uzunluğu kontrol → eşik aşılırsa arka planda summarize (kullanıcıyı bekletme).

---

## 5) PimChat.tsx değişiklikleri

- Mount: login kontrolü → provider seç (satır 174 civarı `readMemory` → `provider.read()`).
- `onFinish` (satır 149): `appendMessage` → `provider.appendMessage` (üyede server'a yazar).
- `prepareSendMessagesRequest` (satır 137): memory snapshot provider'dan.
- **Logout hook:** auth state "signed out"a düşünce → `setMessages([])` + provider'ı Local'e çevir + localStorage'daki ÜYE geçmişini temizleme (server'da kalır). Anonim localStorage ayrı kalır.
- İlk login: `migrate` endpoint'i bir kez çağır (anonim geçmişi server'a taşı), sonra ServerProvider.

---

## 6) KVKK entegrasyonu

- `/ayarlar/verilerim` → "Pim sohbet geçmişim" granular silme → `pim_conversations` DELETE (Mig 027 bayrağı `pim_chat:true`).
- Mig 028 `fn_anonymize_old_pim_conversations()` artık gerçek tabloda çalışır (tablo geldi). İçindeki STUB notu kaldırılıp content regex maskeleme tamamlanabilir (opsiyonel, ayrı iş).
- KVKK aydınlatma `/kvkk` Bölüm 6 zaten "Pim asistanı sohbet geçmişi" kategorisini listeliyor — metin güncel, dokunma.

---

## Kapsam dışı (bu iş DEĞİL — sonraki dalga)
- Pim'in daha çok "iş yapması" (tasarım yükleme tetikleme vb.)
- Proaktif Pim (sormadan yardım önerme)
- Editör-Pim komut entegrasyonu (`PIM-EDITOR-KOMUT-SPEC.md` ayrı)
- `upsertFact`'in LLM-driven "şunu hatırla" akışı (bu mimari fact ALTYAPISINI kurar; LLM'in fact çıkarması ayrı küçük iş — istersen ekleriz)

## Cursor teslim sırası (tek prompt, 6 parça)
1. Migration (`pim_conversations` + RLS) → **Sefa apply**
2. `/api/pim/memory` GET/PUT/migrate
3. `pim/memory.ts` provider pattern
4. Özet akışı (`onFinish` + mini-LLM)
5. `PimChat.tsx` provider + logout hook + ilk-login migrate
6. KVKK silme bağlama

> Her parça file:line'lı Cursor prompt'una dökülecek. Migration apply Sefa'da. Commit+push+canlı kuyruğu ([[cursor-commit-tail]]).

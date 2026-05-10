# Pim AI Agent — Mimari ve Roadmap

**Tarih**: 2026-05-09
**Durum**: Faz 1 (Karşılama Pim + memory) **CANLI** — `OPENAI_API_KEY` set edildiğinde çalışır

---

## Vizyon

Pim Etiket'in baykuş maskotu Pim, sadece bir görsel değil — **A'dan Z'ye süreç yöneten bir ekip**:

| Persona | Rol | Faz |
|---|---|---|
| **Pim** (Karşılama) | Concierge — niyeti anlar, devreder | ✅ Faz 1 |
| **Tasarımcı Pim** | Konfigürasyon + brief çevirici | Faz 2 |
| **Operatör Pim** | Sorun/şikayet çözüm | Faz 3 |
| **Kargocu Pim** | Sipariş takibi | Faz 3 |
| **Ustabaşı Pim** | Üretim durumu, prova | Faz 3 |
| **Muhasebeci Pim** | Fatura, ödeme, iade | Faz 4 |
| **Mevzuat Pim** | Etiket içerik mevzuatı denetimi (3rd-party uzmanlık köprüsü) | Faz 4+ |

Brand voice: **Bursa esnaf samimiyeti** — sıcak ama mesafeli, "sen", abartısız, eğlenceli ama profesyonel. Emoji minimum.

---

## Faz 1 — Şu anki canlı

### Müşteri deneyimi

1. Site açılınca sağ alt köşede **floating Pim butonu** belirir (mercan daire + baykuş ikon).
2. Tıklanınca panel açılır (380×560 mobil-aware).
3. İlk açılışta **KVKK consent** sorulur:
   > "Selam! Tanışalım mı? Sohbet ettiklerimizi tarayıcında tutarsam, bir dahaki gelişinde hatırlarım…"
   - **Tamam, hatırla** → memory aktif
   - **Şimdilik gerek yok** → memory kapalı, sohbet hâlâ çalışır
4. Welcome ekranı: kişiselleştirilmiş selam + 3 chip:
   - Yeni iş / Tekrar baskı / Sorun var
5. Streaming chat → GPT-4o cevaplar canlı akar.
6. Returning user → "Selam Ahmet, hoş geldin tekrar" + son sohbet özeti context'e injekte.

### Teknik mimari

```
storefront/
├── src/lib/pim/
│   ├── personas.ts         ← 7 persona spec, system prompts, BRAND_VOICE
│   └── memory.ts           ← localStorage backend, swap-ready interface
├── src/app/api/pim/chat/
│   └── route.ts            ← POST endpoint, streamText + GPT-4o
└── src/components/pim/
    └── PimChat.tsx         ← floating bubble + panel + composer
```

**Stack**:
- LLM: **GPT-4o** (`@ai-sdk/openai`)
- Streaming: **Vercel AI SDK v6** (`ai`, `@ai-sdk/react`)
- Memory: **localStorage** (anonim user, KVKK opt-in)
- UI: Tailwind 4 + mevcut design tokens (mercan/lacivert)

**Memory schema (localStorage)**:
```ts
{
  userId: string,           // UUID, ilk kullanımda generate
  consent: boolean,         // KVKK opt-in
  consentAt?: number,
  displayName?: string,
  facts: Array<{key, value, learnedAt, source}>,
  history: Array<{role, content, persona, createdAt}>,
  lastConversationSummary?: string,
}
```

**Caps**:
- `MAX_FACTS = 30`
- `MAX_HISTORY = 40`

---

## Faz 1 — Devreye alma

### 1. OpenAI API key

```bash
# storefront/.env.local
OPENAI_API_KEY=sk-proj-...
```

`.env.example` template'inde key var. Production deploy'da Cloudflare/Vercel env'e eklenir.

### 2. Test akışı

1. `npm run dev` → http://localhost:3000
2. Sağ alt mercan butona tıkla
3. Consent → "Tamam, hatırla"
4. Chip'lere bas veya "Adım Sefa, kahve markası için etiket istiyorum" yaz
5. Pim cevap verir (streaming)
6. Sayfayı yenile → "Selam Sefa, hoş geldin tekrar" + son chat'i hatırlar

### 3. Maliyet tahmini (GPT-4o)

- Input: $2.50 / 1M token
- Output: $10 / 1M token
- Ortalama sohbet: ~2K input + 500 output → **~$0.0095/sohbet**
- 1000 müşteri/ay × 3 sohbet → **~$28.5/ay** (oturmuş trafik)

---

## Faz 2 — Tasarımcı Pim (sıradaki)

**Kapsam**:
- /etiket ve /sticker configurator entegrasyonu
- "Brief çevirici": düz metin → otomatik konfigürasyon
- Persona handoff (welcome → designer)
- Kostüm overlay (palette + boya fırçası)

**Tools** (function calling):
- `set_configurator(material, coating, qty, ...)` — configurator state'i değiştir
- `generate_mockup(file_url)` — Replicate/Stability ile mockup
- `vectorize_logo(file_url)` — raster→SVG

**Ek altyapı**: `@ai-sdk/openai` tool calling, configurator Zustand store (mevcut state'i Pim'e açma).

---

## Faz 3 — Operatör + Kargocu + Ustabaşı

I adımı backend bağlandıktan sonra:
- Sipariş lookup tool
- Kargo takip API'si
- Üretim durumu (medusa fason-routing modülü)

---

## Faz 4 — Muhasebeci + Mevzuat

- Fatura/iade entegrasyonu
- **Mevzuat denetim köprüsü** (3rd-party servis): müşteri etiket dosyası yükler → Pim Etiket pre-press kontrol + harici mevzuat kontrol → birleşik rapor

---

## Server-side memory (auth + Supabase sonrası)

Storefront `localStorage` backend'i geçici. I adımında:
- Auth bağlandığında `customer_id` üzerinden `pim_user_profile` upsert
- `medusa/src/modules/pim-memory/` modülü scaffold edildi (5 model)
- LocalStorage'taki anonim user → ilk login'de profile'a migrate
- Server-side recall: `getProfileByCustomerId(id)` → API route memory snapshot inject

**Tablolar (medusa pim-memory module)**:
1. `pim_user_profile` — 1 satır/customer (ad, marka, sektör, ton, last_seen)
2. `pim_user_fact` — N satır (key, value, confidence, source)
3. `pim_conversation` — sohbet oturumları
4. `pim_message` — transcript (ileride pgvector embedding eklenecek)
5. `pim_consent` — KVKK audit log

---

## Bilinçli atlananlar (şimdilik scope-out)

- Ses (ElevenLabs) — Faz 4+
- Voice input (Whisper) — Faz 4+
- Lottie animation kostüm değişimi — Faz 2 ile
- Multilingual — TR-only, scope-out
- Tool calling — Faz 2 ile aktif

---

## Dosyalar

| Dosya | Satır | Açıklama |
|---|---|---|
| `storefront/src/lib/pim/personas.ts` | 175 | 7 persona spec + brand voice + KB |
| `storefront/src/lib/pim/memory.ts` | 175 | localStorage backend |
| `storefront/src/app/api/pim/chat/route.ts` | 70 | streamText endpoint |
| `storefront/src/components/pim/PimChat.tsx` | 380 | Bubble + panel + composer |
| `storefront/src/components/Icon.tsx` | +Icon.X | Close ikon |
| `storefront/src/components/layout/AppShell.tsx` | +PimChat mount | |
| `medusa/src/modules/pim-memory/` | scaffold | 5 model + service |

**Toplam yeni LOC**: ~900

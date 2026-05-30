# Operasyon Kuyruğu (Unified Inbox) — Mimari Spec

> En yüksek değerli yeni özellik. Sefa 6 sayfa gezerek "ne acil?" buluyor — bu tek sayfada bitsin.
> Sayfa: `/admin/kuyruk` (yeni) — sidebar'da en üstte
> Bu bir AGGREGATE sayfası: yeni veri üretmez, mevcut kaynakları tek akışta toplar.

---

## AMAÇ

Operatör sabah panele girince **tek ekranda** görmeli:
- Hangi sipariş AI QC bekliyor
- Hangi prova SLA aşmak üzere
- Hangi sipariş fasona atanmamış
- Hangi sipariş kargo etiketi bekliyor
- Hangi destek/yardım talebi açık

Her satır **tıklanabilir → ilgili sayfaya/aksiyona** götürür. Amaç: "ne acil" sorusunu **5 saniyede** cevaplamak.

---

## VERİ KAYNAKLARI (mevcut, yeni tablo yok)

| Kuyruk tipi | Kaynak | Kriter |
|-------------|--------|--------|
| AI QC bekleyen | `orders` / `ai_qc_decisions` | status=`qc_pending` veya AI verdict bekleyen |
| Prova SLA riski | `orders` | status=`proof_pending` AND (now - proof_sent_at) > 24h (36h'de iade!) |
| Fason atanmamış | `orders` / `order_assignments` | status=`production_pending` AND assignment yok |
| Kargo bekleyen | `orders` | status=`ready_to_ship` AND tracking_no yok |
| Açık destek | `support` + `help_requests` | status=`open` |
| Onay bekleyen yorum | `reviews` | status=`pending` |
| Onay bekleyen yetenek | `partner_capabilities` | approval_status=`pending` (Mig 117) |

---

## GÖREV 1/4 — Aggregate API

### Dosya: `src/app/api/admin/operation-queue/route.ts` (YENİ)

```typescript
// GET /api/admin/operation-queue
// assertPermission("dashboard", "view")
// Her kuyruk için DB-side COUNT + en acil ilk 5-10 kayıt
// Tek round-trip — paralel Promise.all ile her kuyruğu çek

interface QueueItem {
  id: string;            // order_id veya ilgili kayıt id
  type: 'ai_qc' | 'proof_sla' | 'fason_unassigned' | 'shipping' | 'support' | 'review' | 'capability';
  title: string;         // "#00001245 - Swiss Thermo"
  subtitle?: string;     // "Kuşe / 500 adet"
  urgency: 'critical' | 'warning' | 'normal';  // SLA'ya göre
  ageHours?: number;     // ne kadardır bekliyor
  deadline?: string;     // ISO — SLA bitiş (proof için 36h)
  href: string;          // tıklayınca gidilecek (/admin/ai-qc?order=X)
  actionLabel?: string;  // "İncele" / "Ata" / "Etiket bas"
}

interface OperationQueueResponse {
  counts: Record<QueueItem['type'], number>;   // her kuyrukta kaç var
  items: QueueItem[];                           // birleşik, urgency+age'e göre sıralı
  generatedAt: string;
}
```

**Önemli:**
- Her kuyruk için **DB-side WHERE + COUNT** — client'a 500 kayıt çekme YOK (siparişler sayfasının hatası)
- `Promise.all` ile 7 kuyruğu paralel çek
- SLA hesabı server-side (proof_pending için: `now - proof_sent_at`, 36h kritik eşik)
- Toplam item listesi urgency DESC → ageHours DESC sıralı, her tipten max 10

---

## GÖREV 2/4 — Kuyruk Sayfası UI

### Dosya: `src/app/admin/kuyruk/page.tsx` (YENİ)

```
┌─ Operasyon Kuyruğu ──────────────────── [↻ 30s] ─┐
│                                                    │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│ │ 3  │ │ 7  │ │ 2  │ │ 5  │ │ 4  │ │ 1  │       │
│ │AIQC│ │Prova│ │Fason│ │Kargo│ │Dest│ │Yorum│    │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘       │
│  (tıklanınca o kuyruğa filtrele)                  │
│                                                    │
│ ── ACİL (SLA riski) ──────────────────────────── │
│ 🔴 Prova · #00001240 · 34s bekliyor · 2s'de iade!│
│    Swiss Thermo · Kuşe          [Müşteriye yaz →] │
│ 🔴 Prova · #00001238 · 33s bekliyor              │
│                                  [Hatırlat →]      │
│                                                    │
│ ── BUGÜN YAPILACAK ──────────────────────────── │
│ 🟡 AI QC · #00001245 · 2s bekliyor [İncele →]    │
│ 🟡 Fason · #00001243 · atanmadı   [Ata →]        │
│ 🟡 Kargo · #00001230 · etiket yok [Etiket bas →] │
│                                                    │
│ ── NORMAL ─────────────────────────────────────  │
│ ⚪ Destek · Ali V. · "provamda sorun" [Yanıtla →]│
│ ⚪ Yorum · onay bekliyor           [Onayla →]    │
└────────────────────────────────────────────────────┘
```

### Davranış
- **Üst KPI kartları:** her kuyruktan sayı, tıklanınca o tipe filtre
- **3 grup:** Acil (critical) / Bugün (warning) / Normal — urgency'ye göre otomatik
- **Her satır tıklanabilir** → `href`'e git, aksiyon butonu doğrudan ilgili akış
- **30sn auto-refresh** (operatör ekranı açık tutar)
- **Boş durum:** "🎉 Kuyruk temiz! Bekleyen acil iş yok."
- Test verisi filtresi aktif (`excludeTestOrders`)

### SLA renk kuralı (proof için kritik)
- `> 30h` → 🔴 kritik (36h'de otomatik iade)
- `> 18h` → 🟡 uyarı
- `< 18h` → ⚪ normal

---

## GÖREV 3/4 — Sidebar Entegrasyonu

### Dosya: `AdminShell.tsx` (veya sidebar component)

- "Operasyon Kuyruğu" girişini **OPERATÖR MODU grubunun en üstüne** ekle (Panel'den önce)
- Badge: toplam acil (critical) sayısı — kırmızı rozet
- Badge sayısı `operation-queue` API'den (counts toplamı, critical olanlar)
- İkon: inbox/liste ikonu

---

## GÖREV 4/4 — Dashboard'dan Link

### Dosya: `src/app/admin/page.tsx`

Dashboard'daki mevcut "todo" / "acil sıra" bölümünü **kuyruk sayfasına yönlendir**:
- "Tüm acil işleri gör →" linki `/admin/kuyruk`'a
- Dashboard'da sadece **özet sayılar** kalsın (3 AI QC, 7 prova vb.), detay kuyrukta
- Mükerrer hesaplama yapma — dashboard da `operation-queue` API'sini çağırabilir

---

## TEST PLANI

| Test | Beklenen |
|------|----------|
| 5 farklı statüde sipariş | Her biri doğru kuyrukta |
| Prova 34h bekleyen | 🔴 kritik, "2s'de iade" uyarısı |
| Atanmamış production_pending | Fason kuyruğunda + "Ata" butonu |
| Boş sistem | "Kuyruk temiz" mesajı |
| Satır tıkla | İlgili sayfaya gider |
| Test siparişi | Kuyrukta görünmez (filtre) |

---

## UYGULAMA SIRASI

1. Görev 1 — Aggregate API (45 dk) — DB-side, paralel, SLA hesabı
2. Görev 2 — Kuyruk sayfası UI (60 dk)
3. Görev 3 — Sidebar + badge (15 dk)
4. Görev 4 — Dashboard link (15 dk)

**Toplam: ~2.5 saat**

Her görev sonrası `npx tsc --noEmit` + commit. Önek: `feat(admin):`

## NOTLAR
- **Yeni tablo YOK** — sadece mevcut kaynaklardan aggregate
- **DB-side COUNT + WHERE** — client'a toplu kayıt çekme yok (ölçek dersi)
- `assertPermission("dashboard", "view")` — operatör görebilmeli
- CLAUDE.md sefaRules geçerli
- SLA eşikleri: prova 36h iade kuralı kodda mevcut (`auto-refund` cron) — aynı eşiği kullan

---
description: Son kod değişikliklerini 4 uzman perspektifinden paralel denetler — Mühendis, Güvenlik & Uyum, Deneyim & Görsel, Marka Sesi. Smart trigger ile değişiklik tipine göre uygun agent'ları çağırır.
---

## Pim Etiket — 4-Perspektif Denetim

Kullanıcı `/denetle [hedef]` çağırdığında bu workflow çalışır:

### 1) Hedef tespiti

Argüman yoksa son commit otomatik denetlenir:
```bash
git log -1 --stat
git diff HEAD~1
```

Argüman varsa:
- `/denetle src/app/etiket/page.tsx` → tek dosya
- `/denetle son commit` → HEAD vs HEAD~1
- `/denetle son 3 commit` → HEAD vs HEAD~3
- `/denetle anasayfa` → `src/app/page.tsx` + layout component'ları
- `/denetle muhendis` → SADECE Mühendis agent (filtre modu)
- `/denetle guvenlik` → SADECE Güvenlik & Uyum
- `/denetle deneyim` → SADECE Deneyim & Görsel
- `/denetle marka` → SADECE Marka Sesi
- `/denetle muhendis+guvenlik` → çoklu seçim

### 2) Smart Trigger Mantığı (filtre verilmediyse otomatik seçim)

Son commit'in dosya tipini analiz et, ilgili agent'ları çağır:

| Değişiklik tipi | Mühendis | Güvenlik | Deneyim | Marka |
|---|:---:|:---:|:---:|:---:|
| Migration / RPC / DB | ✅ | ✅ | — | — |
| API endpoint (route.ts) | ✅ | ✅ | — | — |
| Yeni component (UI) | ✅ | — | ✅ | ✅ |
| Yeni sayfa | ✅ | ✅ | ✅ | ✅ |
| Sadece copy/text değişiklik | — | — | — | ✅ |
| Pim system prompt | — | — | — | ✅ |
| Yasal sayfa (KVKK/Mesafeli/Cayma) | — | ✅ | — | ✅ |
| Auth / login akışı | ✅ | ✅ | ✅ | ✅ |
| Configurator (etiket/sticker) | ✅ | — | ✅ | ✅ |
| Admin paneli | ✅ | ✅ | ✅ | — |
| Yeni feature (>500 satır toplam) | ✅ | ✅ | ✅ | ✅ |
| Sadece i18n çevirisi | — | — | — | ✅ |
| .gitignore / config dosyası | ✅ | ✅ | — | — |

**Belirsizse** veya komutu açıkça verilmediyse **4 agent hepsi** çalışır.

### 3) Paralel agent spawn

**Tek mesajda, çoklu Agent tool call** ile paralel spawn et:

```
Agent(muhendis, prompt: "[hedef] üzerinde mühendislik denetimi yap...")
Agent(guvenlik-uyum, prompt: "[hedef] üzerinde güvenlik + KVKK + TKHK + telif denetimi yap...")
Agent(deneyim-gorsel, prompt: "[hedef] üzerinde UX + UI + tasarım denetimi yap...")
Agent(marka-sesi, prompt: "[hedef] üzerinde marka sesi + yasak kelime + Pim ton denetimi yap...")
```

Her agent'a prompt verirken **hedefi spesifik söyle** (dosya yolu, commit hash, vb).

### 4) Sonuçları birleştir — Konsolide Rapor

```markdown
# 🔬 Pim Etiket Denetim Raporu

**Hedef:** [dosya/commit]
**Tarih:** [bugün]
**Çalışan agent'lar:** [hangi 4'ünden N'i çalıştı, hangileri smart trigger ile atlandı]

## 🚨 Kritik (P0 — acil)
Her agent'ten gelen P0 bulgular birleştirilmiş:
- **[🛠️/🔒/🎨/💬 Kategori]** Sorun — etkisi — düzeltme önerisi (süre tahmini)

## ⚠️ Öneri (P1 — yapılmalı)
- ...

## 💡 Not (P2 — gözlem)
- ...

## ✅ Doğru yapılanlar
- ...

## 📊 Skor (10 üzerinden)
- 🛠️ Mühendis: X/10
- 🔒 Güvenlik & Uyum: X/10
- 🎨 Deneyim & Görsel: X/10
- 💬 Marka Sesi: X/10
- **Genel: ((toplam)/N).toFixed(1)/10**

## 🎯 Aksiyon Listesi
**🔴 Şimdi düzelt (P0):**
1. [...] — tahmini X dk

**🟡 Bu sprintin sonuna (P1):**
1. [...] — X sa

**🟢 Backlog (P2):**
1. [...]
```

### 5) Tekrar Eden Bulgu Birleştirme

Eğer aynı satırı/dosyayı birden fazla agent flagged ediyorsa **tek bulgu** olarak birleştir, kaynaklarını listele:

```
- **[Dosya:satır]** Sorun (🛠️ Mühendis + 🎨 Deneyim ortak)
```

### 6) Maliyet & Süre Logu

Raporun en altında:
```
> Çalışan agent: 4/4 (full audit)
> Toplam süre: ~X dakika
> Tahmini token: ~Y K
```

### Kurallar

- **Agent'lar paralel spawn** (tek mesajda, multiple Agent calls).
- **Sonuçları sentezle**, ham çıktı pasta yapma.
- **Tekrar eden bulguları birleştir** (3 agent aynı satıra flagged → 1 bulgu).
- **Türkçe rapor.**
- **Aksiyon listesi ZORUNLU** (kullanıcı ne yapacağını bilmeli).
- **Skor verir, mock skor değil** — gerçek değerlendirme.
- **Smart trigger ile atlanan agent'ları belirt** (rapor başında "Bu commit'te güvenlik agent'ı atlandı çünkü sadece UI değişikliği var.").

### Örnek Çağrı

Kullanıcı: `/denetle son commit`

Yanıt akışı:
1. `git log -1 --stat` çalıştır
2. Değişiklik tipini belirle (örn: "loyalty migration + API + UI + i18n")
3. Smart trigger: 4'ü de gerek (yeni feature, >500 satır)
4. 4 agent paralel spawn (tek mesajda)
5. Sonuçları topla
6. Konsolide rapor + aksiyon listesi sun

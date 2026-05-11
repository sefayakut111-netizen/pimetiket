# Fason İş Aktarım Sistemi — Yaklaşım D (Hibrit)

**Sefa proposal · 11 May 2026 · Pim Etiket**

## Mevcut Sorun

Şu an süreç:
1. Müşteri dosya yükler
2. Sefa indirip kontrol eder
3. Email/WhatsApp ile fason'a yollar
4. Fason print eder
5. Cevap atar
6. Sefa takip eder

→ Tekrarlayan iş, hata payı yüksek, ölçeklenmez.

## 4 Yaklaşım Kıyaslaması

| Yaklaşım | Otomasyon | Fason yükü | Karar |
|---|---|---|---|
| A. Fason kendi paneli | %95 | Yüksek (panel öğrenme) | v2'ye saklı |
| B. Tam email otomasyon | %70 | Düşük | Cevap parse zor |
| C. WhatsApp Business API | %60 | Çok düşük | Mesaj başına pahalı |
| **D. Hibrit** ⭐ | **%75** | **Düşük** | **ÖNERİLEN** |

## Yaklaşım D — Hibrit Akış

```
Sipariş onaylandı + AI dosya kontrolü ✅
       ↓
Sefa admin panelde:
   • Fason seç (dropdown — Atölye A/B/C)
   • Teslim tarihi (sözleşmeden default)
   • "Fason'a gönder" butonu
       ↓
Sistem otomatik:
   • Resend → fason emailine mail:
     - Sipariş özeti (ölçü, malzeme, adet, kesim)
     - Signed URL (7 gün geçerli)
     - AI dosya kontrol JSON özeti
     - Teslim tarihi
   • WhatsApp Business API → kısa bilgi (opsiyonel)
   • Order status → "fason_iletildi"
   • order_events log
       ↓
Fason cevabı 2 yolla:
   1. Email cevabı → Cowork triage
   2. Web form: /fason/order/{id}/update
      - "Üretimde" / "Hazır" / "Sorun var"
      - Sorun varsa açıklama + foto
       ↓
Hazır olunca:
   • Fason kargo bilgisini yükler
   • Status → "kargoya_verildi"
   • Müşteriye otomatik kargo maili
```

## Veri Modeli

```sql
fason_partners (
  id uuid PK,
  name text,
  contact_email text,
  contact_whatsapp text,
  specialties text[],            -- ['etiket', 'sticker', 'holografik']
  default_lead_days int,
  performance_score float,       -- 0.0-1.0, otomatik
  active boolean,
  created_at timestamp
)

order_assignments (
  id uuid PK,
  order_id uuid,
  fason_partner_id uuid,
  status enum('assigned', 'sent', 'in_production',
              'ready', 'shipped', 'issue'),
  assigned_at timestamp,
  estimated_delivery timestamp,
  actual_delivery timestamp,
  notes text,
  download_logged_at timestamp   -- link ne zaman indirildi
)
```

## Fason Performans Skorlama (otomatik, aylık Cowork)

| Metrik | Ağırlık | Nasıl ölçülür |
|---|---|---|
| Teslim zamanı | %40 | actual vs estimated delivery |
| Kalite (şikayet/iade) | %30 | order'a iade var mı |
| İletişim hızı | %15 | sent → in_production süresi |
| Sorun bildirimi | %15 | "issue" status sayısı |

**Eşikler:**
- 0.9+ ⭐ → öncelikli atama
- 0.7-0.9 → normal
- <0.7 → fason ile konuş veya çıkar

## Güvenlik & Hassas Konular

- Fason'a giden dosya linkleri **signed URL** (7 gün, sonra ölü)
- Link tıklaması **loglanır** (kim/ne zaman/kaç kez)
- Her fason sözleşmesinde **gizlilik maddesi** zorunlu
- Müşteri telifli içeriği için fason **KVKK veri işleyici** sayılır
- **Veri işleyici sözleşmesi** imzalanır

## Mevcut Durum (Pim Etiket kod tabanı)

- `/admin/fason` sayfası var (mockup, 4 hardcoded fason)
- `orders.status` enum'da `in_production` ve `shipped` var ama `fason_iletildi`/`issue` yok
- `fason_partners` ve `order_assignments` tabloları YOK
- Resend kurulmadı (Aşama 2 bekliyor)
- WhatsApp Business API yok
- AI dosya kontrolü stub (gerçek metadata yok, JSON özeti henüz üretilmiyor)
- Auto-confirm endpoint kurulmuş (Resend'den önce geçici)
- `/fason/order/[id]/update` web form YOK

## Bağımlılık Listesi

1. **Resend mail altyapısı** (Aşama 2) — mail göndermek için ŞART
2. **AI dosya kontrolü gerçek** (Aşama 2) — JSON özet üretmek için
3. **Sefa'nın fason ortakları belirli olmalı** (gerçek atölye listesi)
4. **Veri işleyici sözleşmesi şablonu** (avukat onayı)

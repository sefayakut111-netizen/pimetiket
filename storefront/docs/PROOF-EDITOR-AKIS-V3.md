# Pim Etiket — Proof Editor & AI Validation Akış Şeması v3

> **Tarih:** 25 Mayıs 2026
> **Hazırlayan:** Claude Code (mimari)
> **Amaç:** Tasarım yükleme → bıçak + beyaz katman → AI doğrulama → müşteri/operatör kontrol → baskı

---

## Desteklenen Dosya Tipleri

| Dosya | Bıçak | Beyaz | AI QC | Grup |
|---|---|---|---|---|
| PNG | ✅ | ✅ | ✅ | İşlenebilir |
| AI | ✅ | ✅ | ✅ | İşlenebilir |
| PSD | ✅ | ✅ | ✅ | İşlenebilir |
| PDF | ✅ | ✅ | ✅ | İşlenebilir |
| SVG | ✅ | ✅ | ✅ | İşlenebilir |
| JPG | ❌ | ❌ | ✅ | Sadece QC + hazır şekil |

**EPS desteklenmez** — upload'da engellenir.

---

## Ana Akış (Mermaid)

```mermaid
flowchart TD
    Start([Müşteri sipariş verdi + ödeme tamam]) --> HasDesign{Tasarım<br/>yüklendi mi?}

    HasDesign -->|Evet| QC[🤖 ADIM 1<br/>AI Dosya QC<br/>GPT-4o Vision]
    HasDesign -->|Hayır| AwaitUpload[awaiting_upload<br/>Müşteri sonra yükler]
    AwaitUpload -->|Yükledi| QC

    QC --> QCResult{AI QC<br/>sonucu?}
    QCResult -->|✅ İyi / Normal| FileType{Dosya tipi?}
    QCResult -->|❌ Kötü| HumanReview[👨‍💼 OPERATÖR<br/>human_review]
    QCResult -->|💥 AI çöktü| HumanReview

    %% ===== DOSYA TİPİ AYIRIMI =====

    FileType -->|PNG AI PSD PDF SVG| CutlineCheck[⚙️ ADIM 2<br/>Bıçak tespiti]
    FileType -->|JPG| JpgFlow[⚠️ JPG AKIŞI<br/>Bıçak üretilemez]

    %% ===== JPG ÖZEL AKIŞI =====

    JpgFlow --> JpgChoice{Müşteri<br/>seçimi?}
    JpgChoice -->|PNG yükle| AwaitUpload2[awaiting_upload<br/>Yeni dosya bekle]
    AwaitUpload2 -->|PNG yükledi| QC
    JpgChoice -->|Hazır şekil seç| GeoShape[⚙️ Geometrik bıçak<br/>kare / daire / oval /<br/>dikdörtgen + offset]
    JpgChoice -->|Operatör yardımı| HumanReview
    GeoShape --> WhiteCheck

    %% ===== BIÇAK TESPİTİ =====

    CutlineCheck --> HasCutline{Dosyada<br/>bıçak var mı?}

    HasCutline -->|Var| ParseCut[Bıçağı parse et<br/>→ SVG path]
    HasCutline -->|Yok| AutoCut[⚙️ ADIM 2B<br/>Otomatik bıçak üret<br/>POC v2 OpenCV]

    ParseCut --> ValidateCut{Bıçak<br/>geçerli mi?}
    ValidateCut -->|✅ Kapalı + temiz| WhiteCheck
    ValidateCut -->|❌ Açık / bozuk| AutoCut

    AutoCut --> AutoCutResult{OpenCV<br/>başarılı?}
    AutoCutResult -->|Evet| WhiteCheck
    AutoCutResult -->|Hayır| VisionFallback[🤖 AI Vision Fallback<br/>GPT-4o ile kontur bul]
    VisionFallback --> VisionResult{Vision<br/>başarılı?}
    VisionResult -->|Evet| WhiteCheck
    VisionResult -->|Hayır| HumanReview

    %% ===== BEYAZ KATMAN =====

    WhiteCheck{ADIM 3<br/>Beyaz katman<br/>gerekli mi?}

    WhiteCheck -->|Şeffaf / Metalik<br/>Holo / Simli| GenWhite[⚙️ Beyaz katman üret<br/>Alpha → white mask<br/>Bıçak mask kırpma<br/>İnce detay genişletme]
    WhiteCheck -->|Kuşe / Kraft<br/>Opak PP / Beyaz| SkipWhite[Beyaz katman yok<br/>direkt doğrulamaya]

    GenWhite --> RuleCheck
    SkipWhite --> RuleCheck

    %% ===== AI DOĞRULAMA =====

    RuleCheck[⚙️ ADIM 4A<br/>Rule-based kontrol<br/>bedava + anında]

    RuleCheck --> RuleResult{Kural<br/>sonucu?}
    RuleResult -->|✅ Sorun yok| CustomerReady[proof_pending<br/>Müşteriye sun]
    RuleResult -->|⚠️ / ❌ Sorun var| AIValidate[🤖 ADIM 4B<br/>AI Vision doğrulama<br/>GPT-4o 3 görsel]

    AIValidate --> AIResult{AI<br/>sonucu?}
    AIResult -->|✅ Pass| CustomerReady
    AIResult -->|⚠️ Warn| CustomerWarn[proof_pending<br/>Müşteriye sun<br/>+ uyarı banner]
    AIResult -->|❌ Fail + düzeltilebilir| AutoFix[⚙️ ADIM 4C<br/>Otomatik düzeltme]
    AIResult -->|❌ Fail + düzeltilemez| HumanReview

    AutoFix --> FixResult{Düzeltme<br/>başarılı?}
    FixResult -->|Evet| ReValidate[Tekrar ADIM 4A<br/>max 2 deneme]
    FixResult -->|Hayır| HumanReview
    ReValidate --> RuleResult

    %% ===== MÜŞTERİ KONTROL =====

    CustomerReady --> CustomerView[👤 ADIM 5<br/>Müşteri prova kontrol<br/>/onay/orderId]
    CustomerWarn --> CustomerView

    CustomerView --> CustAction{Müşteri<br/>aksiyonu?}

    CustAction -->|✅ Onayla| ItemApproved{Tüm itemler<br/>onaylandı mı?}
    CustAction -->|✏️ Kendim düzenle| SelfEdit[👤 ADIM 5B<br/>POC Editör<br/>/onay/.../duzenle/itemId]
    CustAction -->|🆘 Uzman yardımı| HelpRequest[proof_help_request<br/>INSERT + not]

    SelfEdit --> SelfEditSave[Kaydet ve dön]
    SelfEditSave --> ProofValidating[proof_validating<br/>AI tekrar kontrol<br/>3-10 saniye]
    ProofValidating --> RuleCheck

    HelpRequest --> HumanReview

    ItemApproved -->|Hayır| CustomerView
    ItemApproved -->|Evet| ProofApproved[proof_approved]

    %% ===== SLA KONTROLÜ =====

    CustomerView -.->|12 saat| Reminder[📧 Hatırlatma mail]
    Reminder -.-> CustomerView
    CustomerView -.->|30 saat| LastWarn[📧 Son uyarı mail]
    LastWarn -.-> CustomerView
    CustomerView -.->|36 saat| AutoCancel[❌ Otomatik iptal<br/>+ PayTR iade]

    %% ===== OPERATÖR MÜDAHALESİ =====

    HumanReview --> OpAction{👨‍💼 Operatör<br/>aksiyonu?}

    OpAction -->|Düzeltip gönder| OpFix[Operatör düzeltir<br/>POC editör / Photoshop]
    OpAction -->|Direkt onayla| ProofApproved
    OpAction -->|Yeni dosya iste| AwaitUpload3[awaiting_upload<br/>Müşteriye mail]
    AwaitUpload3 -->|Yükledi| QC

    OpFix --> OpSend[Müşteriye<br/>tekrar gönder]
    OpSend --> CustomerView

    %% ===== BASKIYA İLETİM =====

    ProofApproved --> ReadyToShip[ready_to_ship]
    ReadyToShip --> AssignCheck{Auto-assign<br/>açık mı?}
    AssignCheck -->|Evet| AutoAssign[fn_find_best_partner<br/>Otomatik partner atama]
    AssignCheck -->|Hayır| ManualAssign[Admin manuel<br/>partner ata]
    AutoAssign --> Production[🖨️ in_production<br/>Partner üretir]
    ManualAssign --> Production
    Production --> Shipped[shipped<br/>Kargoya verildi]
    Shipped --> Delivered[delivered<br/>Teslim edildi]

    AutoCancel --> End([İşlem sonu])
    Delivered --> End

    %% ===== STİLLER =====

    classDef ai fill:#FF6B5B,stroke:#1F2A4D,color:#fff
    classDef system fill:#1F2A4D,stroke:#FF6B5B,color:#fff
    classDef customer fill:#34D399,stroke:#1F2A4D,color:#fff
    classDef operator fill:#FBBF24,stroke:#1F2A4D,color:#000
    classDef danger fill:#EF4444,stroke:#1F2A4D,color:#fff

    class QC,AIValidate,VisionFallback,ProofValidating ai
    class CutlineCheck,AutoCut,GenWhite,RuleCheck,AutoFix,ReValidate,GeoShape system
    class CustomerView,SelfEdit,CustomerReady,CustomerWarn customer
    class HumanReview,OpFix,OpSend operator
    class AutoCancel danger
```

---

## Detay Diyagramları

### Adım 2: Bıçak Tespiti (dosya tipine göre)

```mermaid
flowchart LR
    subgraph "Bıçak Tespit Yöntemleri"
        PNG[PNG dosya] -->|Alpha kanalı| AlphaEdge[Alpha > 0 alanın<br/>dış kenarı = bıçak]
        AI_file[AI dosya] -->|Layer tarama| SpotColor["CutContour" veya<br/>"Thru-cut" spot color<br/>layer → SVG path]
        PSD[PSD dosya] -->|Layer adı| LayerName["die" / "cut" / "knife"<br/>"bicak" layer → path export]
        PDF[PDF dosya] -->|İki yol| PDFPath["1. Spot color layer<br/>2. Vektör path (en dış)"]
        SVG[SVG dosya] -->|Direkt parse| SVGPath["clipPath / path<br/>elementi → bıçak"]
        JPG[JPG dosya] -->|❌| NoCut[Bıçak üretilemez<br/>→ hazır şekil veya<br/>PNG yükle]
    end
```

### Adım 3: Beyaz Katman Üretimi

```mermaid
flowchart TD
    Start([Beyaz katman gerekli]) --> GetAlpha{Alpha kanalı<br/>var mı?}

    GetAlpha -->|PNG/PSD| UseAlpha[Alpha kanalını al]
    GetAlpha -->|AI/PDF/SVG| RenderAlpha[Vektörü rasterize et<br/>→ alpha üret]

    UseAlpha --> Threshold[Alpha > 128<br/>→ beyaz alan]
    RenderAlpha --> Threshold

    Threshold --> ApplyMask[Bıçak SVG ile<br/>mask uygula<br/>taşma önle]

    ApplyMask --> DetailCheck{İnce detay<br/>kontrolü}
    DetailCheck -->|< 0.3mm beyaz| Expand[Minimum 0.3mm<br/>genişlet]
    DetailCheck -->|İzole piksel| Clean[Gürültü temizle]
    DetailCheck -->|Text alanı| SolidFill[Solid beyaz doldur]
    DetailCheck -->|OK| Output

    Expand --> Output[Beyaz katman PNG<br/>kaydet]
    Clean --> Output
    SolidFill --> Output
```

### Adım 4: AI Doğrulama Detayı

```mermaid
flowchart TD
    subgraph "Katman 1 — Rule Check (bedava)"
        R1[Kontur sayısı 1-8?]
        R2[Offset ≥ 1mm?]
        R3[Keskin köşe < 0.5mm?]
        R4[Beyaz coverage %5-%95?]
        R5[Beyaz bıçak içinde?]
        R6[Min boyut ≥ 15mm?]
    end

    subgraph "Katman 2 — AI Vision ($0.01-0.02)"
        V1[3 görsel gönder:<br/>tasarım + bıçak overlay<br/>+ beyaz katman]
        V2[GPT-4o kontrol:<br/>kenar takibi doğru mu?<br/>taşma/eksik var mı?<br/>detay kaybı var mı?]
        V3[Verdict:<br/>pass / warn / fail]
    end

    subgraph "Katman 3 — Auto-Fix (bedava)"
        F1[Gürültü kontur sil]
        F2[Köşe yuvarla 0.5mm+]
        F3[Offset artır]
        F4[Beyaz taşma kırp]
        F5[Beyaz eksik doldur]
    end

    R1 & R2 & R3 & R4 & R5 & R6 -->|Sorun var| V1
    R1 & R2 & R3 & R4 & R5 & R6 -->|Sorun yok| Pass[✅ Müşteriye sun]
    V1 --> V2 --> V3
    V3 -->|fail + fixable| F1 & F2 & F3 & F4 & F5
    V3 -->|pass| Pass
    V3 -->|warn| Warn[⚠️ Müşteriye sun + uyarı]
    V3 -->|fail + unfixable| Op[👨‍💼 Operatöre]
    F1 & F2 & F3 & F4 & F5 -->|Tekrar kontrol| R1
```

### Adım 5: Müşteri Kontrol Ekranı

```mermaid
flowchart TD
    subgraph "/onay/orderId"
        Left[Sol panel:<br/>Item listesi<br/>thumbnail + status<br/>✅ onaylı / ⏳ bekliyor]

        Right[Sağ panel:<br/>Seçili item preview]

        Toggle[Katman toggleları:<br/>🎨 Tasarım on/off<br/>✂️ Bıçak on/off<br/>⬜ Beyaz on/off<br/>🏁 Zemin simülasyon]

        PimMsg[🐦 Pim mesajı:<br/>AI-generated feedback<br/>uyarı varsa sarı banner]

        BtnApprove[✅ Onayla]
        BtnEdit[✏️ Düzenle]
        BtnHelp[🆘 Uzman yardımı]
    end

    BtnApprove -->|Tüm item onaylı| Approved([proof_approved<br/>→ baskı sırasına])
    BtnEdit --> Editor["/onay/.../duzenle/itemId<br/>POC editör tam ekran"]
    BtnHelp --> Ticket["Not yaz + gönder<br/>→ operatör sırasına"]

    Editor --> EditorTools[Müşteri araçları:<br/>• Bıçak konumu sürükle<br/>• Offset slider 0.5-5mm<br/>• Köşe yuvarlama slider<br/>• Beyaz brush/eraser<br/>• Zoom + pan<br/>• Undo 5 adım]
    EditorTools -->|Kaydet| ReValidate[proof_validating<br/>AI tekrar kontrol]
    ReValidate -->|pass| AutoApprove[Otomatik onay]
    ReValidate -->|warn/fail| BackToPreview[Müşteriye tekrar göster]
```

### Operatör Müdahale Noktaları

```mermaid
flowchart LR
    subgraph "Operatöre düşen durumlar"
        E1[AI QC: dosya kalitesi kötü]
        E2[OpenCV + AI Vision:<br/>bıçak üretilemedi]
        E3[AI doğrulama fail<br/>+ auto-fix başarısız]
        E4[Müşteri: uzman<br/>yardımı istedi]
        E5[JPG: müşteri operatör<br/>desteği seçti]
    end

    subgraph "Operatör araçları"
        T1[POC editör ileri mod<br/>node edit + pen tool]
        T2[Dosya indir + dış<br/>program düzelt + yükle]
        T3[Müşteriye not bırak]
        T4[Status değiştir]
    end

    subgraph "Operatör çıkışları"
        O1[Düzeltip müşteriye gönder]
        O2[Direkt baskıya onayla]
        O3[Müşteriden yeni dosya iste]
    end

    E1 & E2 & E3 & E4 & E5 --> T1 & T2 & T3 & T4
    T1 & T2 & T3 & T4 --> O1 & O2 & O3
```

---

## Status Akış Diyagramı (State Machine)

```mermaid
stateDiagram-v2
    [*] --> paid: PayTR onayı

    paid --> awaiting_upload: Tasarım yok
    paid --> qc_pending: Tasarım var

    awaiting_upload --> qc_pending: Müşteri yükledi

    qc_pending --> proof_generating: AI QC ✅ (iyi/normal)
    qc_pending --> human_review: AI QC ❌ (kötü)
    qc_pending --> human_review: AI çöktü (circuit breaker)

    proof_generating --> proof_pending: Bıçak + beyaz + doğrulama ✅
    proof_generating --> human_review: Otomatik üretim + düzeltme başarısız

    state proof_generating {
        [*] --> file_type_check
        file_type_check --> cutline_detect: PNG/AI/PSD/PDF/SVG
        file_type_check --> jpg_flow: JPG
        jpg_flow --> geo_shape: Hazır şekil seçildi
        jpg_flow --> [*]: PNG yükle (→ awaiting_upload)
        cutline_detect --> cutline_found: Bıçak var
        cutline_detect --> cutline_generate: Bıçak yok
        cutline_found --> white_layer_check
        cutline_generate --> white_layer_check
        geo_shape --> white_layer_check
        white_layer_check --> white_generate: Şeffaf/metalik/holo/simli
        white_layer_check --> rule_validate: Opak malzeme
        white_generate --> rule_validate
        rule_validate --> ai_validate: Sorun var
        rule_validate --> [*]: Sorun yok (pass)
        ai_validate --> auto_fix: Fail + fixable
        ai_validate --> [*]: Pass/warn
        auto_fix --> rule_validate: Düzeltildi
    }

    proof_pending --> proof_approved: Müşteri tüm onayladı
    proof_pending --> proof_validating: Müşteri düzenledi
    proof_pending --> human_review: Müşteri uzman istedi
    proof_pending --> cancelled: 36 saat SLA aşıldı

    proof_validating --> proof_pending: AI tekrar kontrol tamamlandı

    human_review --> proof_pending: Operatör düzeltip gönderdi
    human_review --> proof_approved: Operatör direkt onayladı
    human_review --> awaiting_upload: Operatör yeni dosya istedi

    proof_approved --> ready_to_ship

    ready_to_ship --> in_production: Partner atandı
    in_production --> shipped: Kargoya verildi
    shipped --> delivered: Teslim edildi

    cancelled --> [*]
    delivered --> [*]

    note right of proof_pending
        SLA Timer:
        12sa → hatırlatma mail
        30sa → son uyarı mail
        36sa → otomatik iptal + iade
    end note

    note right of proof_validating
        Kısa ömürlü (3-10sn)
        Müşteri düzenleme
        sonrası AI tekrar kontrol
    end note
```

---

## Maliyet Özeti (100 kullanıcı / 300 tasarım)

```mermaid
pie title Aylık AI Maliyet Dağılımı (~$14.50)
    "Pim Chat" : 6.84
    "Design QC (Adım 1)" : 2.03
    "Cutline Vision Fallback" : 0.34
    "AI Proof Validator (Adım 4)" : 1.58
    "Cutline Metadata Feedback" : 0.04
    "SAM Cutline (gelecek)" : 3.00
    "Diğer (blog, öneri)" : 0.67
```

---

## Kural Tablosu Özet

| Adım | Aktör | Girdi | Çıktı | Maliyet |
|---|---|---|---|---|
| 1. Dosya QC | 🤖 GPT-4o | Ham dosya | iyi/normal/kötü | $0.01 |
| 2. Bıçak tespit | ⚙️ OpenCV | Dosya | SVG path | $0 |
| 2B. Bıçak üret | ⚙️ POC v2 | Dosya | SVG path | $0 |
| 2C. Vision fallback | 🤖 GPT-4o | Görsel | Kontur polygon | $0.01 |
| 3. Beyaz katman | ⚙️ Canvas | Alpha + bıçak | White PNG | $0 |
| 4A. Rule check | ⚙️ Kurallar | Bıçak + beyaz | pass/warn/fail | $0 |
| 4B. AI validate | 🤖 GPT-4o | 3 görsel | verdict + issues | $0.02 |
| 4C. Auto-fix | ⚙️ SVG/Canvas | Sorunlu proof | Düzeltilmiş proof | $0 |
| 5. Müşteri kontrol | 👤 | Proof preview | Onay/düzenle/yardım | $0 |
| 5B. Müşteri edit | 👤 POC | Editör | Düzeltilmiş bıçak | $0 |
| 6B. Operatör | 👨‍💼 | Sorunlu proof | Düzeltilmiş proof | $0 |
| 7. Baskıya ilet | ⚙️ | Onaylı paket | Manifest + iş emri | $0 |

---

> Bu diyagramları görmek için: VS Code'da "Markdown Preview Mermaid Support" extension'ı
> veya GitHub'da dosyayı aç (otomatik render).

*Hazırlayan: Claude Code (mimari) · 25 May 2026*

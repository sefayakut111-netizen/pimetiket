/**
 * Pim Etiket Sistem Anayasası — docx generator
 * Sefa için tek seferlik script. Çalıştır: node scripts/generate-anayasa-docx.js
 */

const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  PageOrientation,
} = require("docx");

// İçerik
const KATEGORILER = [
  {
    title: "1. Sipariş & Ödeme",
    items: [
      ["Sipariş ID formatı:", " DDMMYYYY + 4 random rakam = 12 hane saf rakam. Operatör/müşteri tarih okur. Örnek: 190520264837."],
      ["Harf yok, prefix yok, tire yok", " (telefon dictation, RIP, barkod uyumu)."],
      ["Ödeme: yalnızca PayTR sanal POS.", " Manuel/havale akışı yok (mali pencere bekliyor)."],
      ["Tasarımsız sipariş açılabilir", ' — "Sonra yüklerim" akışı default kabul.'],
      ["PayTR merchant_oid ayrı bir kavram", " — sipariş ID'den farklı, 32 char PE + UUID hex."],
      ["Cüzdan vizyonu YOK", " — bakiye sistemi, kredi, abonelik gibi cüzdan benzeri özellik eklenmeyecek (Sefa kararı 10 May)."],
    ],
  },
  {
    title: "2. Proof / Onay Akışı",
    items: [
      ["Order_status enum 15 değer", " — bu state machine değişmez kontrat. Yeni state eklenirse hem TS hem DB güncellenir."],
      ["paid → trigger → ya awaiting_upload ya proof_pending", " (dosya varlığına göre). Trigger early-return guard yok (Mig 064)."],
      ["proof_generating ara state'i 5 dakikalık SLA", " — sla_proof_deadline kolonu. Süre dolarsa operatör devraldı mesajı."],
      ["36 saat onaysız sipariş = otomatik iade", " (Sefa kararı, henüz cron yazılmadı)."],
      ["14 gün awaiting_upload'da kalırsa otomatik iptal", " + ücret iadesi."],
      ['Müşteri "Yardım iste" → operatör ticket', " — proof_help_requests tablosu. Ticket açık iken fn_finalize_proof fail döner."],
      ["Onay sayfasında lightbox modal", " — kullanıcı bıçağı büyütüp inceler."],
      ["Multi-design picker", " — bir ürünün N tasarımı varsa 1/2/3 tab'ları."],
    ],
  },
  {
    title: "3. POC v2 (Cutline Üretici)",
    items: [
      ["POC v2 4 malzeme tipi:", " kağıt, şeffaf, metalik, holografik."],
      ["5 beyaz plan modu:", " off / full / smart / ai / custom."],
      ["3 tier:", " pro / standard / improve (sınıflandırma)."],
      ["POC fiyatlandırmaya ETKİ ETMEZ", " — konfigüratörde fiyat zaten hesaplanmış; POC sadece görselleştirir + operatör manifestine taşır."],
      ["Sıfır kesim kayma toleransı:", " 0 mm seçimde otomatik -0.3 mm erode (kayma payı)."],
      ["SVG export 2 spot color grup:", ' <g id="White"> + <g id="CutContour">.'],
      ["POC iki mod:", " is-dev (Sefa standalone test) ve is-embed (müşteri akışında). Embed'de upload + SVG indir GİZLİ."],
      ["POC headless mode", " (?autoSave=1): hidden iframe ile arka planda otomatik cutline üretir."],
      ["Müşteri dosya yüklemez/indirmez", ' — sadece manuel bıçak ayarlar, "Kaydet ve dön" der.'],
    ],
  },
  {
    title: "4. Veri & Storage",
    items: [
      ["Hibrit storage:", " 12 ay Supabase (hot) → sonra R2 (cold)."],
      ["Versiyonlama:", " design_files version, cutline_designs.status lifecycle (auto_generated → draft → approved → superseded)."],
      ["R2 EU jurisdiction", " (forcePathStyle, KVKK)."],
      ["Signed URL TTL:", " customer önizleme 1 saat, POC fetch 5 dakika, manifest 1 saat."],
      ["FSEK m.66 telif kabulu", " — checkout'ta zorunlu checkbox + audit log (IP + zaman damgası)."],
      ["KVKK m.11/h cold access audit", " — admin signed URL alımı archive_events'e yazılır."],
    ],
  },
  {
    title: "5. Mail & İletişim",
    items: [
      ["AI mailleri Resend (otomatik),", " insan mailleri Gmail Workspace (Sefa elle)."],
      ["Stub mode:", " Resend env yokken mail outbox kuyruğa yazar, env eklenince otomatik gönderilir."],
      ["Mail outbox tek tablo (polymorphic):", " fason_mail_outbox — customer/fason/lead/admin kategorileri."],
      ["24 saat awaiting_upload → hatırlatma mail", " (cron upload-reminders)."],
      ["24 saat proof_pending → hatırlatma mail", " (cron proof-reminders)."],
    ],
  },
  {
    title: "6. Karakter & Ses",
    items: [
      ["Pim tek karakter görünür", " — arkada uzman ajanlar (design-qc, cutline-feedback, vs.) çalışsa da tek yüz Pim."],
      ['Pim "sen" diliyle konuşur', ' — formel "siz" yerine samimi "sen".'],
      ["Türkçe akışta edilgen kabul edilir:", ' "Bıçak temiz üretildi" (Pim üretmiş hissi değil, sistem üretti).'],
      ['Pim asla "hızlı baskı yapabiliriz" demez', " — etiket 10, sticker 5 iş günü standartı."],
    ],
  },
  {
    title: "7. UX & Tasarım",
    items: [
      ["Adres slot picker", " — max 5 slot, görsel 1/2/3 chip'leri (telefon defteri mantığı)."],
      ["İlk sipariş = ilk slot", " otomatik kayıt + varsayılan."],
      ["Inputta autofill border kaybolmaz", " — Tailwind ring-1 + autofill inset birlikte çalışır."],
      ["Loading state'leri Skeleton", " (gerçek görsel hazır olana kadar)."],
      ["Demo/dev rozet production'da GİZLİ", " (body:not(.is-dev) selector)."],
      ["Lightbox: ESC ile kapanır, aria-modal, role=dialog", " (erişilebilirlik zorunlu)."],
    ],
  },
  {
    title: "8. Admin & Operatör",
    items: [
      ["RBAC:", " admin / staff rolleri (profiles.role). Detaylı yetki admin_role enum (super_admin / operations / customer_service / production / content_editor)."],
      ["/api/admin/* endpoint'leri assertAdmin guard", " + service role (RLS bypass)."],
      ["Manifest JSON indir", " — proof_approved+ siparişlerde, SVG signed URL'leri 1 saat geçerli, audit log."],
      ["Fason rolü ayrı bir kullanıcı tipi olacak", " (henüz eklenmedi — sadece kendi atandığı siparişleri görecek)."],
      ['Operatör "Baskıya aldım" → status: in_production', "."],
      ["Test simulator ID'leri 99 marker'lı", " — gerçek üretim siparişlerinden ayrılır."],
    ],
  },
  {
    title: "9. Teknik Disiplin",
    items: [
      ["Next.js custom sürüm", " — node_modules/next/dist/docs okumadan yeni kod yazılmaz."],
      ["Migration sırası kutsal:", " 001 → 002 → ... ASLA atlanmaz, her biri idempotent (if not exists)."],
      ["Trigger function update edildiğinde create or replace,", " trigger kendi DROP/CREATE değil."],
      ["create policy if not exists KULLANILMAZ", " — PostgreSQL ≤14 desteklemez. drop policy if exists + create policy pattern."],
      ["Yeni migration yazıldığında 5 dk içinde Supabase Dashboard'a manuel apply", " (CI yok)."],
      ["PostHog EU region, Sentry v10 instrumentation pattern.", ""],
      ["/api/cron/* endpoint'leri CRON_SECRET Bearer auth.", ""],
      ["TS strict mode → 0 hata kural.", " Eski kod fix'lenir, yeni kod hatasız yazılır."],
    ],
  },
  {
    title: "10. Mali & Yasal",
    items: [
      ["TKHK m.5 zorunlu alanlar:", " MERSİS, sabit tel, iş yeri adresi (footer + yasal sayfalar)."],
      ["Sosyal medya ana mecra: Instagram", " (Twitter, TikTok ikincil)."],
      ["İlk 3 ay reklam stratejisi: mikro-influencer barter", " (sıfır cash)."],
      ["Fason aktarım yaklaşımı D (Hibrit)", " — bazı işler iç, bazı işler dış."],
    ],
  },
  {
    title: "11. Kupon & Davet Programı",
    items: [
      ["Davet kodu (PIM-XXXXXXXX) ile üye olan arkadaş", " kayıt anında %10 indirim kuponu alır — sipariş vermesi gerekmez."],
      ["Davet eden kişi", " davet ettiği arkadaş ilk ödenmiş siparişini tamamlayınca %10 kupon alır."],
      ["Tek sipariş = tek kupon", " — kupon birleştirme yasak; cüzdan/bakiye sistemi yok."],
      ["Davet kodu kayıtta isteğe bağlı", " — URL ?ref= veya kayıt formundaki alan; zorunlu değil."],
      ["Google OAuth kayıt", " — davet kodu user metadata + callback cookie/ref fallback ile uygulanır."],
      ["Kişiye özel kuponlar (target_user_id)", " başka hesapta geçersiz; fn_validate_coupon kontrol eder."],
      ["Hoşgeldin (HOSGELDIN-*) + davet (REF-NEW-*)", " aynı hesapta birlikte durabilir; checkout'ta yalnızca biri kullanılır."],
    ],
  },
];

// Document oluştur
const children = [
  // Title
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({
        text: "Pim Etiket",
        bold: true,
        size: 56,
        color: "FF6B5B",
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240 },
    children: [
      new TextRun({
        text: "Sistem Anayasası",
        bold: true,
        size: 40,
        color: "1F2937",
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: "E7E5DD",
        space: 8,
      },
    },
    children: [
      new TextRun({
        text: "v1.0 — 19 Mayıs 2026 — Sefa Yakut",
        italics: true,
        size: 22,
        color: "6B6B6B",
      }),
    ],
  }),
  // Önsöz
  new Paragraph({
    spacing: { before: 240, after: 240 },
    children: [
      new TextRun({
        text:
          "Bu belge Pim Etiket sisteminin değişmez karakteristik kurallarını listeler. " +
          "Bir kural eklemek/değiştirmek/çıkarmak için Sefa onayı gerekir. " +
          "Her madde gelecek geliştirmeler için referans noktasıdır — yeni kod yazılırken bu kurallarla çelişen kararlar alınmaz.",
        size: 22,
        italics: true,
        color: "374151",
      }),
    ],
  }),
];

let itemCounter = 0;
for (const kat of KATEGORILER) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({
          text: kat.title,
          bold: true,
          color: "FF6B5B",
        }),
      ],
    })
  );

  for (const [bold, plain] of kat.items) {
    itemCounter++;
    children.push(
      new Paragraph({
        numbering: { reference: "anayasa-items", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: bold, bold: true }),
          new TextRun({ text: plain }),
        ],
      })
    );
  }
}

// Footer info
children.push(
  new Paragraph({
    spacing: { before: 600, after: 0 },
    alignment: AlignmentType.CENTER,
    border: {
      top: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: "E7E5DD",
        space: 8,
      },
    },
    children: [
      new TextRun({
        text: `${itemCounter} madde · 10 kategori`,
        size: 18,
        color: "6B6B6B",
      }),
    ],
  }),
  new Paragraph({
    spacing: { before: 0, after: 0 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "Bir kural değişirse: bu belgenin versiyonu artar (v1.1, v1.2, ...).",
        size: 18,
        italics: true,
        color: "6B6B6B",
      }),
    ],
  })
);

const doc = new Document({
  creator: "Pim Etiket — Sefa Yakut",
  title: "Pim Etiket Sistem Anayasası",
  description: "Sistemin karakteristik kuralları, 10 kategori, 62 madde.",
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: "FF6B5B" },
        paragraph: {
          spacing: { before: 300, after: 120 },
          outlineLevel: 0,
        },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "anayasa-items",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720, hanging: 360 } },
            },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    },
  ],
});

const outPath = path.resolve(
  __dirname,
  "..",
  "docs",
  "PIMETIKET-SISTEM-ANAYASASI.docx"
);

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("✓ Yazıldı:", outPath);
  console.log("  Toplam madde:", itemCounter);
  console.log("  Kategori sayısı:", KATEGORILER.length);
});

/**
 * FASON PARTNER SİMÜLASYONU (analiz amaçlı, geçici)
 *
 * Gerçek kaynak fonksiyonları çağırır:
 *  - buildOrderItemMeta        (src/lib/order-item-meta.ts)
 *  - redactOrderAddressForPartner / fullOrderAddressForPartnerShipping
 *                              (src/lib/fason/redact-order-address.ts)
 *
 * Amaç: Üretim partnerinin (fason) gözünden, token linkiyle bir siparişe
 * eriştiğinde EKRANINDA ne göreceğini birebir göstermek + durum makinesi
 * deliklerini canlandırmak. DB/sunucu gerektirmez (pure fonksiyonlar).
 */

import { buildOrderItemMeta } from "../src/lib/order-item-meta";
import {
  redactOrderAddressForPartner,
  fullOrderAddressForPartnerShipping,
} from "../src/lib/fason/redact-order-address";

const C = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function h(title: string) {
  console.log("\n" + C.bold(C.cyan("━".repeat(70))));
  console.log(C.bold(C.cyan("  " + title)));
  console.log(C.bold(C.cyan("━".repeat(70))));
}

// ─────────────────────────────────────────────────────────────────────────
// 1) MÜŞTERİNİN SİPARİŞİ (checkout'tan gelen, PII içeren gerçekçi veri)
// ─────────────────────────────────────────────────────────────────────────
h("1. MÜŞTERİ SİPARİŞ VERİYOR (checkout'taki ham veri)");

// orders.address — checkout shape: { label?, name, addr, city, phone }
const customerAddress = {
  label: "Ev",
  name: "Ayşe Yılmaz",
  addr: "Bağdat Cad. No:42 D:7 Kadıköy",
  city: "İstanbul",
  phone: "0532 111 22 33",
};

// Sepet satırı — buildOrderItemMeta'ya giren GERÇEK kaynak
const cartItem = {
  shape: "circle",
  cut: "kiss-cut",
  material: "transparent",
  finish: "matte",
  width: 60,
  height: 60,
  designCount: 1,
  designTempId: "a1b2c3d4-0000-1111-2222-design0001",
  designPreviewUrl:
    "https://r2.pimetiket.com/previews/ayse-yilmaz-dugun-davetiyesi.png",
  designFileName: "ayse-yilmaz-dugun-davetiyesi-FINAL.pdf", // ← müşteri PII'si
  designMimeType: "application/pdf",
  // sepetten gelen serbest spread alanları (meta) — kişiselleştirme metni
  meta: {
    personalizationText: "Ayşe & Mehmet 14.02.2026",
    giftNote: "Anneme özel, lütfen kırılmaz paketleyin",
  },
};

const storedMeta = buildOrderItemMeta(cartItem); // ← GERÇEK fonksiyon

// Admin atama yaparken serbest not giriyor (assign route notes alanı, 1000 char)
const adminAssignmentNote =
  "Müşteri Ayşe Hanım acele istiyor, sorun olursa 0532 111 22 33'ten arayın. Düğün 14 Şubat.";

console.log(C.dim("orders.address (DB'de):"));
console.log(customerAddress);
console.log(C.dim("\norder_items.meta (buildOrderItemMeta çıktısı, DB'de):"));
console.log(storedMeta);
console.log(C.dim("\norder_assignments.notes (admin girdi):"));
console.log("  " + JSON.stringify(adminAssignmentNote));

// ─────────────────────────────────────────────────────────────────────────
// 2) PARTNER TOKEN LİNKİNE TIKLIYOR → GET /api/fason/info/[token]
//    (route.ts:86-98 payload şekillendirmesi BİREBİR taklit ediliyor,
//     gerçek redactOrderAddressForPartner kullanılıyor)
// ─────────────────────────────────────────────────────────────────────────
h("2. PARTNER TOKEN LİNKİNE TIKLIYOR — auth YOK, public uç");
console.log(
  C.dim("GET /api/fason/info/{token}  →  route.ts:86-98 payload'u\n")
);

const assignmentRow = {
  id: "asgn-0001",
  status: "sent",
  estimated_delivery: "2026-02-10",
  notes: adminAssignmentNote, // ← route satır 87: ham dönüyor
  assigned_at: "2026-06-12T10:00:00Z",
  acknowledged_at: null,
  in_production_at: null,
  ready_at: null,
  shipped_at: null,
  tracking_company: null,
  tracking_number: null,
};

// route.ts:86-98'in döndürdüğü gerçek payload
const partnerReceives = {
  assignment: assignmentRow,
  order: {
    id: "ORD-2026-0042",
    created_at: "2026-06-12T09:30:00Z",
    address: redactOrderAddressForPartner(customerAddress), // ← GERÇEK redaksiyon
  },
  items: [
    {
      product: "sticker",
      title: "Yuvarlak Şeffaf Etiket",
      config: "60×60mm · Yuvarlak · Şeffaf",
      width: 60,
      height: 60,
      qty: 500,
      meta: storedMeta, // ← route satır 95: items HAM dönüyor (redaksiyon YOK)
    },
  ],
  fasonName: "Acme Baskı Ltd.",
  downloadUrl: "/api/fason/download/{token}",
};

console.log(C.bold("📱 PARTNERİN EKRANINDA GÖRDÜĞÜ JSON:"));
console.log(JSON.stringify(partnerReceives, null, 2));

// ─────────────────────────────────────────────────────────────────────────
// 3) SIZINTI ANALİZİ — partnere ulaşan müşteri PII'si
// ─────────────────────────────────────────────────────────────────────────
h("3. SIZINTI ANALİZİ — partner müşteri kimliğini görmemeli (Model B)");

const leaks: Array<{ alan: string; deger: unknown; kanit: string }> = [];
const m = partnerReceives.items[0].meta as Record<string, unknown>;

if (m.designFileName)
  leaks.push({
    alan: "items[].meta.designFileName",
    deger: m.designFileName,
    kanit: "info/[token]/route.ts:95 (items ham)",
  });
if (m.designPreviewUrl)
  leaks.push({
    alan: "items[].meta.designPreviewUrl",
    deger: m.designPreviewUrl,
    kanit: "info/[token]/route.ts:95 — URL'de müşteri adı gömülü",
  });
if (m.personalizationText)
  leaks.push({
    alan: "items[].meta.personalizationText",
    deger: m.personalizationText,
    kanit: "buildOrderItemMeta:45 — ...(item.meta) spread'i",
  });
if (m.giftNote)
  leaks.push({
    alan: "items[].meta.giftNote",
    deger: m.giftNote,
    kanit: "buildOrderItemMeta:45 — bilinmeyen alan spread'i",
  });
if (partnerReceives.assignment.notes)
  leaks.push({
    alan: "assignment.notes",
    deger: partnerReceives.assignment.notes,
    kanit: "info/[token]/route.ts:87 — serbest admin notu ham",
  });

console.log(
  C.green("✓ Adres redakte edildi → ") +
    JSON.stringify(partnerReceives.order.address) +
    C.dim("  (sokak/ad/telefon düştü — redaksiyon DOĞRU çalışıyor)")
);
console.log(
  "\n" +
    C.red(C.bold(`✗ ${leaks.length} ALAN ham sızıyor (auth'suz token ucundan):`))
);
for (const l of leaks) {
  console.log(C.red("  • " + l.alan));
  console.log("      değer: " + C.yellow(JSON.stringify(l.deger)));
  console.log("      " + C.dim(l.kanit));
}

// ─────────────────────────────────────────────────────────────────────────
// 4) shipping-info — Model B "tam adres" ucu
// ─────────────────────────────────────────────────────────────────────────
h("4. PARTNER 'KARGO BİLGİSİ' BUTONUNA BASIYOR (shipping-info)");
console.log(
  C.dim(
    "fullOrderAddressForPartnerShipping() — status 'ready'/'in_production' ise açılır\n"
  )
);
const fullShip = fullOrderAddressForPartnerShipping(customerAddress);
console.log(C.bold("Partnere dönen 'Model B' adresi:"));
console.log(fullShip);
console.log(
  C.red(
    "\n✗ recipientName + phone + addressLine = müşterinin GERÇEK kimliği ve tam adresi."
  )
);
console.log(
  C.dim(
    "  'Redakte kargo etiketi' (anonim gönderi kodu) mekanizması YOK — partner her şeyi görüyor."
  )
);

// ─────────────────────────────────────────────────────────────────────────
// 5) DURUM MAKİNESİ SİMÜLASYONU (FSM — apply-assignment-action.ts:34-40 verbatim)
// ─────────────────────────────────────────────────────────────────────────
h("5. DURUM MAKİNESİ — partner üretim akışını ilerletiyor");

// apply-assignment-action.ts:34-40 ile BİREBİR aynı (kanıt için kopyalandı)
const ALLOWED_FROM_STATUS: Record<string, readonly string[]> = {
  acknowledge: ["assigned", "sent"],
  in_production: ["acknowledged"],
  ready: ["in_production"],
  shipped: ["ready"],
  issue: ["assigned", "sent", "acknowledged", "in_production", "ready"],
};
const ACTION_TO_STATUS: Record<string, string> = {
  acknowledge: "acknowledged",
  in_production: "in_production",
  ready: "ready",
  shipped: "shipped",
  issue: "issue",
};

function tryAction(
  current: string,
  action: string
): { ok: boolean; next?: string } {
  const allowed = ALLOWED_FROM_STATUS[action];
  if (!allowed || !allowed.includes(current)) return { ok: false };
  return { ok: true, next: ACTION_TO_STATUS[action] };
}

function runFlow(label: string, start: string, actions: string[]) {
  console.log(C.bold("\n▶ " + label));
  let cur = start;
  console.log("  başlangıç: " + C.cyan(cur));
  for (const a of actions) {
    const r = tryAction(cur, a);
    if (r.ok) {
      console.log(
        `  ${a.padEnd(14)} → ${C.green(r.next!)}  ${C.dim("(izin verildi)")}`
      );
      cur = r.next!;
    } else {
      console.log(
        `  ${a.padEnd(14)} → ${C.red("REDDEDİLDİ")}  ${C.dim(
          `('${cur}' durumundan '${a}' yapılamaz)`
        )}`
      );
    }
  }
  return cur;
}

// Normal mutlu yol
runFlow("Normal akış (mutlu yol)", "sent", [
  "acknowledge",
  "in_production",
  "ready",
  "shipped",
]);

// C3: issue ölü-kilidi
const stuck = runFlow("BULGU C3 — partner SORUN bildiriyor (issue)", "in_production", [
  "issue", // sorunu bildirdi
  "in_production", // sorun çözüldü, devam etmek istiyor
  "ready",
  "shipped",
]);
console.log(
  C.red(
    `  ⮑ Atama '${stuck}' durumunda KİLİTLENDİ. issue'dan çıkış aksiyonu yok → kapasiteyi işgal ediyor, iş ilerlemiyor.`
  )
);

// C1: paused partner hâlâ ilerletebiliyor
h("6. BULGU C1 — ADMIN PARTNERİ DURDURDU (paused), partner ne yapabiliyor?");
const partnerStatus = "paused"; // fason_partners.status
console.log("  fason_partners.status = " + C.red(partnerStatus));
console.log(
  C.dim(
    "  status/route.ts yalnız ASSIGNMENT durumuna bakar, fason_partners.status'a BAKMAZ:\n"
  )
);
// status route'un gerçek guard'ı: sadece aktif assignment statüsü
const ACTIVE_ASSIGNMENT = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
  "issue",
];
function partnerStatusUpdate(assignmentStatus: string, action: string) {
  // assert-active-partner-assignment: assignment aktif mi? (partner status'u kontrol EDİLMİYOR)
  if (!ACTIVE_ASSIGNMENT.includes(assignmentStatus))
    return { ok: false, reason: "assignment aktif değil" };
  const r = tryAction(assignmentStatus, action);
  return r.ok
    ? { ok: true, next: r.next }
    : { ok: false, reason: "geçersiz FSM geçişi" };
}
let cur = "acknowledged";
for (const a of ["in_production", "ready", "shipped"]) {
  const r = partnerStatusUpdate(cur, a);
  if (r.ok) {
    console.log(
      `  partner (paused) "${a}" → ${C.green(r.next!)}  ${C.red(
        "✗ İZİN VERİLDİ — durdurulmuş partner üretime devam ediyor"
      )}`
    );
    cur = r.next!;
  }
}
console.log(
  C.red(
    "\n  ⮑ Durdurulan/sonlandırılan partner siparişi 'shipped'e kadar tamamlayabiliyor (C1)."
  )
);

console.log("\n" + C.bold(C.cyan("━".repeat(70))));
console.log(C.bold("  SİMÜLASYON BİTTİ"));
console.log(C.bold(C.cyan("━".repeat(70))));

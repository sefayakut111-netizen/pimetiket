/**
 * Pim Etiket — Fason Mail Şablonları (Resend bekliyor)
 *
 * Resend aktive edilince bu şablonlar gerçek HTML mail olarak gönderilir.
 * Şu an stub modunda — outbox'a yazılır, gönderim NO-OP'tur.
 *
 * Marka sesi:
 *   - Türkçe, sade, müşteriye seslenirken "sen", fason'a seslenirken "siz"
 *   - Operasyonel — duygusal değil, bilgilendirici
 *   - Hukuki dipnot zorunlu (KVKK m.5/2-c, telif lisans)
 */

export interface MailTemplateInput {
  payload: Record<string, unknown>;
}

export interface MailRendered {
  subject: string;
  html: string;
  text: string;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

function escape(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shellHtml(title: string, body: string, footer: string): string {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f4; padding: 24px; color: #1c1917;">
    <table role="presentation" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px;">
      <tr><td>
        <div style="font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Pim Etiket</div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 24px;">pimetiket.com</div>
        ${body}
        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 28px 0 16px;" />
        <div style="font-size: 11px; color: #78716c; line-height: 1.6;">${footer}</div>
      </td></tr>
    </table>
  </body>
</html>`;
}

// ============================================================
// fason_new_assignment — fasona yeni iş atandı
// ============================================================
function renderFasonNewAssignment(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);
  const fasonName = escape(p.fason_name);
  const estimated = escape(p.estimated_delivery ?? "yakında");
  const notes = escape(p.notes ?? "—");
  const token = escape(p.fason_token);
  const link = `${SITE_URL}/fason/${token}`;

  const subject = `Yeni iş — Sipariş ${orderId} · teslim ${estimated}`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">Merhaba ${fasonName},</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      Pim Etiket üzerinden size yeni bir baskı işi atandı. Detaylar ve
      tasarım dosyası aşağıdaki bağlantıda — bağlantı kişiseldir,
      paylaşmayın.
    </p>

    <table role="presentation" style="width: 100%; margin: 20px 0; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #57534e;">Sipariş No</td><td style="padding: 6px 0; font-weight: 600;">${orderId}</td></tr>
      <tr><td style="padding: 6px 0; color: #57534e;">Hedef teslim</td><td style="padding: 6px 0; font-weight: 600;">${estimated}</td></tr>
      <tr><td style="padding: 6px 0; color: #57534e;">Notlar</td><td style="padding: 6px 0;">${notes}</td></tr>
    </table>

    <div style="margin: 24px 0;">
      <a href="${link}" style="display: inline-block; background: #1e293b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Sipariş detaylarını aç →
      </a>
    </div>

    <p style="font-size: 12px; color: #78716c; line-height: 1.6;">
      Bağlantı 14 gün geçerlidir. Her tasarım dosyası tıklaması 15 dakikalık
      taze imzalı bağlantı üretir — kayıtlı tutmaya gerek yoktur.
    </p>
  `;

  const footer = `
    KVKK m.12 — Veri işleyici sıfatınızla:
    aktarılan müşteri verileri ve tasarım dosyası yalnızca bu sipariş için kullanılır,
    üretim sonrası en geç 30 gün içinde imha edilir, başkasına aktarılmaz.
    Sözleşmesel yükümlülüklerinizi hatırlatırız.
  `;

  const text = `Yeni iş — Sipariş ${orderId}\n\nMerhaba ${fasonName},\n\nPim Etiket üzerinden size yeni bir baskı işi atandı.\n\nSipariş No: ${orderId}\nHedef teslim: ${estimated}\nNotlar: ${notes}\n\nDetaylar: ${link}\n\nBağlantı 14 gün geçerli.\n\nKVKK m.12 — veri işleyici yükümlülükleriniz devam etmektedir.`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// customer_in_production — müşteriye üretim başladı
// ============================================================
function renderCustomerInProduction(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);
  const estimated = escape(p.estimated_delivery ?? "yakında");
  const customerName = escape(p.customer_name ?? "");

  const subject = `Siparişin üretime girdi — ${orderId}`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">İyi haber${customerName ? ` ${customerName}` : ""}!</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      <strong>${orderId}</strong> numaralı siparişin baskı atölyemize iletildi
      ve üretim aşamasına geçti. Hedef teslim tarihi: <strong>${estimated}</strong>.
    </p>

    <p style="font-size: 13px; line-height: 1.6; color: #57534e;">
      Üretim modeli: Pim Etiket fason baskı ortakları ile çalışır. Tasarımın
      ve kargo bilgilerin yalnızca bu sipariş için kullanılır, 30 gün sonra
      imha edilir.
    </p>

    <div style="margin: 24px 0;">
      <a href="${SITE_URL}/siparislerim" style="display: inline-block; background: #1e293b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Siparişimi takip et →
      </a>
    </div>
  `;

  const footer = `
    Veri aktarım detayları: <a href="${SITE_URL}/gizlilik">Gizlilik Politikası</a> ·
    <a href="${SITE_URL}/kvkk">KVKK Aydınlatma</a>.
    Aboneliği kapatmak için <a href="${SITE_URL}/profil">profil ayarları</a>.
  `;

  const text = `Siparişin üretime girdi — ${orderId}\n\n${orderId} numaralı siparişin baskı atölyemize iletildi. Hedef teslim: ${estimated}.\n\nTakip: ${SITE_URL}/siparislerim`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// customer_shipped — müşteriye kargoya verildi
// ============================================================
function renderCustomerShipped(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);
  const carrier = escape(p.carrier ?? "Kargo");
  const trackingNo = escape(p.tracking_no ?? "");
  const trackingUrl = typeof p.tracking_url === "string" ? p.tracking_url : "";

  const subject = `Kargoya verildi — ${orderId}`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">Sipariş yola çıktı!</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      <strong>${orderId}</strong> numaralı sipariş kargoya teslim edildi.
    </p>

    <table role="presentation" style="width: 100%; margin: 16px 0; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #57534e;">Kargo firması</td><td style="padding: 6px 0; font-weight: 600;">${carrier}</td></tr>
      ${trackingNo ? `<tr><td style="padding: 6px 0; color: #57534e;">Takip no</td><td style="padding: 6px 0; font-weight: 600;">${trackingNo}</td></tr>` : ""}
    </table>

    ${
      trackingUrl
        ? `<div style="margin: 24px 0;">
            <a href="${escape(trackingUrl)}" style="display: inline-block; background: #1e293b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Kargoyu takip et →
            </a>
          </div>`
        : ""
    }
  `;

  const footer = `
    Bir sorun olursa <a href="${SITE_URL}/iletisim">iletişim</a> sayfasından
    bize ulaşabilirsin. İyi günlerde kullan!
  `;

  const text = `Kargoya verildi — ${orderId}\n\nKargo: ${carrier}${trackingNo ? `\nTakip no: ${trackingNo}` : ""}${trackingUrl ? `\nTakip: ${trackingUrl}` : ""}`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// customer_delivered — teslim edildi, yorum talebi
// ============================================================
function renderCustomerDelivered(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);

  const subject = `Siparişin teslim edildi — ${orderId} · değerlendirir misin?`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">Teslim edildi 🎉</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      <strong>${orderId}</strong> numaralı siparişinin kargosu teslim edildi.
      Beğendiysen birkaç dakika ayırıp deneyimini yazar mısın? Yorum
      bırakanlara sonraki siparişte küçük bir teşekkür kuponu gönderiyoruz.
    </p>

    <div style="margin: 24px 0;">
      <a href="${SITE_URL}/siparislerim" style="display: inline-block; background: #f97066; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Değerlendir →
      </a>
    </div>
  `;

  const footer = `
    Bu mail tek seferlik bilgilendirmedir. Pazarlama bültenleri ayrı bir
    abonelik gerektirir — onayın yoksa bu kanaldan başka mail göndermeyiz.
  `;

  const text = `Teslim edildi — ${orderId}\n\nKısa bir değerlendirme bırakır mısın?\n${SITE_URL}/siparislerim`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// auto_refund_stale_proof — 36 saat onaysız iptal
// ============================================================
function renderAutoRefundStaleProof(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);
  const refundAmount = escape(p.refund_amount ?? "—");

  const subject = `Sipariş iptal edildi ve iade başlatıldı — ${orderId}`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">Sipariş iptal edildi</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      <strong>${orderId}</strong> numaralı sipariş için 36 saat içinde prova
      onayı alamadığımız için sipariş iptal edildi. Ödemen ilgili banka
      tarafından kartına iade edilecektir.
    </p>

    <table role="presentation" style="width: 100%; margin: 16px 0; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #57534e;">İade tutarı</td><td style="padding: 6px 0; font-weight: 600;">${refundAmount} TL</td></tr>
      <tr><td style="padding: 6px 0; color: #57534e;">Karta yansıma</td><td style="padding: 6px 0;">3–10 iş günü</td></tr>
    </table>

    <p style="font-size: 13px; line-height: 1.6; color: #57534e;">
      Tekrar denemek istersen sepetin hâlâ duruyor — istediğin zaman
      siparişi yenileyebilirsin.
    </p>
  `;

  const footer = `
    Sorun mu yaşadın? <a href="${SITE_URL}/iletisim">İletişim</a> sayfasından
    bize ulaş, hızlıca yardımcı olalım.
  `;

  const text = `Sipariş iptal edildi — ${orderId}\n\n36 saat içinde prova onayı alınamadığı için sipariş iptal edildi. İade tutarı: ${refundAmount} TL · 3–10 iş günü içinde karta yansır.`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// Router
// ============================================================
const RENDERERS: Record<string, (input: MailTemplateInput) => MailRendered> = {
  fason_new_assignment: renderFasonNewAssignment,
  customer_in_production: renderCustomerInProduction,
  customer_shipped: renderCustomerShipped,
  customer_delivered: renderCustomerDelivered,
  auto_refund_stale_proof: renderAutoRefundStaleProof,
};

export function renderMailTemplate(
  templateKey: string,
  payload: Record<string, unknown>
): MailRendered | null {
  const renderer = RENDERERS[templateKey];
  if (!renderer) return null;
  return renderer({ payload });
}

export function listRegisteredTemplates(): string[] {
  return Object.keys(RENDERERS);
}

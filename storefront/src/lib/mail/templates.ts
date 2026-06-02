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

  const text = `Yeni iş — Sipariş ${orderId}\n\nMerhaba ${fasonName},\n\nPim Etiket üzerinden size yeni bir baskı işi atandı.\n\nSipariş No: ${orderId}\nHedef teslim: ${estimated}\nNotlar: ${notes}\n\nDetaylar: ${link}\n\nBağlantı 14 gün geçerli.\n\nKVKK m.12 — veri işleyici sözleşmemizdeki yükümlülükler aynen geçerli.`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// fason_partner_welcome — yeni üretim partneri kaydı
// ============================================================
function renderFasonPartnerWelcome(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const fasonName = escape(p.fason_name);
  const contactEmail = escape(p.contact_email ?? "");
  const partnerLink = `${SITE_URL}/partner`;

  const subject = "Pim Etiket üretim partneri kaydınız tamamlandı";

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">Merhaba ${fasonName},</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      Pim Etiket üretim partneri kaydınız oluşturuldu. Size atanan işleri
      partner panelinden takip edebilir, yeni iş bildirimlerini e-posta ile alırsınız.
    </p>

    <table role="presentation" style="width: 100%; margin: 20px 0; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #57534e;">Giriş e-postası</td><td style="padding: 6px 0; font-weight: 600;">${contactEmail}</td></tr>
    </table>

    <div style="margin: 24px 0;">
      <a href="${partnerLink}" style="display: inline-block; background: #1e293b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Partner paneline git →
      </a>
    </div>

    <p style="font-size: 12px; color: #78716c; line-height: 1.6;">
      Giriş için e-posta adresinize tek kullanımlık doğrulama kodu gönderilir.
      Size atanan her iş için ayrıca kişisel iş bağlantısı e-posta ile iletilir.
    </p>
  `;

  const footer = `
    KVKK m.12 — Veri işleyici sıfatınızla aktarılan müşteri verileri ve tasarım
    dosyaları yalnızca ilgili sipariş için kullanılır. Sözleşmesel yükümlülüklerinizi
    hatırlatırız.
  `;

  const text = `Pim Etiket üretim partneri kaydınız tamamlandı\n\nMerhaba ${fasonName},\n\nPartner paneli: ${partnerLink}\nGiriş e-postası: ${contactEmail}\n\nGiriş için OTP kodu gönderilir. Yeni işler e-posta ile bildirilir.\n\nKVKK m.12 — veri işleyici yükümlülükleri geçerlidir.`;

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
    <h1 style="font-size: 18px; margin: 0 0 12px;">${customerName ? `${customerName}, siparişin` : "Siparişin"} üretime girdi</h1>
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
  // Defansif: yalnızca https:// URL'lere href ver. Endpoint zaten
  // doğruluyor, mail template ikinci katman güvence.
  let trackingUrl = "";
  if (typeof p.tracking_url === "string") {
    try {
      const u = new URL(p.tracking_url);
      if (u.protocol === "https:") trackingUrl = u.toString();
    } catch {
      /* invalid URL, link gösterilmez */
    }
  }

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
      <tr><td style="padding: 6px 0; color: #57534e;">İade tutarı</td><td style="padding: 6px 0; font-weight: 600;">${refundAmount} ₺</td></tr>
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

  const text = `Sipariş iptal edildi — ${orderId}\n\n36 saat içinde prova onayı alınamadığı için sipariş iptal edildi. İade tutarı: ${refundAmount} ₺ · 3–10 iş günü içinde karta yansır.`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// Router
// ============================================================
// ============================================================
// lead_welcome — şablon listesi signup welcome maili
// ============================================================
function renderLeadWelcome(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const downloadUrl = (() => {
    const raw = typeof p.download_url === "string" ? p.download_url : "";
    if (!raw) return "";
    try {
      const u = new URL(raw);
      if (u.protocol === "https:") return u.toString();
    } catch {
      /* invalid */
    }
    return "";
  })();
  const interests = Array.isArray(p.interests)
    ? (p.interests as unknown[]).map(String).slice(0, 5).join(", ")
    : "";

  const subject = "Şablon paketin hazır — Pim Etiket";

  const body = `
    <h1 style="font-size: 20px; margin: 0 0 12px;">Hoş geldin</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      Pim Etiket şablon kütüphanesine kaydolduğun için teşekkürler.
      ${interests ? `İlgilendiğin alanlar: <strong>${escape(interests)}</strong>.` : ""}
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      ${
        downloadUrl
          ? `Tüm şablonları içeren ZIP aşağıdaki butonda. Canva, Illustrator,
             Figma — istediğin araçta aç ve ihtiyacına göre özelleştir.`
          : `Şablonlar son rötuşlardan geçiyor — hazır olur olmaz tek tıkla
             indirme linki sana mail olarak gelecek. <em>24 saat içinde</em>.`
      }
    </p>

    ${
      downloadUrl
        ? `<div style="margin: 24px 0; text-align: center;">
            <a href="${downloadUrl}" style="display: inline-block; background: #ff6b5b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px;">
              ✨ Şablon paketini indir
            </a>
          </div>`
        : ""
    }

    <p style="font-size: 13px; line-height: 1.6; color: #57534e;">
      Hazır tasarımını Pim Etiket'te bastırmak istersen, sticker ya da
      etiket sayfasından konfigürasyonu seçip dosyanı yükleyebilirsin —
      Pim AI dosyanı kontrol eder, prova hazırlanır, 5 iş günü içinde
      kargoya veriyoruz.
    </p>

    <div style="margin: 24px 0; display: flex; gap: 12px;">
      <a href="${SITE_URL}/etiket" style="display: inline-block; background: #ffffff; color: #1e293b; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; border: 1px solid #e7e5e4;">
        Etiket yapılandır
      </a>
      <a href="${SITE_URL}/sticker" style="display: inline-block; background: #ffffff; color: #1e293b; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; border: 1px solid #e7e5e4;">
        Sticker yapılandır
      </a>
    </div>
  `;

  // Sefa 21 May v68 — token-li unsubscribe URL (cron processor inject eder)
  const unsubUrl =
    typeof p._unsubscribe_url === "string" && p._unsubscribe_url
      ? p._unsubscribe_url
      : `${SITE_URL}/bildirim-tercihleri`;

  const footer = `
    Yeni şablon eklendikçe sana haber veririz, spam atmayız.
    <a href="${unsubUrl}">Tek tıkla çık</a> · <a href="${SITE_URL}/bildirim-tercihleri">tüm tercihler</a>.
    KVKK aydınlatma: <a href="${SITE_URL}/kvkk">pimetiket.com/kvkk</a>.
  `;

  const text = `Hoş geldin!\n\nPim Etiket şablon kütüphanesine kaydoldun.${downloadUrl ? `\n\nZIP indir: ${downloadUrl}` : "\n\nŞablonlar hazır olunca mail atacağız (24 saat içinde)."}\n\nEtiket yapılandır: ${SITE_URL}/etiket\nSticker yapılandır: ${SITE_URL}/sticker\n\nAboneliği iptal et: ${unsubUrl}`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// customer_abandoned_cart — sepete eklediniz, 24+ saat oldu
// ============================================================
function renderCustomerAbandonedCart(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const itemCount = Number(p.item_count ?? 0);
  const total = Number(p.total ?? 0);
  const customerName = escape(p.customer_name ?? "");
  const couponCode = escape(p.coupon_code ?? "");

  // Subject sade — emoji + indirim oranı Gmail "Promotions" tab'ına itiyor.
  // Sayı + isim + nötr fiil → ana inbox'ta kalma şansı yüksek.
  const subject = customerName
    ? `${customerName}, sepetindeki ${itemCount} ürün hâlâ bekliyor`
    : `Sepetindeki ${itemCount} ürün hâlâ bekliyor`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">${customerName ? `${customerName}, sepetin` : "Sepetin"} kapanmadı 👀</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      Birkaç gün önce sepete ${itemCount} ürün eklemiştin ama ödeme tamamlanmadı.
      Toplam tutarın: <strong>${total.toLocaleString("tr-TR")} ₺</strong>.
    </p>

    ${
      couponCode
        ? `<div style="margin: 20px 0; padding: 16px; background: #fff1ee; border-radius: 12px; text-align: center;">
            <div style="font-size: 12px; color: #ff6b5b; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">Sana özel</div>
            <div style="font-size: 24px; font-weight: 700; color: #1e293b; margin-top: 4px;">%10 indirim</div>
            <div style="font-size: 14px; color: #57534e; margin-top: 4px;">Kupon: <strong style="font-family: monospace;">${couponCode}</strong></div>
            <div style="font-size: 11px; color: #78716c; margin-top: 6px;">7 gün geçerli</div>
          </div>`
        : ""
    }

    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      Tasarım hâlâ sepete bağlı, fiyat değişmedi. Bir tıkla kaldığın yerden
      devam edebilirsin.
    </p>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${SITE_URL}/sepet" style="display: inline-block; background: #ff6b5b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px;">
        Sepete dön & tamamla →
      </a>
    </div>

    <p style="font-size: 12px; line-height: 1.6; color: #78716c;">
      Vazgeçtiysen sorun değil — başka bir tasarım için tekrar görüşürüz.
      Sepetin 30 gün açık kalır, fiyat değişirse hesabına yansır.
    </p>
  `;

  const unsubUrl =
    typeof p._unsubscribe_url === "string" && p._unsubscribe_url
      ? p._unsubscribe_url
      : `${SITE_URL}/bildirim-tercihleri`;

  const footer = `
    Bu mail, açık bir sipariş için hatırlatma olarak gönderildi.
    <a href="${unsubUrl}">Tek tıkla çık</a> · <a href="${SITE_URL}/bildirim-tercihleri">tüm tercihler</a>.
  `;

  const text = `${customerName ? `${customerName}, sepetin` : "Sepetin"} kapanmadı.\n\nSepette ${itemCount} ürün, toplam ${total.toLocaleString("tr-TR")} ₺.${couponCode ? `\n\n%10 indirim kodu: ${couponCode} (7 gün geçerli)` : ""}\n\nSepete dön: ${SITE_URL}/sepet\n\nAboneliği iptal et: ${unsubUrl}`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// customer_review_request — teslim sonrası 7 gün, yorum iste
// ============================================================
function renderCustomerReviewRequest(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);
  const customerName = escape(p.customer_name ?? "");
  const reviewToken = escape(p.review_token ?? "");
  const productName = escape(p.product_name ?? "siparişin");

  const reviewLink = reviewToken
    ? `${SITE_URL}/yorum-yaz/${reviewToken}`
    : `${SITE_URL}/siparislerim`;

  const subject = customerName
    ? `${customerName}, ${productName} nasıl oldu?`
    : `${productName} için yorumun bizim için kıymetli`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px;">Etiketin elinde — şimdi?</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524;">
      Geçen hafta teslim aldığın <strong>${productName}</strong>
      (${orderId}) nasıl oldu? Yorumun bizim için kıymetli,
      bir sonraki müşterimizin kararına yardımcı olur.
    </p>

    <div style="margin: 24px 0; text-align: center;">
      <a href="${reviewLink}" style="display: inline-block; background: #ff6b5b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px;">
        ⭐ Yorum yaz · 30 saniye
      </a>
    </div>

    <p style="font-size: 13px; line-height: 1.6; color: #57534e;">
      Bir şey eksik kaldıysa veya bir sorun varsa, lütfen ${escape(
        "info@pimetiket.com"
      )} adresine yazarak bize bildir — düzeltmek için elimizden geleni yaparız.
    </p>
  `;

  const unsubUrl =
    typeof p._unsubscribe_url === "string" && p._unsubscribe_url
      ? p._unsubscribe_url
      : `${SITE_URL}/bildirim-tercihleri`;

  const footer = `
    Bu mail teslim aldığın sipariş için gönderildi.
    <a href="${unsubUrl}">Tek tıkla çık</a> · <a href="${SITE_URL}/bildirim-tercihleri">tüm tercihler</a>.
  `;

  const text = `${customerName ? `${customerName}, deneyimini` : "Deneyimini"} paylaşır mısın?\n\n${productName} (${orderId}) için yorum yaz: ${reviewLink}\n\nSorun varsa: info@pimetiket.com\n\nAboneliği iptal et: ${unsubUrl}`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// admin_new_order — Sefa'ya yeni sipariş bildirimi (ANLIK)
// Sefa 21 May v68: payment-callback başarılı sonra tetiklenir,
// Sefa /admin'i sürekli açık tutmak zorunda kalmasın.
// ============================================================
function renderAdminNewOrder(input: MailTemplateInput): MailRendered {
  const p = input.payload;
  const orderId = escape(p.order_id);
  const customerEmail = escape(p.customer_email ?? "—");
  const customerName = escape(p.customer_name ?? "Yeni müşteri");
  const total = escape(p.total_text ?? "—");
  const items = escape(p.items_summary ?? "—");
  const hasDesign = Boolean(p.has_design);
  const adminLink = `${SITE_URL}/admin/siparisler/${orderId}`;

  const subject = `🛒 Yeni sipariş ${orderId} — ${total}`;

  const body = `
    <h1 style="font-size: 18px; margin: 0 0 12px; color: #FF6B5B;">🛒 Yeni sipariş geldi</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #292524; margin: 0 0 16px;">
      <strong>${customerName}</strong> az önce sipariş verdi.
      ${hasDesign ? "Tasarım yüklü." : "<strong>Tasarım sonra yüklenecek</strong> (awaiting_upload)."}
    </p>

    <table role="presentation" style="width: 100%; margin: 20px 0; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #57534e;">Sipariş No</td><td style="padding: 6px 0; font-weight: 600;">${orderId}</td></tr>
      <tr><td style="padding: 6px 0; color: #57534e;">Müşteri</td><td style="padding: 6px 0;">${customerEmail}</td></tr>
      <tr><td style="padding: 6px 0; color: #57534e;">Toplam</td><td style="padding: 6px 0; font-weight: 600;">${total}</td></tr>
      <tr><td style="padding: 6px 0; color: #57534e;">İçerik</td><td style="padding: 6px 0;">${items}</td></tr>
    </table>

    <div style="margin: 24px 0;">
      <a href="${adminLink}" style="display: inline-block; background: #FF6B5B; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Sipariş detayını aç →
      </a>
    </div>
  `;

  const footer = `
    Bu mail Pim Etiket admin bildirim sisteminden gönderildi.
    Bildirimi durdurmak için <code>ADMIN_NOTIFICATION_EMAIL</code> env'ini Vercel'den kaldır.
  `;

  const text = `Yeni sipariş ${orderId} — ${total}\n\n${customerName} (${customerEmail})\nİçerik: ${items}\n${hasDesign ? "Tasarım yüklü" : "Tasarım sonra yüklenecek"}\n\nDetay: ${adminLink}`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// ============================================================
// admin_daily_summary — Sefa'ya günlük operasyon özeti (TR 09:00)
// Sefa 21 May v68: kahvesini içerken günün durumunu görür.
// ============================================================
function renderAdminDailySummary(input: MailTemplateInput): MailRendered {
  const p = input.payload as Record<string, number | string>;
  const newOrders = Number(p.newOrders24h) || 0;
  const revenue = Math.round(Number(p.revenue24h) || 0).toLocaleString("tr-TR");
  const awaitingUpload = Number(p.awaitingUpload) || 0;
  const awaitingUploadStale = Number(p.awaitingUploadStale) || 0;
  const aiQc = Number(p.aiQcQueue) || 0;
  const proof = Number(p.proofPending) || 0;
  const production = Number(p.inProduction) || 0;
  const shipped = Number(p.shipped24h) || 0;
  const capacityWarn = Number(p.partnerCapacityWarn) || 0;
  const adminLink = `${SITE_URL}/admin`;

  const subject = `📊 Günlük özet — ${newOrders} yeni sipariş · ${revenue} ₺`;

  // Kritik uyarı banner'ı (varsa)
  const hasAlerts = awaitingUploadStale > 0 || capacityWarn > 0;
  const alertBanner = hasAlerts
    ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #78350f;">
        <strong>⚠️ Dikkat:</strong>
        ${awaitingUploadStale > 0 ? `${awaitingUploadStale} sipariş 24+ saattir tasarım bekliyor. ` : ""}
        ${capacityWarn > 0 ? `${capacityWarn} üretim partneri kapasitesinin %85+'inde. ` : ""}
      </div>`
    : "";

  const body = `
    <h1 style="font-size: 20px; margin: 0 0 4px; color: #0f172a;">📊 Pim Etiket — Günlük Özet</h1>
    <p style="font-size: 13px; color: #64748b; margin: 0 0 20px;">Son 24 saatin operasyon özeti</p>

    ${alertBanner}

    <h2 style="font-size: 14px; color: #FF6B5B; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">💰 Sipariş & Ciro</h2>
    <table role="presentation" style="width: 100%; font-size: 13px; margin-bottom: 12px;">
      <tr><td style="padding: 4px 0; color: #57534e;">Yeni sipariş</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${newOrders}</td></tr>
      <tr><td style="padding: 4px 0; color: #57534e;">Ciro (24sa)</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${revenue} ₺</td></tr>
      <tr><td style="padding: 4px 0; color: #57534e;">Kargolanan (24sa)</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${shipped}</td></tr>
    </table>

    <h2 style="font-size: 14px; color: #FF6B5B; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">📦 Aktif Kuyruklar</h2>
    <table role="presentation" style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #57534e;">Tasarım bekleyen</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${awaitingUpload}${awaitingUploadStale > 0 ? ` <span style="color:#f59e0b;">(${awaitingUploadStale} stale)</span>` : ""}</td></tr>
      <tr><td style="padding: 4px 0; color: #57534e;">AI QC kuyruğu</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${aiQc}</td></tr>
      <tr><td style="padding: 4px 0; color: #57534e;">Müşteri prova onayı</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${proof}</td></tr>
      <tr><td style="padding: 4px 0; color: #57534e;">Üretimde</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">${production}</td></tr>
    </table>

    <div style="margin: 28px 0;">
      <a href="${adminLink}" style="display: inline-block; background: #FF6B5B; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Admin paneline git →
      </a>
    </div>
  `;

  const footer = `
    Bu mail her sabah 09:00'da otomatik gönderilir.
    Durdurmak için <code>ADMIN_NOTIFICATION_EMAIL</code> env'ini Vercel'den kaldır.
  `;

  const text = `Pim Etiket — Günlük Özet (son 24sa)\n\nYeni sipariş: ${newOrders}\nCiro: ${revenue} ₺\nKargolanan: ${shipped}\n\nKuyruklar:\n- Tasarım bekleyen: ${awaitingUpload} (${awaitingUploadStale} stale)\n- AI QC: ${aiQc}\n- Prova onayı: ${proof}\n- Üretimde: ${production}\n\n${capacityWarn > 0 ? `⚠️ ${capacityWarn} partner %85+ doluluk\n\n` : ""}Admin: ${adminLink}`;

  return { subject, html: shellHtml(subject, body, footer), text };
}

// Sefa 21 May v68 — Prerendered template bypass.
// notifications.ts'in 10 müşteri mail helper'ı React Email render edip
// outbox'a `_prerendered` key + payload.{subject,html,text} yazar.
// Cron bu key'i görünce render bypass eder, direkt gönderir.
function renderPrerendered(input: MailTemplateInput): MailRendered | null {
  const p = input.payload;
  const subject = typeof p.subject === "string" ? p.subject : "";
  const html = typeof p.html === "string" ? p.html : "";
  const text = typeof p.text === "string" ? p.text : "";
  if (!subject || (!html && !text)) return null;
  return { subject, html, text };
}

const RENDERERS: Record<
  string,
  (input: MailTemplateInput) => MailRendered | null
> = {
  fason_new_assignment: renderFasonNewAssignment,
  fason_partner_welcome: renderFasonPartnerWelcome,
  customer_in_production: renderCustomerInProduction,
  customer_shipped: renderCustomerShipped,
  customer_delivered: renderCustomerDelivered,
  auto_refund_stale_proof: renderAutoRefundStaleProof,
  lead_welcome: renderLeadWelcome,
  customer_abandoned_cart: renderCustomerAbandonedCart,
  customer_review_request: renderCustomerReviewRequest,
  admin_new_order: renderAdminNewOrder,
  admin_daily_summary: renderAdminDailySummary,
  // Sefa 21 May v68 — caller-rendered React Email helpers için bypass
  _prerendered: renderPrerendered,
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

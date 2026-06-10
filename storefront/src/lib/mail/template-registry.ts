/**
 * Mail şablon kaydı — admin önizleme / test gönderimi için.
 */

import "server-only";

import { render } from "@react-email/render";
import { renderMailTemplate, type MailRendered } from "./templates";
import { OrderConfirmationEmail } from "./templates/order-confirmation";
import { OrderDeliveredEmail } from "./templates/order-delivered";
import { ProofReadyEmail } from "./templates/proof-ready";
import { OrderProofReminderEmail } from "./templates/order-proof-reminder";
import { QcFlaggedEmail } from "./templates/qc-flagged";
import { QcRejectedEmail } from "./templates/qc-rejected";
import { ShipmentStatusEmail } from "./templates/shipment-status";
import { ShippingUpdateEmail } from "./templates/shipping-update";
import { OrderShippedEmail } from "./templates/order-shipped";
import { ProofHelpResolvedEmail } from "./templates/proof-help-resolved";
import { OrderUploadReminderEmail } from "./templates/order-upload-reminder";
import { OrderCancelledEmail } from "./templates/order-cancelled";
import { PaymentFailedEmail } from "./templates/payment-failed";
import { RefundRequestEmail } from "./templates/refund-request";
import { RefundApprovedEmail } from "./templates/refund-approved";
import { RefundRejectedEmail } from "./templates/refund-rejected";
import { RefundCompletedEmail } from "./templates/refund-completed";
import { MemberWelcomeEmail } from "./templates/member-welcome";
import { ReviewRequestEmail } from "./templates/review-request";
import { AbandonedCartEmail } from "./templates/abandoned-cart";
import { NewsletterWelcomeEmail } from "./templates/newsletter-welcome";
import { AdminNewOrderEmail } from "./templates/admin-new-order";
import { AdminDailySummaryEmail } from "./templates/admin-daily-summary";
import { AdminSupportTicketEmail } from "./templates/admin-support-ticket";
import { AdminAutoRefundEmail } from "./templates/admin-auto-refund";
import { FasonStatusEmail } from "./templates/fason-status";
import { FasonCancelledEmail } from "./templates/fason-cancelled";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { buildDailySummaryFallback } from "./generate-daily-summary";

export const MAIL_TEMPLATES = [
  {
    key: "order-confirmation",
    label: "Sipariş Onayı",
    subject: "Siparişiniz onaylandı",
  },
  {
    key: "order-delivered",
    label: "Teslim Bildirimi",
    subject: "Siparişiniz teslim edildi",
  },
  {
    key: "proof-ready",
    label: "Prova Hazır",
    subject: "Baskı provanız hazır",
  },
  {
    key: "proof-reminder",
    label: "Prova Hatırlatma",
    subject: "Provanız onay bekliyor",
  },
  {
    key: "qc-flagged",
    label: "QC Uyarı",
    subject: "Tasarımınızda düzeltme gerekli",
  },
  {
    key: "qc-rejected",
    label: "QC Red",
    subject: "Tasarımınız reddedildi",
  },
  {
    key: "shipment-status",
    label: "Kargo Durumu",
    subject: "Kargo güncelleme",
  },
  {
    key: "shipping-update",
    label: "Kargo Takip",
    subject: "Kargonuz yola çıktı",
  },
  {
    key: "order-shipped",
    label: "Kargoya Verildi",
    subject: "Siparişiniz kargoya verildi",
  },
  {
    key: "proof-help-resolved",
    label: "Destek Yanıtı",
    subject: "Yardım talebiniz yanıtlandı",
  },
  {
    key: "order-upload-reminder",
    label: "Upload Hatırlatma",
    subject: "Tasarımınızı yükleyin",
  },
  {
    key: "abandoned-cart",
    label: "Terk Sepet",
    subject: "Sepetiniz sizi bekliyor",
  },
  {
    key: "review-request",
    label: "Yorum Daveti",
    subject: "Deneyiminizi paylaşın",
  },
  {
    key: "admin-daily-summary",
    label: "Günlük Özet",
    subject: "Pim Etiket günlük rapor",
  },
  {
    key: "admin-new-support-ticket",
    label: "Destek Talebi (Admin)",
    subject: "Yeni destek talebi",
  },
  {
    key: "customer-support-received",
    label: "Destek Talebi Alındı (Müşteri)",
    subject: "Destek talebiniz alındı",
  },
  {
    key: "order-cancelled",
    label: "Sipariş İptal",
    subject: "Siparişiniz iptal edildi",
  },
  {
    key: "payment-failed",
    label: "Ödeme Başarısız",
    subject: "Ödeme alınamadı",
  },
  {
    key: "refund-request",
    label: "İade Talebi Alındı",
    subject: "İade talebiniz alındı",
  },
  {
    key: "refund-approved",
    label: "İade Onaylandı",
    subject: "İade talebiniz onaylandı",
  },
  {
    key: "refund-rejected",
    label: "İade Reddedildi",
    subject: "İade talebi sonucu",
  },
  {
    key: "refund-completed",
    label: "Para İadesi",
    subject: "İade kartınıza yansıyacak",
  },
  {
    key: "member-welcome",
    label: "Üyelik Hoşgeldin",
    subject: "Pim Etiket'e hoş geldin",
  },
  {
    key: "newsletter-welcome",
    label: "Bülten Hoşgeldin",
    subject: "Pim Etiket bültenine hoş geldin",
  },
  {
    key: "admin-new-order",
    label: "Yeni Sipariş (Admin)",
    subject: "Yeni sipariş geldi",
  },
  {
    key: "admin-auto-refund",
    label: "Otomatik İade (Admin)",
    subject: "Otomatik iade yapıldı",
  },
  {
    key: "fason-status",
    label: "Fason İş Güncellemesi",
    subject: "İş güncellemesi",
  },
  {
    key: "fason-cancelled",
    label: "Fason İş İptali",
    subject: "İş ataması iptal edildi",
  },
] as const;

export type MailTemplateKey = (typeof MAIL_TEMPLATES)[number]["key"];

const MOCK_ORDER_ID = "PE-2026-001234";
const MOCK_NAME = "Ayşe Yılmaz";
const MOCK_TICKET_ID = "tkt_demo_001";

function templateMeta(key: MailTemplateKey) {
  return MAIL_TEMPLATES.find((t) => t.key === key)!;
}

export async function previewMailTemplate(
  key: MailTemplateKey
): Promise<MailRendered | null> {
  const meta = templateMeta(key);

  switch (key) {
    case "order-confirmation": {
      const html = await render(
        OrderConfirmationEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          items: [
            {
              title: "Yuvarlak Etiket 5cm",
              config: "Mat kuşe · 500 adet",
              qty: 1,
              total: 890,
            },
          ],
          subtotal: 890,
          shipping: 49,
          total: 939,
          estimatedDelivery: "28 Mayıs 2026",
        })
      );
      return {
        subject: `${meta.subject} — #${MOCK_ORDER_ID}`,
        html,
        text: `Siparişin onaylandı — ${MOCK_ORDER_ID}`,
      };
    }
    case "order-delivered": {
      const html = await render(
        OrderDeliveredEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          deliveredAt: "25 Mayıs 2026 14:32",
          carrierLabel: "Yurtiçi Kargo",
        })
      );
      return {
        subject: `${meta.subject} — #${MOCK_ORDER_ID}`,
        html,
        text: `Sipariş teslim edildi — ${MOCK_ORDER_ID}`,
      };
    }
    case "proof-ready": {
      const html = await render(
        ProofReadyEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          productTitle: "Yuvarlak Etiket 5cm",
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "proof-reminder": {
      const html = await render(
        OrderProofReminderEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          pendingCount: 1,
          hoursSincePaid: 36,
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "qc-flagged": {
      const html = await render(
        QcFlaggedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          warnings: ["DPI sınırda (298)", "Bleed payı kontrol ediliyor"],
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "qc-rejected": {
      const html = await render(
        QcRejectedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          reason:
            "Tasarım dosyasında font outline eksik. Lütfen Illustrator'da Create Outlines yapıp tekrar yükleyin.",
          fileName: "etiket-v3.pdf",
          issueCategory: "font",
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "shipment-status": {
      const html = await render(
        ShipmentStatusEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          status: "in_transit",
          description: "Transfer merkezine ulaştı",
          location: "İstanbul Avrupa",
          trackingNumber: "1234567890",
          trackingUrl: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula",
        })
      );
      return { subject: meta.subject, html, text: "" };
    }
    case "shipping-update": {
      const html = await render(
        ShippingUpdateEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          carrierName: "Yurtiçi Kargo",
          trackingNumber: "1234567890",
          trackingUrl: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula",
          estimatedDelivery: "27 Mayıs 2026",
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "order-shipped": {
      const html = await render(
        OrderShippedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          carrierName: "Yurtiçi Kargo",
          trackingNumber: "1234567890",
          trackingUrl: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula",
          deliveryWindow: "5-7 iş günü",
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "proof-help-resolved": {
      const html = await render(
        ProofHelpResolvedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          itemTitle: "Yuvarlak Etiket 5cm",
          originalMessage: "Prova rengi ekrandakinden farklı görünüyor, normal mi?",
          resolutionNote:
            "Mat kuşe baskıda renkler ekrandan %5-8 daha koyu çıkar — bu normal. İsterseniz CMYK proof PDF gönderebiliriz.",
        })
      );
      return { subject: meta.subject, html, text: "" };
    }
    case "order-upload-reminder": {
      const html = await render(
        OrderUploadReminderEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          pendingCount: 1,
          hoursSincePaid: 28,
        })
      );
      return { subject: `${meta.subject} — #${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "abandoned-cart": {
      const unsub = buildUnsubscribeUrl("preview@example.com", "marketing");
      const html = await render(
        AbandonedCartEmail({
          customerName: MOCK_NAME,
          itemCount: 2,
          total: 1240,
          unsubscribeUrl: unsub,
        })
      );
      return {
        subject: meta.subject,
        html,
        text: "",
      };
    }
    case "review-request": {
      const unsub = buildUnsubscribeUrl("preview@example.com", "marketing");
      const html = await render(
        ReviewRequestEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          productName: "Yuvarlak Etiket 5cm",
          unsubscribeUrl: unsub,
        })
      );
      return { subject: meta.subject, html, text: "" };
    }
    case "admin-daily-summary": {
      const fallbackStats = buildDailySummaryFallback({
        newOrders24h: 12,
        revenue24h: 18450,
        awaitingUpload: 3,
        awaitingUploadStale: 1,
        aiQcQueue: 5,
        proofPending: 2,
        inProduction: 8,
        shipped24h: 6,
        partnerCapacityWarn: 1,
      });
      const html = await render(
        AdminDailySummaryEmail({
          date: "7 Haziran 2026",
          fallbackStats,
        })
      );
      return { subject: meta.subject, html, text: fallbackStats };
    }
    case "admin-new-support-ticket": {
      const html = await render(
        AdminSupportTicketEmail({
          ticketId: MOCK_TICKET_ID,
          customerName: MOCK_NAME,
          subject: "Sipariş durumu hakkında",
          messagePreview:
            "Merhaba, PE-2026-001234 numaralı siparişimin kargo durumunu öğrenmek istiyorum.",
        })
      );
      return { subject: meta.subject, html, text: "" };
    }
    case "customer-support-received":
      return (
        renderMailTemplate("customer_support_ticket_received", {
          ticket_id: MOCK_TICKET_ID,
          subject: "Sipariş durumu hakkında",
          category: "siparis",
          customer_name: MOCK_NAME,
        }) ?? null
      );
    case "order-cancelled": {
      const html = await render(
        OrderCancelledEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          reason:
            "36 saat içinde prova onayı alınamadığı için sipariş otomatik iptal edildi.",
          cancelSource: "stale_proof",
          refundAmount: 939,
          refundInitiated: true,
        })
      );
      return {
        subject: `Sipariş iptal edildi — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    case "payment-failed": {
      const html = await render(
        PaymentFailedEmail({
          customerName: MOCK_NAME,
          amount: 939,
          failureHint: "3D Secure doğrulaması tamamlanmadı",
        })
      );
      return { subject: "Ödeme alınamadı — sepetin duruyor", html, text: "" };
    }
    case "refund-request": {
      const html = await render(
        RefundRequestEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          returnId: "ret_demo_001",
          reasonLabel: "Üretim hatası (renk/baskı bozuk)",
        })
      );
      return {
        subject: `İade talebin alındı — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    case "refund-approved": {
      const html = await render(
        RefundApprovedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          returnId: "ret_demo_001",
          adminNote:
            "İade talebin onaylandı. Ürünü kargoyla geri gönder, eline ulaşınca para iadesi başlatılacak.",
        })
      );
      return {
        subject: `İade talebin onaylandı — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    case "refund-rejected": {
      const html = await render(
        RefundRejectedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          returnId: "ret_demo_001",
          reason:
            "Gönderdiğin fotoğraflar üretim hatasını göstermiyor; iade koşulları karşılanmıyor.",
        })
      );
      return {
        subject: `İade talebi sonucu — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    case "refund-completed": {
      const html = await render(
        RefundCompletedEmail({
          customerName: MOCK_NAME,
          orderId: MOCK_ORDER_ID,
          refundAmount: 939,
          cardLast4: "4242",
        })
      );
      return {
        subject: `İade kartına yansıyacak — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    case "member-welcome": {
      const html = await render(
        MemberWelcomeEmail({ customerName: MOCK_NAME })
      );
      return { subject: "Pim Etiket'e hoş geldin", html, text: "" };
    }
    case "newsletter-welcome": {
      const unsub = buildUnsubscribeUrl("preview@example.com", "marketing");
      const html = await render(
        NewsletterWelcomeEmail({ unsubscribeUrl: unsub })
      );
      return { subject: meta.subject, html, text: "" };
    }
    case "admin-new-order": {
      const html = await render(
        AdminNewOrderEmail({
          orderId: MOCK_ORDER_ID,
          total: "939 ₺",
          customerName: MOCK_NAME,
          items: "1× Yuvarlak Etiket 5cm",
          status: "Tasarım bekliyor",
        })
      );
      return {
        subject: `Yeni sipariş — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    case "admin-auto-refund": {
      const html = await render(
        AdminAutoRefundEmail({
          orderId: MOCK_ORDER_ID,
          refundAmount: "939 ₺",
          customerName: MOCK_NAME,
        })
      );
      return { subject: `Otomatik iade — ${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "fason-status": {
      const html = await render(
        FasonStatusEmail({
          orderId: MOCK_ORDER_ID,
          statusText: "Üretime başlandı",
          token: "demo_token_preview",
        })
      );
      return { subject: `İş güncellemesi — ${MOCK_ORDER_ID}`, html, text: "" };
    }
    case "fason-cancelled": {
      const html = await render(
        FasonCancelledEmail({
          orderId: MOCK_ORDER_ID,
          token: "demo_token_preview",
        })
      );
      return {
        subject: `İş ataması iptal edildi — ${MOCK_ORDER_ID}`,
        html,
        text: "",
      };
    }
    default:
      return null;
  }
}

export function isMailTemplateKey(value: string): value is MailTemplateKey {
  return MAIL_TEMPLATES.some((t) => t.key === value);
}

/**
 * /bildirim-tercihleri/cikis?t=<token>
 *
 * Sefa 21 May v68 — Mail unsubscribe confirm sayfası.
 *
 * Mail içindeki "Bildirimleri kapat" linkine tıklayan kullanıcı buraya
 * gelir. Token URL'dedir; sunucu doğrular, kullanıcı "Evet, çıkar"
 * butonuna basarsa form POST → /api/mail/unsubscribe ile suppression
 * kaydı atılır.
 *
 * Tasarım:
 *   - Auth gerektirmez (mail alıcısı login olmamış olabilir)
 *   - Tek-tıklama (Gmail/Yahoo) için /api/mail/unsubscribe POST de
 *     ayrı endpoint olarak destekleniyor (RFC 8058)
 *   - Hatalı/expired token → açıklayıcı mesaj + iletişim linki
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  verifyUnsubscribeToken,
  type UnsubscribeCategory,
} from "@/lib/mail/unsubscribe";
import {
  recordSuppression,
  type SuppressionType,
  type MailCategory,
} from "@/lib/mail/suppression";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<UnsubscribeCategory, string> = {
  marketing: "Pazarlama mailleri (kampanya, kupon, indirim)",
  blog: "Blog yazıları ve haberler",
  lead: "Hoş geldin maili ve PDF rehber serisi",
  all: "Tüm pazarlama bildirimleri",
};

function categoryToSuppression(cat: UnsubscribeCategory): {
  type: SuppressionType;
  blockedCategories: MailCategory[] | undefined;
} {
  if (cat === "all") {
    return { type: "unsubscribe_marketing", blockedCategories: ["lead"] };
  }
  if (cat === "blog") {
    return { type: "unsubscribe_blog", blockedCategories: ["lead"] };
  }
  return { type: "unsubscribe_marketing", blockedCategories: ["lead"] };
}

// ===== Server Action: Aboneliği iptal et =====
async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  if (!token) redirect("/bildirim-tercihleri/cikis?err=missing");

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    redirect("/bildirim-tercihleri/cikis?err=invalid");
  }

  const { type, blockedCategories } = categoryToSuppression(
    payload.category
  );
  const result = await recordSuppression({
    email: payload.email,
    type,
    reason: `user_unsubscribe_web:${payload.category}`,
    blockedCategories,
  });
  if (!result.ok) {
    redirect("/bildirim-tercihleri/cikis?err=db");
  }

  redirect(
    `/bildirim-tercihleri/cikis?done=1&cat=${encodeURIComponent(
      payload.category
    )}`
  );
}

interface PageProps {
  searchParams: Promise<{
    t?: string;
    err?: string;
    done?: string;
    cat?: string;
  }>;
}

export default async function UnsubscribePage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const token = sp.t ?? "";
  const err = sp.err ?? "";
  const done = sp.done === "1";
  const doneCategory = (sp.cat ?? "marketing") as UnsubscribeCategory;

  // ===== Done state =====
  if (done) {
    const label = CATEGORY_LABELS[doneCategory] ?? "Pazarlama mailleri";
    return (
      <Shell title="Aboneliğin iptal edildi">
        <p style={p}>
          <strong>{label}</strong> kategorisini artık almayacaksın.
        </p>
        <p style={p}>
          Sipariş onayı, kargo durumu ve fatura gibi{" "}
          <strong>zorunlu</strong> mailler KVKK m.5/2-c kapsamında
          gönderilmeye devam edecek (hizmetin parçası).
        </p>
        <p style={p}>
          Fikrin değişirse hesabın varsa{" "}
          <Link href="/auth?next=/bildirim-tercihleri" style={a}>
            giriş yaparak bildirim tercihlerini
          </Link>{" "}
          tekrar açabilirsin. Hesabın yoksa{" "}
          <a href="mailto:info@pimetiket.com" style={a}>
            info@pimetiket.com
          </a>{" "}
          adresine yaz.
        </p>
      </Shell>
    );
  }

  // ===== Error state =====
  if (err) {
    const messages: Record<string, string> = {
      missing: "Link eksik. Maildeki butonu tekrar tıkla.",
      invalid:
        "Link geçersiz veya süresi dolmuş (>365 gün). Aşağıdaki sayfadan tercihleri elle yönet.",
      db: "Bir hata oluştu. Lütfen tekrar dene veya bize ulaş.",
    };
    return (
      <Shell title="Bağlantı sorunu">
        <p style={p}>
          {messages[err] ?? "Bilinmeyen hata. Lütfen tekrar dene."}
        </p>
        <p style={p}>
          <Link href="/auth?next=/bildirim-tercihleri" style={a}>
            Giriş yap → bildirim tercihleri
          </Link>
          {" · "}
          <a href="mailto:info@pimetiket.com" style={a}>
            info@pimetiket.com
          </a>
        </p>
        <p style={pMuted}>
          Sorun devam ederse:{" "}
          <a href="mailto:info@pimetiket.com" style={a}>
            info@pimetiket.com
          </a>
        </p>
      </Shell>
    );
  }

  // ===== Confirm state =====
  if (!token) {
    return (
      <Shell title="Link eksik">
        <p style={p}>Token bulunamadı. Maildeki butonu tekrar tıkla.</p>
      </Shell>
    );
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return (
      <Shell title="Link geçersiz">
        <p style={p}>
          Bağlantı geçersiz veya süresi dolmuş. Hesabın varsa{" "}
          <Link href="/auth?next=/bildirim-tercihleri" style={a}>
            giriş yaparak tercihlerini
          </Link>{" "}
          yönet; hesabın yoksa{" "}
          <a href="mailto:info@pimetiket.com" style={a}>
            info@pimetiket.com
          </a>
          .
        </p>
      </Shell>
    );
  }

  const label = CATEGORY_LABELS[payload.category] ?? "Pazarlama mailleri";

  return (
    <Shell title="Aboneliği iptal et">
      <p style={p}>
        <strong>{payload.email}</strong> adresini şu kategoriden
        çıkarmak üzeresin:
      </p>
      <p
        style={{
          ...p,
          padding: "12px 16px",
          background: "#FFF5EB",
          borderRadius: 12,
          color: "#1A2335",
        }}
      >
        {label}
      </p>
      <form action={confirmUnsubscribe}>
        <input type="hidden" name="t" value={token} />
        <button type="submit" style={btnPrimary}>
          Evet, beni çıkar
        </button>
      </form>
      <p style={pMuted}>
        Sipariş, kargo, fatura gibi <strong>zorunlu</strong> mailler
        gönderilmeye devam eder. (KVKK m.5/2-c — hizmetin parçası.)
      </p>
      <p style={pMuted}>
        <Link href="/" style={a}>
          ← Ana sayfaya dön
        </Link>
      </p>
    </Shell>
  );
}

// ============================================================
// Stil + Shell — bağımlılık eklemeden basit inline tasarım
// ============================================================
function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        padding: "48px 16px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#FFFFFF",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <h1
          style={{
            fontSize: 24,
            margin: "0 0 16px",
            color: "#1A2335",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}

const p: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: "#1A2335",
  margin: "12px 0",
};

const pMuted: React.CSSProperties = {
  ...p,
  fontSize: 13,
  color: "#5C6877",
  marginTop: 20,
};

const a: React.CSSProperties = {
  color: "#ef3e56",
  textDecoration: "underline",
};

const btnPrimary: React.CSSProperties = {
  background: "#ef3e56",
  color: "#FFFFFF",
  border: "none",
  padding: "12px 24px",
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 16,
};

export const metadata = {
  title: "Aboneliği iptal et · Pim Etiket",
  robots: "noindex,nofollow",
};

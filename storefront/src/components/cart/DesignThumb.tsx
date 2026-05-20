/**
 * Cart Design Thumbnail — Sefa 20 May v68
 *
 * Sepet ve /odeme satırlarında ürün ikonu yerine kullanılır:
 *   1. designPreviewUrl varsa → asıl tasarım önizlemesi (render edilmiş PNG)
 *   2. preview yoksa + designMimeType varsa → format rozeti (PDF/AI/PSD/EPS)
 *   3. hiçbiri yoksa → ürün fallback ikonu (sticker/etiket)
 *
 * Brand renkleri (resmi Adobe brand identity 2024):
 *   - PDF: #E33 (Adobe Acrobat brand red)
 *   - AI:  #330000 / #FF9A00 (Illustrator orange-brown)
 *   - PSD: #001E36 / #31A8FF (Photoshop deep blue)
 */

import { Icon } from "@/components/Icon";

type Product = "sticker" | "etiket";

interface DesignThumbProps {
  /** Render edilmiş preview PNG URL (Migration 072) — varsa öncelik bu */
  previewUrl?: string;
  /** Orijinal dosya adı — alt text + tooltip */
  fileName?: string;
  /** Orijinal MIME — preview yoksa hangi rozet gösterileceğini belirler */
  mimeType?: string;
  /** Ürün tipi — son fallback için (hiç tasarım yüklenmemiş) */
  product: Product;
  /** Kart boyutu — sepet 80px, /odeme 56px */
  size?: "sm" | "md";
}

function getKindFromMime(mime?: string): "pdf" | "ai" | "psd" | "eps" | "img" | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m === "application/illustrator") return "ai";
  if (m === "image/vnd.adobe.photoshop") return "psd";
  if (m === "application/postscript") return "eps";
  if (m.startsWith("image/")) return "img";
  return null;
}

function getKindFromFileName(name?: string): "pdf" | "ai" | "psd" | "eps" | "img" | null {
  if (!name) return null;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = name.slice(dot).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".ai") return "ai";
  if (ext === ".psd") return "psd";
  if (ext === ".eps") return "eps";
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"].includes(ext)) return "img";
  return null;
}

/** Format rozeti — Adobe brand renklerinde "Ai" / "Ps" / "PDF" / "EPS" */
function FormatBadge({
  kind,
  size,
}: {
  kind: "pdf" | "ai" | "psd" | "eps";
  size: "sm" | "md";
}) {
  const config = {
    pdf: { bg: "#E33", text: "PDF", color: "#FFFFFF" },
    ai: { bg: "#330000", text: "Ai", color: "#FF9A00" },
    psd: { bg: "#001E36", text: "Ps", color: "#31A8FF" },
    eps: { bg: "#5A5A5A", text: "EPS", color: "#FFFFFF" },
  }[kind];
  const fontSize = size === "sm" ? "16px" : "22px";
  return (
    <div
      className="w-full h-full flex items-center justify-center rounded-lg"
      style={{
        background: config.bg,
        color: config.color,
      }}
      role="img"
      aria-label={`${config.text} dosya`}
    >
      <span
        className="font-bold leading-none tracking-tight"
        style={{ fontSize }}
      >
        {config.text}
      </span>
    </div>
  );
}

export function DesignThumb({
  previewUrl,
  fileName,
  mimeType,
  product,
  size = "md",
}: DesignThumbProps) {
  const sizeClass = size === "sm" ? "w-14 h-14" : "w-15 h-15 sm:w-20 sm:h-20";

  // Öncelik 1 — render edilmiş preview varsa direkt göster
  if (previewUrl) {
    return (
      <div
        className={`grid place-items-center ${sizeClass} rounded-lg shrink-0 overflow-hidden bg-white ring-1 ring-gri-200`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={fileName ?? "Tasarım önizlemesi"}
          title={fileName}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  // Öncelik 2 — MIME / uzantıya göre format rozeti
  const kind =
    getKindFromMime(mimeType) ?? getKindFromFileName(fileName);
  if (kind && kind !== "img") {
    return (
      <div className={`${sizeClass} shrink-0`}>
        <FormatBadge kind={kind} size={size} />
      </div>
    );
  }

  // Fallback — ürün ikonu (hiç dosya yüklenmemiş veya tanınmayan format)
  const iconSize = size === "sm" ? 22 : 28;
  return (
    <div
      className={`grid place-items-center ${sizeClass} rounded-lg shrink-0 overflow-hidden ${
        product === "etiket" ? "bg-krem" : "bg-pim-mercan-tint"
      }`}
      aria-label={product === "etiket" ? "Etiket" : "Sticker"}
    >
      {product === "etiket" ? (
        <Icon.Roll size={iconSize} className="text-lacivert" />
      ) : (
        <Icon.Sticker size={iconSize} className="text-pim-mercan" />
      )}
    </div>
  );
}

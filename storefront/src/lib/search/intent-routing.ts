import {
  ETIKET_ENABLED,
  ETIKET_LAUNCH_LABEL,
} from "@/lib/etiket-feature-flags";
import type {
  ParsedSearchIntent,
  SearchIntentAction,
} from "./search-intent-types";

export function buildStickerConfiguratorUrl(
  intent: ParsedSearchIntent
): string {
  const qs = new URLSearchParams();
  qs.set("cut", "diecut");
  if (intent.material) qs.set("material", intent.material);
  if (intent.finish) qs.set("finish", intent.finish);
  if (intent.shape) qs.set("shape", intent.shape);
  if (intent.qty) qs.set("qty", String(intent.qty));
  const query = qs.toString();
  return `/sticker/yapilandir${query ? `?${query}` : ""}`;
}

export function resolveSearchIntentAction(
  intent: ParsedSearchIntent
): SearchIntentAction {
  if (intent.intent === "unclear") {
    return {
      href: null,
      label: "Netleştirelim",
      subtitle: intent.clarifyQuestion,
      showPimLink: true,
    };
  }

  if (intent.productType === "etiket" && !ETIKET_ENABLED) {
    return {
      href: buildStickerConfiguratorUrl({ ...intent, productType: "sticker" }),
      label: "Sticker konfigüratörüne git",
      subtitle: `Etiket baskı ${ETIKET_LAUNCH_LABEL}'da açılıyor — şimdilik sticker tam açık.`,
      etiketDisabled: true,
    };
  }

  if (intent.intent === "configure") {
    if (intent.productType === "sticker") {
      return {
        href: buildStickerConfiguratorUrl(intent),
        label: "Sticker konfigüratörüne git",
        subtitle: intent.sizeHint
          ? `${intent.sizeHint}${intent.qty ? ` · ${intent.qty} adet` : ""}`
          : intent.qty
            ? `${intent.qty} adet`
            : undefined,
      };
    }
    if (intent.productType === "etiket") {
      return {
        href: "/etiket/yapilandir",
        label: "Etiket konfigüratörüne git",
      };
    }
  }

  if (intent.intent === "browse") {
    if (intent.productType === "sticker") {
      return { href: "/sticker", label: "Sticker ürünlerine git" };
    }
    if (intent.productType === "etiket") {
      return { href: "/etiket", label: "Etiket sayfasına git" };
    }
    return { href: "/malzemeler", label: "Malzemelere göz at" };
  }

  if (intent.intent === "info") {
    return {
      href: "/sss",
      label: "Sık sorulan sorular",
      subtitle: "Teslimat, dosya hazırlığı, minimum adet",
    };
  }

  return {
    href: "/sticker",
    label: "Sticker sayfasına git",
    showPimLink: true,
  };
}

/** AI/bütçe yokken basit anahtar kelime eşleşmesi. */
export function fallbackSearchIntent(query: string): ParsedSearchIntent {
  const q = query.toLowerCase();

  if (
    q.includes("etiket") ||
    q.includes("rulo") ||
    q.includes("tabaka etiket")
  ) {
    return {
      intent: "browse",
      productType: "etiket",
      confidence: 0.4,
    };
  }

  if (
    q.includes("sticker") ||
    q.includes("çıkartma") ||
    q.includes("cikartma") ||
    q.includes("vinil") ||
    q.includes("holografik") ||
    q.includes("holo")
  ) {
    const material = q.includes("holo") || q.includes("holografik")
      ? "holo"
      : q.includes("transparan") || q.includes("şeffaf") || q.includes("seffaf")
        ? "transparan"
        : q.includes("simli") || q.includes("glitter")
          ? "simli"
          : "vinil";
    const shape = q.includes("yuvarlak") || q.includes("daire")
      ? "circle"
      : q.includes("kare")
        ? "square"
        : undefined;
    const finish = q.includes("mat")
      ? "mat"
      : q.includes("parlak")
        ? "parlak"
        : undefined;
    const qtyMatch = q.match(/(\d{2,4})\s*adet/);
    const qty = qtyMatch ? Number(qtyMatch[1]) : undefined;

    return {
      intent: shape || material !== "vinil" || qty ? "configure" : "browse",
      productType: "sticker",
      material,
      finish,
      shape,
      qty: qty && qty >= 25 && qty <= 1000 ? qty : undefined,
      confidence: 0.45,
    };
  }

  if (
    q.includes("kargo") ||
    q.includes("teslim") ||
    q.includes("iade") ||
    q.includes("fiyat") ||
    q.includes("dpi") ||
    q.includes("cmvk")
  ) {
    return { intent: "info", productType: "none", confidence: 0.35 };
  }

  return {
    intent: "unclear",
    productType: "none",
    confidence: 0.2,
    clarifyQuestion: "Sticker mi etiket mi arıyorsun, yoksa sipariş/teslimat sorusu mu?",
  };
}

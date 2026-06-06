import { SSS_FAQS_TR } from "./faq-data";

/** FAQPage JSON-LD — TR soru-cevapları (server + client ortak) */
export function getSssFaqSchemaItems(): { q: string; a: string }[] {
  return Object.values(SSS_FAQS_TR).flat().map((f) => ({
    q: f.q,
    a: `${f.summary} ${f.detail}`,
  }));
}

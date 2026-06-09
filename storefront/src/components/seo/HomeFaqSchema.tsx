import { SchemaJsonLd, faqSchema } from "@/components/SchemaJsonLd";
import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faqs";

/** Anasayfa FAQPage JSON-LD */
export function HomeFaqSchema() {
  return <SchemaJsonLd data={faqSchema([...HOME_FAQ_ITEMS])} />;
}

/**
 * Pim faq_lookup — yerel SSS arama (embedding/AI yok).
 */

import { tool } from "ai";
import { z } from "zod";
import {
  SSS_FAQS_EN,
  SSS_FAQS_TR,
  type SssCategory,
  type SssFaqItem,
} from "@/lib/sss/faq-data";

function normalizeTr(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i");
}

function scoreFaq(
  query: string,
  item: SssFaqItem,
  category: SssCategory
): number {
  const q = normalizeTr(query.trim());
  if (!q) return 0;

  const haystack = normalizeTr(
    `${item.q} ${item.summary} ${item.detail} ${category}`
  );

  if (haystack.includes(q)) return 10 + q.length;

  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return 0;

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

export function createFaqLookupTool(locale: "tr" | "en" = "tr") {
  const faqs = locale === "en" ? SSS_FAQS_EN : SSS_FAQS_TR;

  return tool({
    description:
      "SSS veritabanında malzeme, teknik dosya, iade/garanti, KVKK, üretim/teslim, ödeme gibi detay soruları ara. Embedding yok — yerel metin arama.",
    inputSchema: z.object({
      query: z.string().min(2).max(500).describe("Arama sorgusu"),
    }),
    execute: async ({ query }) => {
      const scored: Array<{
        q: string;
        summary: string;
        detail: string;
        category: SssCategory;
        score: number;
      }> = [];

      for (const [category, items] of Object.entries(faqs) as Array<
        [SssCategory, SssFaqItem[]]
      >) {
        for (const item of items) {
          const score = scoreFaq(query, item, category);
          if (score > 0) {
            scored.push({
              q: item.q,
              summary: item.summary,
              detail: item.detail,
              category,
              score,
            });
          }
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 3);

      if (top.length === 0) {
        return { found: false as const };
      }

      return {
        found: true as const,
        results: top.map(({ q, summary, detail, category }) => ({
          q,
          summary,
          detail,
          category,
        })),
      };
    },
  });
}

import type { Metadata } from "next";
import { withSocialMetadata, withTrHreflang } from "./page-metadata";

/** Yasal / politika sayfaları — canonical + hreflang + OG/Twitter */
export function legalPageMetadata(
  title: string,
  description: string,
  canonical: string
): Metadata {
  return {
    title,
    description,
    alternates: withTrHreflang(canonical),
    ...withSocialMetadata({ title, description, canonical }),
  };
}

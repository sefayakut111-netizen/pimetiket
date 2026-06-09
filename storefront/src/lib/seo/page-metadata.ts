import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

const SITE_URL = getSiteUrl();

/** TR-only hreflang — /en prefix açılmadan yalnızca tr-TR + x-default */
export function withTrHreflang(canonical: string): Metadata["alternates"] {
  const path = canonical.startsWith("/") ? canonical : `/${canonical}`;
  const absolute = `${SITE_URL}${path === "/" ? "" : path}`;
  return {
    canonical: path,
    languages: {
      "tr-TR": absolute,
      "x-default": absolute,
    },
  };
}

/** Tutarlı Open Graph + Twitter (summary_large_image) */
export function withSocialMetadata(input: {
  title: string;
  description: string;
  canonical: string;
  ogType?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  const { title, description, canonical, ogType = "website" } = input;
  return {
    openGraph: {
      title,
      description,
      url: canonical,
      type: ogType,
      locale: "tr_TR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

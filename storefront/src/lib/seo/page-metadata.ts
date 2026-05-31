import type { Metadata } from "next";

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

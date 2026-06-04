import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStickerProductName } from "@/lib/sticker-product-name";

const DESCRIPTION =
  "Sticker şekli, malzemesi, yüzeyi ve adetini seç; gerçek zamanlı fiyat ve önizleme. AI dosya kontrolü, 5 iş günü içinde kargoda.";

function pickParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export async function generateMetadata(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = (await props.searchParams) ?? {};
  const name = getStickerProductName({
    sayfa: pickParam(sp.sayfa),
    cut: pickParam(sp.cut),
    shape: pickParam(sp.shape),
    material: pickParam(sp.material),
  });

  return {
    title: `${name} — özelleştir ve fiyat al · Pim Etiket`,
    description: DESCRIPTION,
    alternates: { canonical: "/sticker/yapilandir" },
    robots: { index: false, follow: true },
  };
}

export default function StickerYapilandirLayout({ children }: { children: ReactNode }) {
  return children;
}

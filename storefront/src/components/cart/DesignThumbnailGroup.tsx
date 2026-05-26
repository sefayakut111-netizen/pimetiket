/**
 * Multi-design thumbnail grid — sepet, ödeme ve sipariş özetinde
 * designPreviewUrl + additionalDesigns[] birlikte gösterilir.
 */

import type { CustomerCartItem } from "@/lib/customer-cart";
import { DesignThumb } from "./DesignThumb";

type Product = CustomerCartItem["product"];

export interface DesignPreviewEntry {
  previewUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export function designPreviewsFromCartItem(
  item: Pick<
    CustomerCartItem,
    | "designPreviewUrl"
    | "designFileName"
    | "designMimeType"
    | "additionalDesigns"
  >
): DesignPreviewEntry[] {
  const entries: DesignPreviewEntry[] = [];
  if (
    item.designPreviewUrl ||
    item.designFileName ||
    item.designMimeType
  ) {
    entries.push({
      previewUrl: item.designPreviewUrl,
      fileName: item.designFileName,
      mimeType: item.designMimeType,
    });
  }
  for (const d of item.additionalDesigns ?? []) {
    entries.push({
      previewUrl: d.previewUrl,
      fileName: d.fileName,
      mimeType: d.mimeType,
    });
  }
  return entries;
}

export function DesignThumbnailGroup({
  item,
  size = "md",
  previews,
}: {
  item: Pick<CustomerCartItem, "product"> &
    Parameters<typeof designPreviewsFromCartItem>[0];
  size?: "sm" | "md";
  /** API'den gelen liste varsa cart yerine kullan */
  previews?: DesignPreviewEntry[];
}) {
  const entries = previews ?? designPreviewsFromCartItem(item);

  if (entries.length === 0) {
    return <DesignThumb product={item.product} size={size} />;
  }

  if (entries.length === 1) {
    const e = entries[0];
    return (
      <DesignThumb
        previewUrl={e.previewUrl}
        fileName={e.fileName}
        mimeType={e.mimeType}
        product={item.product}
        size={size}
      />
    );
  }

  const primary = entries[0];
  const others = entries.slice(1);
  const thumbSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <DesignThumb
        previewUrl={primary.previewUrl}
        fileName={primary.fileName}
        mimeType={primary.mimeType}
        product={item.product}
        size={size}
      />
      {others.length > 0 && (
        <div className="border-t border-gri-200 pt-1.5">
          <div className="text-[10px] font-semibold text-gri-500 uppercase tracking-wide mb-1">
            Diğer tasarımlar
          </div>
          <div className="flex gap-1 flex-wrap">
            {others.map((e, i) => (
              <div
                key={`${e.fileName ?? "design"}-${i + 1}`}
                className={`${thumbSize} rounded overflow-hidden bg-gri-100 ring-1 ring-gri-200 shrink-0`}
                title={e.fileName ?? `Tasarım ${i + 2}`}
              >
                {e.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={e.previewUrl}
                    alt={e.fileName ?? `Tasarım ${i + 2}`}
                    className="w-full h-full object-contain bg-white"
                    loading="lazy"
                  />
                ) : (
                  <DesignThumb
                    previewUrl={undefined}
                    fileName={e.fileName}
                    mimeType={e.mimeType}
                    product={item.product}
                    size="sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

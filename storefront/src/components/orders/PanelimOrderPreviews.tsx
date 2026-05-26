"use client";

import type { CustomerOrder } from "@/lib/customer-order";
import { DesignThumb } from "@/components/cart/DesignThumb";
import {
  designPreviewsFromCartItem,
  type DesignPreviewEntry,
} from "@/components/cart/DesignThumbnailGroup";
import type { OrderDesignFilesByItem } from "./OrderCardDesignPreview";
import { OrderItemDesignPreview } from "./OrderItemDesignPreview";

type OrderItem = CustomerOrder["items"][number];

function resolvePreviews(
  item: OrderItem,
  designFiles?: OrderDesignFilesByItem[string]
): DesignPreviewEntry[] {
  const apiPreviews: DesignPreviewEntry[] =
    designFiles?.map((df) => ({
      previewUrl: df.previewUrl,
      fileName: df.fileName,
      mimeType: df.mimeType,
    })) ?? [];
  const cartPreviews = designPreviewsFromCartItem(item);
  return apiPreviews.length > 0 ? apiPreviews : cartPreviews;
}

/** Sol sütun — birincil tasarım (eski büyük önizleme boyutu). */
export function PanelimPrimaryPreview({
  orderId,
  item,
  designFiles,
}: {
  orderId: string;
  item: OrderItem;
  designFiles?: OrderDesignFilesByItem[string];
}) {
  const previews = resolvePreviews(item, designFiles);
  if (previews.length <= 1) {
    return (
      <OrderItemDesignPreview
        orderId={orderId}
        item={item}
        designFiles={designFiles}
        size="md"
      />
    );
  }
  const primary = previews[0];
  return (
    <DesignThumb
      previewUrl={primary.previewUrl}
      fileName={primary.fileName}
      mimeType={primary.mimeType}
      product={item.product}
      size="md"
    />
  );
}

/** Üretim çizelgesinin altında — diğer tasarımlar küçük thumb + ad. */
export function PanelimAdditionalDesignsRow({
  item,
  designFiles,
}: {
  item: OrderItem;
  designFiles?: OrderDesignFilesByItem[string];
}) {
  const previews = resolvePreviews(item, designFiles);
  const others = previews.slice(1);
  if (others.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gri-100 pt-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gri-600">
        Diğer tasarımlar
      </div>
      <div className="flex flex-wrap gap-3">
        {others.map((entry, i) => (
          <div
            key={`${entry.fileName ?? "design"}-${i + 2}`}
            className="flex w-[4.5rem] flex-col items-center gap-1"
          >
            <DesignThumb
              previewUrl={entry.previewUrl}
              fileName={entry.fileName}
              mimeType={entry.mimeType}
              product={item.product}
              size="sm"
            />
            <span className="text-[11px] font-medium text-gri-800">
              Tasarım {i + 2}
            </span>
            {entry.fileName && (
              <span
                className="max-w-[4.5rem] truncate text-center text-[10px] text-gri-600"
                title={entry.fileName}
              >
                {entry.fileName}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

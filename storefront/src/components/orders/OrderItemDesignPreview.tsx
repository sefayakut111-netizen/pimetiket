"use client";

import { useEffect, useState } from "react";
import type { CustomerCartItem } from "@/lib/customer-cart";
import { DesignThumb } from "@/components/cart/DesignThumb";
import {
  DesignThumbnailGroup,
  designPreviewsFromCartItem,
  type DesignPreviewEntry,
} from "@/components/cart/DesignThumbnailGroup";
import { isPersistentPreviewUrl } from "@/lib/design-preview/preview-url";

export interface OrderDesignFilePreview {
  id: string;
  fileName: string;
  mimeType: string;
  previewUrl?: string;
}

type OrderItem = Pick<
  CustomerCartItem,
  | "id"
  | "product"
  | "designPreviewUrl"
  | "designFileName"
  | "designMimeType"
  | "additionalDesigns"
>;

export function OrderItemDesignPreview({
  orderId,
  item,
  designFiles,
  size = "sm",
  onPreview,
}: {
  orderId: string;
  item: OrderItem;
  designFiles?: OrderDesignFilePreview[];
  size?: "sm" | "md";
  onPreview?: (url: string) => void;
}) {
  const apiPreviews: DesignPreviewEntry[] =
    designFiles?.map((df) => ({
      previewUrl: df.previewUrl,
      fileName: df.fileName,
      mimeType: df.mimeType,
    })) ?? [];

  const cartPreviews = designPreviewsFromCartItem(item).map((entry) => ({
    ...entry,
    previewUrl: isPersistentPreviewUrl(entry.previewUrl)
      ? entry.previewUrl
      : undefined,
  }));
  const previews = apiPreviews.length > 0 ? apiPreviews : cartPreviews;

  if (previews.length > 1) {
    const group = (
      <DesignThumbnailGroup
        item={{ ...item, product: item.product }}
        size={size}
        previews={previews}
      />
    );
    if (onPreview && previews[0]?.previewUrl) {
      return (
        <button
          type="button"
          onClick={() => onPreview(previews[0].previewUrl!)}
          className="cursor-zoom-in shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-pim-mercan/40"
          aria-label="Tasarımı büyüt"
        >
          {group}
        </button>
      );
    }
    return group;
  }

  return (
    <OrderItemDesignThumb
      orderId={orderId}
      itemId={item.id}
      fallbackPreviewUrl={
        isPersistentPreviewUrl(item.designPreviewUrl ?? previews[0]?.previewUrl)
          ? (item.designPreviewUrl ?? previews[0]?.previewUrl)
          : undefined
      }
      fileName={item.designFileName ?? previews[0]?.fileName}
      mimeType={item.designMimeType ?? previews[0]?.mimeType}
      product={item.product}
      size={size}
      onPreview={onPreview}
    />
  );
}

export function OrderItemDesignThumb({
  orderId,
  itemId,
  fallbackPreviewUrl,
  fileName,
  mimeType,
  product,
  size = "sm",
  onPreview,
}: {
  orderId: string;
  itemId: string;
  fallbackPreviewUrl?: string;
  fileName?: string;
  mimeType?: string;
  product: "sticker" | "etiket";
  size?: "sm" | "md";
  onPreview?: (url: string) => void;
}) {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [fetchedMime, setFetchedMime] = useState<string | undefined>(undefined);
  const [fetchedName, setFetchedName] = useState<string | undefined>(undefined);
  const [fallbackBroken, setFallbackBroken] = useState(false);
  const [retryFetch, setRetryFetch] = useState(0);

  const stableFallback =
    fallbackPreviewUrl && !fallbackBroken ? fallbackPreviewUrl : undefined;
  const previewUrl = stableFallback ?? fetchedUrl ?? undefined;

  useEffect(() => {
    if (stableFallback && retryFetch === 0) return;
    let active = true;
    void fetch(`/api/orders/${orderId}/items/${itemId}/design-url?thumb=1`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: { url?: string; mimeType?: string; fileName?: string } | null) => {
          if (!active || !data?.url) return;
          const isRaster =
            data.mimeType?.startsWith("image/") &&
            !data.mimeType.includes("svg");
          if (isRaster) {
            setFetchedUrl(data.url);
          }
          setFetchedMime(data.mimeType);
          setFetchedName(data.fileName);
        }
      )
      .catch(() => {
        /* sessiz */
      });
    return () => {
      active = false;
    };
  }, [orderId, itemId, stableFallback, retryFetch]);

  const thumb = (
    <DesignThumb
      previewUrl={previewUrl}
      fileName={fileName ?? fetchedName}
      mimeType={mimeType ?? fetchedMime}
      product={product}
      size={size}
      onImageError={() => {
        if (stableFallback) {
          setFallbackBroken(true);
          setRetryFetch((n) => n + 1);
        }
      }}
    />
  );

  if (onPreview && previewUrl) {
    return (
      <button
        type="button"
        onClick={() => onPreview(previewUrl)}
        className="cursor-zoom-in shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-pim-mercan/40"
        aria-label="Tasarımı büyüt"
      >
        {thumb}
      </button>
    );
  }

  return thumb;
}

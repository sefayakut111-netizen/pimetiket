import type { OrderDesignFilesByItem } from "@/components/orders/OrderCardDesignPreview";

export type OrderDesignFilesMap = Record<string, OrderDesignFilesByItem>;

interface UploadStatusItem {
  id: string;
  designFiles?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    previewUrl?: string;
  }>;
}

/** Tek sipariş upload-status → itemId → designFiles */
export async function fetchOrderDesignFiles(
  orderId: string
): Promise<OrderDesignFilesByItem | null> {
  try {
    const res = await fetch(`/api/orders/${orderId}/upload-status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: UploadStatusItem[] };
    if (!data.items) return null;
    const map: OrderDesignFilesByItem = {};
    for (const it of data.items) {
      map[it.id] = (it.designFiles ?? []).map((df) => ({
        id: df.id,
        fileName: df.fileName,
        mimeType: df.mimeType,
        previewUrl: df.previewUrl,
      }));
    }
    return map;
  } catch {
    return null;
  }
}

/** Paralel prefetch — orderId → item design files */
export async function prefetchOrderDesignFiles(
  orderIds: string[]
): Promise<OrderDesignFilesMap> {
  const unique = [...new Set(orderIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const results = await Promise.all(
    unique.map(async (orderId) => {
      const files = await fetchOrderDesignFiles(orderId);
      return [orderId, files] as const;
    })
  );

  const map: OrderDesignFilesMap = {};
  for (const [orderId, files] of results) {
    if (files) map[orderId] = files;
  }
  return map;
}

/** Meta'da tüm item'lar için preview varsa upload-status atlanabilir */
export function orderHasMetaPreviews(order: {
  items: Array<{
    designPreviewUrl?: string;
    additionalDesigns?: Array<{ previewUrl?: string }>;
  }>;
}): boolean {
  if (order.items.length === 0) return false;
  return order.items.every((item) => {
    if (item.designPreviewUrl) return true;
    return (item.additionalDesigns ?? []).some((d) => d.previewUrl);
  });
}

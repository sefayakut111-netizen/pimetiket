import type { OrderDesignFilesByItem } from "@/components/orders/OrderCardDesignPreview";
import { getExpectedDesignCount } from "@/lib/order-item-meta";

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

type OrderPreviewItem = {
  designCount?: number;
  designPreviewUrl?: string;
  additionalDesigns?: Array<{ previewUrl?: string }>;
};

function itemHasAllMetaPreviews(item: OrderPreviewItem): boolean {
  const expected = getExpectedDesignCount(
    {
      designCount: item.designCount,
      additionalDesigns: item.additionalDesigns,
    },
    0
  );
  if (expected <= 1) {
    return Boolean(item.designPreviewUrl?.trim());
  }
  const slotUrls: (string | undefined)[] = [
    item.designPreviewUrl,
    ...(item.additionalDesigns ?? []).map((d) => d.previewUrl),
  ];
  for (let i = 0; i < expected; i++) {
    const url = slotUrls[i];
    if (!url?.trim()) return false;
  }
  return true;
}

/** Tüm item/slot'larda meta preview varsa upload-status atlanabilir */
export function orderHasMetaPreviews(order: {
  items: OrderPreviewItem[];
}): boolean {
  if (order.items.length === 0) return false;
  return order.items.every(itemHasAllMetaPreviews);
}

import type { OrderDesignFilesByItem } from "@/components/orders/OrderCardDesignPreview";
import { getExpectedDesignCount } from "@/lib/order-item-meta";
import { metaPreviewUrlsArePersistent, isPersistentPreviewUrl } from "@/lib/design-preview/preview-url";

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
    return metaPreviewUrlsArePersistent({
      designPreviewUrl: item.designPreviewUrl,
    });
  }
  const slotUrls: (string | undefined)[] = [
    item.designPreviewUrl,
    ...(item.additionalDesigns ?? []).map((d) => d.previewUrl),
  ];
  for (let i = 0; i < expected; i++) {
    const url = slotUrls[i];
    if (!isPersistentPreviewUrl(url)) return false;
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

type DesignMetaItem = {
  designCount?: number;
  designFileName?: string;
  designPreviewUrl?: string;
  designMimeType?: string;
  additionalDesigns?: Array<{
    fileName: string;
    previewUrl?: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
};

type DesignDbFile = {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  status?: string;
  previewUrl?: string;
  mimeType?: string;
  storagePath?: string;
  flags: Array<{ kind: "ok" | "warning" | "error"; message: string }>;
};

export type DesignSlotDisplay = DesignDbFile & {
  slotIndex: number;
  pendingLink?: boolean;
};

/** DB kayıtları + meta slot'ları birleştir — multi-design listesi. */
export function buildDesignSlotDisplay(
  item: DesignMetaItem | undefined,
  dbFiles: DesignDbFile[]
): DesignSlotDisplay[] {
  const metaSlots: Array<{
    fileName: string;
    previewUrl?: string;
    mimeType?: string;
    sizeBytes?: number;
  }> = [];

  if (item?.designFileName || item?.designPreviewUrl) {
    metaSlots.push({
      fileName: item.designFileName ?? "Tasarım 1",
      previewUrl: item.designPreviewUrl,
      mimeType: item.designMimeType,
    });
  }
  for (const ad of item?.additionalDesigns ?? []) {
    metaSlots.push({
      fileName: ad.fileName,
      previewUrl: ad.previewUrl,
      mimeType: ad.mimeType,
      sizeBytes: ad.sizeBytes,
    });
  }

  const expected = getExpectedDesignCount(
    {
      designCount: item?.designCount,
      additionalDesigns: item?.additionalDesigns,
    },
    Math.max(dbFiles.length, metaSlots.length)
  );

  const usedDb = new Set<string>();
  const entries: DesignSlotDisplay[] = [];

  for (let i = 0; i < expected; i++) {
    const meta = metaSlots[i];
    let db =
      meta &&
      dbFiles.find(
        (f) => !usedDb.has(f.id) && f.name === meta.fileName
      );
    if (!db) {
      db = dbFiles.find((f) => !usedDb.has(f.id));
    }
    if (db) {
      usedDb.add(db.id);
      entries.push({ ...db, slotIndex: i });
    } else if (meta) {
      entries.push({
        id: `meta-${i}`,
        name: meta.fileName,
        size: meta.sizeBytes ?? 0,
        uploadedAt: 0,
        previewUrl: meta.previewUrl,
        mimeType: meta.mimeType,
        flags: [],
        slotIndex: i,
        pendingLink: true,
      });
    }
  }

  for (const db of dbFiles) {
    if (!usedDb.has(db.id)) {
      entries.push({ ...db, slotIndex: entries.length });
    }
  }

  if (entries.length === 0 && dbFiles.length > 0) {
    return dbFiles.map((f, i) => ({ ...f, slotIndex: i }));
  }

  return entries;
}

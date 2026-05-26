"use client";

import type { CustomerOrder } from "@/lib/customer-order";
import {
  OrderItemDesignPreview,
  type OrderDesignFilePreview,
} from "./OrderItemDesignPreview";

const MAX_ITEMS_SHOWN = 3;

export type OrderDesignFilesByItem = Record<string, OrderDesignFilePreview[]>;

export function OrderCardDesignPreview({
  orderId,
  items,
  designFilesByItem,
  size = "sm",
  compactMultiItem = true,
}: {
  orderId: string;
  items: CustomerOrder["items"];
  designFilesByItem?: OrderDesignFilesByItem;
  size?: "sm" | "md";
  /** Çok item'da primary thumb boyutunu küçült */
  compactMultiItem?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    const item = items[0];
    return (
      <OrderItemDesignPreview
        orderId={orderId}
        item={item}
        designFiles={designFilesByItem?.[item.id]}
        size={size}
      />
    );
  }

  const shown = items.slice(0, MAX_ITEMS_SHOWN);
  const rest = items.length - shown.length;
  const itemSize = compactMultiItem ? "sm" : size;

  return (
    <div className="flex flex-row flex-wrap items-center gap-1.5">
      {shown.map((item) => (
        <div key={item.id} className="shrink-0">
          <OrderItemDesignPreview
            orderId={orderId}
            item={item}
            designFiles={designFilesByItem?.[item.id]}
            size={itemSize}
          />
        </div>
      ))}
      {rest > 0 && (
        <span className="text-[10px] font-semibold text-gri-500 tabular-nums">
          +{rest}
        </span>
      )}
    </div>
  );
}

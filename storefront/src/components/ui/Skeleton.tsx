/**
 * Skeleton — yüklenirken gri pulse placeholder.
 *
 * Kullanım:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton.Card />
 *   <Skeleton.OrderRow />
 *   <Skeleton.AdminTable rows={5} />
 */

import { cn } from "@/lib/cn";

interface SkeletonBaseProps {
  className?: string;
}

function SkeletonBase({ className }: SkeletonBaseProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "block bg-gradient-to-r from-gri-100 via-gri-200 to-gri-100 bg-[length:200%_100%] animate-[shimmer_1.6s_ease-in-out_infinite] rounded",
        className
      )}
    />
  );
}

/** Tek bir cart/sipariş satırı placeholder'ı */
function OrderRow() {
  return (
    <div className="flex gap-4 p-5 rounded-2xl bg-white ring-1 ring-gri-200">
      <SkeletonBase className="h-16 w-16 shrink-0 rounded-lg" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBase className="h-4 w-3/4" />
        <SkeletonBase className="h-3 w-1/2" />
        <SkeletonBase className="h-3 w-1/3" />
      </div>
      <div className="text-right space-y-2 shrink-0">
        <SkeletonBase className="h-5 w-20" />
        <SkeletonBase className="h-3 w-12 ml-auto" />
      </div>
    </div>
  );
}

/** Generic kart placeholder'ı */
function Card({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "p-5 rounded-2xl bg-white ring-1 ring-gri-200 space-y-3",
        className
      )}
    >
      <SkeletonBase className="h-5 w-1/3" />
      <SkeletonBase className="h-4 w-full" />
      <SkeletonBase className="h-4 w-5/6" />
      <SkeletonBase className="h-4 w-4/6" />
    </div>
  );
}

/** Admin tablo placeholder'ı */
function AdminTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gri-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gri-200 bg-gri-50">
        <SkeletonBase className="h-3 w-1/4" />
      </div>
      <div className="divide-y divide-gri-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 p-4 items-center">
            <SkeletonBase className="h-4 w-3/4" />
            <SkeletonBase className="h-4 w-1/2" />
            <SkeletonBase className="h-4 w-16" />
            <SkeletonBase className="h-7 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** KPI strip placeholder (4 kart) */
function KpiStrip() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-5 rounded-2xl bg-white ring-1 ring-gri-200 space-y-2"
        >
          <SkeletonBase className="h-3 w-2/3" />
          <SkeletonBase className="h-7 w-16" />
          <SkeletonBase className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

const Skeleton = SkeletonBase as typeof SkeletonBase & {
  OrderRow: typeof OrderRow;
  Card: typeof Card;
  AdminTable: typeof AdminTable;
  KpiStrip: typeof KpiStrip;
};

Skeleton.OrderRow = OrderRow;
Skeleton.Card = Card;
Skeleton.AdminTable = AdminTable;
Skeleton.KpiStrip = KpiStrip;

export { Skeleton };

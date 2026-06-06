/**
 * Pim Etiket — order helpers (storefront-side).
 *
 * OrderStatus tipi PLAN.md §I'daki state machine'in basitleştirilmiş
 * hali. F+I adımında Medusa backend ile tam senkron olacak.
 *
 * Müşteri view (/siparislerim) ve admin view (/admin/siparisler) ortak
 * tip kullanır; STATUS_META label'ları her sayfada kendi konteksti
 * için tanımlanır (müşteri "Kontrolde" görür, admin "AI flag" gibi
 * daha teknik label görür).
 */

/**
 * Sefa 19 May v68 (su borusu denetimi):
 * DB enum 14 değer, TS önceden 9 değerde idi → 5 değer kayıp:
 *   proof_generating, fason_assigned, human_review,
 *   human_review_failed, ready_to_ship.
 * Bunlar /api/admin/ai-qc/decide ve /api/admin/orders/[id]/status
 * endpoint'lerinde DB'ye set ediliyordu ama TS tipi tanımıyordu.
 * Şimdi 14/14 tam senkron.
 */
export type OrderStatus =
  // Sipariş alındı
  | "paid" // Geçici state — paid trigger anında awaiting_upload veya proof_pending'e geçer

  // Ödeme sonrası dosya bekleyiş (Mig 061)
  | "awaiting_upload" // Ödeme yapıldı ama tasarım henüz yüklenmedi — müşteri /siparis/[id]/tasarim-yukle'ye

  // AI QC akışı
  | "qc_pending" // Dosya yüklendi, AI ön kontrol + operatör sırasında
  | "qc_flagged" // AI flag'ledi, manuel inceleme gerek
  | "operator_review" // Operatör inceliyor — SADECE manuel atama (admin /siparisler/[id]); otomatik trigger YOK. Mig 039 sonrası tercih: human_review.
  | "human_review" // İnsan incelemesinde — qc_flagged sonrası otomatik trigger ile gelen state (operator_review'un modern karşılığı)
  | "human_review_failed" // İnceleme reddetti — müşteriye düzeltme iste (Mig 039)

  // Prova / Baskı Onay (Mig 059 — POC entegrasyonu)
  | "proof_generating" // Prova hazırlanıyor (otomatik render, Mig 039)
  | "proof_pending" // Müşteri baskı önizleme onay sayfasında (/onay/[id])
  // proof_validating: müşteri düzenleme yaptı, AI tekrar doğruluyor (kısa ömürlü 3-10sn)
  | "proof_validating"
  | "proof_approved" // Tüm itemler müşteri tarafından onaylandı (Mig 059)
  | "operator_print_review" // Baskı öncesi operatör onayı (Mig 154 — FAZ 1, henüz akışta değil)

  // Üretim
  | "ready_to_ship" // AI QC + prova geçti, üretime hazır (Mig 039)
  | "fason_assigned" // Fason atölyeye atandı (Mig 039)
  | "in_production" // Fason atölyede üretimde

  // Sevkiyat
  | "shipped" // Kargoya verildi
  | "delivered" // Teslim edildi

  // İptal
  | "cancelled"; // İptal edildi

/** Tüm geçerli order_status değerleri — tek kaynak (UI + API senkron) */
export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "operator_review",
  "human_review",
  "human_review_failed",
  "proof_generating",
  "proof_pending",
  "proof_validating",
  "proof_approved",
  "operator_print_review",
  "ready_to_ship",
  "fason_assigned",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

/** Sidebar badge — iptal hariç sipariş sayısı (liste ile uyumlu) */
export function countActiveOrdersForBadge(
  orders: ReadonlyArray<{ status: string }>
): number {
  return orders.filter((o) => o.status !== "cancelled").length;
}

export function countCancelledOrders(
  orders: ReadonlyArray<{ status: string }>
): number {
  return orders.filter((o) => o.status === "cancelled").length;
}

/** Admin liste filtre chip gruplari (8 chip) */
export type AdminStatusChipId =
  | "all"
  | "tasarim"
  | "inceleniyor"
  | "musteri_onayi"
  | "uretime_hazir"
  | "uretimde"
  | "kargo_teslim"
  | "iptal";

export const ADMIN_STATUS_CHIP_MAP: Record<
  Exclude<AdminStatusChipId, "all">,
  readonly OrderStatus[]
> = {
  tasarim: ["paid", "awaiting_upload"],
  inceleniyor: [
    "qc_pending",
    "qc_flagged",
    "human_review",
    "human_review_failed",
    "operator_review",
  ],
  musteri_onayi: ["proof_generating", "proof_validating", "proof_pending"],
  uretime_hazir: ["proof_approved", "operator_print_review", "ready_to_ship"],
  uretimde: ["fason_assigned", "in_production"],
  kargo_teslim: ["shipped", "delivered"],
  iptal: ["cancelled"],
};

export const ADMIN_STATUS_FILTER_CHIPS: ReadonlyArray<{
  id: AdminStatusChipId;
  label: string;
}> = [
  { id: "all", label: "Tümü" },
  { id: "tasarim", label: "Tasarım bekleniyor" },
  { id: "inceleniyor", label: "İnceleniyor" },
  { id: "musteri_onayi", label: "Müşteri onayı" },
  { id: "uretime_hazir", label: "Üretime hazır" },
  { id: "uretimde", label: "Üretimde" },
  { id: "kargo_teslim", label: "Kargo + Teslim" },
  { id: "iptal", label: "İptal" },
];

export function statusesForAdminChip(
  chipId: AdminStatusChipId
): OrderStatus[] | null {
  if (chipId === "all") return null;
  return [...ADMIN_STATUS_CHIP_MAP[chipId]];
}

export function adminChipMatchesFilters(
  chipId: AdminStatusChipId,
  filters: OrderStatus[] | null
): boolean {
  if (chipId === "all") return !filters || filters.length === 0;
  if (!filters?.length) return false;
  const expected = ADMIN_STATUS_CHIP_MAP[chipId];
  return (
    filters.length === expected.length &&
    expected.every((s) => filters.includes(s))
  );
}

export function countOrdersForAdminChip(
  orders: ReadonlyArray<{ status: string }>,
  chipId: AdminStatusChipId
): number {
  if (chipId === "all") return orders.length;
  const statuses = ADMIN_STATUS_CHIP_MAP[chipId];
  return orders.filter((o) =>
    statuses.includes(o.status as OrderStatus)
  ).length;
}

/** Admin manuel status güncelleme dropdown'u — tüm enum değerleri */
export const ADMIN_MANUAL_SET_STATUSES: readonly OrderStatus[] =
  ORDER_STATUS_VALUES;

/** İleri yönlü durum geçiş sırası — admin detay sayfası */
export const ADMIN_STATUS_FORWARD_ORDER: readonly OrderStatus[] = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "operator_review",
  "human_review",
  "human_review_failed",
  "proof_generating",
  "proof_validating",
  "proof_pending",
  "proof_approved",
  "operator_print_review",
  "ready_to_ship",
  "fason_assigned",
  "in_production",
  "shipped",
  "delivered",
];

/** Tahmini teslim tarihi gösterilmeden önceki durumlar (prova/üretim öncesi). */
export const PRE_PRODUCTION_DELIVERY_STATUSES: readonly OrderStatus[] = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "operator_review",
  "human_review",
  "human_review_failed",
  "proof_generating",
  "proof_pending",
  "proof_validating",
  "proof_approved",
  "operator_print_review",
];

export function isPreProductionDeliveryStatus(status: OrderStatus): boolean {
  return PRE_PRODUCTION_DELIVERY_STATUSES.includes(status);
}

/** Geri yönlü durum değişikliğine izin verme — cancelled hariç */
export function isForwardStatusTransition(
  current: OrderStatus,
  target: OrderStatus
): boolean {
  if (target === "cancelled") {
    return current !== "cancelled" && current !== "delivered";
  }
  if (target === current) return false;
  const order = ADMIN_STATUS_FORWARD_ORDER;
  const curIdx = order.indexOf(current);
  const tgtIdx = order.indexOf(target);
  if (curIdx === -1 || tgtIdx === -1) return target !== current;
  return tgtIdx > curIdx;
}

/** Üretim partneri atanmamış — modern akış statüleri */
export const UNASSIGNED_PRODUCTION_STATUSES: readonly OrderStatus[] = [
  "ready_to_ship",
  "proof_approved",
];

/** AI QC kuyruk + dashboard badge — prova/baskı incelemesi hariç (→ /admin/prova) */
export const AI_QC_ACTIVE_STATUSES: readonly OrderStatus[] = [
  "qc_pending",
  "qc_flagged",
  "human_review",
  "human_review_failed",
];

/** Admin sipariş listesi — tek veya çoklu durum filtresi URL'si */
export function adminOrdersListHref(
  statuses: OrderStatus | readonly OrderStatus[]
): string {
  const arr = Array.isArray(statuses) ? [...statuses] : [statuses];
  if (arr.length === 0) return "/admin/siparisler";
  if (arr.length === 1) return `/admin/siparisler?status=${arr[0]}`;
  return `/admin/siparisler?status=${arr.join(",")}`;
}

/** ?status= veya ?status=a,b URL'sinden durum filtresi */
export function parseAdminStatusFilter(
  raw: string | null,
  allParams?: string[]
): OrderStatus[] | null {
  const parts: string[] = [];
  if (allParams && allParams.length > 1) {
    parts.push(...allParams);
  } else if (raw) {
    parts.push(...raw.split(","));
  }
  if (parts.length === 0 || parts[0] === "all") return null;
  const valid = parts
    .map((s) => s.trim())
    .filter((s): s is OrderStatus => isOrderStatus(s));
  return valid.length > 0 ? valid : null;
}

/** Fason atama paneli gösterilecek statüler */
export const FASON_ASSIGN_ELIGIBLE_STATUSES: readonly OrderStatus[] = [
  "operator_review",
  "proof_approved",
  "operator_print_review",
  "ready_to_ship",
  "in_production",
];

/** Admin toplu status değiştirme — izin verilen geçişler (Sprint 2) */
export const VALID_BULK_TRANSITIONS: Partial<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  paid: ["qc_pending", "cancelled"],
  awaiting_upload: ["cancelled"],
  qc_pending: ["proof_generating", "human_review", "cancelled"],
  proof_pending: ["proof_validating", "proof_approved", "cancelled"],
  proof_validating: ["proof_pending", "operator_review", "cancelled"],
  proof_approved: ["ready_to_ship", "operator_print_review"],
  operator_print_review: ["ready_to_ship", "proof_generating", "cancelled"],
  ready_to_ship: ["in_production"],
  in_production: ["shipped"],
  shipped: ["delivered"],
};

/** Tek satır admin dropdown — izin verilen geçişler */
export const VALID_SINGLE_TRANSITIONS: Partial<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  paid: ["qc_pending", "awaiting_upload", "cancelled"],
  awaiting_upload: ["qc_pending", "cancelled"],
  qc_pending: ["proof_generating", "human_review", "qc_flagged", "cancelled"],
  qc_flagged: ["human_review", "cancelled"],
  human_review: ["proof_generating", "human_review_failed", "cancelled"],
  human_review_failed: ["qc_pending", "cancelled"],
  proof_generating: ["proof_pending", "human_review"],
  proof_pending: ["proof_approved", "cancelled"],
  proof_validating: ["proof_pending"],
  proof_approved: ["ready_to_ship", "operator_print_review"],
  operator_print_review: ["ready_to_ship", "proof_generating", "cancelled"],
  ready_to_ship: ["in_production", "fason_assigned"],
  fason_assigned: ["in_production"],
  in_production: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function getValidTransitions(currentStatus: OrderStatus): OrderStatus[] {
  return [...(VALID_SINGLE_TRANSITIONS[currentStatus] ?? [])];
}

export function isValidBulkTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  const allowed = VALID_BULK_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/** Seçili siparişlerin hepsine uygulanabilecek ortak hedef statüler */
export function getCommonBulkTransitionTargets(
  statuses: OrderStatus[]
): OrderStatus[] {
  if (statuses.length === 0) return [];
  const perOrder = statuses.map(
    (s) => VALID_BULK_TRANSITIONS[s] ?? ([] as OrderStatus[])
  );
  return perOrder.reduce<OrderStatus[]>(
    (acc, curr) => acc.filter((t) => curr.includes(t)),
    [...perOrder[0]!]
  );
}

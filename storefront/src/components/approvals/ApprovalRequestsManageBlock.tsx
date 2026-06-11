"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ApprovalRequestPayload } from "@/lib/approvals/types";
import {
  APPROVAL_STATUS_BADGE,
  approvalSourceLabel,
  formatApprovalDate,
} from "@/lib/approvals/approval-ui";
import { ApprovalAssetGrid } from "@/components/approvals/ApprovalAssetGrid";
import {
  CreateApprovalRequestModal,
  type ApprovalOrderItemOption,
} from "@/components/approvals/CreateApprovalRequestModal";

interface ApprovalRequestsManageBlockProps {
  orderId: string;
  mode: "admin" | "partner";
  orderItems?: ApprovalOrderItemOption[];
  /** Partner: yalnızca aktif atamada göster */
  visible?: boolean;
  canCreate?: boolean;
  canCancel?: boolean;
}

export function ApprovalRequestsManageBlock({
  orderId,
  mode,
  orderItems = [],
  visible = true,
  canCreate = true,
  canCancel = false,
}: ApprovalRequestsManageBlockProps) {
  const toast = useToast();
  const [requests, setRequests] = useState<ApprovalRequestPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const listUrl =
    mode === "admin"
      ? `/api/admin/orders/${orderId}/approval-requests`
      : `/api/partner/orders/${orderId}/approval-requests`;
  const postBase =
    mode === "admin" ? "/api/admin/orders" : "/api/partner/orders";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl, { cache: "no-store" });
      if (!res.ok) {
        setRequests([]);
        return;
      }
      const data = (await res.json()) as { requests?: ApprovalRequestPayload[] };
      setRequests(data.requests ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  const handleCancel = async (reqId: string) => {
    if (mode !== "admin" || !canCancel) return;
    setCancellingId(reqId);
    try {
      const res = await fetch(
        `/api/admin/orders/${orderId}/approval-requests/${reqId}/cancel`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "İptal edilemedi");
        return;
      }
      toast.success("Onay görseli isteği iptal edildi");
      await load();
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setCancellingId(null);
    }
  };

  if (!visible) return null;

  return (
    <Card padding="p-5" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-lacivert">
          Onay görselleri
        </h2>
        {canCreate ? (
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setModalOpen(true)}
          >
            Onay görseli iste
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gri-600">Yükleniyor…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gri-600">
          Henüz onay görseli isteği yok.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const badge =
              APPROVAL_STATUS_BADGE[
                req.status as keyof typeof APPROVAL_STATUS_BADGE
              ] ?? APPROVAL_STATUS_BADGE.pending;
            return (
              <div
                key={req.id}
                className="rounded-lg border border-gri-200 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-lacivert">
                      {req.title}
                    </p>
                    <p className="text-[11px] text-gri-600 mt-0.5">
                      {approvalSourceLabel(req.source)} ·{" "}
                      {formatApprovalDate(req.created_at)}
                      {req.blocking ? " · Üretim bekliyor" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      badge.bg,
                      badge.color
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                {req.message ? (
                  <p className="mt-2 text-sm text-gri-700">{req.message}</p>
                ) : null}
                {req.customer_comment ? (
                  <p className="mt-2 text-sm text-gri-700">
                    <span className="font-medium">Müşteri notu:</span>{" "}
                    {req.customer_comment}
                  </p>
                ) : null}
                <ApprovalAssetGrid
                  assets={req.assets}
                  onPreview={(url) => setLightboxUrl(url)}
                />
                {req.status === "pending" && canCancel && mode === "admin" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 min-h-[44px]"
                    disabled={cancellingId === req.id}
                    onClick={() => void handleCancel(req.id)}
                  >
                    {cancellingId === req.id ? "İptal ediliyor…" : "İptal et"}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <CreateApprovalRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        orderId={orderId}
        apiBase={postBase}
        orderItems={orderItems}
        onSuccess={() => {
          toast.success("Onay görseli isteği gönderildi");
          void load();
        }}
        onError={(msg) => toast.error(msg)}
      />

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[85vh] max-w-3xl object-contain rounded-lg"
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

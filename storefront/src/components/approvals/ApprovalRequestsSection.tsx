"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { mapApiError } from "@/lib/api-error-messages";
import type { ApprovalRequestPayload } from "@/lib/approvals/types";
import {
  APPROVAL_STATUS_BADGE,
  formatApprovalDate,
} from "@/lib/approvals/approval-ui";
import { ApprovalAssetGrid } from "@/components/approvals/ApprovalAssetGrid";

interface ApprovalRequestsSectionProps {
  orderId: string;
  /** Opsiyonel dış başlık — onay sayfasında section wrapper kullanılır */
  showHeading?: boolean;
  className?: string;
}

export function ApprovalRequestsSection({
  orderId,
  showHeading = true,
  className,
}: ApprovalRequestsSectionProps) {
  const toast = useToast();
  const [requests, setRequests] = useState<ApprovalRequestPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/approval-requests`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { requests?: ApprovalRequestPayload[] };
      setRequests(data.requests ?? []);
    } catch {
      /* sessiz */
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecide = async (
    reqId: string,
    decision: "approve" | "reject",
    comment?: string
  ) => {
    setDecidingId(reqId);
    try {
      const res = await fetch(
        `/api/orders/${orderId}/approval-requests/${reqId}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, comment }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        toast.error("Bu istek zaten yanıtlanmış");
        await load();
        return;
      }
      if (!res.ok) {
        toast.error(mapApiError(data.error ?? "Karar kaydedilemedi"));
        return;
      }
      toast.success(
        decision === "approve"
          ? "Onay görseli onaylandı"
          : "Değişiklik isteğin iletildi"
      );
      setCommentOpenId(null);
      setCommentText("");
      await load();
    } catch {
      toast.error("Bağlantı hatası — tekrar dene");
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <section className={cn("space-y-4", className)}>
      {showHeading ? (
        <h2 className="text-lg font-semibold text-lacivert">
          Onay bekleyen görseller
        </h2>
      ) : null}

      {requests.map((req) => {
        const badge =
          APPROVAL_STATUS_BADGE[
            req.status as keyof typeof APPROVAL_STATUS_BADGE
          ] ?? APPROVAL_STATUS_BADGE.pending;
        const isPending = req.status === "pending";
        const showComment = commentOpenId === req.id;

        return (
          <Card key={req.id} className="p-4 sm:p-5">
            {req.blocking && isPending ? (
              <div
                className="mb-3 rounded-lg bg-sari-soft px-3 py-2 text-sm font-medium text-sari-koyu"
              >
                Üretim bu onayını bekliyor.
              </div>
            ) : null}

            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-lacivert">{req.title}</h3>
                {req.message ? (
                  <p className="mt-1 text-sm text-gri-700">{req.message}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  badge.bg,
                  badge.color
                )}
              >
                {badge.label}
              </span>
            </div>

            <ApprovalAssetGrid
              assets={req.assets}
              onPreview={(url) => setLightboxUrl(url)}
            />

            {isPending ? (
              <div className="mt-4 space-y-3">
                {showComment ? (
                  <div>
                    <label className="block text-[12px] font-medium text-gri-700 mb-1">
                      Ne değişmesini istiyorsun?
                    </label>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      disabled={decidingId === req.id}
                      className="w-full rounded-lg border border-gri-200 px-3 py-2 text-sm focus:border-pim-mercan focus:outline-none"
                      placeholder="Kısa ve net yaz — ekibimiz anlasın"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    size="md"
                    className="min-h-[44px] flex-1 sm:flex-none"
                    disabled={decidingId === req.id}
                    onClick={() => void handleDecide(req.id, "approve")}
                  >
                    {decidingId === req.id && !showComment
                      ? "Kaydediliyor…"
                      : "Onayla"}
                  </Button>
                  {!showComment ? (
                    <Button
                      variant="secondary"
                      size="md"
                      className="min-h-[44px] flex-1 sm:flex-none"
                      disabled={decidingId === req.id}
                      onClick={() => {
                        setCommentOpenId(req.id);
                        setCommentText("");
                      }}
                    >
                      Değişiklik iste
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="md"
                        className="min-h-[44px]"
                        disabled={decidingId === req.id}
                        onClick={() => {
                          setCommentOpenId(null);
                          setCommentText("");
                        }}
                      >
                        Vazgeç
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        className="min-h-[44px] flex-1 sm:flex-none"
                        disabled={
                          decidingId === req.id || !commentText.trim()
                        }
                        onClick={() =>
                          void handleDecide(
                            req.id,
                            "reject",
                            commentText.trim()
                          )
                        }
                      >
                        {decidingId === req.id
                          ? "Gönderiliyor…"
                          : "İsteği gönder"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-[12px] text-gri-600 space-y-1">
                {req.decided_at ? (
                  <p>Karar: {formatApprovalDate(req.decided_at)}</p>
                ) : null}
                {req.customer_comment ? (
                  <p className="text-gri-700">
                    <span className="font-medium">Notun:</span>{" "}
                    {req.customer_comment}
                  </p>
                ) : null}
              </div>
            )}
          </Card>
        );
      })}

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Görsel önizleme"
        >
          <div
            className="relative max-h-[85vh] max-w-3xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[85vh] w-full object-contain rounded-lg"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

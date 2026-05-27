"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { FASON_ACTION_LABELS, ISSUE_CATEGORIES } from "@/lib/fason/status-labels";
import { cn } from "@/lib/cn";

type FasonAction = "acknowledge" | "in_production" | "ready" | "shipped" | "issue";

function primaryActionForStatus(status: string): FasonAction | null {
  if (status === "assigned" || status === "sent") return "acknowledge";
  if (status === "acknowledged") return "in_production";
  if (status === "in_production") return "ready";
  if (status === "ready") return "shipped";
  return null;
}

interface PartnerStatusActionsProps {
  orderId: string;
  status: string;
  disabled?: boolean;
  compact?: boolean;
  onUpdated?: (newStatus: string) => void;
  onError?: (message: string) => void;
}

export function PartnerStatusActions({
  orderId,
  status,
  disabled = false,
  compact = false,
  onUpdated,
  onError,
}: PartnerStatusActionsProps) {
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [issueCategory, setIssueCategory] = useState("dosya");
  const [issueDesc, setIssueDesc] = useState("");
  const [trackingCompany, setTrackingCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const primary = primaryActionForStatus(status);
  const isTerminal = status === "shipped" || status === "cancelled";

  const submitAction = async (
    action: FasonAction,
    extra?: Record<string, unknown>
  ) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        newStatus?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        onError?.(json.message ?? json.error ?? "Güncelleme başarısız");
        return;
      }
      if (json.newStatus) onUpdated?.(json.newStatus);
      setIssueOpen(false);
      setShipOpen(false);
      setIssueDesc("");
      setTrackingCompany("");
      setTrackingNumber("");
      setTrackingUrl("");
    } catch {
      onError?.("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  };

  if (isTerminal) {
    return (
      <p className="text-[12px] text-gri-600">
        Bu sipariş tamamlandı veya iptal edildi.
      </p>
    );
  }

  const primaryLabel =
    primary === "acknowledge"
      ? FASON_ACTION_LABELS.acknowledge
      : primary === "in_production"
        ? FASON_ACTION_LABELS.inProduction
        : primary === "ready"
          ? FASON_ACTION_LABELS.ready
          : primary === "shipped"
            ? FASON_ACTION_LABELS.shipped
            : null;

  const handlePrimary = () => {
    if (!primary) return;
    if (primary === "shipped") {
      setShipOpen(true);
      return;
    }
    void submitAction(primary);
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap gap-2",
          compact ? "items-center" : "flex-col sm:flex-row"
        )}
      >
        {primaryLabel && (
          <Button
            variant="primary"
            size={compact ? "sm" : "md"}
            disabled={disabled || busy}
            onClick={handlePrimary}
            className={compact ? "" : "min-h-[44px] flex-1 sm:flex-none"}
          >
            {busy ? "Kaydediliyor…" : primaryLabel}
          </Button>
        )}
        {status !== "issue" && (
          <Button
            variant="ghost"
            size={compact ? "sm" : "md"}
            disabled={disabled || busy}
            onClick={() => setIssueOpen(true)}
            className="text-kirmizi hover:bg-kirmizi-soft"
          >
            {FASON_ACTION_LABELS.issue}
          </Button>
        )}
      </div>

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Sorun bildir"
        maxWidthClassName="max-w-[480px]"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gri-700">
              Kategori
            </label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
            >
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gri-700">
              Açıklama
            </label>
            <textarea
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
              placeholder="Ne oldu? (min 5 karakter)"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>
              İptal
            </Button>
            <Button
              variant="primary"
              disabled={busy || issueDesc.trim().length < 5}
              onClick={() =>
                void submitAction("issue", {
                  issue: {
                    category: issueCategory,
                    description: issueDesc.trim(),
                  },
                })
              }
            >
              Gönder
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title="Kargoya verildi"
        maxWidthClassName="max-w-[480px]"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gri-700">
              Kargo firması *
            </label>
            <input
              value={trackingCompany}
              onChange={(e) => setTrackingCompany(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
              placeholder="Yurtiçi, Aras, MNG…"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gri-700">
              Takip numarası *
            </label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gri-700">
              Takip linki (opsiyonel)
            </label>
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
              placeholder="https://…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShipOpen(false)}>
              İptal
            </Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                !trackingCompany.trim() ||
                !trackingNumber.trim()
              }
              onClick={() =>
                void submitAction("shipped", {
                  tracking: {
                    company: trackingCompany.trim(),
                    number: trackingNumber.trim(),
                    url: trackingUrl.trim() || undefined,
                  },
                })
              }
            >
              Kargoya verdim
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

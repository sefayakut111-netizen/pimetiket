"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  APPROVAL_MAX_FILES_PER_REQUEST,
  APPROVAL_MAX_FILE_BYTES,
} from "@/lib/approvals/approval-storage";

export interface ApprovalOrderItemOption {
  id: string;
  title: string;
}

interface CreateApprovalRequestModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  /** admin veya partner POST tabanı */
  apiBase: "/api/admin/orders" | "/api/partner/orders";
  orderItems?: ApprovalOrderItemOption[];
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function CreateApprovalRequestModal({
  open,
  onClose,
  orderId,
  apiBase,
  orderItems = [],
  onSuccess,
  onError,
}: CreateApprovalRequestModalProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const maxMb = APPROVAL_MAX_FILE_BYTES / (1024 * 1024);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onError("Başlık gerekli");
      return;
    }
    if (files.length === 0) {
      onError("En az bir görsel veya PDF seç");
      return;
    }
    if (files.length > APPROVAL_MAX_FILES_PER_REQUEST) {
      onError(`En fazla ${APPROVAL_MAX_FILES_PER_REQUEST} dosya yükleyebilirsin`);
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("title", trimmedTitle);
      if (message.trim()) form.set("message", message.trim());
      if (orderItemId) form.set("order_item_id", orderItemId);
      if (blocking) form.set("blocking", "true");
      for (const f of files) {
        form.append("files", f);
      }

      const res = await fetch(`${apiBase}/${orderId}/approval-requests`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        onError(data.error ?? "Gönderilemedi");
        return;
      }

      setTitle("");
      setMessage("");
      setOrderItemId("");
      setBlocking(false);
      setFiles([]);
      onSuccess();
      onClose();
    } catch {
      onError("Bağlantı hatası — tekrar dene");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-create-title"
    >
      <Card
        className="w-full max-w-lg p-6"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h3
          id="approval-create-title"
          className="text-lg font-semibold text-lacivert"
        >
          Onay görseli iste
        </h3>
        <p className="mt-1 text-sm text-gri-700">
          Müşteri bu görselleri inceleyip onaylayabilir veya değişiklik
          isteyebilir.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-medium text-gri-700">
            Başlık
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-gri-200 px-3 py-2 text-sm focus:border-pim-mercan focus:outline-none"
              placeholder="Örn: Renk teyidi — üretim fotoğrafı"
            />
          </label>

          <label className="block text-[12px] font-medium text-gri-700">
            Mesaj (opsiyonel)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-gri-200 px-3 py-2 text-sm focus:border-pim-mercan focus:outline-none"
              placeholder="Müşteriye kısa not…"
            />
          </label>

          {orderItems.length > 0 ? (
            <label className="block text-[12px] font-medium text-gri-700">
              Ürün kalemi (opsiyonel)
              <select
                value={orderItemId}
                onChange={(e) => setOrderItemId(e.target.value)}
                disabled={submitting}
                className="mt-1 w-full rounded-lg border border-gri-200 px-3 py-2 text-sm focus:border-pim-mercan focus:outline-none"
              >
                <option value="">Tüm sipariş</option>
                {orderItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex items-start gap-2 text-[12px] text-gri-700">
            <input
              type="checkbox"
              checked={blocking}
              onChange={(e) => setBlocking(e.target.checked)}
              disabled={submitting}
              className="mt-0.5"
            />
            <span>
              Üretim bu onayı beklesin (blocking) — müşteri onaylamadan üretim
              bekletilir
            </span>
          </label>

          <div>
            <label className="block text-[12px] font-medium text-gri-700 mb-1">
              Dosyalar (PNG, JPG, WEBP, PDF)
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              multiple
              disabled={submitting}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles(picked);
              }}
              className="block w-full text-sm text-gri-700"
            />
            <p className="mt-1 text-[11px] text-gri-600">
              Max {maxMb} MB/dosya, en fazla {APPROVAL_MAX_FILES_PER_REQUEST}{" "}
              dosya
              {files.length > 0 ? ` · ${files.length} seçildi` : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            size="md"
            className="min-h-[44px]"
            disabled={submitting}
            onClick={onClose}
          >
            Vazgeç
          </Button>
          <Button
            variant="primary"
            size="md"
            className="min-h-[44px]"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Gönderiliyor…" : "İsteği gönder"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

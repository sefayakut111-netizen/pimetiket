/**
 * Pim Etiket — Ödeme Sonrası Tasarım Yükleme
 * /siparis/[id]/tasarim-yukle
 */

"use client";

import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { PimMini } from "@/components/Pim";
import { cn } from "@/lib/cn";
import {
  ALLOWED_MIME_TYPES,
  isAllowedByExtension,
  MAX_FILE_SIZE,
} from "@/lib/storage/design-files";

interface FailedDesign {
  id: string;
  name: string;
  reason: string;
  uploadedAt: string;
}

interface OrderItem {
  id: string;
  title: string;
  qty: number;
  width: number;
  height: number;
  product: string;
  config: string;
  unit: number;
  hasDesign: boolean;
  designsRequired: number;
  designsUploaded: number;
  designsComplete: boolean;
  failedDesigns: FailedDesign[];
}

interface OrderInfo {
  id: string;
  status: string;
  items: OrderItem[];
}

interface UploadedFilePreview {
  name: string;
  size: number;
  previewUrl?: string;
}

const STAY_ON_PAGE_STATUSES = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "human_review",
  "proof_generating",
] as const;

const FILE_ACCEPT = [
  ...ALLOWED_MIME_TYPES,
  ".ai",
  ".psd",
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".svg",
].join(",");

function resolveMimeForUpload(file: File): string | null {
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.toLowerCase().slice(dot);
  switch (ext) {
    case ".ai":
      return "application/illustrator";
    case ".psd":
      return "image/vnd.adobe.photoshop";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".pdf":
      return "application/pdf";
    case ".svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

function uploadWithProgress(
  url: string,
  file: File,
  token: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

function ItemDropZone({
  item,
  isUploading,
  isComplete,
  pendingHighlight,
  onDrop,
  children,
}: {
  item: OrderItem;
  isUploading: boolean;
  isComplete: boolean;
  pendingHighlight: boolean;
  onDrop: (file: File) => void;
  children: ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 transition-all",
        dragOver && !isUploading && "ring-2 ring-pim-mercan bg-pim-mercan-tint/10",
        isComplete && "bg-yesil-soft/10"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isUploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (isUploading) return;
        const file = e.dataTransfer.files[0];
        if (file) onDrop(file);
      }}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
          isComplete ? "bg-yesil" : pendingHighlight ? "bg-pim-mercan" : "bg-gri-200"
        )}
        aria-hidden
      />
      {dragOver && !isUploading && (
        <div className="absolute inset-0 rounded-lg bg-pim-mercan/5 border-2 border-dashed border-pim-mercan flex items-center justify-center z-10 pointer-events-none">
          <span className="text-pim-mercan font-semibold text-sm">
            Dosyayı buraya bırak
          </span>
        </div>
      )}
      {children}
    </Card>
  );
}

export default function TasarimYuklePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, UploadedFilePreview>
  >({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [redistributeOpen, setRedistributeOpen] = useState<string | null>(null);
  const [redistributing, setRedistributing] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }): Promise<OrderInfo | null> => {
      try {
        if (!opts?.silent) setLoading(true);
        const res = await fetch(`/api/orders/${orderId}/upload-status`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            setForbidden(true);
          }
          return null;
        }
        const data = (await res.json()) as OrderInfo;
        setOrder(data);

        const allItemsComplete =
          data.items.length > 0 &&
          data.items.every((i) => i.designsComplete);

        if (allItemsComplete && data.status === "awaiting_upload") {
          const adv = await fetch(`/api/orders/${orderId}/advance-status`, {
            method: "POST",
          });
          if (adv.ok) {
            await new Promise((r) => setTimeout(r, 1500));
            return load({ silent: true });
          }
        }

        if (
          data.status === "proof_pending" ||
          data.status === "proof_validating"
        ) {
          router.replace(`/onay/${orderId}`);
          return data;
        }
        if (data.status === "proof_approved") {
          router.replace(`/onay/${orderId}/tamamlandi`);
          return data;
        }
        if (
          !(STAY_ON_PAGE_STATUSES as readonly string[]).includes(data.status)
        ) {
          router.replace(`/siparis/${orderId}`);
          return data;
        }
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast.error(`Sipariş yüklenemedi: ${msg}`);
        return null;
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [orderId, router, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!order) return;
    if (uploadingItemId) return;

    const allDone =
      order.items.length > 0 &&
      order.items.every((i) => i.designsComplete);

    if (allDone) {
      toast.success(
        "Tüm tasarımlar yüklendi — prova hazırlığı başlıyor..."
      );
      const t = setTimeout(() => router.push(`/onay/${orderId}`), 2000);
      return () => clearTimeout(t);
    }
  }, [order, orderId, router, toast, uploadingItemId]);

  useEffect(() => {
    return () => {
      Object.values(uploadedFiles).forEach((f) => {
        if (f.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileSelect(item: OrderItem, file: File) {
    if (file.size <= 0) {
      toast.error("Boş dosya yüklenemez.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
      return;
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext === ".eps") {
      toast.error(
        "EPS formatı desteklenmiyor. Lütfen AI, PDF veya PNG olarak dışa aktarın."
      );
      return;
    }

    const mimeType = resolveMimeForUpload(file);
    if (!mimeType && !isAllowedByExtension(file.name)) {
      toast.error(
        `Bu dosya formatı desteklenmiyor: ${file.type || ext || "bilinmeyen"}. Desteklenen: PNG, JPG, PDF, SVG, AI, PSD`
      );
      return;
    }

    const wasComplete = item.designsComplete;
    setUploadingItemId(item.id);
    setUploadProgress(0);
    setUploadingFile({ name: file.name, size: file.size });

    try {
      const initRes = await fetch("/api/design/upload-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderItemId: item.id,
          originalName: file.name,
          sizeBytes: file.size,
          mimeType: mimeType ?? "application/pdf",
        }),
      });
      if (!initRes.ok) {
        const e = (await initRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(e.error || `init_failed_${initRes.status}`);
      }
      const init = (await initRes.json()) as {
        uploadUrl: string;
        token: string;
        storagePath: string;
        fileId: string;
      };

      await uploadWithProgress(init.uploadUrl, file, init.token, setUploadProgress);

      const compRes = await fetch("/api/design/upload-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: init.fileId }),
      });
      if (!compRes.ok) {
        const e = (await compRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(e.error || `complete_failed_${compRes.status}`);
      }

      const slotInfo =
        item.designsRequired > 1
          ? ` (${item.designsUploaded + 1}/${item.designsRequired})`
          : "";
      toast.success(`${item.title}${slotInfo}: tasarım yüklendi`);

      setUploadedFiles((prev) => {
        const old = prev[item.id];
        if (old?.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(old.previewUrl);
        }
        return {
          ...prev,
          [item.id]: {
            name: file.name,
            size: file.size,
            previewUrl: file.type.startsWith("image/")
              ? URL.createObjectURL(file)
              : undefined,
          },
        };
      });

      if (!wasComplete) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) => {
                  if (i.id !== item.id) return i;
                  const newUploaded = (i.designsUploaded ?? 0) + 1;
                  return {
                    ...i,
                    designsUploaded: newUploaded,
                    designsComplete: newUploaded >= i.designsRequired,
                    hasDesign: true,
                  };
                }),
              }
            : prev
        );
      }

      await load({ silent: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Yükleme başarısız: ${msg}`);
    } finally {
      setUploadingItemId(null);
      setUploadProgress(0);
      setUploadingFile(null);
    }
  }

  async function handleRedistribute(sourceItemId: string, targetItemId: string) {
    setRedistributing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/redistribute-slot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceItemId, targetItemId }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || `status_${res.status}`);
      }
      toast.success("Slot kapatıldı, adet transfer edildi");
      setRedistributeOpen(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Transfer başarısız: ${msg}`);
    } finally {
      setRedistributing(false);
    }
  }

  function renderFileInput(item: OrderItem) {
    return (
      <input
        ref={(el) => {
          fileInputs.current[item.id] = el;
        }}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelect(item, f);
          e.target.value = "";
        }}
      />
    );
  }

  if (loading) {
    return (
      <main className="container py-8">
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="h-[400px]" />
      </main>
    );
  }

  if (forbidden || !order) {
    return (
      <main className="container py-12">
        <Card className="p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold">
            Bu siparişe erişim yok
          </h1>
          <p className="mb-4 text-sm text-gri-700">
            Sipariş bulunamadı veya başka bir hesaba ait.
          </p>
          <Button href="/siparislerim" variant="primary" size="md">
            Siparişlerime dön
          </Button>
        </Card>
      </main>
    );
  }

  const pendingCount = order.items.filter((i) => !i.designsComplete).length;
  const totalRequired = order.items.reduce(
    (s, i) => s + (i.designsRequired ?? 1),
    0
  );
  const totalUploaded = order.items.reduce(
    (s, i) => s + (i.designsUploaded ?? 0),
    0
  );

  const displayOrderId =
    orderId.length > 12 ? `...${orderId.slice(-8)}` : orderId;

  return (
    <main className="container py-6">
      <div className="mb-6">
        <Eyebrow>SİPARİŞ #{displayOrderId}</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert">
          Tasarımlarını yükle
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          {order.items.length} ürün ·{" "}
          <strong className="text-lacivert tabular-nums">
            {totalUploaded}/{totalRequired}
          </strong>{" "}
          tasarım yüklendi
          {pendingCount > 0 && (
            <span className="text-pim-mercan font-semibold">
              {" "}
              · {pendingCount} kalan
            </span>
          )}
        </p>
      </div>

      <Card className="mb-4 flex items-start gap-3 bg-pim-mercan-tint/30 p-4">
        <PimMini pose="happy" size={48} />
        <div className="text-sm leading-relaxed text-lacivert">
          <p>
            Ödemeni aldık, teşekkürler! Şimdi her ürün için tasarım dosyanı
            yüklemeni bekliyorum. Sıfır kayıp için SVG/AI/PDF, raster ise
            PNG/JPG/PSD destekleniyor (max 30 MB).
          </p>
          <p className="mt-2">
            Tüm tasarımlar yüklenince{" "}
            <strong>otomatik bıçak çıkarımı</strong> başlar — 5 dakika içinde
            onay sayfasında olacak.
          </p>
        </div>
      </Card>

      <div className="mb-4 rounded-lg border border-gri-200 bg-gri-50 p-3 text-[12.5px] text-gri-700 flex items-start gap-2">
        <span className="text-base shrink-0">💡</span>
        <div>
          <strong>İpucu:</strong> Her ürün için en az 1 tasarım yükle. Birden
          fazla tasarım gerekiyorsa buton tekrar tıklanabilir. Şeffaf arka plan
          için PNG formatını tercih et.
        </div>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            Tasarım durumu
          </div>
          <div className="text-[14px] font-bold tabular-nums text-lacivert">
            {totalUploaded} / {totalRequired} yüklendi
          </div>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-gri-100 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out rounded-full",
              totalUploaded === totalRequired ? "bg-yesil" : "bg-pim-mercan"
            )}
            style={{
              width: `${
                totalRequired > 0
                  ? Math.round((totalUploaded / totalRequired) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="mt-1.5 flex flex-col sm:flex-row justify-between gap-1 text-[11.5px] text-gri-700">
          <span>
            {totalRequired > 0
              ? `%${Math.round((totalUploaded / totalRequired) * 100)}`
              : "%0"}
          </span>
          {pendingCount > 0 ? (
            <span className="font-semibold text-pim-mercan">
              {pendingCount} üründe tasarım bekleniyor
            </span>
          ) : (
            <span className="font-semibold text-yesil">
              ✓ Tüm tasarımlar tamam
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-4">
        {order.items.map((item) => {
          const required = item.designsRequired ?? 1;
          const uploaded = item.designsUploaded ?? 0;
          const remaining = Math.max(0, required - uploaded);
          const isMulti = required > 1;
          const isComplete = item.designsComplete;
          const isUploading = uploadingItemId === item.id;
          const filePreview = uploadedFiles[item.id];

          const buttonLabel = isUploading
            ? "Yükleniyor..."
            : isMulti
              ? `Tasarım ${uploaded + 1}/${required} yükle`
              : "Tasarım yükle";

          return (
            <ItemDropZone
              key={item.id}
              item={item}
              isUploading={isUploading}
              isComplete={isComplete}
              pendingHighlight={!isComplete && pendingCount > 0}
              onDrop={(file) => void handleFileSelect(item, file)}
            >
              <div
                className={cn(
                  "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pl-2",
                  isComplete && "opacity-70"
                )}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lacivert">{item.title}</h3>
                  <p className="mt-1 text-sm text-gri-700">
                    {item.qty} ad · {item.width}×{item.height} mm
                    {isMulti && (
                      <>
                        {" "}
                        · <strong>{required} farklı tasarım</strong>
                      </>
                    )}
                  </p>

                  {isMulti && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex gap-1">
                        {Array.from({ length: required }).map((_, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "block w-7 h-2 rounded-full",
                              idx < uploaded ? "bg-yesil" : "bg-gri-200"
                            )}
                            aria-hidden
                          />
                        ))}
                      </div>
                      <span className="text-[12px] font-semibold text-gri-700 tabular-nums">
                        {uploaded} / {required}
                      </span>
                    </div>
                  )}

                  {isComplete && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <p className="inline-flex items-center gap-1 rounded-full bg-yesil-soft px-3 py-1 text-xs font-medium text-yesil">
                        ✓{" "}
                        {isMulti
                          ? `${required} tasarım yüklendi`
                          : "Tasarım yüklendi"}
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputs.current[item.id]?.click()}
                        disabled={isUploading}
                        className="text-[11px] font-semibold text-pim-mercan hover:underline disabled:opacity-50"
                      >
                        Değiştir
                      </button>
                    </div>
                  )}

                  {isComplete && filePreview?.previewUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gri-100 ring-1 ring-gri-200 shrink-0">
                        <img
                          src={filePreview.previewUrl}
                          alt="Yüklenen tasarım"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-[12px] text-gri-700 min-w-0">
                        <div className="font-medium text-lacivert truncate max-w-[200px]">
                          {filePreview.name}
                        </div>
                        <div>
                          {(filePreview.size / 1024 / 1024).toFixed(1)} MB
                        </div>
                      </div>
                    </div>
                  )}

                  {isComplete && filePreview && !filePreview.previewUrl && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-gri-700">
                      <span className="w-10 h-10 rounded-lg bg-gri-100 grid place-items-center text-gri-500 shrink-0">
                        📄
                      </span>
                      <span className="truncate max-w-[200px]">
                        {filePreview.name}
                      </span>
                    </div>
                  )}

                  {item.failedDesigns.length > 0 && (
                    <div className="mt-3 rounded-lg border border-pim-mercan/40 bg-pim-mercan-tint/40 p-3">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pim-mercan text-white text-[11px] font-bold"
                          aria-hidden
                        >
                          !
                        </span>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-lacivert">
                            {item.failedDesigns.length === 1
                              ? "Son yüklediğin dosya AI kontrolünde takıldı"
                              : `${item.failedDesigns.length} dosya AI kontrolünde takıldı`}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-[12px] text-gri-700">
                            {item.failedDesigns.slice(0, 3).map((f) => (
                              <li key={f.id} className="flex gap-1.5">
                                <span className="text-pim-mercan">•</span>
                                <span>
                                  <strong className="text-lacivert">
                                    {f.name}
                                  </strong>
                                  {" — "}
                                  {f.reason}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[11.5px] text-gri-700">
                            Düzeltilmiş dosyayı yükleyince bu uyarı kaybolur ve
                            slot tamamlanır. Yardım için sağ alttaki Pim&apos;e
                            sor.
                          </p>
                          {(() => {
                            const compatible = order.items.filter(
                              (other) =>
                                other.id !== item.id &&
                                other.qty > 0 &&
                                other.product === item.product &&
                                other.width === item.width &&
                                other.height === item.height &&
                                other.config === item.config &&
                                Number(other.unit) === Number(item.unit)
                            );
                            if (compatible.length === 0) return null;
                            const isOpen = redistributeOpen === item.id;
                            return (
                              <div className="mt-3 border-t border-pim-mercan/20 pt-2.5">
                                {!isOpen ? (
                                  <button
                                    type="button"
                                    onClick={() => setRedistributeOpen(item.id)}
                                    className="text-[12px] font-semibold text-pim-mercan hover:underline text-left"
                                  >
                                    Bu tasarımı iptal et
                                    <span className="font-normal text-gri-500 block text-[11px] mt-0.5">
                                      {item.qty} adet diğer ürünlere dağıtılır
                                    </span>
                                  </button>
                                ) : (
                                  <div className="rounded-lg bg-white p-3 border border-pim-mercan/30">
                                    <div className="text-[13px] font-semibold text-lacivert mb-1">
                                      Hangi ürüne aktarmak istiyorsun?
                                    </div>
                                    <p className="text-[11.5px] text-gri-500 mb-3">
                                      Bu ürünün {item.qty} adeti seçtiğin ürüne
                                      eklenecek.
                                    </p>
                                    <div className="space-y-1.5">
                                      {compatible.map((tgt) => (
                                        <button
                                          key={tgt.id}
                                          type="button"
                                          disabled={redistributing}
                                          onClick={() =>
                                            void handleRedistribute(
                                              item.id,
                                              tgt.id
                                            )
                                          }
                                          className="w-full text-left rounded-md border border-gri-200 bg-white px-3 py-2 text-[12.5px] hover:border-pim-mercan hover:bg-pim-mercan-tint/30 transition-colors disabled:opacity-50"
                                        >
                                          <div className="font-medium text-lacivert">
                                            {tgt.title}
                                          </div>
                                          <div className="text-[11px] text-gri-700">
                                            Mevcut: {tgt.qty} ad → Yeni:{" "}
                                            <strong>
                                              {tgt.qty + item.qty}
                                            </strong>{" "}
                                            ad
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRedistributeOpen(null)
                                        }
                                        disabled={redistributing}
                                        className="text-[11.5px] text-gri-700 hover:text-lacivert"
                                      >
                                        Vazgeç
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  {renderFileInput(item)}

                  {isUploading ? (
                    <div className="w-full sm:min-w-[200px]">
                      <Button
                        variant="primary"
                        size="lg"
                        disabled
                        className="w-full"
                      >
                        Yükleniyor...
                        {uploadProgress > 0 ? ` %${uploadProgress}` : ""}
                      </Button>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-gri-100 overflow-hidden">
                        {uploadProgress > 0 ? (
                          <div
                            className="h-full bg-pim-mercan rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        ) : (
                          <div className="h-full bg-pim-mercan rounded-full animate-progress-indeterminate" />
                        )}
                      </div>
                      {uploadingFile && (
                        <p className="mt-1 text-[11px] text-gri-500 text-center truncate">
                          {uploadingFile.name} ·{" "}
                          {(uploadingFile.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      )}
                    </div>
                  ) : !isComplete ? (
                    <>
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => fileInputs.current[item.id]?.click()}
                        disabled={isUploading}
                        className="w-full sm:w-auto"
                      >
                        📁 {buttonLabel}
                      </Button>
                      <p className="mt-1.5 text-[10.5px] text-gri-400 text-right sm:text-left">
                        Desteklenen: PNG, JPG, PDF, SVG, AI, PSD · max 30 MB
                      </p>
                      {isMulti && remaining > 0 && uploaded > 0 && (
                        <p className="mt-1 text-[11.5px] text-gri-500 text-right sm:text-left">
                          {remaining} tasarım kaldı
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </ItemDropZone>
          );
        })}
      </div>
    </main>
  );
}

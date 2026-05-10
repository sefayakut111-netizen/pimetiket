/**
 * Pim Etiket — /yorum-yaz/[orderId]
 *
 * Yorum yazma formu. Müşteri kargo teslim edildikten sonra mailden veya
 * banner'dan buraya yönlenir.
 *
 * Form:
 *   - Yıldız (zorunlu)
 *   - Yorum metni 30-500 karakter
 *   - Foto upload (max 2, opsiyonel)
 *   - "Anasayfada paylaşılsın" checkbox (default ON)
 *   - "İsim baş harfle" checkbox (default OFF)
 *   - Submit → admin moderation kuyruğuna düşer
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { useUser } from "@/lib/supabase/use-user";
import {
  getReviewRequestByOrder,
  submitReview,
  shortenDisplayName,
  type ReviewRequest,
  type ProductType,
} from "@/lib/reviews";
import { fetchCustomerOrder, type CustomerOrder } from "@/lib/customer-order";
import { createClient } from "@/lib/supabase/client";

export default function YorumYazPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? "";
  const router = useRouter();
  const toast = useToast();
  const { user, displayName } = useUser();

  const [request, setRequest] = useState<ReviewRequest | null>(null);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [rating, setRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [showOnHomepage, setShowOnHomepage] = useState(true);
  const [shortenName, setShortenName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    if (!user) {
      router.push(`/auth?next=/yorum-yaz/${orderId}`);
      return;
    }
    void Promise.all([
      getReviewRequestByOrder(orderId),
      fetchCustomerOrder(orderId),
    ])
      .then(([req, ord]) => {
        setRequest(req);
        setOrder(ord);
      })
      .finally(() => setLoading(false));
  }, [orderId, user, router]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 2) {
      toast.error("En fazla 2 fotoğraf yükleyebilirsin");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const newPhotos: { path: string; url: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: 5MB'tan büyük`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("review-photos")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error(`Yükleme hatası: ${error.message}`);
        continue;
      }
      const { data } = supabase.storage
        .from("review-photos")
        .getPublicUrl(path);
      newPhotos.push({ path, url: data.publicUrl });
    }
    setPhotos((prev) => [...prev, ...newPhotos]);
    setUploading(false);
    e.target.value = "";
  };

  const removePhoto = async (path: string) => {
    const supabase = createClient();
    await supabase.storage.from("review-photos").remove([path]);
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Yıldız ver — 1-5 arası");
      return;
    }
    if (body.trim().length < 30) {
      toast.error("Yorum en az 30 karakter olmalı");
      return;
    }
    if (!order) return;

    // Product type'ı order'ın ilk item'ından türet
    const productType: ProductType =
      order.items[0]?.title?.toLowerCase().includes("sticker")
        ? "sticker"
        : "etiket";

    const finalDisplayName = shortenName
      ? shortenDisplayName(displayName ?? "Müşteri")
      : displayName ?? "Müşteri";

    setSubmitting(true);
    const result = await submitReview({
      order_id: orderId,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      body: body.trim(),
      display_name: finalDisplayName,
      show_on_homepage: showOnHomepage,
      photos,
      product_type: productType,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success("Yorumun alındı, ekibimiz inceleyecek 🌟");
      setTimeout(() => router.push("/panelim"), 1500);
    } else {
      toast.error(result.error);
    }
  };

  // Yükleniyor
  if (loading) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gri-200 rounded mx-auto mb-4" />
            <div className="h-32 w-full bg-gri-200 rounded" />
          </div>
        </div>
      </main>
    );
  }

  // Request bulunamadı (zaten yorum yazılmış veya geçersiz order)
  if (!request) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="think" size={140} />
          <h1 className="mt-3 text-[28px] md:text-[32px] font-semibold tracking-tight">
            Yorum talebi bulunamadı
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            Bu sipariş için ya zaten yorum yazılmış ya da yorum süresi geçmiş
            (teslim sonrası 30 gün). Sorularını{" "}
            <Link href="/iletisim" className="text-pim-mercan font-semibold">
              iletişim
            </Link>{" "}
            sayfasından iletebilirsin.
          </p>
          <div className="mt-6">
            <Button variant="primary" href="/panelim">
              Panele dön
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const productLabel =
    order?.items[0]?.title ?? "ürünün";

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-10 md:py-14">
      <div className="mx-auto max-w-[680px] px-4 md:px-6">
        {/* Hero — Pim selamı */}
        <div className="text-center mb-8">
          <Pim pose="wave" size={120} />
          <Eyebrow>Yorumun</Eyebrow>
          <h1 className="mt-3 text-[26px] md:text-[34px] font-semibold tracking-tight leading-tight">
            <strong className="text-pim-mercan">
              {displayName?.split(" ")[0] ?? "Selam"},
            </strong>{" "}
            yorumunu duymak isteriz.
          </h1>
          <p className="mt-3 text-[14px] md:text-[15px] text-gri-700 leading-relaxed max-w-[480px] mx-auto">
            <strong>{productLabel}</strong> nasıldı? Yazdıkların hem bize hem
            de yeni başlayanlara yol gösterir. 30 saniye yeter.
          </p>
        </div>

        <Card padding="p-6 md:p-8" className="!bg-white">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Yıldız */}
            <div>
              <label className="block text-[13px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-2.5">
                Genel puan
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
                    aria-label={`${n} yıldız`}
                    className={`grid place-items-center w-12 h-12 rounded-xl ring-1 transition-all ${
                      n <= rating
                        ? "bg-sari-soft text-sari ring-sari shadow-sm"
                        : "bg-gri-50 text-gri-300 ring-gri-200 hover:ring-gri-400"
                    }`}
                  >
                    <Icon.Star size={22} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="mt-2 text-[12.5px] text-gri-500">
                  {rating === 5 && "Mükemmel — bu duyguyu hisset!"}
                  {rating === 4 && "Memnunum, küçük dokunuşlar olur."}
                  {rating === 3 && "Ortalama — neden 5 değildi söyle."}
                  {rating === 2 && "Beklenti karşılanmamış — anlat."}
                  {rating === 1 && "Üzüldük — sorunu anlat, çözelim."}
                </p>
              )}
            </div>

            {/* Yorum metni */}
            <div>
              <label
                htmlFor="review-body"
                className="block text-[13px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-2.5"
              >
                Yorum
              </label>
              <textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Malzeme, baskı, kargo, üretim hızı — neyi sevdin, neyi sevmedin?"
                rows={5}
                maxLength={500}
                required
                minLength={30}
                className="w-full px-4 py-3 rounded-xl bg-white ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan outline-none text-[14px] leading-relaxed resize-none"
              />
              <div className="mt-1.5 flex justify-between text-[11.5px] text-gri-500">
                <span>{body.length < 30 ? `${30 - body.length} karakter daha` : "Yeterli"}</span>
                <span>{body.length} / 500</span>
              </div>
            </div>

            {/* Fotoğraf upload */}
            <div>
              <label className="block text-[13px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-2.5">
                Fotoğraf <span className="font-normal normal-case text-gri-500">(opsiyonel · max 2)</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.path}
                    className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-gri-200 bg-gri-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt="Yüklenen fotoğraf"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.path)}
                      aria-label="Fotoğrafı sil"
                      className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <Icon.X size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < 2 && (
                  <label className="aspect-square rounded-xl ring-2 ring-dashed ring-gri-300 hover:ring-pim-mercan grid place-items-center cursor-pointer transition-colors text-gri-500 hover:text-pim-mercan">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePhotoUpload}
                      multiple
                      className="hidden"
                      disabled={uploading}
                    />
                    <div className="text-center">
                      <Icon.Plus size={20} className="mx-auto mb-1" />
                      <span className="text-[11px] font-semibold">
                        {uploading ? "Yükleniyor…" : "Ekle"}
                      </span>
                    </div>
                  </label>
                )}
              </div>
              <p className="mt-2 text-[11.5px] text-gri-500">
                JPG/PNG/WEBP, dosya başı max 5 MB.
              </p>
            </div>

            {/* Tercihler */}
            <div className="space-y-3 pt-2 border-t border-gri-100">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnHomepage}
                  onChange={(e) => setShowOnHomepage(e.target.checked)}
                  className="mt-1 accent-pim-mercan"
                />
                <div>
                  <span className="text-[13.5px] font-medium text-lacivert">
                    Yorumum anasayfada paylaşılabilir
                  </span>
                  <p className="text-[11.5px] text-gri-500 mt-0.5">
                    Onay verirsen ekibimiz inceleyip onaylayınca anasayfada da
                    gösterilir.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shortenName}
                  onChange={(e) => setShortenName(e.target.checked)}
                  className="mt-1 accent-pim-mercan"
                />
                <div>
                  <span className="text-[13.5px] font-medium text-lacivert">
                    Adımı baş harfle göster
                  </span>
                  <p className="text-[11.5px] text-gri-500 mt-0.5">
                    Örn: &ldquo;{shortenDisplayName(displayName ?? "Sefa Yakut")}&rdquo;
                    olarak gösterilir.
                  </p>
                </div>
              </label>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={submitting || rating === 0 || body.trim().length < 30}
              >
                {submitting ? "Gönderiliyor…" : "Yorumu gönder"}
              </Button>
              <Button variant="secondary" size="lg" href="/panelim">
                Vazgeç
              </Button>
            </div>
          </form>
        </Card>

        <p className="text-center text-[11.5px] text-gri-500 mt-6 leading-relaxed">
          Yorumun ekibimiz tarafından incelendikten sonra yayınlanır. Genelde
          1-2 iş günü içinde.
        </p>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Button, Card, Eyebrow, Input, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { id: "genel", label: "Genel" },
  { id: "siparis", label: "Sipariş" },
  { id: "tasarim", label: "Tasarım" },
  { id: "kargo", label: "Kargo" },
  { id: "iade", label: "İade" },
  { id: "teknik", label: "Teknik" },
  { id: "fiyat", label: "Fiyat" },
] as const;

export default function DestekPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("genel");
  const [orderId, setOrderId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthed(!!user);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/support/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          category,
          order_id: orderId || undefined,
          guest_name: authed ? undefined : guestName,
          guest_email: authed ? undefined : guestEmail,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        toast.error(json.error ?? "Gönderilemedi");
        return;
      }
      toast.success("Talebiniz alındı — en kısa sürede dönüş yapacağız");
      setSubject("");
      setMessage("");
      setOrderId("");
    } catch {
      toast.error("Ağ hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[640px] px-6">
        <div className="text-center mb-8">
          <Pim pose="chat" size={100} />
          <Eyebrow>Destek</Eyebrow>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight">
            Pim Destek
          </h1>
          <p className="mt-2 text-gri-700">
            Sorununuzu yazın, operatör ekibimiz e-posta ile döner.
          </p>
        </div>

        <Card padding="p-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {!authed && authed !== null && (
              <>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1 block">Adınız</span>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1 block">E-posta</span>
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">Konu</span>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">Kategori</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white ring-1 ring-gri-200 text-[13px]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">
                Sipariş no (varsa)
              </span>
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="00001234"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">Mesajınız</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-gri-200 text-[13px]"
              />
            </label>

            <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
              {loading ? "Gönderiliyor…" : "Gönder"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-[13px] text-gri-600">
          Veya:{" "}
          <a href="mailto:info@pimetiket.com" className="text-pim-mercan font-semibold">
            info@pimetiket.com
          </a>
          {" · "}
          <Link href="/iletisim" className="underline">
            İletişim sayfası
          </Link>
        </p>
      </div>
    </main>
  );
}

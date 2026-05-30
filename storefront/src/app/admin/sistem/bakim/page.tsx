"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow, Input, Skeleton, useToast } from "@/components/ui";

export default function AdminBakimPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin."
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as {
          settings?: {
            maintenance_mode?: boolean;
            maintenance_message?: string | null;
          };
        };
        const s = json.settings;
        setMaintenanceMode(Boolean(s?.maintenance_mode));
        if (s?.maintenance_message) {
          setMaintenanceMessage(s.maintenance_message);
        }
      } catch {
        toast.error("Bakım ayarları yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const patch = async (
    next: Partial<{ maintenanceMode: boolean; maintenanceMessage: string }>
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maintenance_mode: next.maintenanceMode,
          maintenance_message: next.maintenanceMessage,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Güncellenemedi");
        return false;
      }
      if (next.maintenanceMode === true) toast.success("Bakım modu açıldı");
      else if (next.maintenanceMode === false) toast.success("Bakım modu kapatıldı");
      else toast.success("Bakım mesajı güncellendi");
      return true;
    } catch {
      toast.error("Güncellenemedi");
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[720px] px-6">
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[720px] px-6">
        <Eyebrow>Sistem</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold text-lacivert">Bakım modu</h1>
        <p className="mt-2 text-sm text-gri-700">
          Acil durumda müşteri tarafını geçici olarak kapat. Admin paneli etkilenmez.
        </p>

        <Card
          padding="p-6"
          className="mt-6 border-2 border-kirmizi/40 bg-kirmizi-soft/10"
        >
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={maintenanceMode}
              disabled={saving}
              onChange={async (e) => {
                const next = e.target.checked;
                const prev = maintenanceMode;
                setMaintenanceMode(next);
                const ok = await patch({ maintenanceMode: next });
                if (!ok) setMaintenanceMode(prev);
              }}
              className="h-5 w-5 rounded border-gri-300 text-kirmizi focus:ring-kirmizi"
            />
            <span className="text-sm font-medium text-lacivert">
              {maintenanceMode ? "Açık — müşteriler siteye erişemiyor" : "Kapalı"}
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-semibold">
              Müşteri mesajı
            </span>
            <Input
              value={maintenanceMessage}
              disabled={saving}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              onBlur={() => void patch({ maintenanceMessage })}
            />
          </label>

          <p className="mt-3 text-[12.5px] leading-relaxed text-gri-700">
            Açıkken tüm müşteri sayfaları{" "}
            <Link href="/bakim" className="text-pim-mercan underline">
              /bakim
            </Link>{" "}
            sayfasına yönlendirilir. API ve admin yolları çalışmaya devam eder.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" href="/bakim" target="_blank">
              Önizleme
            </Button>
            <Button variant="ghost" href="/admin/ayarlar">
              Genel ayarlar
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

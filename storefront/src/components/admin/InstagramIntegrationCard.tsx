"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";

interface InstagramStatus {
  source: "db" | "env" | "none";
  hasToken: boolean;
  updatedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  tokenPreview: string | null;
  envFallbackConfigured: boolean;
  appSecretConfigured: boolean;
  integrationTableReady: boolean;
  handle: string;
}

export function InstagramIntegrationCard({
  canUpdate,
}: {
  canUpdate: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [exchange, setExchange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/instagram/status", { cache: "no-store" });
      if (!res.ok) {
        toast.error("Instagram durumu yüklenemedi");
        return;
      }
      const json = (await res.json()) as { status?: InstagramStatus };
      if (json.status) setStatus(json.status);
    } catch {
      toast.error("Instagram durumu yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onSaveToken = async () => {
    if (!canUpdate) {
      toast.error("Bu rol token kaydedemez");
      return;
    }
    if (!tokenInput.trim()) {
      toast.error("Token yapıştırın");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/instagram/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenInput.trim(),
          exchange,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Token kaydedilemedi");
        return;
      }
      setTokenInput("");
      toast.success(
        json.exchanged
          ? "Long-lived token kaydedildi"
          : "Token kaydedildi"
      );
      await loadStatus();
    } catch {
      toast.error("Token kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/instagram/test", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "API test başarısız");
        return;
      }
      toast.success(
        `API OK — ${json.postCount ?? 0} gönderi (ham: ${json.mediaCount ?? 0})`
      );
    } catch {
      toast.error("API test başarısız");
    } finally {
      setTesting(false);
    }
  };

  const onSync = async () => {
    if (!canUpdate) {
      toast.error("Bu rol sync tetikleyemez");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/cron-status/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cronName: "instagram-sync" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        toast.error(
          json.error ??
            (json.response?.summary
              ? String(json.response.summary)
              : "Sync başarısız")
        );
        return;
      }
      const synced = json.response?.synced;
      toast.success(
        typeof synced === "number"
          ? `Sync tamam — ${synced} slot güncellendi`
          : "Sync tetiklendi"
      );
    } catch {
      toast.error("Sync başarısız");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card padding="p-6">
        <p className="text-sm text-gri-600">Instagram entegrasyonu yükleniyor…</p>
      </Card>
    );
  }

  const warnExpiry =
    status?.daysRemaining != null && status.daysRemaining < 14;

  return (
    <Card padding="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Instagram API</h2>
          <p className="mt-1 text-sm text-gri-600 leading-relaxed">
            Anasayfa feed (@{status?.handle ?? "pimetiket"}). Token DB&apos;de
            saklanır; Pazar cron ile yenilenir. Kurulum:{" "}
            <code className="text-xs">docs/INSTAGRAM-SETUP.md</code>
          </p>
        </div>
      </div>

      {!status?.integrationTableReady && (
        <div className="mb-4 rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-sm text-amber-900">
          <strong>Migration 179 gerekli:</strong>{" "}
          <code className="text-xs">integration_secrets</code> tablosu yok.
          <code className="block mt-1 text-xs">
            node scripts/apply-migrations-179.mjs
          </code>
        </div>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <dt className="text-gri-500">Durum</dt>
          <dd className="font-medium">
            {status?.hasToken ? (
              <span className="text-yesil-koyu">Token aktif</span>
            ) : (
              <span className="text-gri-600">Token yok</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-gri-500">Kaynak</dt>
          <dd className="font-medium">{status?.source ?? "none"}</dd>
        </div>
        {status?.tokenPreview && (
          <div>
            <dt className="text-gri-500">Token</dt>
            <dd className="font-mono text-xs">{status.tokenPreview}</dd>
          </div>
        )}
        {status?.expiresAt && (
          <div>
            <dt className="text-gri-500">Geçerlilik</dt>
            <dd className="font-medium">
              {status.daysRemaining != null
                ? `${status.daysRemaining} gün`
                : status.expiresAt}
              {warnExpiry && (
                <span className="ml-2 text-amber-700 text-xs">(yakında doluyor)</span>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-gri-500">Env fallback</dt>
          <dd>{status?.envFallbackConfigured ? "Var" : "Yok"}</dd>
        </div>
        <div>
          <dt className="text-gri-500">App secret (exchange)</dt>
          <dd>{status?.appSecretConfigured ? "Var" : "Yok"}</dd>
        </div>
      </dl>

      {canUpdate && (
        <div className="space-y-3 border-t border-gri-200 pt-4">
          <label className="block">
            <span className="text-[13px] font-semibold mb-1.5 block">
              Access token
            </span>
            <Input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Meta Graph API token yapıştır"
              disabled={!status?.integrationTableReady}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gri-700">
            <input
              type="checkbox"
              checked={exchange}
              onChange={(e) => setExchange(e.target.checked)}
              className="rounded border-gri-300"
            />
            Long-lived&apos;a çevir (INSTAGRAM_APP_SECRET gerekli)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onSaveToken()}
              disabled={saving || !status?.integrationTableReady}
            >
              {saving ? "Kaydediliyor…" : "Token kaydet"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onTest()}
              disabled={testing || !status?.hasToken}
            >
              {testing ? "Test…" : "API test"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onSync()}
              disabled={syncing || !status?.hasToken}
            >
              {syncing ? "Sync…" : "Feed sync"}
              <Icon.ChevR size={14} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

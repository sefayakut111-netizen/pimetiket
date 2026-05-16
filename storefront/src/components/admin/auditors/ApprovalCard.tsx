/**
 * ApprovalCard — Sefa'nın onay/red/erteleme paneli (Adım 3)
 *
 * Bir pending_action kaydı için 4-yollu karar UI'ı:
 *
 *   1. ✓ Onayla → Uygula     (POST decide { decision: "approve" })
 *   2. 🛠️ Düzelt + Onayla    (JSON edit + approve_with_edit)
 *   3. ⏸ N gün ertele         (decision: "snooze", snoozeDays)
 *   4. ✗ Reddet               (decision: "reject")
 *
 * Her kararda opsiyonel "Sefa notu" alanı audit'e geçer.
 */

"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorPendingActionRow,
} from "@/lib/agents/_shared/types";

const SEVERITY_STYLES = {
  critical: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
  warning: "bg-saman/15 text-saman-koyu ring-saman/30",
  info: "bg-gri-100 text-gri-700 ring-gri-200",
} as const;

const SEVERITY_LABEL = {
  critical: "🔴 KRİTİK",
  warning: "🟡 UYARI",
  info: "🔵 BİLGİ",
} as const;

const SNOOZE_OPTIONS = [
  { days: 1, label: "1 gün" },
  { days: 3, label: "3 gün" },
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
];

interface DecisionResult {
  ok: boolean;
  status?: string;
  applyResult?: {
    result: string;
    error?: string;
  };
  error?: string;
  detail?: string;
}

interface ApprovalCardProps {
  action: AuditorPendingActionRow;
  /** Karar verildikten sonra çağrılır (refresh için). */
  onDecided?: (result: DecisionResult) => void;
}

export function ApprovalCard({ action, onDecided }: ApprovalCardProps) {
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedPayloadJson, setEditedPayloadJson] = useState(
    JSON.stringify(action.action_payload, null, 2)
  );
  const [snoozeMode, setSnoozeMode] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [loading, setLoading] = useState<
    null | "approve" | "approve_edit" | "snooze" | "reject"
  >(null);
  const [error, setError] = useState<string | null>(null);

  const submitDecision = async (
    decision: "approve" | "approve_with_edit" | "snooze" | "reject",
    extra?: Record<string, unknown>
  ) => {
    setLoading(
      decision === "approve"
        ? "approve"
        : decision === "approve_with_edit"
          ? "approve_edit"
          : decision === "snooze"
            ? "snooze"
            : "reject"
    );
    setError(null);

    try {
      const body: Record<string, unknown> = {
        decision,
        ...(extra ?? {}),
      };
      if (note.trim()) body.note = note.trim();

      const res = await fetch(
        `/api/admin/auditors/pending/${action.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const json = (await res.json()) as DecisionResult;

      if (!json.ok) {
        setError(json.detail ?? json.error ?? "Karar uygulanamadı");
        setLoading(null);
        return;
      }

      onDecided?.(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ağ hatası");
      setLoading(null);
    }
  };

  const handleApprove = () => {
    if (loading) return;
    void submitDecision("approve");
  };

  const handleApproveWithEdit = () => {
    if (loading) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editedPayloadJson);
    } catch (err) {
      setError(
        `JSON parse hatası: ${err instanceof Error ? err.message : "geçersiz format"}`
      );
      return;
    }
    void submitDecision("approve_with_edit", { editedPayload: parsed });
  };

  const handleSnooze = () => {
    if (loading) return;
    void submitDecision("snooze", { snoozeDays });
  };

  const handleReject = () => {
    if (loading) return;
    if (!note.trim()) {
      setError("Reddetmek için kısa bir gerekçe yazman gerek (Sefa notu).");
      return;
    }
    void submitDecision("reject");
  };

  return (
    <Card
      id={`pending-${action.id}`}
      padding="p-5"
      className="scroll-mt-20 hover:ring-pim-mercan transition-colors"
    >
      {/* Header — auditor + severity */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-[24px]">
            {AUDITOR_EMOJI[action.auditor_name]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-gri-500 font-semibold uppercase tracking-[0.04em] mb-0.5">
              {AUDITOR_LABELS[action.auditor_name]} · Onay Bekliyor
            </div>
            <h3 className="font-semibold text-[16px] text-lacivert leading-tight">
              {action.title}
            </h3>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center h-[24px] px-2.5 rounded-full ring-1 text-[11px] font-bold shrink-0",
            SEVERITY_STYLES[action.severity]
          )}
        >
          {SEVERITY_LABEL[action.severity]}
        </span>
      </div>

      {/* Description */}
      <p className="text-[13px] text-gri-700 leading-relaxed mb-4 whitespace-pre-wrap">
        {action.description}
      </p>

      {/* Payload preview */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            Aksiyon parametreleri
          </span>
          <code className="font-mono text-[11px] text-gri-500">
            {action.action_type}
          </code>
        </div>
        {!editing ? (
          <pre className="bg-gri-50 rounded-lg p-3 text-[12px] font-mono text-lacivert whitespace-pre-wrap overflow-x-auto max-h-[160px]">
            {JSON.stringify(action.action_payload, null, 2)}
          </pre>
        ) : (
          <textarea
            value={editedPayloadJson}
            onChange={(e) => setEditedPayloadJson(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full bg-white rounded-lg p-3 text-[12px] font-mono text-lacivert ring-1 ring-pim-mercan focus:outline-none focus:ring-2"
          />
        )}
      </div>

      {/* Note */}
      <div className="mb-4">
        <label
          htmlFor={`note-${action.id}`}
          className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5"
        >
          Sefa notu (opsiyonel — reddederken zorunlu)
        </label>
        <textarea
          id={`note-${action.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Örn: Bu IP'ye geçici izin verdik, engelleme yok"
          className="w-full px-3 py-2 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[13px] text-lacivert placeholder:text-gri-500 focus:outline-none focus:ring-pim-mercan focus:bg-white"
        />
      </div>

      {/* Snooze panel (collapsible) */}
      {snoozeMode && (
        <div className="bg-saman/10 rounded-lg p-3 mb-4">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-2">
            Erteleme süresi
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {SNOOZE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setSnoozeDays(opt.days)}
                className={cn(
                  "h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                  snoozeDays === opt.days
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-lacivert hover:ring-pim-mercan"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSnooze}
              disabled={loading !== null}
            >
              {loading === "snooze" ? "..." : `${snoozeDays} gün ertele`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSnoozeMode(false)}
              disabled={loading !== null}
            >
              Vazgeç
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-kirmizi/10 ring-1 ring-kirmizi/20 rounded-lg px-3 py-2 mb-3 text-[12.5px] text-kirmizi">
          <strong>Hata:</strong> {error}
        </div>
      )}

      {/* Action buttons */}
      {!snoozeMode && (
        <div className="flex gap-2 flex-wrap pt-3 border-t border-gri-100">
          {!editing ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                disabled={loading !== null}
                className="!bg-yesil hover:!bg-yesil-koyu"
              >
                <Icon.Check size={14} />
                {loading === "approve" ? "Uygulanıyor..." : "Onayla → Uygula"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
                disabled={loading !== null}
              >
                🛠️ Düzelt + Onayla
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSnoozeMode(true)}
                disabled={loading !== null}
              >
                ⏸ Ertele
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReject}
                disabled={loading !== null}
              >
                {loading === "reject" ? "..." : "✗ Reddet"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveWithEdit}
                disabled={loading !== null}
                className="!bg-yesil hover:!bg-yesil-koyu"
              >
                <Icon.Check size={14} />
                {loading === "approve_edit"
                  ? "Uygulanıyor..."
                  : "Onayla + Uygula"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setEditedPayloadJson(
                    JSON.stringify(action.action_payload, null, 2)
                  );
                  setError(null);
                }}
                disabled={loading !== null}
              >
                Vazgeç
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

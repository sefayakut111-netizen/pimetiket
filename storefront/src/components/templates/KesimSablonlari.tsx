"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShapePreview } from "@/components/templates/ShapePreview";
import { Card, Eyebrow, Input, Pill, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useUser } from "@/lib/supabase/use-user";
import {
  ALL_CUT_SETS,
  ALL_FORMATS,
  CATEGORY_LABELS,
  CUT_SET_META,
  DIE_CUT_TEMPLATES,
  type CutSet,
  type DieCutTemplate,
  type ShapeCategory,
  type TemplateFormat,
} from "@/lib/templates/die-cut-templates";

type CategoryFilter = "all" | ShapeCategory;

const FORMAT_LABELS: Record<TemplateFormat, string> = {
  pdf: "PDF",
  ai: "AI",
  eps: "EPS",
};

const DOWNLOAD_BTN_CLASS = cn(
  "inline-flex items-center justify-center w-full h-9 rounded-lg",
  "text-[11px] font-semibold ring-1 ring-lacivert bg-white text-lacivert",
  "transition-colors hover:bg-lacivert hover:text-white",
  "disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
);

const EDITOR_BTN_CLASS = cn(
  "inline-flex items-center justify-center w-full h-9 rounded-lg",
  "text-[9.5px] leading-tight font-semibold px-0.5 text-center",
  "ring-1 ring-pim-mercan bg-pim-mercan-tint/40 text-pim-mercan",
  "transition-colors hover:bg-pim-mercan-tint hover:ring-pim-mercan"
);

export default function KesimSablonlari({
  isMember: isMemberFromServer = false,
}: {
  isMember?: boolean;
}) {
  const [set, setSet] = useState<CutSet>("kisscut");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const { user, loading: authLoading } = useUser();
  const isMember = isMemberFromServer || Boolean(user);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DIE_CUT_TEMPLATES.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.id.includes(q) ||
        `${t.widthMm}x${t.heightMm}`.includes(q) ||
        String(t.widthMm).includes(q) ||
        String(t.heightMm).includes(q)
      );
    });
  }, [category, query]);

  return (
    <>
      <div className="mb-8">
        <Eyebrow>1:1 ölçekli · vektörel</Eyebrow>
        <h1 className="mt-3 text-[30px] md:text-[40px] font-semibold leading-[1.08] tracking-[-0.01em]">
          Kesim bıçağı şablonları
        </h1>
        <p className="mt-4 text-[15px] text-gri-700 max-w-[640px] leading-relaxed">
          Kesim bıçağı = etiketinin tam kesileceği çizgi. Tasarımını bu şablona
          göre hazırla; baskıda makine tam bu hattan keser. Hepsi{" "}
          <strong>1:1 ölçekli</strong> — açtığında gerçek boyutta gelir.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {ALL_CUT_SETS.map((s) => {
          const selected = set === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSet(s)}
              aria-pressed={selected}
              className={cn(
                "text-left bg-white rounded-lg shadow-1 p-5 border-l-4 transition-all cursor-pointer",
                selected
                  ? "ring-2 opacity-100"
                  : "ring-1 ring-black/[0.04] opacity-90 hover:ring-gri-300"
              )}
              style={{
                borderLeftColor: CUT_SET_META[s].color,
                ...(selected
                  ? { "--tw-ring-color": CUT_SET_META[s].color }
                  : {}),
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: CUT_SET_META[s].color }}
                />
                <h2 className="text-[15px] font-semibold">{CUT_SET_META[s].label}</h2>
                <Pill variant="gri" className="ml-auto text-[11px]">
                  {CUT_SET_META[s].spot}
                </Pill>
              </div>
              <p className="mt-2 text-[13px] text-gri-700 leading-relaxed">
                {CUT_SET_META[s].desc}
              </p>
            </button>
          );
        })}
      </div>

      <details className="mb-8 rounded-xl ring-1 ring-gri-200 bg-gri-50/60 px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-gri-700 select-none">
          Tasarımcıysan — teknik detay
        </summary>
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-gri-700 leading-relaxed list-disc pl-5">
          <li>
            kisscut seti spot rengi <strong>CutContour</strong> (%100 magenta);
            ThruCut seti <strong>ThruCut</strong> (mavi).
          </li>
          <li>Kesim çizgisi 0,3 pt, dolgusuz (stroke only).</li>
          <li>Tasarım alanına 3 mm bleed bırak; kesim hattı trim sınırıdır.</li>
          <li>İki setin geometrisi birebir aynı — sadece spot adı/rengi farklı.</li>
        </ul>
      </details>

      <div className="sticky top-16 z-40 -mx-4 px-4 md:mx-0 md:px-0 py-3 mb-6 bg-white/90 backdrop-blur-md border-b border-black/[0.06] md:rounded-xl md:ring-1 md:ring-gri-200 md:border-0">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(
                "h-8 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                category === "all"
                  ? "bg-pim-mercan-tint text-pim-mercan"
                  : "text-gri-700 hover:bg-gri-100"
              )}
            >
              Hepsi
            </button>
            {(Object.keys(CATEGORY_LABELS) as ShapeCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "h-8 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                  category === cat
                    ? "bg-pim-mercan-tint text-pim-mercan"
                    : "text-gri-700 hover:bg-gri-100"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ölçü veya şekil ara… (örn. 50, 100x70)"
            className="!h-10 max-w-md"
            aria-label="Şablon ara"
          />
        </div>
      </div>

      <p className="mb-4 text-[13px] text-gri-600">
        {filtered.length} şablon · önizleme rengi üstte seçili kesim setini gösterir
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            set={set}
            isMember={isMember}
            authPending={!isMemberFromServer && authLoading}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gri-600 text-[14px]">
          Aramanla eşleşen şablon yok. Filtreleri temizlemeyi dene.
        </div>
      )}
    </>
  );
}

function TemplateCard({
  tpl,
  set,
  isMember,
  authPending,
}: {
  tpl: DieCutTemplate;
  set: CutSet;
  isMember: boolean;
  authPending: boolean;
}) {
  const dimLabel =
    tpl.shape === "circle"
      ? `Ø${tpl.widthMm} mm`
      : `${tpl.widthMm}×${tpl.heightMm} mm`;

  return (
    <Card padding="p-3" className="flex flex-col h-full">
      <div className="grid place-items-center bg-gri-50 rounded-lg py-2 mb-2">
        <ShapePreview tpl={tpl} set={set} box={120} />
      </div>
      <div className="flex-1">
        <div className="text-[12.5px] font-semibold leading-snug line-clamp-2">
          {tpl.label}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Pill variant="gri" className="!h-[22px] !text-[11px]">
            {dimLabel}
          </Pill>
          {tpl.cornerRadiusMm > 0 && tpl.shape === "rect" && (
            <Pill variant="krem" className="!h-[22px] !text-[11px]">
              r{tpl.cornerRadiusMm}
            </Pill>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {ALL_FORMATS.map((fmt) => (
          <DownloadButton
            key={fmt}
            tpl={tpl}
            set={set}
            format={fmt}
            isMember={isMember}
            authPending={authPending}
          />
        ))}
        <UseInEditorButton templateId={tpl.id} />
      </div>
    </Card>
  );
}

function UseInEditorButton({ templateId }: { templateId: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={EDITOR_BTN_CLASS}
      onClick={() => router.push(`/editor?sablon=${encodeURIComponent(templateId)}`)}
      title="Editörde kullan"
    >
      Editörde kullan
    </button>
  );
}

function DownloadButton({
  tpl,
  set,
  format,
  isMember,
  authPending,
}: {
  tpl: DieCutTemplate;
  set: CutSet;
  format: TemplateFormat;
  isMember: boolean;
  authPending: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (authPending) return;
    if (!isMember) {
      toast.info("İndirmek için giriş yap veya üye ol.");
      router.push("/auth?next=/sablonlar");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        id: tpl.id,
        set,
        format,
      });
      const res = await fetch(`/api/sablonlar/kesim/download?${params}`);
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        requiresAuth?: boolean;
      };

      if (res.status === 401 || data.requiresAuth) {
        toast.warning("Oturum süresi dolmuş olabilir — tekrar giriş yap.");
        router.push("/auth?next=/sablonlar");
        return;
      }

      if (!res.ok || !data.url) {
        toast.error(data.error ?? "İndirme başarısız, tekrar dene.");
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Bağlantı hatası — indirme isteği gönderilemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={DOWNLOAD_BTN_CLASS}
      disabled={loading}
      onClick={handleClick}
      title={
        authPending
          ? "Oturum doğrulanıyor…"
          : isMember
            ? `${FORMAT_LABELS[format]} indir`
            : `${FORMAT_LABELS[format]} — üye girişi gerekli`
      }
    >
      {loading ? "…" : FORMAT_LABELS[format]}
    </button>
  );
}

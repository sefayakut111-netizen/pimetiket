/**
 * Kesim bıçağı (die-cut) şablon kütüphanesi — tek doğruluk kaynağı.
 * Hem /sablonlar Kesim sekmesi (render) hem indirme API'si (key doğrulama) kullanır.
 *
 * Geometri OKU.txt'ten; iki set (KissCut/ThruCut) geometrik olarak birebir aynı.
 * R2 key: templates/die-cut/{set}/{format}/{category}/{fileBase}.{ext}
 */

export type CutSet = "kisscut" | "thrucut";
export type TemplateFormat = "pdf" | "ai" | "eps";
export type ShapeCategory =
  | "yuvarlak"
  | "kare"
  | "dikdortgen"
  | "oval"
  | "bumper";

export interface DieCutTemplate {
  /** Kararlı id — URL/manifest anahtarı. örn: "yuvarlak-cap50", "kare-50x50-r3" */
  id: string;
  category: ShapeCategory;
  /** Kullanıcıya görünen etiket. örn: "Yuvarlak Ø50 mm" */
  label: string;
  widthMm: number;
  heightMm: number;
  /** Köşe yarıçapı mm (0 = keskin; daire/oval'de yok sayılır) */
  cornerRadiusMm: number;
  /** Önizleme şekli */
  shape: "circle" | "ellipse" | "rect";
  /** Yerel/R2 dosya kök adı (uzantısız), set & format dizinleri hariç */
  fileBase: string;
}

const CUT_SETS: Record<
  CutSet,
  { dir: string; label: string; spot: string; color: string; desc: string }
> = {
  kisscut: {
    dir: "KissCut-CutContour-Magenta",
    label: "KissCut (Kontur)",
    spot: "CutContour",
    color: "#E5007E",
    desc: "Yarım kesim — sadece etiket katmanı kesilir, arka kağıt (liner) bütün kalır. Sticker/etiket soyularak çıkar.",
  },
  thrucut: {
    dir: "ThruCut-Mavi",
    label: "ThruCut (Tam kesim)",
    spot: "ThruCut",
    color: "#0047FF",
    desc: "Tam kesim — kağıt boydan boya kesilir, parça tamamen ayrılır. Kartela / askılı etiket / ayrı parça için.",
  },
};

const FORMAT_DIR: Record<TemplateFormat, string> = {
  pdf: "PDF",
  ai: "AI",
  eps: "EPS",
};
const CATEGORY_DIR: Record<ShapeCategory, string> = {
  yuvarlak: "Yuvarlak",
  kare: "Kare",
  dikdortgen: "Dikdortgen",
  oval: "Oval",
  bumper: "Bumper",
};

const YUVARLAK = [25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];
const KARE = [25, 30, 40, 50];
const DIKDORTGEN: Array<[number, number]> = [
  [40, 25],
  [40, 30],
  [50, 30],
  [50, 40],
  [60, 40],
  [70, 40],
  [70, 50],
  [80, 50],
  [90, 50],
  [90, 60],
  [100, 50],
  [100, 70],
  [120, 80],
  [148, 105],
  [100, 150],
];
const OVAL: Array<[number, number]> = [
  [40, 25],
  [40, 30],
  [45, 30],
  [50, 30],
  [55, 35],
  [60, 40],
  [65, 45],
  [80, 50],
  [90, 60],
  [100, 70],
];
const BUMPER: Array<[number, number]> = [
  [100, 40],
  [150, 50],
  [200, 60],
  [250, 75],
  [300, 100],
];

function build(): DieCutTemplate[] {
  const out: DieCutTemplate[] = [];

  for (const d of YUVARLAK) {
    out.push({
      id: `yuvarlak-cap${d}`,
      category: "yuvarlak",
      label: `Yuvarlak Ø${d} mm`,
      widthMm: d,
      heightMm: d,
      cornerRadiusMm: d / 2,
      shape: "circle",
      fileBase: `Yuvarlak_Cap${d}mm`,
    });
  }
  for (const s of KARE) {
    out.push({
      id: `kare-${s}x${s}-keskin`,
      category: "kare",
      label: `Kare ${s}×${s} mm · keskin köşe`,
      widthMm: s,
      heightMm: s,
      cornerRadiusMm: 0,
      shape: "rect",
      fileBase: `Kare_${s}x${s}_keskin`,
    });
    out.push({
      id: `kare-${s}x${s}-r3`,
      category: "kare",
      label: `Kare ${s}×${s} mm · yuvarlak köşe (r3)`,
      widthMm: s,
      heightMm: s,
      cornerRadiusMm: 3,
      shape: "rect",
      fileBase: `Kare_${s}x${s}_yuvarlak-r3`,
    });
  }
  for (const [w, h] of DIKDORTGEN) {
    out.push({
      id: `dikdortgen-${w}x${h}-keskin`,
      category: "dikdortgen",
      label: `Dikdörtgen ${w}×${h} mm · keskin köşe`,
      widthMm: w,
      heightMm: h,
      cornerRadiusMm: 0,
      shape: "rect",
      fileBase: `Dikdortgen_${w}x${h}_keskin`,
    });
    out.push({
      id: `dikdortgen-${w}x${h}-r3`,
      category: "dikdortgen",
      label: `Dikdörtgen ${w}×${h} mm · yuvarlak köşe (r3)`,
      widthMm: w,
      heightMm: h,
      cornerRadiusMm: 3,
      shape: "rect",
      fileBase: `Dikdortgen_${w}x${h}_yuvarlak-r3`,
    });
  }
  for (const [w, h] of OVAL) {
    out.push({
      id: `oval-${w}x${h}`,
      category: "oval",
      label: `Oval ${w}×${h} mm`,
      widthMm: w,
      heightMm: h,
      cornerRadiusMm: 0,
      shape: "ellipse",
      fileBase: `Oval_${w}x${h}`,
    });
  }
  for (const [w, h] of BUMPER) {
    out.push({
      id: `bumper-${w}x${h}`,
      category: "bumper",
      label: `Bumper ${w}×${h} mm · yuvarlak köşe (r6)`,
      widthMm: w,
      heightMm: h,
      cornerRadiusMm: 6,
      shape: "rect",
      fileBase: `Bumper_${w}x${h}_r6`,
    });
  }
  return out;
}

export const DIE_CUT_TEMPLATES: DieCutTemplate[] = build();

export const DIE_CUT_BY_ID: Map<string, DieCutTemplate> = new Map(
  DIE_CUT_TEMPLATES.map((t) => [t.id, t])
);

export const CUT_SET_META = CUT_SETS;

export const CATEGORY_LABELS: Record<ShapeCategory, string> = {
  yuvarlak: "Yuvarlak",
  kare: "Kare",
  dikdortgen: "Dikdörtgen",
  oval: "Oval",
  bumper: "Bumper / Tampon",
};

/** R2 object key — manifest doğrulamasından SONRA çağrılır */
export function dieCutR2Key(
  t: DieCutTemplate,
  set: CutSet,
  format: TemplateFormat
): string {
  return `templates/die-cut/${set}/${format}/${t.category}/${t.fileBase}.${format}`;
}

/** İndirilen dosyanın kullanıcıya görünecek adı */
export function dieCutDownloadFilename(
  t: DieCutTemplate,
  set: CutSet,
  format: TemplateFormat
): string {
  const setTag = set === "kisscut" ? "KissCut" : "ThruCut";
  return `${t.fileBase}_${setTag}.${format}`;
}

/** Yerel kaynak yolu (sadece upload script'i için) */
export function dieCutLocalRelPath(
  t: DieCutTemplate,
  set: CutSet,
  format: TemplateFormat
): string {
  const setDir = CUT_SETS[set].dir;
  return `${setDir}/${FORMAT_DIR[format]}/${CATEGORY_DIR[t.category]}/${t.fileBase}.${format}`;
}

export const ALL_CUT_SETS: CutSet[] = ["kisscut", "thrucut"];
export const ALL_FORMATS: TemplateFormat[] = ["pdf", "ai", "eps"];

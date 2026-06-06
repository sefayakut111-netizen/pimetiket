export type SearchIntentKind = "configure" | "browse" | "info" | "unclear";

export type SearchProductType = "sticker" | "etiket" | "none";

export interface ParsedSearchIntent {
  intent: SearchIntentKind;
  productType: SearchProductType;
  material?: "vinil" | "transparan" | "holo" | "simli";
  finish?: "parlak" | "mat" | "yok";
  shape?: "die" | "square" | "circle" | "oval" | "rectangle" | "ozel";
  sizeHint?: string;
  qty?: number;
  confidence: number;
  clarifyQuestion?: string;
}

export interface SearchIntentAction {
  href: string | null;
  label: string;
  subtitle?: string;
  etiketDisabled?: boolean;
  showPimLink?: boolean;
}

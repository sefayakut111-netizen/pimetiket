/**
 * Pricing profile storage — admin tool için kaydedilebilir konfigürasyon profilleri.
 *
 * MAX 20 profil. localStorage'da tutulur.
 * Auth + DB geldiğinde server-side migrate edilecek.
 *
 * Kullanım senaryosu:
 *   - "Standart kraft konfigi" — Sefa sık kullandığı default'ları kaydeder
 *   - "Premium yaldız" — özel kalemler farklı
 *   - "Numune fiyatlandırma" — düşük margin, hızlı bakış
 *   - "Sözleşmeli müşteri X" — özel margin, müşteri-tier
 *   - vs.
 *
 * Her profile bir input snapshot'ı + meta (ad, notlar, son kullanım, müşteri tipi).
 */

import type { CutType, ProductionMode } from "./pricing-engine";

const STORAGE_KEY = "pim_pricing_profiles_v1";
const MAX_PROFILES = 20;

// ============================================================
// Types
// ============================================================

/** Müşteri tipi — gelecekte customer DB ile entegre edilecek (Block C). */
export type CustomerType =
  | "standart" // Tek seferlik müşteri (default)
  | "duzenli" // Düzenli müşteri (3+ sipariş)
  | "sadik" // Sadık müşteri (10+ sipariş)
  | "sozlesmeli"; // Sözleşmeli — manuel parametreler

export interface ProfileInputSnapshot {
  // Sipariş
  mode: ProductionMode;
  cut: CutType;
  width: number;
  height: number;
  qty: number;
  // Fason
  fasonRate: number;
  // Üretim 6 kalem
  paper: number;
  ink: number;
  coating: number;
  labor: number;
  overhead: number;
  depreciation: number;
  // Operasyon
  setup: number;
  packaging: number;
  cargo: number;
  feePct: number;
  // Margin + KDV
  marginPct: number;
  vatPct: number;
  // v0.4 yeni
  minMarkupFraction: number;
  customerType: CustomerType;
}

export interface PricingProfile {
  id: string;
  name: string;
  notes?: string;
  createdAt: number;
  /** Son hesap yapıldığı zaman */
  lastUsedAt?: number;
  /** Son düzenlendiği zaman (parametre değişikliği) */
  lastModifiedAt: number;
  input: ProfileInputSnapshot;
}

// ============================================================
// Storage
// ============================================================

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `prof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listProfiles(): PricingProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PricingProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: PricingProfile[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // localStorage dolu — silently ignore
  }
}

// ============================================================
// CRUD
// ============================================================

export function getProfile(id: string): PricingProfile | null {
  return listProfiles().find((p) => p.id === id) ?? null;
}

export interface SaveProfileArgs {
  /** undefined ise yeni profil, var ise update */
  id?: string;
  name: string;
  notes?: string;
  input: ProfileInputSnapshot;
}

export function saveProfile(args: SaveProfileArgs): {
  ok: true;
  profile: PricingProfile;
} | {
  ok: false;
  reason: "max_reached" | "name_empty" | "name_duplicate";
} {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    return { ok: false, reason: "name_empty" };
  }

  const profiles = listProfiles();
  const now = Date.now();

  if (args.id) {
    // Update existing
    const idx = profiles.findIndex((p) => p.id === args.id);
    if (idx === -1) {
      // ID bulunamadı, yeni olarak ekle
      args.id = undefined;
    } else {
      const existing = profiles[idx];
      const updated: PricingProfile = {
        ...existing,
        name: trimmedName,
        notes: args.notes,
        input: args.input,
        lastModifiedAt: now,
      };
      profiles[idx] = updated;
      writeAll(profiles);
      return { ok: true, profile: updated };
    }
  }

  // Yeni profil
  if (profiles.length >= MAX_PROFILES) {
    return { ok: false, reason: "max_reached" };
  }

  // Aynı isim çakışması (case-insensitive)
  const lowerName = trimmedName.toLocaleLowerCase("tr");
  if (
    profiles.some((p) => p.name.toLocaleLowerCase("tr") === lowerName)
  ) {
    return { ok: false, reason: "name_duplicate" };
  }

  const fresh: PricingProfile = {
    id: generateId(),
    name: trimmedName,
    notes: args.notes,
    input: args.input,
    createdAt: now,
    lastModifiedAt: now,
  };
  profiles.push(fresh);
  writeAll(profiles);
  return { ok: true, profile: fresh };
}

export function deleteProfile(id: string): void {
  const profiles = listProfiles().filter((p) => p.id !== id);
  writeAll(profiles);
}

/** Profil yüklendiğinde lastUsedAt günceller (audit + age tracking için) */
export function touchProfile(id: string): PricingProfile | null {
  const profiles = listProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  profiles[idx] = { ...profiles[idx], lastUsedAt: Date.now() };
  writeAll(profiles);
  return profiles[idx];
}

// ============================================================
// Age helpers (Fix #6 — parametre güncelliği uyarısı)
// ============================================================

export interface ProfileAge {
  daysSinceModified: number;
  /** Renk + mesaj */
  status: "fresh" | "stale" | "ancient";
  message: string;
}

export function getProfileAge(profile: PricingProfile): ProfileAge {
  const now = Date.now();
  const daysSinceModified = Math.floor(
    (now - profile.lastModifiedAt) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceModified < 90) {
    return {
      daysSinceModified,
      status: "fresh",
      message: daysSinceModified === 0
        ? "Bugün düzenlendi"
        : `${daysSinceModified} gün önce düzenlendi`,
    };
  }

  if (daysSinceModified < 180) {
    return {
      daysSinceModified,
      status: "stale",
      message: `${Math.floor(daysSinceModified / 30)} ay önce düzenlendi — enflasyon kontrolü yap`,
    };
  }

  return {
    daysSinceModified,
    status: "ancient",
    message: `${Math.floor(daysSinceModified / 30)} aydır güncellenmedi — parametreler eski olabilir`,
  };
}

// ============================================================
// Constants & defaults
// ============================================================

/** Hazır profil önerileri (Sefa hızlıca başlatması için seed). */
export function getSeedProfiles(): SaveProfileArgs[] {
  return [
    {
      name: "Standart Fason",
      notes: "Default 250 sticker referans, %75 markup, fason 120 ₺/m²",
      input: getDefaultInput(),
    },
    {
      name: "Numune Paketi",
      notes: "25 sticker, ekonomik (markup düşük, müşteri tanışsın)",
      input: { ...getDefaultInput(), qty: 25, marginPct: 50 },
    },
    {
      name: "Premium Yaldız",
      notes: "Yüksek markup, premium görünüm — müşteri özel istek",
      input: { ...getDefaultInput(), marginPct: 110, fasonRate: 180 },
    },
  ];
}

export function getDefaultInput(): ProfileInputSnapshot {
  return {
    mode: "fason",
    cut: "tabaka",
    width: 50,
    height: 50,
    qty: 250,
    fasonRate: 120,
    paper: 45,
    ink: 25,
    coating: 15,
    labor: 35,
    overhead: 45, // v0.4: SaaS recovery için 15 → 45
    depreciation: 10,
    setup: 50,
    packaging: 15,
    cargo: 80,
    feePct: 2.5,
    marginPct: 75,
    vatPct: 20,
    minMarkupFraction: 0.10,
    customerType: "standart",
  };
}

export const PROFILE_LIMIT = MAX_PROFILES;

/**
 * Pim Etiket — Form validation helpers (frontend-only).
 *
 * Türkiye-spesifik:
 *   - validateTcKimlik: 11 hane + Algoritma kontrolü (10. ve 11. hane checksum)
 *   - validateVkn: 10 hane (basit length + numeric)
 *
 * Genel:
 *   - validateEmail
 *   - validatePhone (TR mobil format)
 *   - validateCardNumber (Luhn)
 *   - validateCardExpiry (MM/YY future)
 *   - validateCvv (3-4 hane)
 */

export interface ValidationResult {
  valid: boolean;
  /** Kullanıcıya gösterilecek mesaj (locale-aware için key, basit MVP'de TR) */
  message?: string;
}

const ok: ValidationResult = { valid: true };

// ============================================================
// TC Kimlik (11 hane + checksum algoritması)
// ============================================================

export function validateTcKimlik(value: string): ValidationResult {
  const tc = value.trim();
  if (!tc) return ok; // boş = optional
  if (!/^\d{11}$/.test(tc)) {
    return { valid: false, message: "TC kimlik 11 hane olmalı" };
  }
  if (tc[0] === "0") {
    return { valid: false, message: "TC kimlik 0 ile başlayamaz" };
  }
  // Checksum algoritma (Maliye standardı):
  // 10. hane: (1+3+5+7+9. haneler toplamı × 7) − (2+4+6+8. haneler toplamı) mod 10
  // 11. hane: ilk 10 hane toplamı mod 10
  const digits = tc.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const d10 = (oddSum * 7 - evenSum) % 10;
  if (d10 !== digits[9]) {
    return {
      valid: false,
      message: "TC kimlik numarası hatalı — kontrol et",
    };
  }
  const sumTen = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  if (sumTen % 10 !== digits[10]) {
    return {
      valid: false,
      message: "TC kimlik numarası hatalı — kontrol et",
    };
  }
  return ok;
}

// ============================================================
// VKN (10 hane numeric)
// ============================================================

export function validateVkn(value: string): ValidationResult {
  const vkn = value.trim();
  if (!vkn) return ok;
  if (!/^\d{10}$/.test(vkn)) {
    return { valid: false, message: "VKN 10 hane olmalı" };
  }
  return ok;
}

// ============================================================
// Email
// ============================================================

export function validateEmail(value: string): ValidationResult {
  const email = value.trim();
  if (!email) return ok;
  // RFC 5322 simplified
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, message: "Geçerli bir email gir" };
  }
  return ok;
}

// ============================================================
// Phone (TR mobil tercih)
// ============================================================

export function validatePhone(value: string): ValidationResult {
  const phone = value.replace(/\D/g, "");
  if (!phone) return ok;
  if (phone.length < 10) {
    return { valid: false, message: "Telefon en az 10 hane" };
  }
  return ok;
}

// ============================================================
// Card number — Luhn checksum
// ============================================================

export function validateCardNumber(value: string): ValidationResult {
  const num = value.replace(/\D/g, "");
  if (!num) return ok;
  if (num.length < 13 || num.length > 19) {
    return { valid: false, message: "Kart numarası 13-19 hane" };
  }
  // Luhn
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  if (sum % 10 !== 0) {
    return { valid: false, message: "Kart numarası geçersiz" };
  }
  return ok;
}

// ============================================================
// Expiry — MM/YY format + future date
// ============================================================

export function validateCardExpiry(value: string): ValidationResult {
  const exp = value.trim();
  if (!exp) return ok;
  if (!/^\d{2}\/\d{2}$/.test(exp)) {
    return { valid: false, message: "Format: AA/YY" };
  }
  const [mm, yy] = exp.split("/").map(Number);
  if (mm < 1 || mm > 12) {
    return { valid: false, message: "Geçersiz ay" };
  }
  const now = new Date();
  const fullYear = 2000 + yy;
  const expiryEnd = new Date(fullYear, mm, 0, 23, 59, 59); // ay sonu
  if (expiryEnd < now) {
    return { valid: false, message: "Kart süresi dolmuş" };
  }
  return ok;
}

// ============================================================
// CVV — 3-4 hane
// ============================================================

export function validateCvv(value: string): ValidationResult {
  const cvv = value.trim();
  if (!cvv) return ok;
  if (!/^\d{3,4}$/.test(cvv)) {
    return { valid: false, message: "CVV 3-4 hane" };
  }
  return ok;
}

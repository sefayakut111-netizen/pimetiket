/**
 * Magic-byte mime detection — server-side only.
 *
 * Audit P0 (12 May): Müşteri client-side mimeType iddiasını gönderiyor;
 * zip-içine .exe gizleyerek bizim bucket'a kaymadığı garanti edilmiyordu.
 * Bu helper Storage'a yazılan ilk 64 byte'tan gerçek MIME'i çıkarır,
 * iddiayla karşılaştırır.
 *
 * Desteklenen tipler design-files ALLOWED_MIME_TYPES ile bire bir uyumlu.
 * Bilinmeyen header'lar `null` döner — caller'ın quarantine kararı verir.
 */

import type { AllowedMime } from "./design-files";

/** Compatible MIME aliases — same magic header → multiple valid declarations */
const MIME_ALIASES: Record<string, string[]> = {
  "application/pdf": ["application/pdf"],
  "application/illustrator": [
    "application/illustrator",
    "application/postscript",
    "application/pdf",
  ],
  "application/postscript": [
    "application/postscript",
    "application/illustrator",
    "application/pdf",
  ],
  "image/vnd.adobe.photoshop": ["image/vnd.adobe.photoshop"],
  "image/png": ["image/png"],
  "image/jpeg": ["image/jpeg"],
  "image/svg+xml": ["image/svg+xml", "text/xml", "application/xml"],
};

/**
 * Magic-byte signatures → canonical mime.
 *
 * AI: modern AI dosyaları PDF wrapper'lı (`%PDF`) gelir; eski PS based
 * `%!PS` ile başlar. Her ikisi de application/illustrator olarak kabul edilir.
 *
 * EPS: `%!PS-Adobe` başlığı PostScript ile aynı; .eps olarak kabul.
 */
interface Signature {
  /** Hex bytes (offset 0'dan başlayarak) */
  bytes: number[];
  /** Algılanan canonical MIME */
  mime: string;
  /** Algılama label'ı — log için */
  label: string;
}

const SIGNATURES: Signature[] = [
  // PNG
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    mime: "image/png",
    label: "PNG",
  },
  // JPEG (FF D8 FF — kalan iki byte değişken)
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", label: "JPEG" },
  // PDF
  {
    bytes: [0x25, 0x50, 0x44, 0x46],
    mime: "application/pdf",
    label: "PDF",
  },
  // PostScript / EPS / AI (modern AI PDF wrapper'lı; eski AI = PS)
  {
    bytes: [0x25, 0x21, 0x50, 0x53],
    mime: "application/postscript",
    label: "PostScript/EPS/AI",
  },
  // Photoshop PSD: "8BPS"
  {
    bytes: [0x38, 0x42, 0x50, 0x53],
    mime: "image/vnd.adobe.photoshop",
    label: "PSD",
  },
];

/** SVG için lightweight string scan — XML başlığı + svg tag */
function detectSvg(buf: Uint8Array): boolean {
  // İlk 512 byte'ı utf8 olarak oku, BOM atla
  const len = Math.min(buf.length, 512);
  let text = "";
  for (let i = 0; i < len; i++) {
    text += String.fromCharCode(buf[i]);
  }
  const lowered = text.toLowerCase().trimStart();
  // BOM'u kabul et (﻿ / 0xEF 0xBB 0xBF)
  return (
    lowered.includes("<svg") ||
    (lowered.startsWith("<?xml") && lowered.includes("<svg"))
  );
}

export interface MagicByteResult {
  /** Algılanan canonical MIME (null = tanınmadı) */
  detected: string | null;
  /** Algılama label'ı (insan okunabilir) */
  label: string;
  /** Iddia edilen MIME ile uyumlu mu? */
  matchesClaim: boolean;
}

/**
 * İlk N byte'ı oku, magic-byte ile compare et.
 *
 * @param buf Storage'tan inilen ilk 64-512 byte
 * @param claimedMime Client'ın gönderdiği MIME
 */
export function detectMimeFromMagicBytes(
  buf: Uint8Array,
  claimedMime: AllowedMime
): MagicByteResult {
  // Binary signature scan
  for (const sig of SIGNATURES) {
    if (buf.length < sig.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[i] !== sig.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const aliases = MIME_ALIASES[claimedMime] ?? [claimedMime];
      return {
        detected: sig.mime,
        label: sig.label,
        matchesClaim: aliases.includes(sig.mime),
      };
    }
  }

  // SVG (XML başlığı binary değil — string scan)
  if (detectSvg(buf)) {
    return {
      detected: "image/svg+xml",
      label: "SVG/XML",
      matchesClaim: claimedMime === "image/svg+xml",
    };
  }

  return {
    detected: null,
    label: "unknown",
    matchesClaim: false,
  };
}

/**
 * SVG upload sanitization — script/XSS ve tehlikeli XML öğelerini temizler.
 */

const FORBIDDEN_TAGS = [
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "applet",
  "link",
  "meta",
  "style",
] as const;

const FORBIDDEN_TAG_RE = new RegExp(
  `<(${FORBIDDEN_TAGS.join("|")})\\b[^>]*>[\\s\\S]*?<\\/\\1>`,
  "gi"
);
const SELF_CLOSING_FORBIDDEN_RE = new RegExp(
  `<(${FORBIDDEN_TAGS.join("|")})\\b[^>]*\\/>`,
  "gi"
);
const ON_ATTR_RE = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF_RE =
  /\s+(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi;
const EXTERNAL_USE_RE =
  /<use\b[^>]*(?:href|xlink:href)\s*=\s*(["'])(?!#)[^"']*\1[^>]*\/?>/gi;

export function isSvgMime(mimeType: string, fileName?: string): boolean {
  if (mimeType === "image/svg+xml") return true;
  return fileName?.toLowerCase().endsWith(".svg") ?? false;
}

/** SVG string/buffer içeriğini sanitize eder; temiz SVG döner. */
export function sanitizeSvg(input: string | Buffer | Uint8Array): string {
  let svg =
    typeof input === "string"
      ? input
      : Buffer.from(
          input instanceof Uint8Array ? input : new Uint8Array(input)
        ).toString("utf-8");

  if (!svg.includes("<svg") && !svg.includes("<SVG")) {
    throw new Error("invalid_svg");
  }

  for (let pass = 0; pass < 3; pass++) {
    svg = svg
      .replace(FORBIDDEN_TAG_RE, "")
      .replace(SELF_CLOSING_FORBIDDEN_RE, "")
      .replace(ON_ATTR_RE, "")
      .replace(JS_HREF_RE, "")
      .replace(EXTERNAL_USE_RE, "");
  }

  if (/<script\b/i.test(svg) || /\son[a-z]+\s*=/i.test(svg)) {
    throw new Error("svg_sanitize_failed");
  }

  return svg.trim();
}

export function sanitizeSvgBuffer(
  input: Buffer | Uint8Array | ArrayBuffer
): Buffer {
  const bytes =
    input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  return Buffer.from(sanitizeSvg(bytes), "utf-8");
}

/** SVG ise sanitize edilmiş buffer döner; değilse orijinal. */
export function maybeSanitizeUploadBytes(
  bytes: Buffer | Uint8Array | ArrayBuffer,
  mimeType: string,
  fileName?: string
): Buffer {
  const buf =
    bytes instanceof Buffer
      ? bytes
      : Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
  if (!isSvgMime(mimeType, fileName)) return buf;
  return sanitizeSvgBuffer(buf);
}

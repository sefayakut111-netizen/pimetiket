/**
 * Sepet/sipariş meta'sındaki preview URL'lerinin kalıcılık kontrolü.
 * Signed URL'ler (token=) saatler içinde expire olur — panelde kırık img.
 */

/** design-previews bucket public URL — kalıcı */
export function isPersistentPreviewUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  if (u.startsWith("blob:")) return false;
  if (u.includes("/storage/v1/object/sign/")) return false;
  if (u.includes("token=") && u.includes("supabase")) return false;
  if (u.includes("/design-previews/")) return true;
  if (u.includes("/object/public/design-previews")) return true;
  return false;
}

/** Panelim prefetch atlamasın diye — yalnızca kalıcı URL varsa true */
export function metaPreviewUrlsArePersistent(item: {
  designPreviewUrl?: string;
  additionalDesigns?: Array<{ previewUrl?: string }>;
}): boolean {
  const urls: (string | undefined)[] = [
    item.designPreviewUrl,
    ...(item.additionalDesigns ?? []).map((d) => d.previewUrl),
  ].filter(Boolean);
  if (urls.length === 0) return false;
  return urls.every((u) => isPersistentPreviewUrl(u));
}

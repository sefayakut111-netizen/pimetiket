/**
 * Minimal className concat helper. Falsey değerleri filtreler.
 *
 * Kullanım:
 *   cn("btn", isActive && "btn-active", className)
 *
 * Daha karmaşık merge senaryoları lazım olunca clsx + tailwind-merge
 * eklenebilir; şu an minimum bağımlılık politikası.
 */
export function cn(
  ...args: (string | undefined | null | false | 0)[]
): string {
  return args.filter(Boolean).join(" ");
}

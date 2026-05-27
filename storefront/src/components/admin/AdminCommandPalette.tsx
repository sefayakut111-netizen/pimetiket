/**
 * AdminCommandPalette — Cmd+K (veya Ctrl+K) ile açılan global admin arama.
 *
 * Sefa 18 May v68 (CRO denetim sonrası):
 * Admin panelinde 30+ menü item var, sidebar uzun. Bu palette ile arama
 * yaparak hızlı erişim sağlanır.
 *
 * Açma yolları:
 *   - Cmd+K (Mac) / Ctrl+K (Win)
 *   - Sidebar üstündeki "Ara..." butonu
 *
 * Eşleştirme:
 *   - Sayfa label'larına (örn "Müşteriler", "Kargo", "Arşiv")
 *   - URL path'lerine (örn /admin/kvkk → "kvkk")
 *   - Diakritik tolerans (ı → i, ş → s, vb)
 */

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export interface CommandItem {
  href: string;
  label: string;
  group: string;
  icon?: ReactNode;
}

function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

interface Props {
  items: CommandItem[];
  open: boolean;
  onClose: () => void;
}

export function AdminCommandPalette({ items, open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Açılınca input'a fokuslan + query sıfırla
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      // Açılma animasyonu sonrası focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filtreleme
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = stripDiacritics(query.trim());
    return items.filter((item) => {
      const haystack = stripDiacritics(
        `${item.label} ${item.group} ${item.href}`
      );
      return haystack.includes(q);
    });
  }, [items, query]);

  // Klavye navigasyonu
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selectedIdx];
        if (item) {
          router.push(item.href);
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, filtered, selectedIdx, router, onClose]);

  // Query değişince selection sıfırla
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-label="Admin arama"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-lacivert/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-gri-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gri-200 px-4 py-3">
          <span className="text-gri-500"></span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sayfa, modül veya menü ara..."
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-gri-400"
            autoComplete="off"
          />
          <kbd className="rounded bg-gri-100 px-1.5 py-0.5 text-[10px] font-semibold text-gri-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gri-500">
              <div className="mb-2 text-2xl"></div>
              Eşleşen sayfa yok
              <div className="mt-1 text-[12px] text-gri-400">
                "{query}" için sonuç bulunamadı
              </div>
            </div>
          ) : (
            filtered.map((item, i) => {
              const isSelected = i === selectedIdx;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors ${
                    isSelected ? "bg-pim-mercan-tint" : "hover:bg-gri-50"
                  }`}
                >
                  {item.icon && (
                    <span className="text-gri-500 shrink-0">{item.icon}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-lacivert truncate">
                      {item.label}
                    </div>
                    <div className="text-[11.5px] text-gri-500 truncate">
                      {item.group} · {item.href}
                    </div>
                  </div>
                  {isSelected && (
                    <kbd className="rounded bg-pim-mercan/10 px-1.5 py-0.5 text-[10px] font-semibold text-pim-mercan shrink-0">
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-gri-200 bg-gri-50 px-4 py-2 text-[11px] text-gri-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-white px-1.5 py-0.5 ring-1 ring-gri-200">
                ↑↓
              </kbd>{" "}
              gezin
            </span>
            <span>
              <kbd className="rounded bg-white px-1.5 py-0.5 ring-1 ring-gri-200">
                ↵
              </kbd>{" "}
              aç
            </span>
          </div>
          <span>{filtered.length} sonuç</span>
        </div>
      </div>
    </div>
  );
}

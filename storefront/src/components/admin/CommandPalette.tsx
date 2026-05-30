/**
 * CommandPalette — Cmd+K global admin arama (sayfa + sipariş/müşteri/kargo).
 */

"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { CommandItem } from "@/components/admin/AdminCommandPalette";

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

interface EntityResult {
  href: string;
  label: string;
  subtitle: string;
  group: string;
}

interface Props {
  navItems: CommandItem[];
  open: boolean;
  onClose: () => void;
}

type PaletteRow =
  | { kind: "nav"; item: CommandItem }
  | { kind: "entity"; item: EntityResult };

export function CommandPalette({ navItems, open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [entityResults, setEntityResults] = useState<EntityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setEntityResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filteredNav = useMemo(() => {
    if (!query.trim()) return navItems;
    const q = stripDiacritics(query.trim());
    return navItems.filter((item) => {
      const haystack = stripDiacritics(
        `${item.label} ${item.group} ${item.href}`
      );
      return haystack.includes(q);
    });
  }, [navItems, query]);

  const fetchEntities = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setEntityResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/search?q=${encodeURIComponent(q.trim())}`
      );
      const json = (await res.json()) as {
        orders?: Array<{ href: string; label: string; subtitle: string }>;
        customers?: Array<{ href: string; label: string; subtitle: string }>;
        shipments?: Array<{ href: string; label: string; subtitle: string }>;
      };
      const rows: EntityResult[] = [
        ...(json.orders ?? []).map((o) => ({
          ...o,
          group: "Siparişler",
        })),
        ...(json.customers ?? []).map((c) => ({
          ...c,
          group: "Müşteriler",
        })),
        ...(json.shipments ?? []).map((s) => ({
          ...s,
          group: "Kargo takip",
        })),
      ];
      setEntityResults(rows);
    } catch {
      setEntityResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchEntities(query);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchEntities]);

  const rows: PaletteRow[] = useMemo(() => {
    const navRows: PaletteRow[] = filteredNav.map((item) => ({
      kind: "nav",
      item,
    }));
    if (query.trim().length < 2) return navRows;
    const entityRows: PaletteRow[] = entityResults.map((item) => ({
      kind: "entity",
      item,
    }));
    return [...entityRows, ...navRows];
  }, [filteredNav, entityResults, query]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[selectedIdx];
        if (!row) return;
        const href = row.kind === "nav" ? row.item.href : row.item.href;
        router.push(href);
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, rows, selectedIdx, router, onClose]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, entityResults.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-label="Admin arama"
    >
      <div className="absolute inset-0 bg-lacivert/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-gri-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gri-200 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sipariş, müşteri, takip no veya sayfa ara..."
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-gri-400"
            autoComplete="off"
          />
          <kbd className="rounded bg-gri-100 px-1.5 py-0.5 text-[10px] font-semibold text-gri-700">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gri-500">
              {searching ? "Aranıyor..." : "Eşleşen sonuç yok"}
              {query.trim().length >= 2 && !searching && (
                <div className="mt-1 text-[12px] text-gri-400">
                  &quot;{query}&quot; için sonuç bulunamadı
                </div>
              )}
            </div>
          ) : (
            rows.map((row, i) => {
              const isSelected = i === selectedIdx;
              if (row.kind === "nav") {
                const item = row.item;
                return (
                  <PaletteButton
                    key={`nav-${item.href}`}
                    isSelected={isSelected}
                    onSelect={() => {
                      router.push(item.href);
                      onClose();
                    }}
                    onHover={() => setSelectedIdx(i)}
                    label={item.label}
                    group={item.group}
                    detail={item.href}
                    icon={item.icon}
                  />
                );
              }
              const item = row.item;
              return (
                <PaletteButton
                  key={`entity-${item.href}-${item.label}`}
                  isSelected={isSelected}
                  onSelect={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  onHover={() => setSelectedIdx(i)}
                  label={item.label}
                  group={item.group}
                  detail={item.subtitle}
                />
              );
            })
          )}
        </div>

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
          <span>{rows.length} sonuç</span>
        </div>
      </div>
    </div>
  );
}

function PaletteButton({
  isSelected,
  onSelect,
  onHover,
  label,
  group,
  detail,
  icon,
}: {
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
  label: string;
  group: string;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors ${
        isSelected ? "bg-pim-mercan-tint" : "hover:bg-gri-50"
      }`}
    >
      {icon && <span className="text-gri-500 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-lacivert truncate">{label}</div>
        <div className="text-[11.5px] text-gri-500 truncate">
          {group} · {detail}
        </div>
      </div>
      {isSelected && (
        <kbd className="rounded bg-pim-mercan/10 px-1.5 py-0.5 text-[10px] font-semibold text-pim-mercan shrink-0">
          ↵
        </kbd>
      )}
    </button>
  );
}

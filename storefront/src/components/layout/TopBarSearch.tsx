"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { searchSitePages } from "@/lib/search/site-pages";

type SearchResult = {
  href: string;
  label: string;
  subtitle?: string;
  group: string;
};

interface TopBarSearchProps {
  /** Üye oturumu — editör/panelim sayfaları dahil */
  isMember?: boolean;
  className?: string;
}

export function TopBarSearch({ isMember = false, className }: TopBarSearchProps) {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIdx(0);
  }, []);

  const openSearch = useCallback(() => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();

    const instant = searchSitePages(q, { member: isMember, limit: 5 });
    setResults(instant);
    setSelectedIdx(0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data: { results?: SearchResult[] }) => {
          setResults(data.results ?? instant);
        })
        .catch(() => {
          setResults(instant);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, isMember]);

  const goTo = (href: string) => {
    close();
    router.push(href);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hit = results[selectedIdx];
    if (hit) goTo(hit.href);
    else if (query.trim()) goTo(`/blog?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      goTo(results[selectedIdx].href);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {!open ? (
        <button
          type="button"
          onClick={openSearch}
          aria-label={t.nav.searchOpen}
          className="inline-flex p-2.5 rounded-full text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
        >
          <Icon.Search size={18} />
        </button>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-1 transition-all duration-200"
        >
          <div className="relative">
            <Icon.Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gri-500 pointer-events-none"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t.nav.searchPlaceholder}
              aria-label={t.nav.searchPlaceholder}
              aria-expanded={results.length > 0}
              aria-controls="topbar-search-results"
              autoComplete="off"
              className={cn(
                "h-9 pl-9 pr-3 rounded-full",
                "text-[13px] text-lacivert placeholder:text-gri-500",
                "bg-gri-50 ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan/40 focus:bg-white outline-none transition-all",
                "w-[min(240px,calc(100vw-7rem))] sm:w-[200px] lg:w-[240px]"
              )}
            />
            {(results.length > 0 || (query.trim() && !loading)) && (
              <div
                id="topbar-search-results"
                role="listbox"
                className="absolute top-full right-0 mt-2 w-[min(320px,calc(100vw-2rem))] max-h-[min(360px,50vh)] overflow-y-auto rounded-xl bg-white shadow-2 ring-1 ring-gri-200 z-[60]"
              >
                {loading && results.length === 0 ? (
                  <div className="px-4 py-3 text-[13px] text-gri-500">
                    {t.common.loading}
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-[13px] text-gri-500">
                    {t.nav.searchEmpty}
                  </div>
                ) : (
                  results.map((row, i) => (
                    <Link
                      key={`${row.href}-${row.label}`}
                      href={row.href}
                      role="option"
                      aria-selected={i === selectedIdx}
                      onClick={() => close()}
                      onMouseEnter={() => setSelectedIdx(i)}
                      className={cn(
                        "block px-4 py-2.5 border-b border-gri-50 last:border-0 transition-colors",
                        i === selectedIdx ? "bg-pim-mercan-tint" : "hover:bg-gri-50"
                      )}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gri-500">
                        {row.group}
                      </div>
                      <div className="text-[13.5px] font-medium text-lacivert truncate">
                        {row.label}
                      </div>
                      {row.subtitle && (
                        <div className="text-[11.5px] text-gri-600 truncate">
                          {row.subtitle}
                        </div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t.common.close}
            className="inline-flex p-2 rounded-full text-gri-600 hover:bg-gri-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 4l8 8M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

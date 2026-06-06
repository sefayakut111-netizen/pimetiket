"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { searchSitePages } from "@/lib/search/site-pages";
import type { SearchIntentAction } from "@/lib/search/search-intent-types";

type SearchResult = {
  href: string;
  label: string;
  subtitle?: string;
  group: string;
};

type IntentPayload = {
  action: SearchIntentAction;
  fallback: boolean;
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
  const [intent, setIntent] = useState<IntentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [intentLoading, setIntentLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setIntent(null);
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
    if (intentDebounceRef.current) clearTimeout(intentDebounceRef.current);

    if (q.length < 2) {
      setLoading(false);
      setIntentLoading(false);
      setIntent(null);
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

    if (q.length >= 3) {
      setIntentLoading(true);
      intentDebounceRef.current = setTimeout(() => {
        void fetch("/api/search/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
        })
          .then(async (r) => {
            if (!r.ok) return null;
            return r.json() as Promise<{
              ok?: boolean;
              action?: SearchIntentAction;
              fallback?: boolean;
            }>;
          })
          .then((data) => {
            if (data?.ok && data.action) {
              setIntent({
                action: data.action,
                fallback: Boolean(data.fallback),
              });
            } else {
              setIntent(null);
            }
          })
          .catch(() => setIntent(null))
          .finally(() => setIntentLoading(false));
      }, 380);
    } else {
      setIntent(null);
      setIntentLoading(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intentDebounceRef.current) clearTimeout(intentDebounceRef.current);
    };
  }, [query, open, isMember]);

  const goTo = (href: string) => {
    close();
    router.push(href);
  };

  const openPim = () => {
    close();
    window.dispatchEvent(new CustomEvent("pim-chat-open"));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (intent?.action.href) {
      goTo(intent.action.href);
      return;
    }
    const hit = results[selectedIdx];
    if (hit) goTo(hit.href);
    else if (query.trim()) goTo(`/blog?q=${encodeURIComponent(query.trim())}`);
  };

  const showPanel =
    intent?.action ||
    results.length > 0 ||
    (query.trim() && (loading || intentLoading));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx] && !intent?.action.href) {
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
              aria-expanded={Boolean(showPanel)}
              aria-controls="topbar-search-results"
              autoComplete="off"
              className={cn(
                "h-9 pl-9 pr-3 rounded-full",
                "text-[13px] text-lacivert placeholder:text-gri-500",
                "bg-gri-50 ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan/40 focus:bg-white outline-none transition-all",
                "w-[min(280px,calc(100vw-7rem))] sm:w-[220px] lg:w-[280px]"
              )}
            />
            {showPanel && (
              <div
                id="topbar-search-results"
                role="listbox"
                className="absolute top-full right-0 mt-2 w-[min(360px,calc(100vw-2rem))] max-h-[min(420px,55vh)] overflow-y-auto rounded-xl bg-white shadow-2 ring-1 ring-gri-200 z-[60]"
              >
                {intent?.action && (
                  <div className="p-3 border-b border-gri-100 bg-gri-50/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gri-500 mb-2">
                      {t.nav.searchIntentLabel}
                      {intent.fallback && (
                        <span className="ml-1 normal-case text-gri-400">
                          (basit eşleşme)
                        </span>
                      )}
                    </div>
                    {intent.action.href ? (
                      <button
                        type="button"
                        onClick={() => goTo(intent.action.href!)}
                        className="w-full text-left rounded-lg px-3 py-2.5 bg-white ring-1 ring-pim-mercan/30 hover:bg-pim-mercan-tint transition-colors"
                      >
                        <div className="text-[13.5px] font-semibold text-lacivert">
                          {intent.action.label}
                        </div>
                        {intent.action.subtitle && (
                          <div className="text-[11.5px] text-gri-600 mt-0.5">
                            {intent.action.subtitle}
                          </div>
                        )}
                        {intent.action.etiketDisabled && (
                          <div className="text-[11px] text-sari-koyu mt-1 font-medium">
                            {t.nav.searchEtiketSoon}
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="rounded-lg px-3 py-2.5 bg-white ring-1 ring-gri-200">
                        {intent.action.subtitle && (
                          <p className="text-[13px] text-gri-700">
                            {intent.action.subtitle}
                          </p>
                        )}
                      </div>
                    )}
                    {intent.action.showPimLink && (
                      <button
                        type="button"
                        onClick={openPim}
                        className="mt-2 text-[12px] font-semibold text-pim-mercan hover:underline"
                      >
                        {t.nav.searchAskPim} →
                      </button>
                    )}
                  </div>
                )}

                {loading && results.length === 0 && !intent ? (
                  <div className="px-4 py-3 text-[13px] text-gri-500">
                    {t.common.loading}
                  </div>
                ) : results.length === 0 && !intent?.action ? (
                  <div className="px-4 py-3 text-[13px] text-gri-500">
                    {t.nav.searchEmpty}
                  </div>
                ) : (
                  results.map((row, i) => (
                    <Link
                      key={`${row.href}-${row.label}`}
                      href={row.href}
                      prefetch={false}
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

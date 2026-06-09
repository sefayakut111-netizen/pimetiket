"use client";

/**
 * PimChat — köşe sohbet widget'ı.
 *
 * Mimari:
 *   - Floating button (sağ alt) → açılır panel (380×520)
 *   - Vercel AI SDK useChat hook ile streaming
 *   - Memory: localStorage (KVKK opt-in toggle)
 *   - İlk açılışta KVKK onayı sohbet paneli içinde
 *
 * AppShell'de mount edilir. /admin altında render OLMAZ
 * (AdminShell zaten ayrı).
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PimAsset } from "@/components/PimAsset";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import type { PimPageContext, PimPersona } from "@/lib/pim/personas";
import {
  getPimMemoryProvider,
  isReturningUser,
  memorySnapshotForPrompt,
  readMemory,
  type PimMemory,
  type PimMemoryProvider,
} from "@/lib/pim/memory";
import { useUser } from "@/lib/supabase/use-user";
import {
  readChatConsent,
  writeChatConsent,
  type ChatConsentValue,
} from "@/lib/pim/chat-consent";
import { addToCustomerCart } from "@/lib/customer-cart";
import { track } from "@/lib/analytics/posthog-events";
import { ETIKET_ENABLED, ETIKET_LAUNCH_LABEL } from "@/lib/etiket-feature-flags";

// Sefa kararı (UX audit): kullanıcı persona seçmez, hazır cevap chip'i
// önerilmez. Pim akıllı bir sistem — pathname + soru içeriğine göre
// otomatik doğru tonda yanıt verir. Chip'ler bot hissi yaratıyordu.

function extractPageContext(pathname: string | null): PimPageContext | undefined {
  if (!pathname) return undefined;
  const proofMatch = pathname.match(/^\/onay\/([^/]+)/);
  if (proofMatch) {
    return { page: "proof", orderId: proofMatch[1] };
  }
  const uploadMatch = pathname.match(/^\/siparis\/([^/]+)\/tasarim-yukle/);
  if (uploadMatch) {
    return { page: "upload", orderId: uploadMatch[1] };
  }
  const orderMatch = pathname.match(/^\/siparis\/([^/]+)/);
  if (orderMatch) {
    return { page: "order", orderId: orderMatch[1] };
  }
  return undefined;
}

export function PimChat() {
  const pathname = usePathname();
  const toast = useToast();
  const { user, loading: authLoading } = useUser();
  const providerRef = useRef<PimMemoryProvider>(getPimMemoryProvider(false));
  const memoryRef = useRef<PimMemory>(readMemory());
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState<PimMemory | null>(null);
  const [persona, setPersona] = useState<PimPersona>("welcome");
  const [unread, setUnread] = useState(0);
  // Sefa 17 May v30: Otomatik açılıp kapanan teaser bubble.
  // Sefa 22 May v68 — Spam fix: teaserDismissed sessionStorage'a
  // persist edilir. Önce her sayfa açılışta tekrar geliyordu, kapatma
  // unutuluyordu. Şimdi: bir kez × tıklarsan o session boyunca gizli.
  const [showTeaser, setShowTeaser] = useState(false);
  const [teaserDismissed, setTeaserDismissedState] = useState(false);
  const setTeaserDismissed = useCallback((value: boolean) => {
    setTeaserDismissedState(value);
    if (typeof window !== "undefined" && value) {
      try {
        sessionStorage.setItem("pim_teaser_dismissed", "1");
      } catch {
        /* sessionStorage full / disabled — sessiz fail */
      }
    }
  }, []);

  // Sefa 21 May v68 (KVKK m.9 sınır ötesi açık rıza):
  // Pim sohbeti OpenAI (ABD) altyapısı kullanıyor → KVKK m.9 açık rıza
  // şart. İlk açılışta onay metni sohbet paneli içinde gösterilir;
  // kabul sonrası normal sohbet akışı devam eder.
  //
  // State değerleri:
  //   null         — henüz okunmadı (SSR/mount öncesi)
  //   "needs-prompt" — karar verilmemiş, panel içinde onay gösterilir
  //   "accepted"   — chat tam çalışır
  //   "declined"   — chat hiç açılmaz, kullanıcı butonu görür ama
  //                  tıklayınca tekrar prompt çıkar
  const [consent, setConsent] = useState<
    "needs-prompt" | "accepted" | "declined" | null
  >(null);

  // Mount: KVKK chat consent + teaser dismiss (memory auth effect'te yüklenir)
  useEffect(() => {
    const record = readChatConsent();
    setConsent(record ? record.value : "needs-prompt");
    try {
      if (sessionStorage.getItem("pim_teaser_dismissed") === "1") {
        setTeaserDismissedState(true);
      }
    } catch {
      /* sessionStorage disabled — fallback: normal teaser döngüsü */
    }
  }, []);

  const handleConsentDecision = useCallback((value: ChatConsentValue) => {
    writeChatConsent(value);
    setConsent(value);
    if (value === "declined") {
      // Panel'i hemen kapat
      setOpen(false);
    }
  }, []);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/pim/chat",
      prepareSendMessagesRequest({ messages }) {
        const mem = memoryRef.current;
        const pageContext = extractPageContext(pathname);
        return {
          body: {
            messages,
            persona,
            memory: memorySnapshotForPrompt(mem),
            pageContext,
          },
        };
      },
    }),
    onFinish: ({ message }) => {
      void (async () => {
        const text = extractText(message);
        if (text) {
          await providerRef.current.appendMessage({
            role: "assistant",
            content: text,
            persona,
          });
        }
        const mem = await providerRef.current.read();
        memoryRef.current = mem;
        setMemory(mem);
        if (providerRef.current.flush && mem.history.length > 20) {
          void fetch("/api/pim/summarize", { method: "POST" }).then(
            async (res) => {
              if (!res.ok) return;
              const updated = await providerRef.current.read();
              memoryRef.current = updated;
              setMemory(updated);
            }
          );
        }
        if (!open) setUnread((n) => n + 1);
      })();
    },
    onError: (error) => {
      // Backend hatası — büyük olasılıkla OPENAI_API_KEY yok ya da
      // OpenAI tarafında geçici sorun. Kullanıcıya genel mesaj, dev'e detay.
      console.error("[PimChat] sendMessage error:", error);
      toast.error(
        "Pim şu an cevap veremiyor — lütfen biraz sonra tekrar dene"
      );
    },
  });

  // Auth-aware memory provider: üye → server, anonim → localStorage
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    async function syncAuthMemory() {
      const isAuth = !!user;
      if (isAuth) {
        const local = readMemory();
        try {
          await fetch("/api/pim/memory/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              displayName: local.displayName ?? null,
              facts: local.facts,
              history: local.history,
            }),
          });
        } catch {
          /* migrate best-effort */
        }
        if (providerRef.current.flush) {
          await providerRef.current.flush().catch(() => {});
        }
        providerRef.current = getPimMemoryProvider(true, user.id);
        const mem = await providerRef.current.read();
        if (cancelled) return;
        applyMemoryToChat(mem, setMemory, setMessages, memoryRef);
      } else {
        if (providerRef.current.flush) {
          await providerRef.current.flush().catch(() => {});
        }
        providerRef.current = getPimMemoryProvider(false);
        setMessages([]);
        const mem = await providerRef.current.read();
        if (cancelled) return;
        applyMemoryToChat(mem, setMemory, setMessages, memoryRef);
      }
    }

    void syncAuthMemory();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, setMessages]);

  // Açılınca unread sıfırla
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    track("pim_chat_opened", { page: pathname });
  }, [open, pathname]);

  // Pathname'e göre default persona'yı hizala — sohbet henüz başlamadıysa.
  // /sticker, /etiket → Tasarımcı Pim
  // /siparis/*, /siparislerim, /odeme-sonuc, /panelim → Kargocu Pim
  // /, /sepet, /odeme → Hoş Geldin Pim
  useEffect(() => {
    if (!pathname) return;
    if (messages.length > 0) return; // user zaten konuşuyor — bozma
    if (
      pathname.startsWith("/sticker") ||
      pathname.startsWith("/etiket")
    ) {
      setPersona((p) => (p === "designer" ? p : "designer"));
    } else if (
      pathname.startsWith("/siparis") ||
      pathname.startsWith("/onay") ||
      pathname.startsWith("/siparislerim") ||
      pathname.startsWith("/odeme-sonuc") ||
      pathname.startsWith("/panelim")
    ) {
      setPersona((p) => (p === "shipper" ? p : "shipper"));
    } else if (
      pathname === "/" ||
      pathname.startsWith("/sepet") ||
      pathname === "/odeme"
    ) {
      setPersona((p) => (p === "welcome" ? p : "welcome"));
    }
  }, [pathname, messages.length]);

  // Custom event listener — başka komponentler "pim-chat-open" event'i
  // dispatch ederse chat'i programmatik açabilir.
  // Kullanım: window.dispatchEvent(new CustomEvent('pim-chat-open'))
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("pim-chat-open", handler);
    return () => window.removeEventListener("pim-chat-open", handler);
  }, []);

  // Sefa 17 May v31: Teaser bubble — optimum asimetrik ritim
  // v30 (5sn+5sn) çok hızlı / flash gibiydi.
  // v31: 4sn delay → 6sn açık → 25sn kapalı → 6sn açık → ...
  // Toplam ~31sn döngü; sayfada ortalama 2-3 kez görünür, yormaz.
  useEffect(() => {
    if (open || teaserDismissed) {
      setShowTeaser(false);
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout>;
    let visible = false;
    const cycle = () => {
      visible = !visible;
      setShowTeaser(visible);
      // Açık ise 6sn sonra kapat, kapalı ise 25sn sonra aç
      timeoutId = setTimeout(cycle, visible ? 6000 : 25000);
    };
    // İlk gösterim için 4sn delay
    timeoutId = setTimeout(cycle, 4000);
    return () => clearTimeout(timeoutId);
  }, [open, teaserDismissed]);

  // /admin altında render etme — AdminShell'in kendi flow'u var
  if (pathname?.startsWith("/admin")) return null;
  // Bıçak hazırlık editörü — odaklı akış; sohbet CTA ile çakışmasın
  if (pathname?.startsWith("/editor")) return null;

  return (
    <>
      {/* Teaser speech bubble — Sefa 18 May v68 UX düzeltmeleri:
          - Pointer ok vertical-center (chat butonun merkezine işaret eder)
          - Balon ile chat buton arası boşluk 96px (eski 88 → bitişik fix)
          - × close 32×32 px (WCAG 2.5.5 tap target compliant)
          - --sticky-cta-h CSS variable → mobile sticky CTA ile uyumlu
          - SVG triangle pointer (rotate ring çirkinliği gitti)
          - z-[56] (chat buton z-[55] üstünde, modal z-[9999] altında) */}
      <div
        aria-hidden={!showTeaser}
        className={cn(
          "fixed right-[96px] z-[56] max-sm:hidden",
          "transition-all duration-300 ease-out origin-bottom-right",
          showTeaser && !open && !teaserDismissed
            ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-x-3 scale-95 pointer-events-none"
        )}
        style={{
          // Chat buton ile aynı CSS variable → mobile sticky CTA ile birlikte kayar
          bottom: "calc(2rem + var(--sticky-cta-h, 0px))",
        }}
      >
        <div className="relative bg-krem-soft rounded-2xl shadow-2 ring-1 ring-krem-koyu/40 pl-3 pr-10 py-3 max-w-[260px] flex items-center gap-2.5">
          {/* Mini karga mark — sol */}
          <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-white ring-1 ring-krem-koyu/30">
            <PimAsset variant="icon" bg="light" size={24} bob={false} />
          </span>
          {/* Mesaj */}
          <p className="text-[12.5px] text-lacivert leading-snug font-medium">
            Selam, ben{" "}
            <span className="text-pim-mercan font-semibold">Pim</span>
            {" "}— soracağın bir şey mi var?
          </p>
          {/* × close — Sefa 18 May v68: 20×20 → 32×32 WCAG 2.5.5 compliant */}
          <button
            type="button"
            onClick={() => setTeaserDismissed(true)}
            aria-label="Bildirimi kapat"
            className="absolute top-1 right-1 w-8 h-8 rounded-full text-gri-500 text-[16px] leading-none flex items-center justify-center hover:bg-white hover:text-lacivert focus-visible:outline focus-visible:outline-2 focus-visible:outline-pim-mercan transition-colors"
          >
            ×
          </button>
          {/* SVG triangle pointer — vertical center, chat butonun merkezine bakar */}
          <svg
            aria-hidden
            width="10"
            height="14"
            viewBox="0 0 10 14"
            className="absolute right-[-9px] top-1/2 -translate-y-1/2 drop-shadow-[1px_1px_0_rgba(184,154,109,0.4)]"
            style={{ overflow: "visible" }}
          >
            <path
              d="M 0 0 L 10 7 L 0 14 Z"
              fill="var(--color-krem-soft)"
              stroke="rgba(184,154,109,0.4)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Floating bubble (her zaman görünür) — Sefa 18 May v68 (UX uzman 3.2):
          Mobile'da sticky CTA bar göründüğünde butonu yukarı kaydır.
          `--sticky-cta-h` CSS variable'ı sayfalar tarafından set edilir
          (etiket/sticker page'inde useEffect). */}
      <button
        id="pim-chat"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Pim'i kapat" : "Pim ile konuş"}
        aria-expanded={open}
        className={cn(
          "fixed right-5 z-[55] group scroll-mt-20",
          "transition-all duration-200 ease-out",
          open && "scale-90 opacity-0 pointer-events-none"
        )}
        style={{
          bottom: "calc(1.25rem + var(--sticky-cta-h, 0px))",
        }}
      >
        <span className="relative inline-flex items-center justify-center h-14 w-14 rounded-full bg-pim-mercan shadow-mercan-lg ring-4 ring-white hover:scale-105 transition-transform">
          {/* Mercan zemin → mark-dark (ters renk yok) */}
          <PimAsset variant="icon" bg="light" size={36} bob={false} />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 grid place-items-center min-w-[20px] h-5 px-1 rounded-full bg-lacivert text-white text-[11px] font-bold ring-2 ring-white"
            >
              {unread}
            </span>
          )}
        </span>
        <span className="sr-only">Pim ile konuş</span>
      </button>

      {/* Chat panel — açılınca göster; KVKK onayı panel içinde */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Pim ile sohbet"
        className={cn(
          "fixed bottom-5 right-5 z-[55]",
          "w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-7rem))]",
          "flex flex-col rounded-2xl bg-white shadow-2 ring-1 ring-gri-200 overflow-hidden",
          "transition-all duration-200 ease-out origin-bottom-right",
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-3 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gri-200 bg-gradient-to-br from-pim-mercan-tint to-white">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-pim-mercan ring-2 ring-white shadow-1">
            {/* Chat header mercan → mark-dark (ters renk yok) */}
            <PimAsset variant="icon" bg="light" size={28} bob={false} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] leading-tight text-lacivert">
              Pim
            </div>
            <div className="text-[11.5px] text-gri-700 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yesil animate-pulse" />
              <span>Akıllı asistan</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Kapat"
            className="p-1.5 rounded-full text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            <Icon.X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 bg-gri-50">
          {consent !== "accepted" ? (
            <ChatConsentInline onDecision={handleConsentDecision} />
          ) : messages.length === 0 ? (
            <WelcomeView
              persona={persona}
              memory={memory}
              onClearHistory={() => {
                void (async () => {
                  await providerRef.current.clearHistory();
                  setMessages([]);
                  setUnread(0);
                  const mem = await providerRef.current.read();
                  memoryRef.current = mem;
                  setMemory(mem);
                })();
              }}
            />
          ) : (
            <MessageList messages={messages} status={status} />
          )}
        </div>

        {/* Composer — yalnızca KVKK onayı sonrası */}
        {consent === "accepted" && (
        <Composer
          disabled={status === "streaming" || status === "submitted"}
          onSend={(text) => {
            void (async () => {
              await providerRef.current.appendMessage({
                role: "user",
                content: text,
                persona,
              });
              track("pim_chat_message_sent", { persona });
              const nameMatch = text.match(
                /(?:adım|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+)/
              );
              const mem = await providerRef.current.read();
              if (nameMatch && !mem.displayName) {
                await providerRef.current.setDisplayName(nameMatch[1]);
              }
              const updated = await providerRef.current.read();
              memoryRef.current = updated;
              setMemory(updated);
              sendMessage({ text });
            })();
          }}
        />
        )}
      </div>
    </>
  );
}

// ============================================================
// Memory → useChat restore
// ============================================================

function applyMemoryToChat(
  mem: PimMemory,
  setMemory: (m: PimMemory) => void,
  setMessages: ReturnType<typeof useChat>["setMessages"],
  memoryRef: MutableRefObject<PimMemory>
) {
  memoryRef.current = mem;
  setMemory(mem);
  if (mem.history.length === 0) return;
  const deduped: typeof mem.history = [];
  for (const m of mem.history) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === m.role && prev.content === m.content) continue;
    deduped.push(m);
  }
  const restored = deduped.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
  }));
  setMessages(restored);
}

// ============================================================
// Subcomponents
// ============================================================

function WelcomeView({
  persona,
  memory,
  onClearHistory,
}: {
  persona: PimPersona;
  memory: PimMemory | null;
  onClearHistory: () => void;
}) {
  const returning = !!memory && isReturningUser(memory);
  const baseName = memory?.displayName;

  let greeting: string;
  let subtext: string;

  // Persona pathname-based otomatik seçilir; UI'ya yansımaz, sadece
  // greeting tonunu şekillendirir. Sefa: "Pim akıllı sistem, sistem
  // ne sunacağını kendi belirler."
  if (persona === "designer") {
    greeting = baseName
      ? `Selam ${baseName} 👋`
      : "Selam 👋";
    subtext = "Konfigüre ettiğin ürün için soru sorabilirsin — fiyat, malzeme, teslim süresi, ne istersen.";
  } else if (persona === "shipper") {
    greeting = baseName
      ? `Selam ${baseName} 👋`
      : "Selam 👋";
    subtext =
      "Siparişin hakkında ne sormak istersen sor — durumu, kargo, teslim tarihi.";
  } else {
    greeting = returning
      ? baseName
        ? `Selam ${baseName}, tekrar hoş geldin.`
        : "Selam, tekrar hoş geldin."
      : baseName
        ? `Selam ${baseName} 👋`
        : "Selam 👋";
    subtext = "Sana nasıl yardım edebilirim?";
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white ring-1 ring-gri-200 p-3.5">
        <div className="font-semibold text-[15px] mb-1">{greeting}</div>
        <div className="text-[13.5px] text-gri-700 leading-relaxed">
          {subtext}
        </div>
        {/* Sefa 17 May v32: text-gri-500 → text-gri-700 (görünürlük fix)
            + boyut 12px → 13px + mesaj güncellendi */}
        <div className="text-[13px] text-gri-700 mt-2 leading-relaxed">
          Aklındaki neyse yaz — fiyat, sipariş, malzeme, teslim. Akıllı bir
          yapay zekayım, seni iyi anlayıp doğru cevabı veririm 🙂
        </div>
      </div>
      {returning && (
        <button
          type="button"
          onClick={onClearHistory}
          className="text-[11.5px] text-gri-500 hover:text-pim-mercan underline-offset-2 hover:underline"
        >
          Yeni sohbet başlat
        </button>
      )}
    </div>
  );
}

function MessageList({
  messages,
  status,
}: {
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const text = extractText(m);
        const toolResults = extractToolResults(m);
        const isUser = m.role === "user";
        const hasContent = text || toolResults.length > 0;
        if (!hasContent) return null;
        return (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-2",
              isUser ? "items-end" : "items-start"
            )}
          >
            {text && (
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-1",
                  isUser
                    ? "bg-pim-mercan text-white rounded-br-md"
                    : "bg-white ring-1 ring-gri-200 text-lacivert rounded-bl-md"
                )}
              >
                {isUser ? text : renderMessageText(text)}
              </div>
            )}
            {toolResults.map((tr, i) => (
              <ToolResultCard key={`${m.id}-tool-${i}`} result={tr} />
            ))}
          </div>
        );
      })}
      {(status === "submitted" || status === "streaming") && (
        <div className="flex justify-start">
          <div className="bg-white ring-1 ring-gri-200 rounded-2xl rounded-bl-md px-3.5 py-2.5">
            <TypingDots />
          </div>
        </div>
      )}
      <div ref={scrollRef} />
    </div>
  );
}

// ============================================================
// Tool result card — quote_sticker / quote_etiket sonucu
// ============================================================

interface ToolResultStickerSuccess {
  success: true;
  product: "sticker";
  /** "WxH" formatı, örn "75×75" */
  size_mm: string;
  qty: number;
  material: string;
  finish: string;
  total_kdv_dahil: number;
  unit_price_kdv_dahil: number;
  hediye_adet: number;
  configurator_url: string;
}

interface ToolResultEtiketSuccess {
  success: true;
  product: "etiket";
  width_mm: number;
  height_mm: number;
  qty: number;
  material: string;
  coating: string;
  customization: string;
  total_kdv_dahil: number;
  unit_price_kdv_dahil: number;
  rolls_needed: number;
  total_m2: number;
  configurator_url: string;
}

interface ToolResultError {
  success: false;
  reason: string;
  bigEtiketRedirect?: boolean;
  etiketDisabled?: boolean;
}

interface ToolResultRedirectBlocked {
  type: "redirect";
  blocked: true;
  message: string;
}

interface ToolResultRedirect {
  type: "redirect";
  url: string;
  label: string;
}

interface ToolResultProofStatus {
  found: boolean;
  orderId?: string;
  status?: string;
  redirect?: ToolResultRedirect;
  pimSuggestion?: string | null;
  [key: string]: unknown;
}

type ToolResultData =
  | ToolResultStickerSuccess
  | ToolResultEtiketSuccess
  | ToolResultError;

function isRedirectResult(r: unknown): r is ToolResultRedirect {
  return (
    !!r &&
    typeof r === "object" &&
    "type" in r &&
    (r as ToolResultRedirect).type === "redirect" &&
    !(r as ToolResultRedirectBlocked).blocked
  );
}

function isRedirectBlocked(r: unknown): r is ToolResultRedirectBlocked {
  return (
    !!r &&
    typeof r === "object" &&
    "type" in r &&
    (r as ToolResultRedirectBlocked).type === "redirect" &&
    (r as ToolResultRedirectBlocked).blocked === true
  );
}

function isProofStatusResult(r: unknown): r is ToolResultProofStatus {
  return (
    !!r &&
    typeof r === "object" &&
    "found" in r &&
    (r as ToolResultProofStatus).found === true
  );
}

function ToolResultCard({ result }: { result: unknown }) {
  const toast = useToast();

  if (isRedirectBlocked(result)) {
    return (
      <div className="max-w-[85%] rounded-xl bg-gri-100 ring-1 ring-gri-200 px-3.5 py-2.5 text-[12.5px] text-gri-700">
        {result.message}
      </div>
    );
  }

  if (isRedirectResult(result)) {
    return (
      <Link
        href={result.url}
        className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-pim-mercan text-white rounded-lg font-medium hover:bg-pim-mercan/90 text-sm"
      >
        {result.label}
      </Link>
    );
  }

  if (isProofStatusResult(result) && result.redirect?.type === "redirect") {
    return (
      <div className="max-w-[85%] rounded-xl bg-white ring-1 ring-gri-200 px-3.5 py-2.5 text-[12.5px] text-lacivert">
        {result.status && (
          <p className="font-medium">Durum: {String(result.status)}</p>
        )}
        {result.pimSuggestion && (
          <p className="mt-1 text-gri-700">{String(result.pimSuggestion)}</p>
        )}
        <Link
          href={result.redirect.url}
          className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-pim-mercan text-white rounded-lg font-medium hover:bg-pim-mercan/90 text-sm"
        >
          {result.redirect.label}
        </Link>
      </div>
    );
  }

  const quote = result as ToolResultData;
  if (!("success" in quote) || !quote.success) {
    const err = quote as ToolResultError;
    return (
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[12.5px]",
          err.etiketDisabled
            ? "bg-sari-soft ring-1 ring-sari/30 text-lacivert"
            : "bg-kirmizi/10 ring-1 ring-kirmizi/30 text-kirmizi"
        )}
      >
        {err.etiketDisabled ? "📅" : "⚠️"} {err.reason}
        {err.bigEtiketRedirect && (
          <div className="text-[11px] text-kirmizi/70 mt-1">
            Büyük etiket servisi yakında.
          </div>
        )}
        {err.etiketDisabled && (
          <Link
            href="/sticker"
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-pim-mercan text-white rounded-lg font-medium hover:bg-pim-mercan/90 text-sm"
          >
            Sticker konfigüratörüne git
          </Link>
        )}
      </div>
    );
  }

  const isSticker = quote.product === "sticker";
  const fmtTL = (n: number) =>
    n.toLocaleString("tr-TR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const handleAddToCart = async () => {
    if (quote.product === "sticker") {
      const parts = quote.size_mm.split(/[×x]/).map((s) => Number(s.trim()));
      const w = Number.isFinite(parts[0]) ? parts[0] : 0;
      const h = Number.isFinite(parts[1]) ? parts[1] : 0;
      if (w === 0 || h === 0) {
        toast.error("Boyut çözümlenemedi — konfigüratörden ekle");
        return;
      }
      const matLabel: Record<string, string> = {
        vinil: "Vinil",
        transparan: "Transparan",
        holo: "Holografik",
        simli: "Simli",
      };
      const finLabel: Record<string, string> = {
        parlak: "Parlak",
        mat: "Mat",
        yok: "Kaplamasız",
      };
      const r = await addToCustomerCart({
        product: "sticker",
        title: `Sticker · ${matLabel[quote.material] ?? quote.material} + ${
          finLabel[quote.finish] ?? quote.finish
        }`,
        config: `${w}×${h}mm · ${quote.qty.toLocaleString(
          "tr-TR"
        )} adet · Pim ile fiyatlandı`,
        width: w,
        height: h,
        qty: quote.qty,
        unit: quote.unit_price_kdv_dahil,
        total: Math.round(quote.total_kdv_dahil),
        material: quote.material as "vinil" | "transparan" | "holo" | "simli",
        finish: quote.finish as "parlak" | "mat" | "yok",
        cut: "diecut",
        hediyeAdet: quote.hediye_adet,
      });
      if (r.ok) toast.success("Sepete eklendi 🛒");
      else toast.error(r.reason);
    } else {
      const r = await addToCustomerCart({
        product: "etiket",
        title: `Etiket · ${quote.material}${
          quote.coating !== "Kaplamasız" ? ` + ${quote.coating}` : ""
        }`,
        config: `${quote.width_mm}×${quote.height_mm}mm · ${quote.qty.toLocaleString(
          "tr-TR"
        )} adet${
          quote.customization !== "Eklenti yok"
            ? ` · ${quote.customization}`
            : ""
        } · Pim ile fiyatlandı`,
        width: quote.width_mm,
        height: quote.height_mm,
        qty: quote.qty,
        unit: quote.unit_price_kdv_dahil,
        total: Math.round(quote.total_kdv_dahil),
        meta: {
          materialLabel: quote.material,
          coatingLabel: quote.coating,
          customizationLabel: quote.customization,
        },
      });
      if (r.ok) toast.success("Sepete eklendi 🛒");
      else toast.error(r.reason);
    }
  };

  return (
    <div className="max-w-[90%] w-full rounded-2xl bg-gradient-to-br from-lacivert to-lacivert-koyu text-white p-4 shadow-2 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-[120px] h-[120px] rounded-full bg-pim-mercan/30 blur-2xl"
      />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/50 font-bold mb-1">
          {isSticker ? "Sticker Fiyat" : "Etiket Fiyat"} · KDV Dahil
        </div>
        <div className="text-[28px] font-bold tracking-tight tabular-nums leading-none">
          {fmtTL(quote.total_kdv_dahil)}{" "}
          <span className="text-pim-mercan text-[20px] font-semibold">₺</span>
        </div>
        <div className="text-[11.5px] text-white/70 mt-1.5 tabular-nums">
          {quote.qty.toLocaleString("tr-TR")} adet ×{" "}
          <strong className="text-white">
            {fmtTL(quote.unit_price_kdv_dahil)} ₺/adet
          </strong>
        </div>

        <div className="text-[11.5px] text-white/80 mt-2 leading-snug">
          {isSticker ? (
            <>
              {quote.size_mm} mm · {quote.material} ·{" "}
              {quote.finish}
              {/* +hediye Pim'de gizli (Sefa kuralı 11 May) — overrun
                  adet backend'de fire payı olarak depo edilir */}
            </>
          ) : (
            <>
              {quote.width_mm}×{quote.height_mm} mm · {quote.material}
              {quote.coating !== "Kaplamasız" && ` · ${quote.coating}`}
              {quote.customization !== "Eklenti yok" &&
                ` · ${quote.customization}`}
              {" · "}
              {quote.rolls_needed} rulo
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
          {quote.product === "etiket" && !ETIKET_ENABLED ? (
            <p className="text-[11px] text-white/70">
              Etiket siparişi {ETIKET_LAUNCH_LABEL}&apos;da açılıyor.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddToCart}
                className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-pim-mercan hover:bg-pim-mercan-koyu text-white text-[11.5px] font-semibold transition-colors"
              >
                <Icon.Cart size={11} /> Sepete ekle
              </button>
              <a
                href={quote.configurator_url}
                className="text-[11px] font-semibold text-pim-mercan hover:text-white transition-colors"
              >
                Düzenle →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

interface UIMessageWithParts {
  parts?: Array<{
    type?: string;
    output?: unknown;
    state?: string;
    [k: string]: unknown;
  }>;
}

/**
 * Tool result part'ları çıkarır. AI SDK v6'da part type'ı "tool-{name}"
 * formatında ve `output` field'ında structured data var.
 */
function extractToolResults(m: unknown): unknown[] {
  if (!m || typeof m !== "object") return [];
  const msg = m as UIMessageWithParts;
  if (!Array.isArray(msg.parts)) return [];

  const results: unknown[] = [];
  for (const part of msg.parts) {
    if (
      part.type?.startsWith("tool-") &&
      part.state === "output-available" &&
      part.output
    ) {
      results.push(part.output);
    }
  }
  return results;
}

function TypingDots() {
  const { t } = useT();
  return (
    <span className="inline-flex gap-1" aria-label={t.pim.typing}>
      <span className="w-1.5 h-1.5 rounded-full bg-gri-500 animate-pulse" />
      <span
        className="w-1.5 h-1.5 rounded-full bg-gri-500 animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-gri-500 animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const { t } = useT();
  const [text, setText] = useState("");
  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 p-3 border-t border-gri-200 bg-white"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t.pim.composerPlaceholder}
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none px-3.5 py-2 rounded-2xl bg-gri-50 ring-1 ring-gri-200 text-[14px] text-lacivert placeholder:text-gri-500 focus:outline-none focus:ring-pim-mercan focus:bg-white max-h-32"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label={t.pim.sendLabel}
        className="grid place-items-center h-10 w-10 rounded-full bg-pim-mercan text-white shadow-mercan disabled:opacity-40 disabled:cursor-not-allowed hover:bg-pim-mercan-koyu transition-colors"
      >
        <Icon.ArrowR size={16} />
      </button>
    </form>
  );
}

// ============================================================
// Helpers
// ============================================================

interface UIMessageLike {
  parts?: Array<{ type?: string; text?: string }>;
  content?: string | Array<{ type?: string; text?: string }>;
}

/** AI SDK v6 UIMessage'ten text parts'ları birleştirir. */
function renderMessageText(text: string): React.ReactNode {
  const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const BARE_URL = /(https?:\/\/[^\s<]+)/g;

  if (!MD_LINK.test(text) && !BARE_URL.test(text)) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const combined = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const label = match[1] || match[3]?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || "Link";
    const url = match[2] || match[3] || "#";
    const isInternal = url.includes("pimetiket.com") || url.startsWith("/");
    const href = isInternal ? url.replace(/^https?:\/\/(www\.)?pimetiket\.com/, "") || "/" : url;

    parts.push(
      <a
        key={match.index}
        href={href}
        className="font-semibold text-pim-mercan underline underline-offset-2"
        {...(isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function extractText(m: unknown): string {
  if (!m || typeof m !== "object") return "";
  const msg = m as UIMessageLike;
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  return "";
}

// ============================================================
// ChatConsentInline — KVKK m.9 açık rıza (sohbet paneli içinde)
// ============================================================

function ChatConsentInline({
  onDecision,
}: {
  onDecision: (value: ChatConsentValue) => void;
}) {
  return (
    <div className="space-y-3 animate-fade-up">
      <div className="flex gap-2.5 items-start">
        <span className="grid place-items-center h-8 w-8 rounded-full bg-pim-mercan shrink-0 mt-0.5">
          <PimAsset variant="icon" bg="light" size={20} bob={false} />
        </span>
        <div className="flex-1 min-w-0 rounded-xl rounded-tl-sm bg-white ring-1 ring-gri-200 p-3.5">
          <h3
            id="chat-consent-title"
            className="text-[14px] font-semibold text-lacivert leading-snug"
          >
            Sohbete başlamadan kısa bir izin
          </h3>
          <p className="mt-2 text-[12.5px] text-gri-700 leading-relaxed">
            Pim yapay zekâ tabanlıdır. Yazdığın sorular ve yanıtlar{" "}
            <strong>OpenAI (ABD)</strong> altyapısında işlenir — KVKK m.9
            kapsamında yurt dışına veri aktarımı için açık rızan gerekir.
          </p>
          <ul className="mt-2.5 text-[11.5px] text-gri-700 space-y-1 list-disc pl-4">
            <li>Sohbet içeriği hesabına bağlanmaz</li>
            <li>Sipariş bilgilerin sohbete dahil edilmez</li>
            <li>Veriler reklam için kullanılmaz</li>
          </ul>
          <p className="mt-2.5 text-[11.5px] text-gri-600 leading-relaxed">
            Detay:{" "}
            <Link
              href="/kvkk"
              className="text-pim-mercan font-semibold hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              KVKK aydınlatma metni
            </Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDecision("accepted")}
              className="h-9 px-4 rounded-full bg-pim-mercan text-white text-[13px] font-semibold hover:bg-pim-mercan-koyu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pim-mercan focus-visible:ring-offset-2 transition-colors"
            >
              Kabul ediyorum
            </button>
            <button
              type="button"
              onClick={() => onDecision("declined")}
              className="h-9 px-4 rounded-full bg-white ring-1 ring-gri-200 text-[13px] font-semibold text-gri-700 hover:bg-gri-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lacivert focus-visible:ring-offset-2 transition-colors"
            >
              Vazgeç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

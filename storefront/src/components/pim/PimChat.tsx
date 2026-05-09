"use client";

/**
 * PimChat — köşe sohbet widget'ı.
 *
 * Mimari:
 *   - Floating button (sağ alt) → açılır panel (380×520)
 *   - Vercel AI SDK useChat hook ile streaming
 *   - Memory: localStorage (KVKK opt-in toggle)
 *   - İlk açılışta consent prompt
 *
 * AppShell'de mount edilir. /admin altında render OLMAZ
 * (AdminShell zaten ayrı).
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PimAsset } from "@/components/PimAsset";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ACTIVE_PERSONAS, PERSONAS, type PimPersona } from "@/lib/pim/personas";
import {
  appendMessage,
  isReturningUser,
  memorySnapshotForPrompt,
  readMemory,
  setConsent,
  setDisplayName,
  type PimMemory,
} from "@/lib/pim/memory";
import { addToCustomerCart } from "@/lib/customer-cart";

const QUICK_CHIPS_BY_PERSONA: Record<
  string,
  Array<{ id: string; label: string; prompt: string }>
> = {
  welcome: [
    {
      id: "new-job",
      label: "Yeni iş",
      prompt: "Yeni bir baskı yaptırmak istiyorum.",
    },
    {
      id: "reorder",
      label: "Tekrar baskı",
      prompt: "Önceki bastırdığım işten tekrar yapacağım.",
    },
    {
      id: "issue",
      label: "Sorun var",
      prompt: "Siparişimle ilgili bir sorun var.",
    },
  ],
  designer: [
    {
      id: "etiket-quote",
      label: "Etiket fiyatı",
      prompt:
        "60×80 mm 5000 adet kraft etiket için fiyat çıkar lütfen, kaplama sade.",
    },
    {
      id: "sticker-quote",
      label: "Sticker fiyatı",
      prompt: "75×75 mm vinil parlak sticker, 250 adet, fiyat söyler misin?",
    },
    {
      id: "brief",
      label: "Brief'ten fiyat",
      prompt:
        "Doğal sabunum için etiket lazım, marka adı OLEA, 60×80mm civarı, 2000 adet, kraft + soft touch olsun.",
    },
  ],
  shipper: [
    {
      id: "where",
      label: "Siparişim nerede?",
      prompt: "Siparişim ne durumda?",
    },
    {
      id: "delivery-est",
      label: "Ne zaman gelir?",
      prompt: "Tahmini teslim tarihi ne olur?",
    },
    {
      id: "complaint",
      label: "Kargo geç kaldı",
      prompt: "Kargom geç kaldı, ne oluyor?",
    },
  ],
};

export function PimChat() {
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState<PimMemory | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [persona, setPersona] = useState<PimPersona>("welcome");
  const [unread, setUnread] = useState(0);

  // Mount'ta memory'yi oku (sadece client)
  useEffect(() => {
    const mem = readMemory();
    setMemory(mem);
    setShowConsent(!mem.consent);
  }, []);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/pim/chat",
      prepareSendMessagesRequest({ messages }) {
        const mem = readMemory();
        return {
          body: {
            messages,
            persona,
            memory: memorySnapshotForPrompt(mem),
          },
        };
      },
    }),
    onFinish: ({ message }) => {
      const mem = readMemory();
      if (mem.consent) {
        const text = extractText(message);
        if (text) {
          appendMessage({
            role: "assistant",
            content: text,
            persona,
          });
        }
      }
      if (!open) setUnread((n) => n + 1);
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

  // Mount'ta memory'deki history'yi useChat'e yükle (sayfa yenileme sonrası)
  useEffect(() => {
    if (!memory || !memory.consent) return;
    if (memory.history.length === 0) return;
    if (messages.length > 0) return; // useChat zaten dolu
    // PimMessage → UIMessage çevirisi (parts[type=text])
    const restored = memory.history.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text" as const, text: m.content }],
    }));
    // useChat type'ı UIMessage[] bekler — runtime safe cast
    setMessages(restored as never);
    // sendMessage'ı no-op kullanmak için referansı tüket (lint pacification yerine no-op)
    void sendMessage;
  }, [memory, messages.length, setMessages, sendMessage]);

  // Açılınca unread sıfırla
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

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

  // /admin altında render etme — AdminShell'in kendi flow'u var
  if (pathname?.startsWith("/admin")) return null;

  const personaSpec = PERSONAS[persona];

  return (
    <>
      {/* Floating bubble (her zaman görünür) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Pim'i kapat" : "Pim ile konuş"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-5 right-5 z-50 group",
          "transition-all duration-200 ease-out",
          open && "scale-90 opacity-0 pointer-events-none"
        )}
      >
        <span className="relative inline-flex items-center justify-center h-14 w-14 rounded-full bg-pim-mercan shadow-mercan-lg ring-4 ring-white hover:scale-105 transition-transform">
          <span className="text-white">
            <PimAsset variant="icon" size={36} bob={false} />
          </span>
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

      {/* Chat panel */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Pim ile sohbet"
        className={cn(
          "fixed bottom-5 right-5 z-50",
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
            <span className="text-white">
              <PimAsset variant="icon" size={28} bob={false} />
            </span>
          </span>
          <div className="flex-1 min-w-0">
            {/* Persona seçici dropdown */}
            <select
              value={persona}
              onChange={(e) => {
                const next = e.target.value as PimPersona;
                setPersona(next);
                setMessages([]); // persona değişince yeni başlangıç
              }}
              className="font-semibold text-[15px] leading-tight bg-transparent border-none outline-none cursor-pointer hover:text-pim-mercan-koyu"
              aria-label="Hangi Pim ile konuşuyorsun"
            >
              {ACTIVE_PERSONAS.map((id) => (
                <option key={id} value={id}>
                  {PERSONAS[id].label}
                </option>
              ))}
            </select>
            <div className="text-[11.5px] text-gri-700 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yesil" />
              {personaSpec.tagline}
              {memory?.consent && (
                <>
                  <span className="text-gri-300">·</span>
                  <span title="Pim seni hatırlıyor">🧠 hatırlıyor</span>
                </>
              )}
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
          {showConsent ? (
            <ConsentPanel
              onAccept={() => {
                const mem = setConsent(true);
                setMemory(mem);
                setShowConsent(false);
              }}
              onDecline={() => {
                setConsent(false);
                setShowConsent(false);
              }}
            />
          ) : messages.length === 0 ? (
            <WelcomeView
              persona={persona}
              memory={memory}
              onChip={(prompt) => {
                if (memory?.consent) {
                  appendMessage({ role: "user", content: prompt, persona });
                }
                sendMessage({ text: prompt });
              }}
              onClearHistory={() => {
                setMessages([]);
                setUnread(0);
                // Memory history sıfırla (consent korunur)
                const mem = readMemory();
                if (mem.consent) {
                  mem.history = [];
                  mem.lastConversationSummary = undefined;
                  // writeMemory direkt çağrılamaz, appendMessage'la yapay clear
                  // Daha temiz: storage'a manuel yaz
                  try {
                    localStorage.setItem(
                      "pim:memory:v1",
                      JSON.stringify(mem)
                    );
                  } catch {
                    /* ignore */
                  }
                  setMemory(mem);
                }
              }}
            />
          ) : (
            <MessageList messages={messages} status={status} />
          )}
        </div>

        {/* Composer */}
        {!showConsent && (
          <Composer
            disabled={status === "streaming" || status === "submitted"}
            onSend={(text) => {
              const mem = readMemory();
              if (mem.consent) {
                appendMessage({ role: "user", content: text, persona });
                // Adı düşürdüyse yakala
                const nameMatch = text.match(/(?:adım|ben)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+)/);
                if (nameMatch && !mem.displayName) {
                  setDisplayName(nameMatch[1]);
                }
              }
              sendMessage({ text });
            }}
          />
        )}
      </div>
    </>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function ConsentPanel({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-gri-200 p-4 text-[13.5px] leading-relaxed">
      <div className="font-semibold text-base mb-1.5">
        Selam! Tanışalım mı?
      </div>
      <p className="text-gri-700 mb-3">
        Sohbet ettiklerimizi <strong>tarayıcında</strong> tutarsam, bir
        dahaki gelişinde nereden kaldığımızı hatırlarım. Marka adın, sevdiğin
        malzeme — bağlam olarak akılda tutarım.
      </p>
      <p className="text-gri-700 mb-3">
        Sunucuda tutmuyoruz. Dilediğin an temizleyebilirsin (profil ayarları
        veya tarayıcı verisini silmek).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 h-10 rounded-full bg-pim-mercan text-white font-semibold text-sm hover:bg-pim-mercan-koyu transition-colors"
        >
          Tamam, hatırla
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="px-4 h-10 rounded-full text-gri-700 font-semibold text-sm hover:bg-gri-100 transition-colors"
        >
          Şimdilik gerek yok
        </button>
      </div>
    </div>
  );
}

function WelcomeView({
  persona,
  memory,
  onChip,
  onClearHistory,
}: {
  persona: PimPersona;
  memory: PimMemory | null;
  onChip: (prompt: string) => void;
  onClearHistory: () => void;
}) {
  const returning = !!memory && isReturningUser(memory);
  const baseName = memory?.displayName;

  let greeting: string;
  let subtext: string;

  if (persona === "designer") {
    greeting = baseName
      ? `Selam ${baseName}, Tasarımcı Pim devraldım.`
      : "Selam, Tasarımcı Pim devraldım.";
    subtext = "Etiket / sticker boyutu + adet söyle, fiyat çıkarayım.";
  } else if (persona === "shipper") {
    greeting = baseName
      ? `Selam ${baseName}, Kargocu Pim devraldım.`
      : "Selam, Kargocu Pim devraldım.";
    subtext =
      "Sipariş id'sini söyle (PE-2026-XXXX) ya da chip'lerden seç.";
  } else {
    greeting = returning
      ? baseName
        ? `Selam ${baseName}, hoş geldin tekrar.`
        : "Selam, hoş geldin tekrar."
      : baseName
        ? `Selam ${baseName}, hoş geldin.`
        : "Selam, hoş geldin.";
    subtext = "Etiket mi sticker mı bakıyoruz?";
  }

  const chips = QUICK_CHIPS_BY_PERSONA[persona] ?? QUICK_CHIPS_BY_PERSONA.welcome;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white ring-1 ring-gri-200 p-3.5">
        <div className="font-semibold text-[15px] mb-0.5">{greeting}</div>
        <div className="text-[13.5px] text-gri-700">{subtext}</div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChip(c.prompt)}
            className="px-3 h-8 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan hover:bg-pim-mercan-tint/40 transition-colors"
          >
            {c.label}
          </button>
        ))}
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
                {text}
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
  cuzdan_indirim_2pct: number;
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
  cuzdan_indirim_2pct: number;
  configurator_url: string;
}

interface ToolResultError {
  success: false;
  reason: string;
  bigEtiketRedirect?: boolean;
}

type ToolResultData =
  | ToolResultStickerSuccess
  | ToolResultEtiketSuccess
  | ToolResultError;

function ToolResultCard({ result }: { result: ToolResultData }) {
  const toast = useToast();

  if (!result.success) {
    return (
      <div className="max-w-[85%] rounded-xl bg-kirmizi/10 ring-1 ring-kirmizi/30 px-3.5 py-2.5 text-[12.5px] text-kirmizi">
        ⚠️ {result.reason}
        {result.bigEtiketRedirect && (
          <div className="text-[11px] text-kirmizi/70 mt-1">
            Büyük etiket servisi yakında.
          </div>
        )}
      </div>
    );
  }

  const isSticker = result.product === "sticker";
  const fmtTL = (n: number) =>
    n.toLocaleString("tr-TR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const handleAddToCart = () => {
    if (result.product === "sticker") {
      const parts = result.size_mm.split(/[×x]/).map((s) => Number(s.trim()));
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
      const r = addToCustomerCart({
        product: "sticker",
        title: `Sticker · ${matLabel[result.material] ?? result.material} + ${
          finLabel[result.finish] ?? result.finish
        }`,
        config: `${w}×${h}mm · ${result.qty.toLocaleString(
          "tr-TR"
        )} adet · Pim ile fiyatlandı`,
        width: w,
        height: h,
        qty: result.qty,
        unit: result.unit_price_kdv_dahil,
        total: Math.round(result.total_kdv_dahil),
        cut: "diecut",
        hediyeAdet: result.hediye_adet,
      });
      if (r.ok) toast.success("Sepete eklendi 🛒");
      else toast.error(r.reason);
    } else {
      const r = addToCustomerCart({
        product: "etiket",
        title: `Etiket · ${result.material}${
          result.coating !== "Kaplama yok" ? ` + ${result.coating}` : ""
        }`,
        config: `${result.width_mm}×${result.height_mm}mm · ${result.qty.toLocaleString(
          "tr-TR"
        )} adet${
          result.customization !== "Eklenti yok"
            ? ` · ${result.customization}`
            : ""
        } · Pim ile fiyatlandı`,
        width: result.width_mm,
        height: result.height_mm,
        qty: result.qty,
        unit: result.unit_price_kdv_dahil,
        total: Math.round(result.total_kdv_dahil),
      });
      if (r.ok) toast.success("Sepete eklendi 🛒");
      else toast.error(r.reason);
    }
  };

  return (
    <div className="max-w-[90%] w-full rounded-2xl bg-gradient-to-br from-lacivert to-[#111827] text-white p-4 shadow-2 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-[120px] h-[120px] rounded-full bg-pim-mercan/30 blur-2xl"
      />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/50 font-bold mb-1">
          {isSticker ? "Sticker Fiyat" : "Etiket Fiyat"} · KDV Dahil
        </div>
        <div className="text-[28px] font-bold tracking-tight tabular-nums leading-none">
          {fmtTL(result.total_kdv_dahil)}{" "}
          <span className="text-pim-mercan text-[20px] font-semibold">TL</span>
        </div>
        <div className="text-[11.5px] text-white/70 mt-1.5 tabular-nums">
          {result.qty.toLocaleString("tr-TR")} adet ×{" "}
          <strong className="text-white">
            {fmtTL(result.unit_price_kdv_dahil)} TL/adet
          </strong>
        </div>

        <div className="text-[11.5px] text-white/80 mt-2 leading-snug">
          {isSticker ? (
            <>
              {result.size_mm} mm · {result.material} ·{" "}
              {result.finish}
              {result.hediye_adet > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-yesil">
                    +{result.hediye_adet} hediye
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              {result.width_mm}×{result.height_mm} mm · {result.material}
              {result.coating !== "Kaplama yok" && ` · ${result.coating}`}
              {result.customization !== "Eklenti yok" &&
                ` · ${result.customization}`}
              {" · "}
              {result.rolls_needed} rulo
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10.5px] text-yesil bg-yesil-soft/20 px-2 py-1 rounded-full font-semibold">
            💳 Cüzdandan: −{fmtTL(result.cuzdan_indirim_2pct)} TL (%2)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddToCart}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-pim-mercan hover:bg-pim-mercan-koyu text-white text-[11.5px] font-semibold transition-colors"
            >
              <Icon.Cart size={11} /> Sepete ekle
            </button>
            <a
              href={result.configurator_url}
              className="text-[11px] font-semibold text-pim-mercan hover:text-white transition-colors"
            >
              Düzenle →
            </a>
          </div>
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
function extractToolResults(m: unknown): ToolResultData[] {
  if (!m || typeof m !== "object") return [];
  const msg = m as UIMessageWithParts;
  if (!Array.isArray(msg.parts)) return [];

  const results: ToolResultData[] = [];
  for (const part of msg.parts) {
    if (
      part.type?.startsWith("tool-") &&
      part.state === "output-available" &&
      part.output
    ) {
      results.push(part.output as ToolResultData);
    }
  }
  return results;
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Pim yazıyor">
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
        placeholder="Pim'e yaz…"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none px-3.5 py-2 rounded-2xl bg-gri-50 ring-1 ring-gri-200 text-[14px] text-lacivert placeholder:text-gri-500 focus:outline-none focus:ring-pim-mercan focus:bg-white max-h-32"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Gönder"
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

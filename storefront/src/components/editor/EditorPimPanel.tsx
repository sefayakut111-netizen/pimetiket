"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { PimMini } from "@/components/Pim";
import { PimAsset } from "@/components/PimAsset";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PimEditorCommand } from "@/lib/editor/pim-command-schema";
import type { PimCommandResult } from "@/lib/editor/dispatch-pim-command";

interface ChatMessage {
  id: string;
  role: "user" | "pim";
  text: string;
}

export interface EditorPimPanelProps {
  onCommand: (command: PimEditorCommand) => PimCommandResult;
  disabled?: boolean;
}

function EditorPimPanelContent({
  messages,
  sending,
  disabled,
  input,
  onInputChange,
  onSubmit,
  listRef,
}: {
  messages: ChatMessage[];
  sending: boolean;
  disabled?: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-gri-100 px-3 py-2.5">
        <PimMini pose="chat" size={28} />
        <p className="text-[13px] font-semibold text-lacivert leading-tight">
          Pim&apos;e söyle
        </p>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 space-y-2 bg-gri-50"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[95%] rounded-xl px-3 py-2 text-[13px] leading-snug",
              msg.role === "user"
                ? "ml-auto bg-pim-mercan text-white"
                : "mr-auto bg-white text-lacivert ring-1 ring-gri-200"
            )}
          >
            {msg.text}
          </div>
        ))}
        {sending ? (
          <p className="text-[12px] text-gri-500 px-1">Pim düşünüyor…</p>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-gri-200 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="1 lira boyutu, yuvarlak kes…"
            disabled={disabled || sending}
            maxLength={500}
            className="min-w-0 flex-1 text-[13px]"
            aria-label="Pim komutu"
          />
          <Button
            type="submit"
            size="sm"
            disabled={disabled || sending || !input.trim()}
            className="shrink-0"
          >
            Gönder
          </Button>
        </div>
      </form>
    </>
  );
}

export function EditorPimPanel({ onCommand, disabled }: EditorPimPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "pim",
      text: "Boyut, kesim veya arka plan — yaz, uygularım. Örneğin: «50×30 mm yap», «yuvarlak kes», «arka planı kaldır».",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || disabled) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/editor/pim-command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, product: "sticker" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        command?: PimEditorCommand;
        error?: string;
      };

      if (!res.ok || !data.command) {
        setMessages((prev) => [
          ...prev,
          {
            id: `p-err-${Date.now()}`,
            role: "pim",
            text:
              data.error === "Unauthorized"
                ? "Devam etmek için giriş yapman lazım."
                : "Şu an yanıt veremedim — tekrar dener misin?",
          },
        ]);
        return;
      }

      const cmd = data.command;
      const reply =
        data.reply ??
        (cmd.action === "reject"
          ? cmd.reason
          : cmd.action === "clarify"
            ? cmd.question
            : "Tamam.");

      let pimReply = reply;
      if (cmd.action !== "reject" && cmd.action !== "clarify") {
        const result = onCommand(cmd);
        if (!result.ok) {
          pimReply = `Bunu uygulayamadım: ${result.reason}`;
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: `p-${Date.now()}`, role: "pim", text: pimReply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `p-err-${Date.now()}`,
          role: "pim",
          text: "Bağlantı hatası — tekrar dene.",
        },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }, [input, sending, disabled, onCommand, scrollToBottom]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const panelProps = {
    messages,
    sending,
    disabled,
    input,
    onInputChange: setInput,
    onSubmit: () => void sendMessage(),
    listRef,
  };

  return (
    <>
      <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-gri-200 bg-white lg:flex">
        <EditorPimPanelContent {...panelProps} />
      </aside>

      <button
        type="button"
        aria-label="Pim asistanını aç"
        disabled={disabled}
        onClick={() => setSheetOpen(true)}
        className={cn(
          "lg:hidden fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-pim-mercan text-white shadow-lg ring-2 ring-white transition-transform active:scale-95",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <PimAsset variant="icon" bg="dark" size={36} bob={false} ariaLabel="" />
      </button>

      {sheetOpen ? (
        <>
          <button
            type="button"
            aria-label="Pim panelini kapat"
            className="lg:hidden fixed inset-0 z-40 bg-lacivert/40"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 flex max-h-[50dvh] min-h-[280px] flex-col overflow-hidden rounded-t-2xl border border-gri-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Pim asistanı"
          >
            <EditorPimPanelContent {...panelProps} />
          </div>
        </>
      ) : null}
    </>
  );
}

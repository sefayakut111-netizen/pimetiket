"use client";

import { useCallback, useRef, useState } from "react";
import { PimMini } from "@/components/Pim";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PimEditorCommand } from "@/lib/editor/pim-command-schema";

interface ChatMessage {
  id: string;
  role: "user" | "pim";
  text: string;
}

export interface EditorPimPanelProps {
  onCommand: (command: PimEditorCommand) => void;
  disabled?: boolean;
}

export function EditorPimPanel({ onCommand, disabled }: EditorPimPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "pim",
      text: "Boyut, kesim şekli veya arka plan için yaz — uygularım. Tasarım çizmem.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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

      if (cmd.action !== "reject" && cmd.action !== "clarify") {
        onCommand(cmd);
      }

      setMessages((prev) => [
        ...prev,
        { id: `p-${Date.now()}`, role: "pim", text: reply },
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

  return (
    <aside className="hidden min-h-0 flex-col overflow-hidden border-l border-gri-200 bg-white lg:flex">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-gri-100 px-3 py-3">
        <PimMini pose="chat" size={32} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-lacivert leading-tight">
            Pim&apos;e söyle
          </p>
          <p className="text-[11px] text-gri-500 leading-snug">
            Doğal dille komut ver
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-gri-50"
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
        className="shrink-0 border-t border-gri-200 p-3 bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Örn: 1 lira boyutu yap, yuvarlak kes, arka planı sil"
            disabled={disabled || sending}
            maxLength={500}
            className="text-[13px]"
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
    </aside>
  );
}

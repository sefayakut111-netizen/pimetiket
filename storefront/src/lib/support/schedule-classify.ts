/**
 * Destek talebi oluşturulunca AI sınıflandırmayı Vercel-safe arka planda tetikler.
 */

import "server-only";

import { after } from "next/server";
import { classifyTicket } from "./classify-ticket";

export function scheduleSupportClassify(ticketId: string): void {
  try {
    after(async () => {
      await classifyTicket(ticketId);
    });
  } catch (err) {
    console.warn("[schedule-support-classify] after() fallback:", err);
    void classifyTicket(ticketId).catch((e) => {
      console.error("[schedule-support-classify] inline failed:", ticketId, e);
    });
  }
}

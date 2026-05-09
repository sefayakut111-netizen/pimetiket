/**
 * Customer wallet store — Supabase wire (read-only).
 *
 * Bakiye = wallet_transactions.amount toplamı.
 * Pozitif: yatırım/iade. Negatif: sipariş ödeme.
 *
 * Yazma (deposit/charge/refund) backend service_role yapar — müşteri
 * direkt tabloya INSERT atamaz (RLS koruması).
 */

import { createClient } from "./supabase/client";
import { getCurrentUser } from "./supabase/auth-bridge";

export type WalletTxKind = "deposit" | "purchase" | "refund" | "bonus";

export interface WalletTransaction {
  id: string;
  amount: number;
  description: string;
  orderId: string | null;
  /** Heuristic kategori (description'dan veya order_id'den çıkarsanır) */
  kind: WalletTxKind;
  createdAt: string;
}

interface DbRow {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  order_id: string | null;
  created_at: string;
}

function inferKind(r: DbRow): WalletTxKind {
  const amt = Number(r.amount);
  const desc = r.description.toLowerCase();
  if (amt < 0) return "purchase";
  if (desc.includes("bonus") || desc.includes("hediye")) return "bonus";
  if (desc.includes("iade") || desc.includes("refund")) return "refund";
  return "deposit";
}

function rowToTx(r: DbRow): WalletTransaction {
  return {
    id: r.id,
    amount: Number(r.amount),
    description: r.description,
    orderId: r.order_id,
    kind: inferKind(r),
    createdAt: r.created_at,
  };
}

export async function listMyWalletTransactions(): Promise<WalletTransaction[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[wallet] list error:", error);
    return [];
  }
  return (data as DbRow[]).map(rowToTx);
}

export interface WalletSummary {
  balance: number;
  totalIn: number;
  totalOut: number;
}

export function summarizeWallet(txs: WalletTransaction[]): WalletSummary {
  let totalIn = 0;
  let totalOut = 0;
  for (const t of txs) {
    if (t.amount > 0) totalIn += t.amount;
    else totalOut += Math.abs(t.amount);
  }
  return {
    balance: totalIn - totalOut,
    totalIn,
    totalOut,
  };
}

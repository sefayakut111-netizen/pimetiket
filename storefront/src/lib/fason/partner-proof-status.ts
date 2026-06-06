/** Partner item proof_status — decide guard ve pending sayımı (tek kaynak) */

export const PARTNER_DECIDABLE_STATUSES = [
  "approved",
  "partner_review",
] as const;

export const PARTNER_TERMINAL_STATUSES = [
  "partner_approved",
  "partner_rejected",
  "partner_revised",
] as const;

/** Banner / özet: partner kararı bekleyen kalemler */
export const PARTNER_PENDING_STATUSES = [
  "approved",
  "partner_review",
  "partner_revised",
] as const;

export function isPartnerDecideAllowed(proofStatus: string): boolean {
  return (PARTNER_DECIDABLE_STATUSES as readonly string[]).includes(
    proofStatus
  );
}

export function isPartnerPending(proofStatus: string): boolean {
  return (PARTNER_PENDING_STATUSES as readonly string[]).includes(proofStatus);
}

export function isPartnerTerminal(proofStatus: string): boolean {
  return (PARTNER_TERMINAL_STATUSES as readonly string[]).includes(proofStatus);
}

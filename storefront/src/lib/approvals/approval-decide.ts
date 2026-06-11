/**
 * Onay görseli müşteri kararı — paylaşılan validasyon (API + verify runner).
 */

export type ApprovalDecision = "approve" | "reject";

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export function parseApprovalDecision(
  raw: unknown
): ApprovalDecision | null {
  if (raw === "approve" || raw === "reject") return raw;
  return null;
}

/** Reject'te comment zorunlu; approve'da opsiyonel */
export function validateApprovalDecisionInput(
  decision: ApprovalDecision,
  comment: string | null | undefined
): string | null {
  if (decision === "reject") {
    const trimmed = (comment ?? "").trim();
    if (!trimmed) return "Değişiklik isteğinde açıklama gerekli";
    if (trimmed.length > 2000) return "Açıklama çok uzun (max 2000)";
  } else if (comment && comment.trim().length > 2000) {
    return "Açıklama çok uzun (max 2000)";
  }
  return null;
}

/** Yalnızca pending isteklerde karar verilebilir */
export function canDecideApprovalRequest(status: string): boolean {
  return status === "pending";
}

/**
 * OG-1 onay görseli — unit doğrulama.
 * Kullanım: npx tsx scripts/verify-approval-requests.runner.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import {
  canDecideApprovalRequest,
  parseApprovalDecision,
  validateApprovalDecisionInput,
} from "../src/lib/approvals/approval-decide";
import {
  APPROVAL_MAX_FILES_PER_REQUEST,
  APPROVAL_MAX_FILE_BYTES,
  detectApprovalMime,
  validateApprovalFileCount,
  validateApprovalFileSize,
} from "../src/lib/approvals/approval-storage";
import { assertActivePartnerAssignment } from "../src/lib/fason/assert-active-partner-assignment";

config({ path: resolve(process.cwd(), ".env.local") });

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Mock Supabase — atamasız partner */
function mockAdminNoAssignment() {
  return {
    from: (table: string) => {
      if (table !== "order_assignments") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

async function main() {
  // (a) decide idempotensi — yalnızca pending
  assert(canDecideApprovalRequest("pending"), "pending must be decidable");
  assert(!canDecideApprovalRequest("approved"), "approved not decidable");
  assert(!canDecideApprovalRequest("rejected"), "rejected not decidable");
  assert(!canDecideApprovalRequest("cancelled"), "cancelled not decidable");
  console.log("[verify-approval-requests] decide idempotency predicate OK");

  // (b) reject comment zorunluluğu
  assert(parseApprovalDecision("approve") === "approve", "approve parse");
  assert(parseApprovalDecision("reject") === "reject", "reject parse");
  assert(parseApprovalDecision("maybe") === null, "invalid decision");
  assert(
    validateApprovalDecisionInput("reject", "") !== null,
    "reject requires comment"
  );
  assert(
    validateApprovalDecisionInput("reject", "   ") !== null,
    "reject whitespace comment invalid"
  );
  assert(
    validateApprovalDecisionInput("reject", "Renk tonu farklı") === null,
    "reject with comment OK"
  );
  assert(
    validateApprovalDecisionInput("approve", null) === null,
    "approve without comment OK"
  );
  console.log("[verify-approval-requests] reject comment rules OK");

  // (c) partner guard — atamasız partner 403 (mock)
  const guard = await assertActivePartnerAssignment(
    mockAdminNoAssignment() as never,
    "order-uuid",
    "partner-uuid"
  );
  assert(!guard.ok, "unassigned partner must fail guard");
  console.log("[verify-approval-requests] partner assignment guard OK");

  // (d) asset sayı / boyut limitleri
  assert(
    validateApprovalFileCount(0) !== null,
    "zero files must fail"
  );
  assert(
    validateApprovalFileCount(APPROVAL_MAX_FILES_PER_REQUEST + 1) !== null,
    "too many files must fail"
  );
  assert(
    validateApprovalFileCount(3) === null,
    "3 files within limit OK"
  );
  assert(
    validateApprovalFileSize(APPROVAL_MAX_FILE_BYTES + 1) !== null,
    "oversize must fail"
  );
  assert(
    validateApprovalFileSize(1024) === null,
    "1kb file OK"
  );

  const pngHeader = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const pngMime = detectApprovalMime(pngHeader, "image/png");
  assert(pngMime.mime === "image/png", "png magic OK");

  const webpHeader = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]);
  const webpMime = detectApprovalMime(webpHeader, "image/webp");
  assert(webpMime.mime === "image/webp", "webp magic OK");

  console.log("[verify-approval-requests] asset limits + magic bytes OK");
  console.log("[verify-approval-requests] OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

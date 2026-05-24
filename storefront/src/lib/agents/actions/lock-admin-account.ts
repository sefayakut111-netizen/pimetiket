/**
 * Aksiyon: lock_admin_account — Brute force hedef hesabı geçici kilitle.
 *
 * Payload:
 *   { email: string, duration_hours?: number (default 1), reason?: string }
 *
 * Çalışma şekli:
 *   - Supabase Auth Admin API: updateUserById ile banned_until SET
 *   - Süre dolana kadar kullanıcı giriş yapamaz
 *   - Sefa onayladığı için panel'den manuel kaldırılabilir
 *
 * Kullanım senaryosu: 47 başarısız giriş denemesinden sonra brute
 * force'a karşı hesabı süreyle kilitle. block_ip ile birlikte uygulanır
 * (IP engellense bile farklı IP'den denenmesin diye).
 */

import type { ActionHandler } from "../_shared/proposal";
import { findAuthUserIdByEmail } from "@/lib/auth-user-lookup";

interface LockAccountPayload {
  email: string;
  duration_hours?: number;
  reason?: string;
}

interface AuthUser {
  id: string;
  email: string | null;
}

const lockAdminAccount: ActionHandler = async ({ admin, payload }) => {
  const { email, duration_hours: durationHours = 1 } =
    payload as unknown as LockAccountPayload;

  if (!email || typeof email !== "string") {
    return {
      result: "failed",
      error: "Invalid payload: 'email' field is required",
    };
  }

  // 1) Email → user_id lookup (Mig 088 RPC veya listUsers fallback)
  const userId = await findAuthUserIdByEmail(admin, email);
  if (!userId) {
    return {
      result: "failed",
      error: `User not found: ${email}`,
    };
  }

  // 2) banned_until tarihi hesapla (Supabase format: ISO + duration string)
  const bannedUntil = new Date();
  bannedUntil.setHours(bannedUntil.getHours() + durationHours);

  // 3) Supabase Auth Admin API: ban_duration parametresi destekli
  // updateUserById ile auth.users.banned_until set ediyor.
  try {
    // admin.auth.admin — service-role key ile gelir, public client'ta yoktur
    const authAdmin = admin.auth.admin;
    if (!authAdmin || typeof authAdmin.updateUserById !== "function") {
      return {
        result: "failed",
        error:
          "Supabase Auth Admin API not available (service-role key missing?)",
      };
    }

    const { data, error } = await authAdmin.updateUserById(userId, {
      ban_duration: `${durationHours}h`,
    });

    if (error) {
      return {
        result: "failed",
        error: `Supabase Auth: ${error.message}`,
      };
    }

    const user = data?.user as AuthUser | undefined;

    return {
      result: "success",
      affectedRows: 1,
      affectedIds: { userId: user?.id ?? userId, email },
      externalCall: {
        provider: "supabase_auth",
        bannedUntil: bannedUntil.toISOString(),
        durationHours,
      },
    };
  } catch (err) {
    return {
      result: "failed",
      error: `Supabase Auth threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export default lockAdminAccount;

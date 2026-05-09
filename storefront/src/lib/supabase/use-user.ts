/**
 * useUser — Client component'larda auth state'i takip eder.
 *
 * Supabase yapılandırılmamışsa { user: null, loading: false }.
 * onAuthStateChange ile login/logout otomatik refresh.
 */

"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "./client";

export interface UseUserResult {
  user: User | null;
  loading: boolean;
  /** Display name (profile veya email fallback) */
  displayName: string | null;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    null;

  return { user, loading, displayName };
}

/** Çıkış helper'ı — TopBar'daki dropdown'dan çağrılır */
export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  await supabase.auth.signOut();
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Boş query param (?form=) temizler — edge URL hydration sorunlarını önler.
 * Örn: /sticker/yapilandir?form=&shape=bumper → form silinir.
 */
export function useSanitizeEmptyQueryParam(paramName: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has(paramName)) return;
    if (params.get(paramName) !== "") return;
    params.delete(paramName);
    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    router.replace(path, { scroll: false });
  }, [searchParams, router, paramName]);
}

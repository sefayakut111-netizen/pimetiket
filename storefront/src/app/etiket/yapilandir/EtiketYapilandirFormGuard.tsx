"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  ETIKET_RULO_ENABLED,
  ETIKET_TABAKA_ENABLED,
} from "@/lib/etiket-feature-flags";

/** Rulo kapalıyken ?form=rulo → /etiket redirect (layout erişim guard). */
export function EtiketYapilandirFormGuard({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const form = searchParams.get("form");
    if (form === "rulo" && !ETIKET_RULO_ENABLED) {
      router.replace("/etiket");
      return;
    }
    if (form === "tabaka" && !ETIKET_TABAKA_ENABLED) {
      router.replace("/etiket");
    }
  }, [searchParams, router]);

  return children;
}

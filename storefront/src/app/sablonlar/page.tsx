"use client";

import { Suspense } from "react";
import { SablonlarHub } from "./SablonlarHub";

export default function SablonlarPage() {
  return (
    <main className="py-10 pb-24">
      <div className="mx-auto max-w-[1100px] px-4 md:px-8">
        <Suspense
          fallback={
            <div className="py-20 text-center text-gri-600 text-[14px]">
              Şablonlar yükleniyor…
            </div>
          }
        >
          <SablonlarHub />
        </Suspense>
      </div>
    </main>
  );
}

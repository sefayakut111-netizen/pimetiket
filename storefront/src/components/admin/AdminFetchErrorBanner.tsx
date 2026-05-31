"use client";

import { Card } from "@/components/ui";

interface AdminFetchErrorBannerProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** Admin listelerinde API/network hatası — boş liste ile karışmasın. */
export function AdminFetchErrorBanner({
  title,
  message,
  onRetry,
  className,
}: AdminFetchErrorBannerProps) {
  return (
    <Card
      padding="p-4"
      className={className ?? "mb-5 !bg-kirmizi/5 ring-kirmizi/20"}
    >
      <div className="text-[13px] text-kirmizi-koyu">
        <strong className="block mb-1">{title}</strong>
        {message && (
          <p className="text-gri-700 leading-relaxed">{message}</p>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-[12px] text-pim-mercan font-semibold hover:underline"
          >
            Yeniden dene
          </button>
        )}
      </div>
    </Card>
  );
}

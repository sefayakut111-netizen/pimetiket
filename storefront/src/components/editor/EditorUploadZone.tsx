"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

interface EditorUploadZoneProps {
  designLoaded: boolean;
  fileName?: string | null;
  canRemoveBg?: boolean;
  removingBg?: boolean;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onRemoveBg: () => void;
}

export function EditorUploadZone({
  designLoaded,
  fileName,
  canRemoveBg,
  removingBg,
  disabled,
  onFileSelected,
  onRemoveBg,
}: EditorUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = () => {
    if (!disabled) inputRef.current?.click();
  };

  const acceptFile = (file: File | undefined) => {
    if (!file || disabled) return;
    onFileSelected(file);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={pickFile}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-pim-mercan bg-pim-mercan-tint/40"
            : "border-gri-300 bg-gri-50/50 hover:border-pim-mercan/60 hover:bg-pim-mercan-tint/20",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-pim-mercan shadow-sm ring-1 ring-gri-200"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <span className="mt-3 text-[13px] font-semibold text-lacivert">
          {designLoaded && fileName ? fileName : "Dosya yükle veya sürükle"}
        </span>
        <span className="mt-1 text-[11px] text-gri-600 leading-snug">
          PNG · JPG · PDF · AI · PSD
        </span>
        {designLoaded ? (
          <span className="mt-2 text-[10px] text-gri-500">
            Yeni dosya seçmek için tıkla veya sürükle
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,application/pdf,.ai,.pdf,.psd,image/vnd.adobe.photoshop"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {canRemoveBg ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={removingBg || disabled}
          onClick={onRemoveBg}
        >
          {removingBg ? "AI işliyor…" : "AI ile arka planı kaldır"}
        </Button>
      ) : null}
    </div>
  );
}

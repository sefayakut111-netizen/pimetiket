/**
 * ValidatedInput — Input + onBlur validation + inline hata mesajı.
 *
 * Kullanım:
 *   <ValidatedInput
 *     value={tc}
 *     onChange={setTc}
 *     validate={validateTcKimlik}
 *     placeholder="11 hane"
 *   />
 */

"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "./Input";
import { cn } from "@/lib/cn";

interface ValidationResult {
  valid: boolean;
  message?: string;
}

interface Props
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  validate: (value: string) => ValidationResult;
  /** Değer değişince hata sıfırlansın mı? Default true. */
  resetOnChange?: boolean;
}

export function ValidatedInput({
  value,
  onChange,
  validate,
  resetOnChange = true,
  className,
  ...rest
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setDirty(true);
    const result = validate(e.target.value);
    setError(result.valid ? null : (result.message ?? "Geçersiz"));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (resetOnChange && error) {
      setError(null);
    }
  };

  const showError = dirty && error;

  return (
    <>
      <Input
        {...rest}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={!!showError}
        aria-describedby={showError ? `${rest.id ?? "field"}-error` : undefined}
        className={cn(
          showError &&
            "!ring-kirmizi !shadow-[0_0_0_4px_rgba(224,75,60,0.12)]",
          className
        )}
      />
      {showError && (
        <p
          id={`${rest.id ?? "field"}-error`}
          className="mt-1.5 text-[12px] text-kirmizi font-medium flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
          </svg>
          {error}
        </p>
      )}
    </>
  );
}

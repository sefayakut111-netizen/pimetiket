/**
 * ClampedNumberInput — Number input + clamp on blur (not on every keystroke).
 *
 * Sefa 21 May v68 — Konfigüratör Boyut input bug fix:
 *   Önceki kod onChange'de hemen clamp yapıyordu:
 *     setWidth(Math.max(MIN, Number(e.target.value) || MIN))
 *   Bu yüzden kullanıcı "252" → "25" yazmak için silmek istediğinde
 *   25 < MIN ise anında MIN'e snap ediyor → karakter silinmiyor görünüyor.
 *
 *   Doğru pattern: ham string'i state'de tut, onBlur'da clamp + commit.
 *   Kullanıcı yazarken hiç engellenmez; focus dışı çıkınca validate.
 *
 * Props:
 *   value          — committed number değer (parent state)
 *   onChange       — onBlur'da çağrılır, clamped değerle
 *   min, max       — clamp sınırları
 *   step           — opsiyonel, default 1
 *   ...rest        — diğer input props (className, aria-* vs)
 */

"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";

interface Props
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "min" | "max" | "type"
  > {
  /**
   * Mevcut sayı. `undefined` ise input boş gözükür (touched-aware UX —
   * etiket konfigüratörde "kullanıcı bilinçli seçim yapsın" kuralı).
   * İlk keystroke sonrası parent state'i set eder.
   */
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

export function ClampedNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  onBlur,
  ...rest
}: Props) {
  // Ham string state — input value'su (kullanıcı yazarken hiç clamp yok).
  // value undefined ise boş başlar; tanımlı ise stringify.
  const [raw, setRaw] = useState<string>(
    value === undefined ? "" : String(value)
  );

  // Parent value değişirse (örn. preset chip tıklaması) input'u sync et.
  // value undefined → raw boş; tanımlı → string ile karşılaştır.
  useEffect(() => {
    if (value === undefined) {
      if (raw !== "") setRaw("");
    } else if (Number(raw) !== value) {
      setRaw(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit() {
    const parsed = Number(raw);
    // Boş veya geçersiz → min
    if (raw === "" || Number.isNaN(parsed)) {
      onChange(min);
      setRaw(String(min));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    setRaw(String(clamped));
  }

  return (
    <input
      {...rest}
      type="number"
      value={raw}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        // Enter ile de commit
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
        rest.onKeyDown?.(e);
      }}
    />
  );
}

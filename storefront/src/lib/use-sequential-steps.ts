/**
 * useSequentialSteps — konfigüratör sayfaları için sıralı adım kilitleme.
 *
 * Sefa kararı 18 May v53: '/etiket'te yapılan basamak kilitleme sistemi
 * /sticker'da ve ileride eklenecek TÜM konfigüratör sayfalarında geçerli
 * olacak. Tek bir hook, tüm sayfalar paylaşır.
 *
 * Kullanım:
 *   const { isLocked, lockMessage } = useSequentialSteps({
 *     stepIds: [0, 1, 2, 3, 4],
 *     stepLabels: ['Etiket türü', 'Malzeme', 'Kaplama', ...],
 *     touchedSteps,            // Set<number> — kullanıcı dokunduğu step'ler
 *     prerequisiteForFirst,    // boolean — step-0 için ön koşul (örn. formFactorTouched)
 *     locale,                  // 'tr' | 'en'
 *   });
 *
 *   // FormSection'a geç:
 *   <FormSection
 *     id="step-1"
 *     locked={isLocked(1)}
 *     lockMessage={lockMessage(1)}
 *     ...
 *   />
 *
 * Kural:
 *  - stepIds[0] her zaman açık (ilk adım, prerequisite yoksa)
 *  - stepIds[0] için `prerequisiteForFirst` verilirse: false ise locked
 *  - stepIds[N] (N>0) için: stepIds[N-1] touched değilse locked
 *
 * NOT: Bu hook stateless — sadece hesaplayıcı. State (touchedSteps)
 * dışarıda yönetilir.
 */

export interface SequentialStepsConfig {
  /** DOM step id'leri, sıralı (örn [0, 1, 2, 3]). */
  stepIds: readonly number[];
  /** Step başlıkları, stepIds ile aynı sırada (lock mesajında kullanılır). */
  stepLabels: readonly string[];
  /** Kullanıcının dokunduğu step'ler (her seçimde markTouched çağrılır).
   *  Stepper UI'da "TAMAM" göstergesi için kullanılır. */
  touchedSteps: Set<number>;
  /** Sefa 21 May v68 (konfigüratör denetim #2/#10): URL pre-fill ile
   *  kilidi açılan ama henüz kullanıcının seçim yapmadığı adımlar. Lock
   *  hesabında touched + unlocked birleştirilir; "TAMAM" göstergesi
   *  sadece touched'a bakar. Default boş Set. */
  unlockedSteps?: Set<number>;
  /** İlk adım (stepIds[0]) için opsiyonel ön koşul.
   *  Örn. /etiket'te step-0 etiket türü → formFactorTouched gereklidir
   *  (touchedSteps dışında ayrı state). */
  prerequisiteForFirst?: boolean;
  /** Locale — lock mesajı bu dile göre üretilir. */
  locale: "tr" | "en";
}

export interface SequentialStepsResult {
  /** Verilen step id locked mi? */
  isLocked: (domStepId: number) => boolean;
  /** Verilen step için lock mesajı (locale-aware). */
  lockMessage: (domStepId: number) => string;
}

export function useSequentialSteps({
  stepIds,
  stepLabels,
  touchedSteps,
  unlockedSteps,
  prerequisiteForFirst,
  locale,
}: SequentialStepsConfig): SequentialStepsResult {
  const isLocked = (domStepId: number): boolean => {
    const idx = stepIds.indexOf(domStepId);
    if (idx === -1) return false; // bilinmeyen step → locked değil
    if (idx === 0) {
      // İlk adım — prerequisite varsa ona bak
      if (prerequisiteForFirst === undefined) return false;
      return !prerequisiteForFirst;
    }
    // Sonraki adımlar — bir öncekinin touched veya unlocked olduğunu
    // kontrol. URL pre-fill'den gelen adımlar unlockedSteps'te yer alır
    // (lock'u açar) ama TAMAM göstergesi vermez (touched değil).
    const prev = stepIds[idx - 1];
    if (prev === stepIds[0] && prerequisiteForFirst === false) {
      return true; // ilk step prereq tamamlanmamış
    }
    const prevSatisfied =
      touchedSteps.has(prev) || (unlockedSteps?.has(prev) ?? false);
    return !prevSatisfied;
  };

  const lockMessage = (domStepId: number): string => {
    const idx = stepIds.indexOf(domStepId);
    if (idx <= 0) return "";
    const prevLabel = stepLabels[idx - 1] ?? "önceki";
    return locale === "en"
      ? `Complete "${prevLabel}" first.`
      : `Önce "${prevLabel}" adımını tamamla.`;
  };

  return { isLocked, lockMessage };
}

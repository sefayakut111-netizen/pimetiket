/**
 * Pim — Etiket Profesörü mascot wrapper.
 *
 * Profesyonel görsel asset'i (Gemini SVG çıktısı) olduğunda buraya geldik.
 * Mevcut 9-pose SVG path'leri silindi; tüm pose'lar şu an aynı statik
 * detailed mascot'u gösterir. Pose API ve animasyonlar korunur.
 *
 * 9 pose için ayrı vektör asset'leri (pose-specific) gelene kadar tüm
 * pose'lar görsel olarak aynıdır. animate-pim-bob hâlâ çalışır.
 *
 * Kaynak: PimAsset (composite SVG, viewBox crop ile detailed/icon/combination).
 */

import { PimAsset } from "./PimAsset";

export type PimPose =
  | "wave"
  | "think"
  | "wait"
  | "inspect"
  | "happy"
  | "sad"
  | "excited"
  | "box"
  | "chat";

interface PimProps {
  pose?: PimPose;
  size?: number;
  bob?: boolean;
  className?: string;
}

export function Pim({
  pose = "wave",
  size = 200,
  bob = true,
  className,
}: PimProps) {
  return (
    <PimAsset
      variant="detailed"
      size={size}
      bob={bob}
      className={className}
      ariaLabel={`Pim karga: ${pose}`}
    />
  );
}

interface PimMiniProps {
  pose?: PimPose;
  size?: number;
  className?: string;
}

export function PimMini({
  pose = "wave",
  size = 36,
  className,
}: PimMiniProps) {
  return (
    <PimAsset
      variant="icon"
      size={size}
      bob={false}
      className={className}
      ariaLabel={`Pim mini: ${pose}`}
    />
  );
}

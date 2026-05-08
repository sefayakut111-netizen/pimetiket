/**
 * Pim — Etiket Profesörü mascot.
 *
 * ⚠️ NOT: Bu SVG insanımsı bir karakter çiziyor (cilt tonu, krem önlük).
 * docs/brand/PIM_MASCOT_BRIEF.md kanonik karakter spec'i — yumurta-şekilli
 * KUŞ karakter (round glasses, açık önlük, dual cep). Profesyonel vektör
 * çizim teslim edilince bu dosyanın SVG path'leri değiştirilecek.
 *
 * KORUNACAKLAR (yeniden çizimde aynı kalacak):
 *   - PimPose union (9 pose)
 *   - Props API (pose, size, bob, className)
 *   - Animasyonlar (animate-pim-bob, animate-pim-wave-hand)
 *   - PimMini sub-component
 */

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

interface PoseConfig {
  mouth: "smile" | "wide" | "small" | "frown" | "talk" | "neutral";
  brows: "happy" | "think" | "neutral" | "focus" | "worry";
  arms: "wave" | "thumb" | "up" | "chin" | "magnify" | "down";
  extra: "magnify" | "box" | "spark" | null;
}

const POSES: Record<PimPose, PoseConfig> = {
  wave: { mouth: "smile", brows: "happy", arms: "wave", extra: null },
  think: { mouth: "small", brows: "think", arms: "chin", extra: null },
  wait: { mouth: "small", brows: "neutral", arms: "down", extra: null },
  inspect: {
    mouth: "small",
    brows: "focus",
    arms: "magnify",
    extra: "magnify",
  },
  happy: { mouth: "wide", brows: "happy", arms: "thumb", extra: null },
  sad: { mouth: "frown", brows: "worry", arms: "down", extra: null },
  excited: { mouth: "wide", brows: "happy", arms: "up", extra: "spark" },
  box: { mouth: "smile", brows: "happy", arms: "down", extra: "box" },
  chat: { mouth: "talk", brows: "neutral", arms: "down", extra: null },
};

// Palette (placeholder anatomy renkleri — brief'le birlikte değişecek)
const SKIN = "#FFCDB9";
const SKIN_SH = "#F2A98E";
const APRON = "#F5EBD9";
const APRON_SH = "#E8DCC4";
const CORAL = "#FF6B5B";
const NAVY = "#1F2937";
const ACCENT = "#FF9933";

export function Pim({
  pose = "wave",
  size = 200,
  bob = true,
  className = "",
}: PimProps) {
  const p = POSES[pose];
  const wrapClass = `inline-block leading-none ${
    bob ? "animate-pim-bob" : ""
  } ${className}`.trim();

  const mouth = (() => {
    switch (p.mouth) {
      case "smile":
        return (
          <path
            d="M88 122 Q100 132 112 122"
            stroke={NAVY}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        );
      case "wide":
        return (
          <path
            d="M86 120 Q100 137 114 120 Q100 128 86 120 Z"
            fill={NAVY}
          />
        );
      case "small":
        return (
          <path
            d="M94 124 Q100 128 106 124"
            stroke={NAVY}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        );
      case "frown":
        return (
          <path
            d="M90 128 Q100 120 110 128"
            stroke={NAVY}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        );
      case "talk":
        return <ellipse cx="100" cy="125" rx="6" ry="4" fill={NAVY} />;
      default:
        return null;
    }
  })();

  const brows = (() => {
    switch (p.brows) {
      case "happy":
        return (
          <>
            <path
              d="M70 80 Q78 75 86 80"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M114 80 Q122 75 130 80"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </>
        );
      case "think":
        return (
          <>
            <path
              d="M70 78 L86 82"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M114 82 L130 76"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        );
      case "focus":
        return (
          <>
            <path
              d="M70 80 L86 80"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M114 80 L130 80"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        );
      case "worry":
        return (
          <>
            <path
              d="M70 82 Q78 76 86 80"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M114 80 Q122 76 130 82"
              stroke={NAVY}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </>
        );
      default:
        return (
          <>
            <rect x="70" y="78" width="16" height="3" rx="1.5" fill={NAVY} />
            <rect x="114" y="78" width="16" height="3" rx="1.5" fill={NAVY} />
          </>
        );
    }
  })();

  const eyes = (
    <g>
      <circle cx="78" cy="98" r="3.2" fill={NAVY} />
      <circle cx="122" cy="98" r="3.2" fill={NAVY} />
    </g>
  );

  const glasses = (
    <g fill="none" stroke={NAVY} strokeWidth="2.4">
      <circle cx="78" cy="98" r="14" />
      <circle cx="122" cy="98" r="14" />
      <path d="M92 98 L108 98" strokeLinecap="round" />
      <path d="M64 96 L60 92" strokeLinecap="round" />
      <path d="M136 96 L140 92" strokeLinecap="round" />
    </g>
  );

  const arms = (() => {
    switch (p.arms) {
      case "wave":
        return (
          <g>
            <path
              d="M62 175 Q52 195 56 215"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <g
              className="animate-pim-wave-hand"
              style={{ transformOrigin: "138px 175px" }}
            >
              <path
                d="M138 175 Q160 160 168 138"
                stroke={SKIN}
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="170" cy="134" r="11" fill={SKIN} />
            </g>
            <circle cx="56" cy="215" r="10" fill={SKIN} />
          </g>
        );
      case "thumb":
        return (
          <g>
            <path
              d="M62 175 Q56 195 70 200"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M138 175 Q150 160 152 142"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <g transform="translate(150 138)">
              <circle r="11" fill={SKIN} />
              <rect x="-3" y="-14" width="6" height="9" rx="3" fill={SKIN} />
            </g>
            <circle cx="70" cy="200" r="10" fill={SKIN} />
          </g>
        );
      case "up":
        return (
          <g>
            <path
              d="M62 175 Q40 150 48 130"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M138 175 Q160 150 152 130"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="48" cy="128" r="10" fill={SKIN} />
            <circle cx="152" cy="128" r="10" fill={SKIN} />
          </g>
        );
      case "chin":
        return (
          <g>
            <path
              d="M62 175 Q56 195 70 200"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M138 175 Q120 160 110 132"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="70" cy="200" r="10" fill={SKIN} />
            <circle cx="108" cy="128" r="9" fill={SKIN} />
          </g>
        );
      case "magnify":
        return (
          <g>
            <path
              d="M62 175 Q56 195 70 200"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M138 175 Q146 158 138 138"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="70" cy="200" r="10" fill={SKIN} />
            <circle cx="138" cy="138" r="10" fill={SKIN} />
          </g>
        );
      default:
        return (
          <g>
            <path
              d="M62 175 Q52 200 60 220"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M138 175 Q148 200 140 220"
              stroke={SKIN}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="60" cy="220" r="10" fill={SKIN} />
            <circle cx="140" cy="220" r="10" fill={SKIN} />
          </g>
        );
    }
  })();

  const extra = (() => {
    if (p.extra === "magnify") {
      return (
        <g transform="translate(124 110)">
          <circle
            r="22"
            fill="rgba(255,255,255,0.4)"
            stroke={NAVY}
            strokeWidth="3"
          />
          <circle r="22" fill="none" stroke={NAVY} strokeWidth="3" />
          <path
            d="M16 16 L30 30"
            stroke={NAVY}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      );
    }
    if (p.extra === "box") {
      return (
        <g transform="translate(45 195)">
          <rect width="110" height="70" rx="6" fill={ACCENT} />
          <rect y="0" width="110" height="14" fill="#E68422" />
          <path
            d="M0 14 L110 14"
            stroke="#C76C12"
            strokeWidth="1.5"
          />
          <rect
            x="48"
            y="0"
            width="14"
            height="70"
            fill="#FFD9B0"
            opacity="0.6"
          />
        </g>
      );
    }
    if (p.extra === "spark") {
      return (
        <g fill={ACCENT}>
          <path d="M30 50 L34 58 L42 60 L34 62 L30 70 L26 62 L18 60 L26 58 Z" />
          <path d="M170 60 L173 66 L179 68 L173 70 L170 76 L167 70 L161 68 L167 66 Z" />
        </g>
      );
    }
    return null;
  })();

  return (
    <div role="img" aria-label={`Pim: ${pose}`} className={wrapClass}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 240"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient
            id={`pim-cheek-${pose}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor={CORAL} stopOpacity="0.55" />
            <stop offset="100%" stopColor={CORAL} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* gölge */}
        <ellipse cx="100" cy="232" rx="56" ry="6" fill="rgba(31,41,55,0.12)" />

        {/* önlük + body */}
        <g>
          <path
            d="M55 190 Q55 160 78 152 L122 152 Q145 160 145 190 L145 222 Q100 232 55 222 Z"
            fill={APRON}
          />
          <path
            d="M82 152 L92 130 M118 152 L108 130"
            stroke={APRON_SH}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="80"
            y="180"
            width="40"
            height="22"
            rx="4"
            fill={APRON_SH}
          />
          <rect x="62" y="170" width="22" height="14" rx="3" fill={CORAL} />
          <circle cx="73" cy="177" r="2" fill="white" />
        </g>

        {arms}

        <rect x="92" y="138" width="16" height="14" fill={SKIN_SH} opacity="0.5" />

        {/* head */}
        <g>
          <circle cx="100" cy="98" r="50" fill={SKIN} />
          <path
            d="M60 78 Q70 50 100 48 Q130 50 140 78 Q132 64 100 62 Q68 64 60 78 Z"
            fill={NAVY}
          />
          <circle cx="68" cy="115" r="9" fill={`url(#pim-cheek-${pose})`} />
          <circle cx="132" cy="115" r="9" fill={`url(#pim-cheek-${pose})`} />
          <ellipse cx="50" cy="100" rx="5" ry="9" fill={SKIN_SH} />
          <ellipse cx="150" cy="100" rx="5" ry="9" fill={SKIN_SH} />

          {brows}
          {eyes}
          {glasses}
          {mouth}
        </g>

        {extra}
      </svg>
    </div>
  );
}

// ----------------------------------------------------------------
// PimMini — sohbet ve küçük avatar yerleri için yuvarlak mask
// ----------------------------------------------------------------

interface PimMiniProps {
  pose?: PimPose;
  size?: number;
  className?: string;
}

export function PimMini({ pose = "wave", size = 36, className = "" }: PimMiniProps) {
  return (
    <div
      role="img"
      aria-label={`Pim mini: ${pose}`}
      className={`grid place-items-center overflow-hidden ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: SKIN,
        boxShadow:
          "0 1px 3px rgba(31,41,55,0.2), inset 0 -2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ transform: "translateY(4px) scale(1.6)" }}>
        <Pim pose={pose} size={size * 1.5} bob={false} />
      </div>
    </div>
  );
}

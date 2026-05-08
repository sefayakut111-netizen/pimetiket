/**
 * Pim — Etiket Profesörü (Owl mascot).
 *
 * v0.2 — humanoid placeholder'dan baykuş'a redraw (2026-05-08).
 * Kanonik karakter spec: docs/brand/PIM_MASCOT_BRIEF.md
 *
 * Yapı:
 *   - Egg-shaped mercan body (head + body integrated)
 *   - Frontal büyük gözler + lacivert yuvarlak gözlük
 *   - Hooked turuncu gaga (üçgen değil, kıvrık)
 *   - Ear tufts + heart-shaped face disc (lighter coral)
 *   - 2 stilize kanat (humanoid kol yerine, pose'a göre değişir)
 *   - 2 turuncu pençe (talons)
 *   - Açık krem önlük, V-yaka — mercan vücut ortadan görünür
 *   - Sol cep: rulo etiket / Sağ cep: renkli sticker'lar
 *
 * Pose API (DESIGN_SYSTEM.md §4): 9 pose. Vücut/yüz aynı, sadece
 * kanat pozisyonu, mouth, brows, ve extra (magnifier/box/spark) değişir.
 *
 * Bu hâlâ stilize "amatör" SVG — profesyonel illüstratör vektörü
 * teslim ettiğinde path'ler değişir, pose API ve animasyonlar kalır.
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
  wings: "wave" | "up" | "chin" | "magnify" | "thumb" | "box" | "down";
  extra: "magnify" | "box" | "spark" | null;
}

const POSES: Record<PimPose, PoseConfig> = {
  wave: { mouth: "smile", brows: "happy", wings: "wave", extra: null },
  think: { mouth: "small", brows: "think", wings: "chin", extra: null },
  wait: { mouth: "small", brows: "neutral", wings: "down", extra: null },
  inspect: {
    mouth: "small",
    brows: "focus",
    wings: "magnify",
    extra: "magnify",
  },
  happy: { mouth: "wide", brows: "happy", wings: "thumb", extra: null },
  sad: { mouth: "frown", brows: "worry", wings: "down", extra: null },
  excited: { mouth: "wide", brows: "happy", wings: "up", extra: "spark" },
  box: { mouth: "smile", brows: "happy", wings: "box", extra: "box" },
  chat: { mouth: "talk", brows: "neutral", wings: "down", extra: null },
};

// Palette
const CORAL = "#FF6B5B";
const CORAL_DARK = "#E85544";
const CORAL_LIGHT = "#FFA89E";
const KREM = "#F5EBD9";
const KREM_DARK = "#E8DCC4";
const NAVY = "#1F2937";
const ACCENT = "#FF9933";
const ACCENT_DARK = "#E68422";
const WHITE = "#FFFFFF";

// Sticker accent (sadece sağ cepte)
const VIOLET = "#56258C";
const MINT = "#5CC9B5";
const YELLOW = "#FFC845";

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

  return (
    <div role="img" aria-label={`Pim baykuş: ${pose}`} className={wrapClass}>
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
            <stop offset="0%" stopColor={CORAL_LIGHT} stopOpacity="0.7" />
            <stop offset="100%" stopColor={CORAL_LIGHT} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Yer gölgesi */}
        <ellipse cx="100" cy="232" rx="55" ry="6" fill="rgba(31,41,55,0.12)" />

        {/* Pençeler (talons) — vücut altında */}
        <g>
          <Talon x={82} />
          <Talon x={118} />
        </g>

        {/* Sol kanat (arka katmanda — vücudun arkasında başlar) */}
        <Wing side="left" pose={p.wings} />

        {/* Vücut + Baş (egg-shaped, tek path) */}
        <path
          d="M 100 38 C 62 38 38 78 38 130 C 38 188 65 218 100 218 C 135 218 162 188 162 130 C 162 78 138 38 100 38 Z"
          fill={CORAL}
        />

        {/* Vücut altı gölge (alt kısım hafif koyu) */}
        <path
          d="M 50 175 Q 100 220 150 175 Q 145 215 100 218 Q 55 215 50 175 Z"
          fill={CORAL_DARK}
          opacity="0.4"
        />

        {/* Heart-shaped face disc (gözler etrafında) */}
        <path
          d="M 100 78 C 78 70 50 78 50 108 C 50 138 78 152 100 148 C 122 152 150 138 150 108 C 150 78 122 70 100 78 Z"
          fill={CORAL_LIGHT}
          opacity="0.55"
        />

        {/* Ear tufts (üstte 2 küçük kulak püskülü) */}
        <path
          d="M 65 50 L 70 28 L 80 48 Z"
          fill={CORAL_DARK}
        />
        <path
          d="M 135 50 L 130 28 L 120 48 Z"
          fill={CORAL_DARK}
        />

        {/* Cheek blush (yanaklar) */}
        <circle
          cx="62"
          cy="120"
          r="9"
          fill={`url(#pim-cheek-${pose})`}
        />
        <circle
          cx="138"
          cy="120"
          r="9"
          fill={`url(#pim-cheek-${pose})`}
        />

        {/* Brows */}
        <Brows kind={p.brows} />

        {/* Eyes (büyük frontal owl gözleri) */}
        <g>
          <circle cx="78" cy="105" r="13" fill={WHITE} />
          <circle cx="78" cy="107" r="6" fill={NAVY} />
          <circle cx="80" cy="105" r="2" fill={WHITE} />

          <circle cx="122" cy="105" r="13" fill={WHITE} />
          <circle cx="122" cy="107" r="6" fill={NAVY} />
          <circle cx="124" cy="105" r="2" fill={WHITE} />
        </g>

        {/* Glasses (yuvarlak, kalın çerçeve) */}
        <g fill="none" stroke={NAVY} strokeWidth="2.5">
          <circle cx="78" cy="105" r="16" />
          <circle cx="122" cy="105" r="16" />
          <path d="M 94 105 L 106 105" strokeLinecap="round" />
          <path d="M 62 102 L 56 98" strokeLinecap="round" />
          <path d="M 138 102 L 144 98" strokeLinecap="round" />
        </g>

        {/* Hooked beak (turuncu, kıvrık üçgen) */}
        <path
          d="M 92 128 Q 100 132 108 128 L 100 144 Z"
          fill={ACCENT}
          stroke={ACCENT_DARK}
          strokeWidth="0.6"
        />
        {/* Beak highlight */}
        <path
          d="M 96 130 Q 100 132 104 130"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />

        {/* Mouth (gaganın altında, küçük) */}
        <Mouth kind={p.mouth} />

        {/* V-chest plumage hint (göğüs tüy detayı, çok küçük) */}
        <path
          d="M 92 158 L 100 168 L 108 158"
          stroke={CORAL_DARK}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Apron — açık V-yaka, iki flap */}
        <g>
          {/* Sol flap */}
          <path
            d="M 60 138 Q 56 175 60 215 L 95 215 L 95 178 L 75 158 Z"
            fill={KREM}
            stroke={KREM_DARK}
            strokeWidth="0.8"
          />
          {/* Sağ flap */}
          <path
            d="M 140 138 Q 144 175 140 215 L 105 215 L 105 178 L 125 158 Z"
            fill={KREM}
            stroke={KREM_DARK}
            strokeWidth="0.8"
          />
          {/* V-yaka kenar gölgeleri */}
          <path
            d="M 75 158 L 100 178 L 125 158"
            stroke={KREM_DARK}
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Sol cep — rulo etiket (ciddi taraf) */}
        <g>
          <rect
            x="64"
            y="180"
            width="26"
            height="26"
            rx="3"
            fill={KREM_DARK}
          />
          {/* Rulo (cepten çıkıyor) */}
          <ellipse cx="77" cy="178" rx="11" ry="3.5" fill={WHITE} stroke={NAVY} strokeWidth="0.7" />
          <rect x="66" y="178" width="22" height="6" fill={WHITE} stroke={NAVY} strokeWidth="0.5" />
          <ellipse cx="77" cy="184" rx="11" ry="3" fill={WHITE} />
          {/* Etiket asılı */}
          <rect x="73" y="186" width="8" height="14" fill={WHITE} stroke={NAVY} strokeWidth="0.4" />
          <line x1="74" y1="190" x2="80" y2="190" stroke={NAVY} strokeWidth="0.4" opacity="0.6" />
          <line x1="74" y1="193" x2="80" y2="193" stroke={NAVY} strokeWidth="0.4" opacity="0.6" />
          <text x="77" y="197" textAnchor="middle" fontSize="3" fontFamily="Nunito" fontWeight="700" fill={CORAL}>
            ÜRÜN
          </text>
        </g>

        {/* Sağ cep — sticker karması (eğlenceli taraf) */}
        <g>
          <rect
            x="110"
            y="180"
            width="26"
            height="26"
            rx="3"
            fill={KREM_DARK}
          />
          {/* Sticker'lar (cepten taşıyor) */}
          {/* Yıldız (yellow) */}
          <path
            d="M 116 174 L 118 178 L 122 178 L 119 181 L 120 185 L 116 183 L 112 185 L 113 181 L 110 178 L 114 178 Z"
            fill={YELLOW}
            stroke={NAVY}
            strokeWidth="0.4"
          />
          {/* Daire (violet) — half peeled */}
          <circle cx="125" cy="176" r="5" fill={VIOLET} stroke={NAVY} strokeWidth="0.4" />
          <text x="125" y="178.5" textAnchor="middle" fontSize="4" fontFamily="Nunito" fontWeight="800" fill={WHITE}>
            P
          </text>
          {/* Kalp/damla (mint) */}
          <path
            d="M 132 184 Q 136 180 134 178 Q 132 178 132 181 Q 132 178 130 178 Q 128 180 132 184 Z"
            fill={MINT}
            stroke={NAVY}
            strokeWidth="0.4"
          />
          {/* Cepteki ek yatay sticker'lar */}
          <rect x="113" y="190" width="20" height="3" rx="1" fill={MINT} opacity="0.7" />
          <rect x="113" y="195" width="14" height="3" rx="1" fill={VIOLET} opacity="0.7" />
        </g>

        {/* Sağ kanat (önde — pose'a göre dinamik) */}
        <Wing side="right" pose={p.wings} />

        {/* Extra elementler (magnify glass, box, spark) */}
        <Extra kind={p.extra} />
      </svg>
    </div>
  );
}

// ============================================================
// Sub-components: Wing, Mouth, Brows, Talon, Extra
// ============================================================

function Wing({ side, pose }: { side: "left" | "right"; pose: PoseConfig["wings"] }) {
  const isLeft = side === "left";
  const isRight = side === "right";

  // Kanat geometrisi: yan, hafif feather hint
  // Default duruş (yana sarkık)
  const downLeft = (
    <g>
      <path
        d="M 38 130 Q 22 145 30 180 Q 44 188 50 175 Q 50 152 45 130 Z"
        fill={CORAL_DARK}
      />
      {/* Feather hint (1-2 stroke) */}
      <path
        d="M 36 150 Q 33 170 42 178"
        stroke={CORAL}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
  );

  const downRight = (
    <g>
      <path
        d="M 162 130 Q 178 145 170 180 Q 156 188 150 175 Q 150 152 155 130 Z"
        fill={CORAL_DARK}
      />
      <path
        d="M 164 150 Q 167 170 158 178"
        stroke={CORAL}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
  );

  // wave: sağ kanat yukarı + animation
  if (pose === "wave") {
    if (isLeft) return downLeft;
    return (
      <g
        className="animate-pim-wave-hand"
        style={{ transformOrigin: "162px 130px" }}
      >
        <path
          d="M 162 130 Q 175 105 178 75 Q 168 75 158 100 Q 152 118 155 130 Z"
          fill={CORAL_DARK}
        />
        <path
          d="M 168 90 Q 165 110 160 125"
          stroke={CORAL}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
    );
  }

  // up: iki kanat tam yukarı
  if (pose === "up") {
    if (isLeft) {
      return (
        <g>
          <path
            d="M 38 130 Q 18 105 22 70 Q 35 70 45 95 Q 50 115 48 130 Z"
            fill={CORAL_DARK}
          />
          <path
            d="M 30 95 Q 32 115 40 128"
            stroke={CORAL}
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            opacity="0.5"
          />
        </g>
      );
    }
    return (
      <g>
        <path
          d="M 162 130 Q 182 105 178 70 Q 165 70 155 95 Q 150 115 152 130 Z"
          fill={CORAL_DARK}
        />
        <path
          d="M 170 95 Q 168 115 160 128"
          stroke={CORAL}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
    );
  }

  // chin: sağ kanat yüze yakın (think pose)
  if (pose === "chin") {
    if (isLeft) return downLeft;
    return (
      <g>
        <path
          d="M 162 130 Q 158 115 130 110 Q 122 116 128 130 Q 145 138 162 130 Z"
          fill={CORAL_DARK}
        />
      </g>
    );
  }

  // magnify: sağ kanat magnifier tutar (inspect)
  if (pose === "magnify") {
    if (isLeft) return downLeft;
    return (
      <g>
        <path
          d="M 162 130 Q 168 110 148 100 Q 138 108 144 122 Q 152 130 162 130 Z"
          fill={CORAL_DARK}
        />
      </g>
    );
  }

  // thumb: kanatlar hafif yukarı (happy — owl thumbs up imkansız, yelpazelenmiş kanat)
  if (pose === "thumb") {
    if (isLeft) {
      return (
        <g>
          <path
            d="M 38 130 Q 24 115 28 95 Q 40 92 46 110 Q 50 122 48 130 Z"
            fill={CORAL_DARK}
          />
        </g>
      );
    }
    return (
      <g>
        <path
          d="M 162 130 Q 176 115 172 95 Q 160 92 154 110 Q 150 122 152 130 Z"
          fill={CORAL_DARK}
        />
      </g>
    );
  }

  // box: kanatlar paket etrafında (öne sarmal)
  if (pose === "box") {
    if (isLeft) {
      return (
        <g>
          <path
            d="M 38 130 Q 30 165 50 195 Q 65 198 62 175 Q 55 152 48 130 Z"
            fill={CORAL_DARK}
          />
        </g>
      );
    }
    return (
      <g>
        <path
          d="M 162 130 Q 170 165 150 195 Q 135 198 138 175 Q 145 152 152 130 Z"
          fill={CORAL_DARK}
        />
      </g>
    );
  }

  // down (default — wait, sad, chat)
  return isLeft ? downLeft : downRight;
}

function Mouth({ kind }: { kind: PoseConfig["mouth"] }) {
  switch (kind) {
    case "smile":
      return (
        <path
          d="M 92 152 Q 100 158 108 152"
          stroke={NAVY}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "wide":
      return (
        <path
          d="M 89 150 Q 100 165 111 150 Q 100 158 89 150 Z"
          fill={NAVY}
        />
      );
    case "small":
      return (
        <path
          d="M 96 154 Q 100 157 104 154"
          stroke={NAVY}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "frown":
      return (
        <path
          d="M 92 158 Q 100 152 108 158"
          stroke={NAVY}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "talk":
      return <ellipse cx="100" cy="155" rx="3.5" ry="2.5" fill={NAVY} />;
    default:
      return null;
  }
}

function Brows({ kind }: { kind: PoseConfig["brows"] }) {
  switch (kind) {
    case "happy":
      return (
        <>
          <path
            d="M 64 84 Q 74 78 88 84"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 112 84 Q 126 78 136 84"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case "think":
      return (
        <>
          <path
            d="M 64 82 L 88 87"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 112 87 L 136 80"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      );
    case "focus":
      return (
        <>
          <path
            d="M 64 85 L 88 85"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 112 85 L 136 85"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      );
    case "worry":
      return (
        <>
          <path
            d="M 64 88 Q 74 80 88 84"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 112 84 Q 126 80 136 88"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    default: // neutral
      return (
        <>
          <rect x="64" y="83" width="22" height="2.6" rx="1.3" fill={NAVY} />
          <rect x="114" y="83" width="22" height="2.6" rx="1.3" fill={NAVY} />
        </>
      );
  }
}

function Talon({ x }: { x: number }) {
  // 3-toe stilize pençe
  const baseY = 218;
  return (
    <g transform={`translate(${x} ${baseY})`}>
      {/* Bilek */}
      <ellipse cx="0" cy="0" rx="6" ry="2" fill={ACCENT_DARK} />
      {/* 3 parmak */}
      <path
        d="M -5 0 L -7 8 L -5 11"
        stroke={ACCENT}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 0 0 L 0 10 L 0 13"
        stroke={ACCENT}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 5 0 L 7 8 L 5 11"
        stroke={ACCENT}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Extra({ kind }: { kind: PoseConfig["extra"] }) {
  if (kind === "magnify") {
    return (
      <g transform="translate(150 105)">
        <circle r="20" fill="rgba(255,255,255,0.35)" stroke={NAVY} strokeWidth="2.5" />
        <circle r="20" fill="none" stroke={NAVY} strokeWidth="2.5" />
        {/* Lens parlama */}
        <ellipse cx="-6" cy="-6" rx="6" ry="3" fill={WHITE} opacity="0.7" />
        {/* Sap */}
        <path
          d="M 14 14 L 26 26"
          stroke={NAVY}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 14 14 L 26 26"
          stroke="#5C3A21"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (kind === "box") {
    return (
      <g transform="translate(50 188)">
        <rect width="100" height="50" rx="4" fill={ACCENT} />
        <rect y="0" width="100" height="10" fill={ACCENT_DARK} />
        <path d="M 0 10 L 100 10" stroke="#C76C12" strokeWidth="1" />
        <rect x="44" y="0" width="12" height="50" fill="#FFD9B0" opacity="0.6" />
        {/* Etiket */}
        <rect x="65" y="20" width="22" height="12" rx="1" fill={WHITE} stroke={NAVY} strokeWidth="0.5" />
        <text
          x="76"
          y="29"
          textAnchor="middle"
          fontSize="6"
          fontFamily="Nunito"
          fontWeight="700"
          fill={NAVY}
        >
          PİM
        </text>
      </g>
    );
  }

  if (kind === "spark") {
    return (
      <g fill={ACCENT}>
        <path d="M 24 50 L 28 58 L 36 60 L 28 62 L 24 70 L 20 62 L 12 60 L 20 58 Z" />
        <path d="M 176 60 L 179 66 L 185 68 L 179 70 L 176 76 L 173 70 L 167 68 L 173 66 Z" />
        <path d="M 100 22 L 102 28 L 108 30 L 102 32 L 100 38 L 98 32 L 92 30 L 98 28 Z" opacity="0.7" />
      </g>
    );
  }

  return null;
}

// ============================================================
// PimMini — sohbet ve küçük avatar yerleri için yuvarlak mask
// ============================================================

interface PimMiniProps {
  pose?: PimPose;
  size?: number;
  className?: string;
}

export function PimMini({
  pose = "wave",
  size = 36,
  className = "",
}: PimMiniProps) {
  return (
    <div
      role="img"
      aria-label={`Pim mini: ${pose}`}
      className={`grid place-items-center overflow-hidden ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: CORAL,
        boxShadow:
          "0 1px 3px rgba(31,41,55,0.2), inset 0 -2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ transform: "translateY(8px) scale(1.7)" }}>
        <Pim pose={pose} size={size * 1.6} bob={false} />
      </div>
    </div>
  );
}

/* Pim — the Etiket Professor mascot.
   Friendly little label-roll character: round head with round glasses, krem apron,
   simple body. Multiple poses via prop.
*/

const Pim = ({ pose = "wave", size = 200, bob = true }) => {
  // base palette
  const skin = "#FFCDB9";       // warm tone
  const skinSh = "#F2A98E";
  const apron = "#F5EBD9";      // krem önlük
  const apronSh = "#E8DCC4";
  const coral = "#FF6B5B";
  const navy = "#1F2937";
  const accent = "#FF9933";

  // poses define expressions + accessories
  const poses = {
    wave: { mouth: "smile", brows: "happy", arms: "wave", extra: null },
    think: { mouth: "small", brows: "think", arms: "chin", extra: null },
    wait: { mouth: "small", brows: "neutral", arms: "down", extra: null },
    inspect: { mouth: "small", brows: "focus", arms: "magnify", extra: "magnify" },
    happy: { mouth: "wide", brows: "happy", arms: "thumb", extra: null },
    sad: { mouth: "frown", brows: "worry", arms: "down", extra: null },
    excited: { mouth: "wide", brows: "happy", arms: "up", extra: "spark" },
    box: { mouth: "smile", brows: "happy", arms: "down", extra: "box" },
    chat: { mouth: "talk", brows: "neutral", arms: "down", extra: null },
  };
  const p = poses[pose] || poses.wave;

  const wrap = bob ? "pim-bob" : "";

  // mouth shape
  const mouth = (() => {
    switch (p.mouth) {
      case "smile":
        return <path d="M88 122 Q100 132 112 122" stroke={navy} strokeWidth="3.5" strokeLinecap="round" fill="none"/>;
      case "wide":
        return <path d="M86 120 Q100 137 114 120 Q100 128 86 120 Z" fill={navy}/>;
      case "small":
        return <path d="M94 124 Q100 128 106 124" stroke={navy} strokeWidth="3" strokeLinecap="round" fill="none"/>;
      case "frown":
        return <path d="M90 128 Q100 120 110 128" stroke={navy} strokeWidth="3.5" strokeLinecap="round" fill="none"/>;
      case "talk":
        return <ellipse cx="100" cy="125" rx="6" ry="4" fill={navy}/>;
      default:
        return null;
    }
  })();

  const brows = (() => {
    switch (p.brows) {
      case "happy":
        return (<>
          <path d="M70 80 Q78 75 86 80" stroke={navy} strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M114 80 Q122 75 130 80" stroke={navy} strokeWidth="3" strokeLinecap="round" fill="none"/>
        </>);
      case "think":
        return (<>
          <path d="M70 78 L86 82" stroke={navy} strokeWidth="3" strokeLinecap="round"/>
          <path d="M114 82 L130 76" stroke={navy} strokeWidth="3" strokeLinecap="round"/>
        </>);
      case "focus":
        return (<>
          <path d="M70 80 L86 80" stroke={navy} strokeWidth="3" strokeLinecap="round"/>
          <path d="M114 80 L130 80" stroke={navy} strokeWidth="3" strokeLinecap="round"/>
        </>);
      case "worry":
        return (<>
          <path d="M70 82 Q78 76 86 80" stroke={navy} strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M114 80 Q122 76 130 82" stroke={navy} strokeWidth="3" strokeLinecap="round" fill="none"/>
        </>);
      default:
        return (<>
          <rect x="70" y="78" width="16" height="3" rx="1.5" fill={navy}/>
          <rect x="114" y="78" width="16" height="3" rx="1.5" fill={navy}/>
        </>);
    }
  })();

  // eyes
  const eyes = (
    <g>
      <circle cx="78" cy="98" r="3.2" fill={navy}/>
      <circle cx="122" cy="98" r="3.2" fill={navy}/>
    </g>
  );

  // glasses
  const glasses = (
    <g fill="none" stroke={navy} strokeWidth="2.4">
      <circle cx="78" cy="98" r="14"/>
      <circle cx="122" cy="98" r="14"/>
      <path d="M92 98 L108 98" strokeLinecap="round"/>
      <path d="M64 96 L60 92" strokeLinecap="round"/>
      <path d="M136 96 L140 92" strokeLinecap="round"/>
    </g>
  );

  // arms
  const arms = (() => {
    switch (p.arms) {
      case "wave":
        return (
          <g>
            {/* right arm down */}
            <path d="M62 175 Q52 195 56 215" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            {/* left arm waving */}
            <g className="pim-wave-hand" style={{transformOrigin: "138px 175px"}}>
              <path d="M138 175 Q160 160 168 138" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
              <circle cx="170" cy="134" r="11" fill={skin}/>
            </g>
            <circle cx="56" cy="215" r="10" fill={skin}/>
          </g>
        );
      case "thumb":
        return (
          <g>
            <path d="M62 175 Q56 195 70 200" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <path d="M138 175 Q150 160 152 142" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            {/* thumbs up hand */}
            <g transform="translate(150 138)">
              <circle r="11" fill={skin}/>
              <rect x="-3" y="-14" width="6" height="9" rx="3" fill={skin}/>
            </g>
            <circle cx="70" cy="200" r="10" fill={skin}/>
          </g>
        );
      case "up":
        return (
          <g>
            <path d="M62 175 Q40 150 48 130" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <path d="M138 175 Q160 150 152 130" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <circle cx="48" cy="128" r="10" fill={skin}/>
            <circle cx="152" cy="128" r="10" fill={skin}/>
          </g>
        );
      case "chin":
        return (
          <g>
            <path d="M62 175 Q56 195 70 200" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <path d="M138 175 Q120 160 110 132" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <circle cx="70" cy="200" r="10" fill={skin}/>
            <circle cx="108" cy="128" r="9" fill={skin}/>
          </g>
        );
      case "magnify":
        return (
          <g>
            <path d="M62 175 Q56 195 70 200" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <path d="M138 175 Q146 158 138 138" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <circle cx="70" cy="200" r="10" fill={skin}/>
            {/* hand holding magnifier */}
            <circle cx="138" cy="138" r="10" fill={skin}/>
          </g>
        );
      default: // down
        return (
          <g>
            <path d="M62 175 Q52 200 60 220" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <path d="M138 175 Q148 200 140 220" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none"/>
            <circle cx="60" cy="220" r="10" fill={skin}/>
            <circle cx="140" cy="220" r="10" fill={skin}/>
          </g>
        );
    }
  })();

  // extras (held items)
  const extra = (() => {
    if (p.extra === "magnify") {
      return (
        <g transform="translate(124 110)">
          <circle r="22" fill="rgba(255,255,255,0.4)" stroke={navy} strokeWidth="3"/>
          <circle r="22" fill="none" stroke={navy} strokeWidth="3"/>
          <path d="M16 16 L30 30" stroke={navy} strokeWidth="5" strokeLinecap="round"/>
        </g>
      );
    }
    if (p.extra === "box") {
      return (
        <g transform="translate(45 195)">
          <rect width="110" height="70" rx="6" fill={accent}/>
          <rect y="0" width="110" height="14" fill="#E68422"/>
          <path d="M0 14 L110 14" stroke="#C76C12" strokeWidth="1.5"/>
          <rect x="48" y="0" width="14" height="70" fill="#FFD9B0" opacity="0.6"/>
        </g>
      );
    }
    if (p.extra === "spark") {
      return (
        <g fill={accent}>
          <path d="M30 50 L34 58 L42 60 L34 62 L30 70 L26 62 L18 60 L26 58 Z"/>
          <path d="M170 60 L173 66 L179 68 L173 70 L170 76 L167 70 L161 68 L167 66 Z"/>
        </g>
      );
    }
    return null;
  })();

  // Body shape: head + apron-y body
  return (
    <div style={{display: "inline-block", lineHeight: 0}} className={wrap}>
      <svg width={size} height={size} viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`pim-cheek-${pose}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={coral} stopOpacity="0.55"/>
            <stop offset="100%" stopColor={coral} stopOpacity="0"/>
          </radialGradient>
        </defs>
        {/* shadow */}
        <ellipse cx="100" cy="232" rx="56" ry="6" fill="rgba(31,41,55,0.12)"/>

        {/* body / apron */}
        <g>
          {/* shoulders/arms baseline behind body */}
          {/* body */}
          <path d="M55 190 Q55 160 78 152 L122 152 Q145 160 145 190 L145 222 Q100 232 55 222 Z" fill={apron}/>
          {/* apron straps */}
          <path d="M82 152 L92 130 M118 152 L108 130" stroke={apronSh} strokeWidth="3" strokeLinecap="round"/>
          {/* apron pocket */}
          <rect x="80" y="180" width="40" height="22" rx="4" fill={apronSh}/>
          {/* apron tag (label!) */}
          <rect x="62" y="170" width="22" height="14" rx="3" fill={coral}/>
          <circle cx="73" cy="177" r="2" fill="white"/>
        </g>

        {/* arms */}
        {arms}

        {/* neck */}
        <rect x="92" y="138" width="16" height="14" fill={skinSh} opacity="0.5"/>

        {/* head */}
        <g>
          <circle cx="100" cy="98" r="50" fill={skin}/>
          {/* hair tuft */}
          <path d="M60 78 Q70 50 100 48 Q130 50 140 78 Q132 64 100 62 Q68 64 60 78 Z" fill={navy}/>
          {/* cheeks */}
          <circle cx="68" cy="115" r="9" fill={`url(#pim-cheek-${pose})`}/>
          <circle cx="132" cy="115" r="9" fill={`url(#pim-cheek-${pose})`}/>
          {/* ears */}
          <ellipse cx="50" cy="100" rx="5" ry="9" fill={skinSh}/>
          <ellipse cx="150" cy="100" rx="5" ry="9" fill={skinSh}/>

          {brows}
          {eyes}
          {glasses}
          {mouth}
        </g>

        {extra}
      </svg>
    </div>
  );
};

// Tiny avatar (just face) for chat / small spots
const PimMini = ({ size = 36, pose = "wave" }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    background: "#FFCDB9",
    display: "grid", placeItems: "center",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(31,41,55,0.2), inset 0 -2px 0 rgba(0,0,0,0.05)",
  }}>
    <div style={{transform: "translateY(4px) scale(1.6)"}}>
      <Pim pose={pose} size={size * 1.5} bob={false}/>
    </div>
  </div>
);

window.Pim = Pim;
window.PimMini = PimMini;

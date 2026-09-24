export type BoardMaterial = "bamboo" | "slate" | "go19" | "go9" | "rice";

const slateEdge =
  "M90 104 L107 79 C178 72 220 84 284 76 L310 80 C388 68 445 78 511 73 C579 68 633 82 693 75 L714 78 C792 67 849 82 919 74 L945 99 C938 171 949 213 941 279 L944 304 C934 375 947 422 940 490 C933 558 948 603 940 672 L945 704 C936 778 949 831 940 902 L918 928 C849 921 791 936 728 928 L699 932 C629 923 580 938 511 929 C443 921 394 936 326 928 L294 934 C224 925 168 939 96 928 L70 911 C77 841 63 787 73 720 L69 692 C79 622 63 568 72 500 C81 430 64 382 73 313 L66 286 C77 216 64 168 73 117 Z";
const slateTopTransform = "translate(16 16) scale(0.968)";
const slateShadowTransform = "translate(0 8)";

function GoGrid({ compact = false }: { compact?: boolean }) {
  const count = compact ? 9 : 19;
  const positions = Array.from({ length: count }, (_, index) =>
    Number((62 + (876 * index) / (count - 1)).toFixed(2)),
  );
  const stars = compact
    ? [
        [2, 2],
        [2, 6],
        [4, 4],
        [6, 2],
        [6, 6],
      ]
    : [2, 8, 14].flatMap((row) => [2, 8, 14].map((column) => [row, column]));

  return (
    <g>
      <g
        fill="none"
        stroke="#563d2c"
        strokeOpacity={compact ? 0.74 : 0.66}
        strokeWidth={compact ? 2 : 1.55}
      >
        {positions.map((position, index) => (
          <g key={index}>
            <path d={`M${position} 62 V938`} />
            <path d={`M62 ${position} H938`} />
          </g>
        ))}
      </g>
      <g fill="#4c3527">
        {stars.map(([row, column]) => (
          <circle
            key={`${row}-${column}`}
            cx={positions[column]}
            cy={positions[row]}
            r={compact ? 5 : 4.4}
          />
        ))}
      </g>
    </g>
  );
}

export default function PlaygroundBoard({
  material,
}: {
  material: BoardMaterial;
}) {
  return (
    <svg
      className="playground-board-art"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="bamboo-base" x1="0" y1="0" x2="0.92" y2="1">
          <stop stopColor="#c69a61" />
          <stop offset="0.52" stopColor="#b78a52" />
          <stop offset="1" stopColor="#a87844" />
        </linearGradient>
        <linearGradient id="bamboo-rod" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#dec28d" />
          <stop offset="0.24" stopColor="#c9a46a" />
          <stop offset="0.76" stopColor="#be9459" />
          <stop offset="1" stopColor="#d5b77f" />
        </linearGradient>
        <pattern
          id="bamboo-planks"
          width="1000"
          height="164"
          patternUnits="userSpaceOnUse"
        >
          <rect width="1000" height="32" y="2" rx="13" fill="url(#bamboo-rod)" />
          <rect width="1000" height="32" y="35" rx="13" fill="url(#bamboo-rod)" />
          <rect width="1000" height="32" y="68" rx="13" fill="url(#bamboo-rod)" />
          <rect width="1000" height="32" y="101" rx="13" fill="url(#bamboo-rod)" />
          <rect width="1000" height="32" y="134" rx="13" fill="url(#bamboo-rod)" />
          <g fill="none" stroke="#775834" strokeOpacity="0.29" strokeWidth="2">
            <path d="M208 3v30m5-30v30m371 2v30m5-30v30m-314 2v30m5-30v30m358 2v30m5-30v30m-451 2v30m5-30v30" />
          </g>
          <g fill="none" stroke="#f2d8a8" strokeOpacity="0.36" strokeWidth="2">
            <path d="M211 4v27m371 3v27m-314 3v27m358 3v27m-451 3v27" />
          </g>
          <g fill="none" stroke="#795a38" strokeOpacity="0.17" strokeWidth="1">
            <path d="M34 12c128 5 263-5 382 0s271-4 546 1M82 57c190-5 305 7 481 1s258-3 392 1M26 91c174 3 282-5 438-1s315 8 510 0M114 147c144-4 300 5 425-1s312-1 410 2" />
          </g>
        </pattern>
        <linearGradient id="go-wood" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e4c17f" />
          <stop offset="0.48" stopColor="#d5ae6c" />
          <stop offset="1" stopColor="#c89b59" />
        </linearGradient>
        <pattern
          id="go-grain"
          width="180"
          height="125"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 20c48-9 92 8 180-3M0 78c52 6 106-10 180-1M24 110c39-5 80 4 133-3"
            fill="none"
            stroke="#966c3f"
            strokeOpacity="0.13"
            strokeWidth="2"
          />
          <path
            d="M35 43c28-3 57 4 82 0M107 98c24 1 39-4 61-1"
            fill="none"
            stroke="#f5dda9"
            strokeOpacity="0.2"
            strokeWidth="2"
          />
        </pattern>
        <linearGradient id="slate-face" x1="0" y1="0" x2="0.9" y2="1">
          <stop stopColor="#858a87" />
          <stop offset="0.5" stopColor="#727976" />
          <stop offset="1" stopColor="#626966" />
        </linearGradient>
        <pattern
          id="slate-grain"
          width="370"
          height="330"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M9 28c27-8 48-2 73-7M126 35l52-6M245 19c33 4 62-6 98-1M44 98l42-3m17 1 29 2M198 115c28-5 50-2 69-6M292 152l44-4M28 224c39 2 60-6 91-4M166 264l56-8M276 300c30-2 51 1 72-3"
            fill="none"
            stroke="#d8d9d4"
            strokeOpacity="0.1"
            strokeWidth="2.5"
          />
          <path d="M52 122l42-5m105 53 30-4M203 17l47-3M82 287l35-4m172-116 28-3" fill="none" stroke="#3f4948" strokeOpacity="0.1" strokeWidth="2" />
          <circle cx="87" cy="65" r="2" fill="#e2e1d9" fillOpacity="0.13" />
          <circle cx="247" cy="119" r="1.5" fill="#e2e1d9" fillOpacity="0.14" />
          <circle cx="321" cy="244" r="1.5" fill="#434b49" fillOpacity="0.12" />
        </pattern>
        <clipPath id="slate-clip">
          <path d={slateEdge} transform={slateTopTransform} />
        </clipPath>
        <filter id="slate-shadow" x="-12%" y="-12%" width="124%" height="136%">
          <feGaussianBlur stdDeviation="15" />
        </filter>
        <linearGradient id="rice-paper" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f4ebd5" />
          <stop offset="0.56" stopColor="#eee2c7" />
          <stop offset="1" stopColor="#e4d4b4" />
        </linearGradient>
        <pattern
          id="rice-fibres"
          width="164"
          height="178"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="#997e5d" strokeOpacity="0.12" strokeWidth="1">
            <path d="M7 22l57-3m21 33 66-4M18 109l46 2m41 46 53-3M111 13l27 1M1 72l32-2" />
            <path d="M36 8v10m72 24v8m-65 38v8m98 26v10m-48-5v8" />
          </g>
          <g fill="#8f7757" fillOpacity="0.1">
            <circle cx="75" cy="27" r="1.4" />
            <circle cx="145" cy="91" r="1" />
            <circle cx="54" cy="147" r="1.3" />
          </g>
        </pattern>
        <linearGradient id="scroll-roller" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#78543d" />
          <stop offset="0.32" stopColor="#b07c50" />
          <stop offset="0.72" stopColor="#81583f" />
          <stop offset="1" stopColor="#553b32" />
        </linearGradient>
        <filter id="paper-shadow" x="-8%" y="-8%" width="116%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {material === "bamboo" && (
        <g>
          <rect width="1000" height="1000" fill="url(#bamboo-base)" />
          <rect width="1000" height="1000" fill="url(#bamboo-planks)" />
          <path d="M16 0v1000M984 0v1000" stroke="#714d31" strokeOpacity="0.27" strokeWidth="5" />
          <path d="M22 0v1000M978 0v1000" stroke="#f2d7a7" strokeOpacity="0.35" strokeWidth="2" />
        </g>
      )}

      {material === "slate" && (
        <g>
          <rect width="1000" height="1000" fill="#d8d1c4" />
          <rect width="1000" height="1000" fill="#eeeae0" fillOpacity="0.28" />
          <path d={slateEdge} transform={slateShadowTransform} fill="#263238" opacity="0.38" filter="url(#slate-shadow)" />
          <path d={slateEdge} fill="#48504e" stroke="#38413f" strokeWidth="3" strokeLinejoin="round" />
          <path d={slateEdge} transform={slateTopTransform} fill="url(#slate-face)" stroke="#aab0aa" strokeOpacity="0.24" strokeWidth="2" strokeLinejoin="round" />
          <g clipPath="url(#slate-clip)">
            <rect width="1000" height="1000" fill="url(#slate-grain)" />
            <path d="M75 397c111-19 184 8 272-5m46-2c124-21 245 7 391-9M76 554c121 9 196-14 314-3m66 5c138 12 252-16 455-2M132 708c82-14 141 8 214-7m185-10c106 8 188-8 305 3" fill="none" stroke="#e0e1da" strokeOpacity="0.11" strokeWidth="3" />
            <path d="M118 465c74 4 126-9 192-6m401-28c48-2 90 2 143 5M189 668c52-4 91-2 139 3m366-15c52-3 93 1 142 3" fill="none" stroke="#424a48" strokeOpacity="0.1" strokeWidth="2" />
          </g>
        </g>
      )}

      {(material === "go19" || material === "go9") && (
        <g>
          <rect width="1000" height="1000" fill="url(#go-wood)" />
          <rect width="1000" height="1000" fill="url(#go-grain)" />
          <rect x="17" y="17" width="966" height="966" fill="none" stroke="#775333" strokeOpacity="0.65" strokeWidth="8" />
          <rect x="29" y="29" width="942" height="942" fill="none" stroke="#efd39b" strokeOpacity="0.48" strokeWidth="2" />
          <GoGrid compact={material === "go9"} />
          {material === "go9" && (
            <rect x="56" y="56" width="888" height="888" fill="none" stroke="#684a31" strokeOpacity="0.28" strokeWidth="2" />
          )}
        </g>
      )}

      {material === "rice" && (
        <g>
          <rect width="1000" height="1000" fill="#ad9274" />
          <rect x="20" y="20" width="960" height="960" rx="5" fill="#4f392f" opacity="0.28" filter="url(#paper-shadow)" />
          <rect x="18" y="18" width="964" height="964" rx="5" fill="#684a37" />
          <rect x="26" y="42" width="948" height="916" fill="url(#rice-paper)" />
          <rect x="26" y="42" width="948" height="916" fill="url(#rice-fibres)" />
          <rect x="17" y="18" width="966" height="36" rx="18" fill="url(#scroll-roller)" />
          <path d="M31 27h938M31 47h938" stroke="#d4af79" strokeOpacity="0.42" strokeWidth="2" />
          <circle cx="30" cy="36" r="18" fill="#4a342d" />
          <circle cx="970" cy="36" r="18" fill="#4a342d" />
          <rect x="17" y="946" width="966" height="36" rx="18" fill="url(#scroll-roller)" />
          <path d="M31 955h938M31 975h938" stroke="#d4af79" strokeOpacity="0.38" strokeWidth="2" />
          <circle cx="30" cy="964" r="18" fill="#4a342d" />
          <circle cx="970" cy="964" r="18" fill="#4a342d" />
          <g transform="translate(912 886)" fill="none" stroke="#a84439" strokeOpacity="0.2" strokeWidth="9">
            <circle r="28" />
            <path d="M-12-12h24v24h-24zM-4-12v24M4-12v24" />
          </g>
        </g>
      )}
    </svg>
  );
}

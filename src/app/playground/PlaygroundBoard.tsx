export type BoardMaterial = "bamboo" | "slate" | "go19" | "go9" | "rice";

const slateEdge =
  "M74 55 L150 62 L224 49 L305 59 L385 45 L468 54 L553 43 L631 57 L716 48 L798 61 L875 50 L943 67 L935 145 L950 218 L939 299 L952 383 L941 465 L955 548 L941 635 L952 715 L938 798 L948 880 L925 946 L849 938 L773 953 L694 941 L615 954 L533 942 L451 954 L368 940 L286 950 L203 936 L125 947 L55 923 L62 847 L46 769 L58 689 L43 609 L56 526 L44 444 L58 361 L45 278 L61 197 L50 119 Z";

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
          <stop stopColor="#747e81" />
          <stop offset="0.52" stopColor="#606b70" />
          <stop offset="1" stopColor="#515d63" />
        </linearGradient>
        <pattern
          id="slate-grain"
          width="126"
          height="98"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M9 21l38-9m31 53 34-8M21 84l19-4m44-54 24-5"
            fill="none"
            stroke="#d2d4ce"
            strokeOpacity="0.13"
            strokeWidth="2"
          />
          <circle cx="69" cy="28" r="1.8" fill="#e2e1d9" fillOpacity="0.18" />
          <circle cx="13" cy="58" r="1.2" fill="#e2e1d9" fillOpacity="0.2" />
        </pattern>
        <clipPath id="slate-clip">
          <path d={slateEdge} />
        </clipPath>
        <filter id="slate-shadow" x="-12%" y="-12%" width="124%" height="130%">
          <feGaussianBlur stdDeviation="13" />
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
          <path d={slateEdge} transform="translate(0 17)" fill="#26333a" opacity="0.3" filter="url(#slate-shadow)" />
          <path d={slateEdge} fill="#38454b" />
          <g clipPath="url(#slate-clip)">
            <rect width="1000" height="1000" fill="url(#slate-face)" />
            <rect width="1000" height="1000" fill="url(#slate-grain)" />
            <path d="M76 180c190-52 346 33 501-6s267-16 369 7M46 783c222-28 389 14 602-13s280-20 344 2" fill="none" stroke="#d8dbd5" strokeOpacity="0.12" strokeWidth="3" />
          </g>
          <path d={slateEdge} fill="none" stroke="#343f45" strokeWidth="9" strokeOpacity="0.62" />
          <path d="M80 73 L153 78 L224 66 L305 76 L385 62 L468 71 L553 60 L631 74 L716 65 L798 78 L875 67 L923 82 L918 148 L933 218 L922 299 L935 383 L924 465 L938 548 L924 635 L935 715 L921 798 L931 880 L909 921 L849 916 L773 931 L694 919 L615 932 L533 920 L451 932 L368 918 L286 928 L203 914 L125 925 L79 906 L85 847 L69 769 L81 689 L66 609 L79 526 L67 444 L81 361 L68 278 L84 197 Z" fill="none" stroke="#c3c8c5" strokeOpacity="0.48" strokeWidth="2.5" />
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

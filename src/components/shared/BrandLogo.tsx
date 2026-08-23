interface BrandLogoProps {
  size?: number
  className?: string
}

/**
 * Escudo institucional (inspirado en el logo oficial): escudo negro con la "A" y el
 * edificio, libro y laureles dorado-oliva, llama superior y cinta vino "EXCELENCIA".
 */
export function BrandLogo({ size = 96, className }: BrandLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} role="img" aria-label="Escudo Arca de Cristo">
      <defs>
        <linearGradient id="oliveGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C4C85A" />
          <stop offset="50%" stopColor="#9A9C2E" />
          <stop offset="100%" stopColor="#5F621A" />
        </linearGradient>
        <linearGradient id="shieldBlack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B2B2B" />
          <stop offset="100%" stopColor="#0D0D0D" />
        </linearGradient>
        <linearGradient id="wineRibbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9A2730" />
          <stop offset="100%" stopColor="#7D1D24" />
        </linearGradient>
      </defs>

      {/* Fondo circular blanco para contraste sobre fondos oscuros */}
      <circle cx="100" cy="100" r="96" fill="#FFFFFF" />

      {/* Laureles dorado-oliva */}
      <g fill="url(#oliveGold)">
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = -105 + i * 15
          const rad = (angle * Math.PI) / 180
          const cx = 100 + 70 * Math.cos(rad)
          const cy = 118 + 70 * Math.sin(rad) * 0.95
          return <ellipse key={`l-${i}`} cx={cx} cy={cy} rx="8" ry="3.6" transform={`rotate(${angle + 90} ${cx} ${cy})`} />
        })}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = -75 - i * 15
          const rad = (angle * Math.PI) / 180
          const cx = 100 - 70 * Math.cos(rad)
          const cy = 118 + 70 * Math.sin(rad) * 0.95
          return <ellipse key={`r-${i}`} cx={cx} cy={cy} rx="8" ry="3.6" transform={`rotate(${-(angle + 90)} ${cx} ${cy})`} />
        })}
      </g>

      {/* Libro abierto con llama */}
      <path d="M70 44 Q100 34 130 44 L130 56 Q100 46 70 56 Z" fill="url(#oliveGold)" />
      <path d="M100 36 L100 46" stroke="#5F621A" strokeWidth="1.5" />
      <path d="M100 18 C94 26 96 31 100 34 C104 31 106 26 100 18 Z" fill="#E30613" />
      <path d="M100 23 C97 27 98 30 100 32 C102 30 103 27 100 23 Z" fill="#F6B26B" />

      {/* Escudo negro */}
      <path d="M58 58 L142 58 L142 118 Q142 150 100 164 Q58 150 58 118 Z" fill="url(#shieldBlack)" stroke="#9A9C2E" strokeWidth="2.5" />

      {/* Letra A */}
      <text x="100" y="106" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="58" fontWeight="700" fill="#FFFFFF">
        A
      </text>

      {/* Edificio (arca) */}
      <rect x="84" y="112" width="32" height="30" fill="#FFFFFF" />
      <rect x="80" y="108" width="40" height="5" fill="#C4C85A" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <rect key={`w-${r}-${c}`} x={88 + c * 9} y={116 + r * 8} width="5" height="5" fill="#0D0D0D" />),
      )}

      {/* Cinta EXCELENCIA */}
      <path d="M40 150 Q100 172 160 150 L166 170 Q100 194 34 170 Z" fill="url(#wineRibbon)" />
      <text x="100" y="168" textAnchor="middle" fontFamily="'Inter', sans-serif" fontSize="12" fontWeight="800" letterSpacing="1.5" fill="#FFFFFF">
        EXCELENCIA
      </text>
    </svg>
  )
}

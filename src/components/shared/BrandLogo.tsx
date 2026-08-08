interface BrandLogoProps {
  size?: number
  className?: string
}

/**
 * Escudo institucional (inspirado en el logo oficial): anillo dorado, laureles,
 * emblema central con libro y letra "A", cinta roja "EXCELENCIA".
 */
export function BrandLogo({ size = 96, className }: BrandLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} role="img" aria-label="Escudo Arca de Cristo">
      <defs>
        <linearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3D07A" />
          <stop offset="45%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#8A6D1B" />
        </linearGradient>
        <linearGradient id="navyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#123A6B" />
          <stop offset="100%" stopColor="#081F3E" />
        </linearGradient>
      </defs>

      {/* Anillo exterior dorado */}
      <circle cx="100" cy="100" r="94" fill="url(#goldRing)" />
      <circle cx="100" cy="100" r="82" fill="url(#navyFill)" stroke="#F3D07A" strokeWidth="2" />

      {/* Laureles */}
      <g fill="#E7C468" opacity="0.95">
        {Array.from({ length: 7 }).map((_, i) => {
          const angle = -100 + i * 16
          const rad = (angle * Math.PI) / 180
          const cx = 100 + 62 * Math.cos(rad)
          const cy = 130 + 62 * Math.sin(rad) * 0.9
          return <ellipse key={`l-${i}`} cx={cx} cy={cy} rx="7" ry="3.2" transform={`rotate(${angle + 90} ${cx} ${cy})`} />
        })}
        {Array.from({ length: 7 }).map((_, i) => {
          const angle = -80 - i * 16
          const rad = (angle * Math.PI) / 180
          const cx = 100 - 62 * Math.cos(rad)
          const cy = 130 + 62 * Math.sin(rad) * 0.9
          return <ellipse key={`r-${i}`} cx={cx} cy={cy} rx="7" ry="3.2" transform={`rotate(${-(angle + 90)} ${cx} ${cy})`} />
        })}
      </g>

      {/* Libro */}
      <path d="M62 96 Q100 84 138 96 L138 112 Q100 100 62 112 Z" fill="#F3D07A" />
      <path d="M100 84 L100 100" stroke="#123A6B" strokeWidth="2" />

      {/* Letra A */}
      <text x="100" y="88" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="46" fontWeight="700" fill="#F7E7B4">
        A
      </text>

      {/* Cinta EXCELENCIA */}
      <path d="M46 148 Q100 168 154 148 L160 168 Q100 190 40 168 Z" fill="#CE1126" stroke="#8A0E1C" strokeWidth="1" />
      <text x="100" y="163" textAnchor="middle" fontFamily="'Inter', sans-serif" fontSize="12" fontWeight="800" letterSpacing="1.5" fill="#fff">
        EXCELENCIA
      </text>
    </svg>
  )
}

import { createLightTheme, createDarkTheme, type BrandVariants, type Theme } from '@fluentui/react-components'

/**
 * Rampa de marca basada en el azul institucional (bandera dominicana).
 * En tema claro: colorBrandBackground = brand[80], hover = brand[70], pressed = brand[40].
 */
const azulDominicano: BrandVariants = {
  10: '#02070E',
  20: '#040F1E',
  30: '#06172E',
  40: '#081F3E',
  50: '#0A274E',
  60: '#0C2F5E',
  70: '#0E376E',
  80: '#103F7E',
  90: '#1F538F',
  100: '#35679F',
  110: '#4E7BB0',
  120: '#6990C0',
  130: '#87A6D0',
  140: '#A8BEE0',
  150: '#CCD8EF',
  160: '#F4F7FC',
}

const FONT = "'Inter', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif"

export const lightTheme: Theme = createLightTheme(azulDominicano)
export const darkTheme: Theme = createDarkTheme(azulDominicano)

darkTheme.colorBrandForeground1 = azulDominicano[130]
darkTheme.colorBrandForeground2 = azulDominicano[140]

lightTheme.fontFamilyBase = FONT
lightTheme.fontFamilyMonospace = "'JetBrains Mono', 'Cascadia Code', Consolas, monospace"
darkTheme.fontFamilyBase = FONT
darkTheme.fontFamilyMonospace = lightTheme.fontFamilyMonospace

export const institutionalColors = {
  azul: '#103F7E',
  azulOscuro: '#081F3E',
  azulMedio: '#0A274E',
  rojo: '#CE1126',
  rojoClaro: '#E53440',
  blanco: '#FFFFFF',
  fondo: '#F3F5F8',
  superficie: '#FFFFFF',
  borde: '#E4E8EF',
  texto: '#1B2430',
  textoSuave: '#667085',
}

export const gradientes = {
  azul: 'linear-gradient(135deg, #0A274E 0%, #103F7E 55%, #1F538F 100%)',
  rojo: 'linear-gradient(135deg, #A50E1E 0%, #CE1126 60%, #E53440 100%)',
  verde: 'linear-gradient(135deg, #14532D 0%, #15803D 60%, #22C55E 100%)',
  celeste: 'linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)',
  violeta: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
  naranja: 'linear-gradient(135deg, #7C2D12 0%, #EA580C 100%)',
}

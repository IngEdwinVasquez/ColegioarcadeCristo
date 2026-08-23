import { createLightTheme, createDarkTheme, type BrandVariants, type Theme } from '@fluentui/react-components'

/**
 * Rampa de marca basada en el cian institucional (fachada del colegio).
 * En tema claro: colorBrandBackground = brand[80], hover = brand[70], pressed = brand[40].
 */
const cianInstitucional: BrandVariants = {
  10: '#001A24',
  20: '#00283A',
  30: '#003A52',
  40: '#004D6B',
  50: '#005F84',
  60: '#006E96',
  70: '#0079A6',
  80: '#0089B8',
  90: '#0095C8',
  100: '#3AB1DA',
  110: '#5DBFE1',
  120: '#7FCCE8',
  130: '#A0D9EE',
  140: '#BFE5F4',
  150: '#DDF1F9',
  160: '#F0F9FC',
}

const FONT = "'Inter', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif"

export const lightTheme: Theme = createLightTheme(cianInstitucional)
export const darkTheme: Theme = createDarkTheme(cianInstitucional)

darkTheme.colorBrandForeground1 = cianInstitucional[130]
darkTheme.colorBrandForeground2 = cianInstitucional[140]

lightTheme.fontFamilyBase = FONT
lightTheme.fontFamilyMonospace = "'JetBrains Mono', 'Cascadia Code', Consolas, monospace"
darkTheme.fontFamilyBase = FONT
darkTheme.fontFamilyMonospace = lightTheme.fontFamilyMonospace

/** Paleta institucional: cian y rojo de la fachada; negro, dorado oliva y vino del escudo. */
export const institutionalColors = {
  azul: '#0095C8',
  azulOscuro: '#0A1F2B',
  azulMedio: '#0B2E3F',
  rojo: '#E30613',
  rojoClaro: '#EF3E4A',
  vino: '#7D1D24',
  dorado: '#9A9C2E',
  negro: '#161616',
  blanco: '#FFFFFF',
  fondo: '#F3F5F8',
  superficie: '#FFFFFF',
  borde: '#E4E8EF',
  texto: '#1B2430',
  textoSuave: '#667085',
}

export const gradientes = {
  azul: 'linear-gradient(135deg, #0B2E3F 0%, #0095C8 55%, #1AA3D2 100%)',
  rojo: 'linear-gradient(135deg, #8E0C1F 0%, #E30613 60%, #EF3E4A 100%)',
  verde: 'linear-gradient(135deg, #14532D 0%, #15803D 60%, #22C55E 100%)',
  celeste: 'linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)',
  violeta: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)',
  naranja: 'linear-gradient(135deg, #7C2D12 0%, #EA580C 100%)',
}

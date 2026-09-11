/**
 * Preferencias de IA por usuario. Cada persona puede conectar su propia cuenta
 * de IA (o usar Microsoft 365 Copilot con su cuenta institucional) para que el
 * uso de la IA no consuma los tokens/cuota del centro.
 *
 * Las credenciales se guardan ÚNICAMENTE en este navegador (localStorage) y
 * nunca se envían al centro ni se comparten entre usuarios del dispositivo.
 */

export type UserAiProvider = 'copilot' | 'openai' | 'deepseek' | 'anthropic' | 'azure'

export interface UserAiSettings {
  provider: UserAiProvider
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface UserAiProviderInfo {
  value: UserAiProvider
  label: string
  hint: string
  defaultModel: string
  defaultBaseUrl?: string
  needsKey: boolean
}

export const USER_AI_PROVIDERS: UserAiProviderInfo[] = [
  {
    value: 'copilot',
    label: 'Microsoft 365 Copilot (cuenta del centro)',
    hint: 'Usa tu cuenta institucional de Microsoft 365. No requiere clave API.',
    defaultModel: '',
    needsKey: false,
  },
  {
    value: 'openai',
    label: 'OpenAI (mi cuenta)',
    hint: 'Conecta tu propia cuenta de OpenAI.',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    needsKey: true,
  },
  {
    value: 'deepseek',
    label: 'DeepSeek (mi cuenta)',
    hint: 'Conecta tu propia cuenta de DeepSeek.',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
    needsKey: true,
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude (mi cuenta)',
    hint: 'Conecta tu propia cuenta de Anthropic.',
    defaultModel: 'claude-3-5-sonnet-latest',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
  },
  {
    value: 'azure',
    label: 'Azure OpenAI (mi cuenta)',
    hint: 'Requiere la URL del recurso y la clave de tu cuenta de Azure OpenAI.',
    defaultModel: '',
    needsKey: true,
  },
]

export function userAiProviderInfo(provider: UserAiProvider): UserAiProviderInfo | undefined {
  return USER_AI_PROVIDERS.find((p) => p.value === provider)
}

let currentUid = 'anon'

/** Fija el usuario actual para guardar/leer sus preferencias de IA. */
export function setAiCurrentUser(uid?: string | null) {
  currentUid = uid?.trim() || 'anon'
}

const storageKey = (uid?: string) => `arca_ai_settings::${(uid ?? currentUid) || 'anon'}`

export function getUserAiSettings(uid?: string): UserAiSettings | null {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserAiSettings>
    if (!parsed || typeof parsed !== 'object' || !parsed.provider) return null
    return {
      provider: parsed.provider as UserAiProvider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    }
  } catch {
    return null
  }
}

export function saveUserAiSettings(settings: UserAiSettings, uid?: string) {
  localStorage.setItem(storageKey(uid), JSON.stringify(settings))
}

export function clearUserAiSettings(uid?: string) {
  localStorage.removeItem(storageKey(uid))
}

/** Indica si la configuración del usuario está lista para usarse. */
export function isUserAiReady(settings: UserAiSettings | null): boolean {
  if (!settings) return false
  if (settings.provider === 'copilot') return true
  if (settings.provider === 'azure') return !!settings.apiKey?.trim() && !!settings.baseUrl?.trim()
  return !!settings.apiKey?.trim()
}

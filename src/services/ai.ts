import { appConfig } from '../config/appConfig'
import { acquireToken } from './msal'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiChatOptions {
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export type AiProvider = 'openai' | 'deepseek' | 'anthropic' | 'azure' | 'proxy'

const DEFAULTS: Record<Exclude<AiProvider, 'proxy'>, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
  azure: { baseUrl: '', model: '' },
}

function resolvedConfig() {
  const provider = (appConfig.ai.provider || 'proxy') as AiProvider
  const base = DEFAULTS[provider as Exclude<AiProvider, 'proxy'>]
  const baseUrl = appConfig.ai.baseUrl || base?.baseUrl || ''
  const model = appConfig.ai.model || base?.model || ''
  return { provider, baseUrl, model, apiKey: appConfig.ai.apiKey }
}

class AiServiceError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AiServiceError'
    this.status = status
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiServiceError('No se pudo contactar el servicio de IA. Verifique la conectividad y la URL configurada.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AiServiceError(`El servicio de IA respondió con error (${res.status}): ${text.slice(0, 300)}`, res.status)
  }
  return res.json()
}

/** Extrae el texto de la respuesta según el proveedor. */
function extractContent(data: unknown): string {
  const d = data as Record<string, unknown>
  // Respuesta estilo OpenAI / DeepSeek / Azure
  const choices = d?.choices as Array<{ message?: { content?: string } }> | undefined
  if (choices?.[0]?.message?.content) return choices[0].message.content
  // Respuesta estilo Anthropic
  const content = d?.content as Array<{ type?: string; text?: string }> | undefined
  if (Array.isArray(content)) return content.map((c) => c.text ?? '').join('')
  // Respuesta de un proxy propio: { content } o { answer } o { text }
  if (typeof d?.content === 'string') return d.content
  if (typeof d?.answer === 'string') return d.answer
  if (typeof d?.text === 'string') return d.text
  if (typeof data === 'string') return data
  throw new AiServiceError('Respuesta de IA no reconocida. Revise la configuración del proveedor/proxy.')
}

/** Obtiene el token de Entra ID del usuario para autenticar la llamada al proxy. */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const token = await acquireToken()
    return { Authorization: `Bearer ${token}` }
  } catch {
    throw new AiServiceError('No se pudo autenticar con Microsoft 365. Vuelva a iniciar sesión.')
  }
}

/**
 * Chat de IA multi-proveedor. En modo `proxy` (recomendado) envía los mensajes a un
 * desencadenador HTTP (Power Automate / Azure Function) y espera `{ content }` o una
 * respuesta estilo OpenAI. En los demás modos llama directo al proveedor (solo
 * recomendado en desarrollo: la clave queda expuesta en el navegador).
 */
export async function aiChat(messages: AiMessage[], options: AiChatOptions = {}): Promise<string> {
  const { provider, baseUrl, model, apiKey } = resolvedConfig()

  if (provider === 'proxy') {
    if (!baseUrl) throw new AiServiceError('Falta VITE_AI_API_URL (URL del desencadenador HTTP del proxy de IA).')
    const data = await postJson(baseUrl, { messages, options }, await authHeaders())
    return extractContent(data)
  }

  if (!baseUrl) {
    throw new AiServiceError(`Falta la URL base para el proveedor «${provider}» (VITE_AI_API_URL).`)
  }

  if (provider === 'anthropic') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const rest = messages.filter((m) => m.role !== 'system')
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 2048,
      system: system || undefined,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }
    if (options.temperature != null) body.temperature = options.temperature
    const data = await postJson(`${baseUrl}/messages`, body, {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    })
    return extractContent(data)
  }

  // Proveedores compatibles con OpenAI (openai, deepseek, azure)
  const headers: Record<string, string> = {}
  if (apiKey) {
    if (provider === 'azure') headers['api-key'] = apiKey
    else headers.Authorization = `Bearer ${apiKey}`
  }
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.maxTokens ?? 2048,
  }
  if (options.jsonMode) body.response_format = { type: 'json_object' }
  const endpoint =
    provider === 'azure'
      ? `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=2024-06-01`
      : `${baseUrl}/chat/completions`
  const data = await postJson(endpoint, body, headers)
  return extractContent(data)
}

/** Convierte la respuesta JSON de la IA a un objeto, tolerando fallos. */
export function parseAiJson<T>(text: string): T | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(clean) as T
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1)) as T
      } catch {
        /* cae al retorno nulo */
      }
    }
  }
  return null
}

export function isAiConfigured(): boolean {
  const { provider, baseUrl } = resolvedConfig()
  if (provider === 'proxy') return !!baseUrl
  return !!baseUrl
}

export { AiServiceError }

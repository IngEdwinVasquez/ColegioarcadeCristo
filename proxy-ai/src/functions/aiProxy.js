import { app } from '@azure/functions'

const DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
  azure: { baseUrl: '', model: '' },
}

const json = (status, body) => ({ status, jsonBody: body })

// ------------------------------------------------------------------ Límite de peticiones (por IP, en memoria)
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 30
const buckets = new Map()

function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-azure-clientip') || 'desconocida'
}

function allowRate(ip) {
  const now = Date.now()
  const b = buckets.get(ip)
  if (buckets.size > 2000) buckets.clear()
  if (!b || now - b.start > RATE_WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 })
    return true
  }
  b.count += 1
  return b.count <= RATE_MAX
}

// ------------------------------------------------------------------ Validación del token de Entra ID
// Delega la verificación de firma a Microsoft Graph: solo un token válido de un
// usuario del tenant devuelve 200 en /me. Devuelve el correo del usuario o null.
async function validateAndGetEmail(token) {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    const raw = typeof data?.mail === 'string' ? data.mail : data?.userPrincipalName
    return typeof raw === 'string' ? raw.toLowerCase() : null
  } catch {
    return null
  }
}

app.http('aiProxy', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai',
  handler: async (request) => {
    const ip = clientIp(request)
    if (!allowRate(ip)) return json(429, { error: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' })

    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!token) return json(401, { error: 'Autenticación requerida (inicio de sesión de Microsoft 365).' })
    const email = await validateAndGetEmail(token)
    if (!email) return json(401, { error: 'Token inválido o sesión expirada. Vuelva a iniciar sesión.' })

    const body = await request.json().catch(() => null)
    const messages = body?.messages
    const options = body?.options ?? {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return json(400, { error: 'Se requiere el campo "messages" (array de {role, content}).' })
    }
    if (messages.length > 20) return json(400, { error: 'Demasiados mensajes en la solicitud.' })

    const provider = String(process.env.AI_PROVIDER || 'openai').toLowerCase()
    const def = DEFAULTS[provider] ?? DEFAULTS.openai
    const baseUrl = String(process.env.AI_BASE_URL || def.baseUrl || '').replace(/\/$/, '')
    const model = process.env.AI_MODEL || def.model
    const apiKey = process.env.AI_API_KEY || ''
    if (!apiKey) return json(500, { error: 'Falta AI_API_KEY en la configuración de la función.' })

    const maxTokens = Math.min(Math.max(Number(options.maxTokens) || 2048, 1), 4096)
    const temperature = options.temperature == null ? 0.6 : Number(options.temperature)

    let content = ''

    if (provider === 'anthropic') {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
      const rest = messages.filter((m) => m.role !== 'system')
      const payload = {
        model,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }
      if (temperature != null) payload.temperature = temperature
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return json(res.status, { error: `Proveedor: ${(await res.text()).slice(0, 300)}` })
      const data = await res.json()
      content = Array.isArray(data?.content) ? data.content.map((c) => c?.text ?? '').join('') : ''
    } else {
      const headers = { 'Content-Type': 'application/json' }
      if (provider === 'azure') headers['api-key'] = apiKey
      else headers.Authorization = `Bearer ${apiKey}`
      const payload = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }
      if (options.jsonMode) payload.response_format = { type: 'json_object' }
      const endpoint =
        provider === 'azure'
          ? `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=${process.env.AI_AZURE_API_VERSION || '2024-06-01'}`
          : `${baseUrl}/chat/completions`
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) })
      if (!res.ok) return json(res.status, { error: `Proveedor: ${(await res.text()).slice(0, 300)}` })
      const data = await res.json()
      content = data?.choices?.[0]?.message?.content ?? ''
    }

    return json(200, { content })
  },
})

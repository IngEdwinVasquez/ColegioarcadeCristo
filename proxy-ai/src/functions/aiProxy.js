import { app } from '@azure/functions'

const DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
  azure: { baseUrl: '', model: '' },
}

const json = (status, body) => ({ status, jsonBody: body })

app.http('aiProxy', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai',
  handler: async (request) => {
    const body = await request.json().catch(() => null)
    const messages = body?.messages
    const options = body?.options ?? {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return json(400, { error: 'Se requiere el campo "messages" (array de {role, content}).' })
    }

    const provider = String(process.env.AI_PROVIDER || 'openai').toLowerCase()
    const def = DEFAULTS[provider] ?? DEFAULTS.openai
    const baseUrl = String(process.env.AI_BASE_URL || def.baseUrl || '').replace(/\/$/, '')
    const model = process.env.AI_MODEL || def.model
    const apiKey = process.env.AI_API_KEY || ''
    if (!apiKey) return json(500, { error: 'Falta AI_API_KEY en la configuración de la función.' })

    let content = ''

    if (provider === 'anthropic') {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
      const rest = messages.filter((m) => m.role !== 'system')
      const payload = {
        model,
        max_tokens: options.maxTokens ?? 2048,
        system: system || undefined,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }
      if (options.temperature != null) payload.temperature = options.temperature
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
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 2048,
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

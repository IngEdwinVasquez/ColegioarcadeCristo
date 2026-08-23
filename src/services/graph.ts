import { Client, type AuthenticationProvider, type AuthenticationProviderOptions } from '@microsoft/microsoft-graph-client'
import { acquireToken } from './msal'

const authProvider: AuthenticationProvider = {
  getAccessToken: async (_options?: AuthenticationProviderOptions) => acquireToken(),
}

export const graphClient = Client.initWithMiddleware({
  authProvider,
  defaultVersion: 'v1.0',
})

export type GraphMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

export interface GraphRequestOptions {
  headers?: Record<string, string>
}

export function graphRequest<T>(path: string, method: GraphMethod = 'GET', body?: unknown, options?: GraphRequestOptions): Promise<T> {
  let request = graphClient.api(path)
  if (options?.headers) request = request.headers(options.headers)
  switch (method) {
    case 'GET':
      return request.get() as Promise<T>
    case 'POST':
      return request.post(body) as Promise<T>
    case 'PATCH':
      return request.patch(body) as Promise<T>
    case 'PUT':
      return request.put(body) as Promise<T>
    default:
      return request.delete() as Promise<T>
  }
}

/** Recorre todas las páginas de una colección de Graph (@odata.nextLink). */
export async function graphGetAll<T>(path: string, options?: GraphRequestOptions): Promise<T[]> {
  const items: T[] = []
  let next: string | undefined = path
  while (next) {
    const page: { value: T[]; '@odata.nextLink'?: string } = await graphRequest(next, 'GET', undefined, options)
    items.push(...(page.value ?? []))
    next = page['@odata.nextLink']
  }
  return items
}

/** Extrae un mensaje legible de un error de Graph. */
export function graphErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; body?: string; statusCode?: number }
    if (e.body) {
      try {
        const parsed = JSON.parse(e.body) as { message?: string; error?: { message?: string } }
        const msg = parsed.error?.message ?? parsed.message
        if (msg) return msg
      } catch {
        /* cuerpo no JSON */
      }
    }
    if (e.message) return e.message
  }
  return 'Error de comunicación con Microsoft 365'
}

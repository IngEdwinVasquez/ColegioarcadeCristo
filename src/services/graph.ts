import { Client, type AuthenticationProvider, type AuthenticationProviderOptions } from '@microsoft/microsoft-graph-client'
import { acquireToken } from './msal'

const authProvider: AuthenticationProvider = {
  getAccessToken: async (_options?: AuthenticationProviderOptions) => acquireToken(),
}

export const graphClient = Client.initWithMiddleware({
  authProvider,
  defaultVersion: 'v1.0',
})

export function graphRequest<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' = 'GET', body?: unknown): Promise<T> {
  const request = graphClient.api(path)
  return method === 'GET'
    ? (request.get() as Promise<T>)
    : method === 'POST'
      ? (request.post(body) as Promise<T>)
      : method === 'PATCH'
        ? (request.patch(body) as Promise<T>)
        : method === 'PUT'
          ? (request.put(body) as Promise<T>)
          : (request.delete() as Promise<T>)
}

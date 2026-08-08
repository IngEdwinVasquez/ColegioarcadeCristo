import { graphRequest } from './graph'

export interface EntraUser {
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
  accountEnabled?: boolean
}

/**
 * Lista los usuarios del directorio (Microsoft Entra ID) mediante Graph.
 * Requiere el permiso delegado User.Read.All o Directory.Read.All y consentimiento.
 */
export async function listEntraUsers(): Promise<EntraUser[]> {
  const response = await graphRequest<{ value: EntraUser[] }>(
    '/users?$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=200&$orderby=displayName',
  )
  return response.value ?? []
}

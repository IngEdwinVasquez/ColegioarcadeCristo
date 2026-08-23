import { graphGetAll, graphRequest } from './graph'

export interface EntraUser {
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
  accountEnabled?: boolean
  jobTitle?: string | null
}

export interface MyProfile {
  id: string
  displayName: string
  email: string
  jobTitle?: string
}

/**
 * Lista los usuarios del directorio (Microsoft Entra ID) mediante Graph.
 * Requiere el permiso delegado User.ReadBasic.All (o Directory.Read.All) con consentimiento.
 */
export async function listEntraUsers(): Promise<EntraUser[]> {
  const users = await graphGetAll<EntraUser>(
    "/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle&$filter=userType eq 'Member'&$top=999",
  )
  return users.filter((u) => u.accountEnabled !== false).sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
}

/** Perfil del usuario conectado (id de objeto, nombre y correo). */
export async function getMyProfile(): Promise<MyProfile> {
  const me = await graphRequest<EntraUser>('/me?$select=id,displayName,mail,userPrincipalName,jobTitle')
  return {
    id: me.id,
    displayName: me.displayName ?? me.userPrincipalName ?? 'Usuario',
    email: (me.mail ?? me.userPrincipalName ?? '').toLowerCase(),
    jobTitle: me.jobTitle ?? undefined,
  }
}

/** Foto de perfil del usuario conectado como Object URL (o null si no existe). */
export async function getMyPhoto(): Promise<string | null> {
  try {
    const blob = (await graphRequest<Blob>('/me/photos/96x96/$value')) as Blob
    if (!(blob instanceof Blob)) return null
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

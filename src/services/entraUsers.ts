import { graphGetAll, graphRequest, graphRequestWithScopes } from './graph'

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

export interface NewEntraUser {
  displayName: string
  mailNickname: string
  userPrincipalName: string
  givenName?: string
  surname?: string
  /** Contraseña temporal; el usuario deberá cambiarla al iniciar sesión. */
  password: string
  usageLocation?: string
}

/**
 * Crea una cuenta de usuario en Entra ID (aparece en "Usuarios activos" del centro
 * de administración de Microsoft 365). Requiere el permiso delegado
 * `User.ReadWrite.All` con consentimiento de administrador y que quien ejecuta la
 * acción tenga un rol con permiso para crear usuarios.
 */
export async function createEntraUser(input: NewEntraUser): Promise<EntraUser> {
  return graphRequestWithScopes<EntraUser>('/users', 'POST', {
    accountEnabled: true,
    displayName: input.displayName,
    mailNickname: input.mailNickname,
    userPrincipalName: input.userPrincipalName,
    givenName: input.givenName,
    surname: input.surname,
    usageLocation: input.usageLocation ?? 'DO',
    passwordProfile: {
      forceChangePasswordNextSignIn: true,
      password: input.password,
    },
  }, ['User.ReadWrite.All'])
}

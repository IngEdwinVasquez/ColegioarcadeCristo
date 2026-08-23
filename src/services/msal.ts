import { PublicClientApplication, LogLevel, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'
import { appConfig } from '../config/appConfig'

export const loginRequest = {
  scopes: [...appConfig.m365.scopes],
}

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: appConfig.m365.clientId,
    authority: appConfig.m365.authority,
    redirectUri: appConfig.m365.redirectUri,
    postLogoutRedirectUri: appConfig.m365.redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) console.error('[MSAL]', message)
      },
      logLevel: LogLevel.Error,
      piiLoggingEnabled: false,
    },
  },
})

let initialized: Promise<void> | null = null

/** Inicializa MSAL y procesa la respuesta del redirect (si la hay). Idempotente. */
export function initMsal(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      await msalInstance.initialize()
      const result = await msalInstance.handleRedirectPromise()
      const account = result?.account ?? msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
      if (account) msalInstance.setActiveAccount(account)
    })()
  }
  return initialized
}

export function getActiveAccount(): AccountInfo | null {
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null
}

export async function acquireToken(): Promise<string> {
  const account = getActiveAccount()
  if (!account) {
    throw new Error('No hay una sesión activa en Microsoft Entra ID')
  }
  try {
    const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account })
    return response.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({ ...loginRequest, account })
      // acquireTokenRedirect navega fuera de la página; esta promesa no se resuelve.
      return new Promise<string>(() => {})
    }
    throw error
  }
}

export function signIn(): Promise<void> {
  return msalInstance.loginRedirect({ ...loginRequest, prompt: 'select_account' })
}

export function signOut(): Promise<void> {
  const account = getActiveAccount()
  return msalInstance.logoutRedirect({ account: account ?? undefined })
}

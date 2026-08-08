import { PublicClientApplication, LogLevel } from '@azure/msal-browser'
import { appConfig } from '../config/appConfig'

export const loginRequest = {
  scopes: [...appConfig.m365.scopes],
}

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: appConfig.m365.clientId,
    authority: appConfig.m365.authority,
    redirectUri: appConfig.m365.redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: () => {
        /* logging deshabilitado en producción */
      },
      logLevel: LogLevel.Warning,
    },
  },
})

export async function acquireToken(): Promise<string> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
  if (!account) {
    throw new Error('No hay una sesión activa en Microsoft Entra ID')
  }
  const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account })
  return response.accessToken
}

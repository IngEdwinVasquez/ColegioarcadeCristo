const env = import.meta.env

const m365ClientId = (env.VITE_MSAL_CLIENT_ID as string | undefined) ?? ''
const m365Enabled = (env.VITE_M365_ENABLED as string | undefined) === 'true' && m365ClientId.length > 0

export const appConfig = {
  appName: 'Colegio Evangélico Arca de Cristo',
  shortName: 'Arca de Cristo',
  institution: 'Centro Educativo Evangélico Arca de Cristo',
  tagline: 'Excelencia educativa con valores cristianos',
  city: 'La Romana, República Dominicana',
  year: new Date().getFullYear(),
  contact: {
    address: 'Calle Dr. Teófilo Ferry No. 78, Centro de la Ciudad, La Romana, Rep. Dom.',
    phone: '(809) 550-6292',
    phoneHref: '+18095506292',
    email: 'ceacarcadecristo@gmail.com',
    instagram: '@centroeducativoarcadecristo',
    instagramUrl: 'https://www.instagram.com/centroeducativoarcadecristo/',
    website: 'arcadecristo.edu.do',
    websiteUrl: 'http://arcadecristo.edu.do/',
  },
  colors: {
    azul: '#002D62',
    azulOscuro: '#041E42',
    rojo: '#CE1126',
    dorado: '#C9A227',
    blanco: '#FFFFFF',
  },
  m365: {
    enabled: m365Enabled,
    clientId: m365ClientId,
    authority: (env.VITE_MSAL_AUTHORITY as string | undefined) ?? 'https://login.microsoftonline.com/common',
    redirectUri:
      (env.VITE_MSAL_REDIRECT_URI as string | undefined) ?? window.location.origin,
    scopes: [
      'User.Read',
      'Mail.Send',
      'Calendars.ReadWrite',
      'Sites.ReadWrite.All',
      'Files.ReadWrite.All',
      'Directory.Read.All',
    ],
    graphBase: 'https://graph.microsoft.com/v1.0',
    // SharePoint site que se usará como "base de datos" (listas)
    siteHostname: (env.VITE_SPO_HOSTNAME as string | undefined) ?? 'yourtenant.sharepoint.com',
    siteId: (env.VITE_SPO_SITE_ID as string | undefined) ?? '',
    sitePath: (env.VITE_SPO_SITE_PATH as string | undefined) ?? '/sites/ArcaDeCristo',
  },
} as const

export type AppConfig = typeof appConfig

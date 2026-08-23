const env = import.meta.env

const clientId = ((env.VITE_MSAL_CLIENT_ID as string | undefined) ?? '').trim()
const tenantId = ((env.VITE_MSAL_TENANT_ID as string | undefined) ?? '').trim()

if (!clientId || !tenantId) {
  // La app solo funciona conectada a Microsoft 365: sin registro de aplicación no hay acceso.
  throw new Error(
    'Configuración incompleta: defina VITE_MSAL_CLIENT_ID y VITE_MSAL_TENANT_ID (ver docs/M365_SETUP.md).',
  )
}

const csv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

export const appConfig = {
  appName: 'Colegio Evangélico Arca de Cristo',
  shortName: 'Arca de Cristo',
  institution: 'Centro Educativo Evangélico Arca de Cristo',
  tagline: 'Excelencia educativa con valores cristianos',
  motto: 'Instruir es construir',
  founded: 1986,
  city: 'La Romana, República Dominicana',
  timeZone: 'America/Santo_Domingo',
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
    azul: '#0095C8',
    azulOscuro: '#0A1F2B',
    rojo: '#E30613',
    vino: '#7D1D24',
    dorado: '#9A9C2E',
    negro: '#161616',
    blanco: '#FFFFFF',
  },
  m365: {
    clientId,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    // Si no se define, se usa el origen actual (localhost en desarrollo, la URL pública en producción).
    redirectUri: ((env.VITE_MSAL_REDIRECT_URI as string | undefined) ?? '').trim() || window.location.origin,
    scopes: [
      'User.Read',
      'User.ReadBasic.All',
      'Mail.Send',
      'Calendars.ReadWrite',
      'Sites.ReadWrite.All',
      'Sites.Manage.All',
      'Files.ReadWrite.All',
      'Directory.Read.All',
    ],
    graphBase: 'https://graph.microsoft.com/v1.0',
    // Sitio de SharePoint Online que actúa como base de datos (listas ARC_*).
    // Si VITE_SPO_HOSTNAME está vacío, se resuelve automáticamente desde /sites/root del tenant.
    siteHostname: ((env.VITE_SPO_HOSTNAME as string | undefined) ?? '').trim(),
    siteId: ((env.VITE_SPO_SITE_ID as string | undefined) ?? '').trim(),
    sitePath: ((env.VITE_SPO_SITE_PATH as string | undefined) ?? '').trim() || '/sites/IntranetArca',
    // Carpeta raíz en OneDrive del usuario para el repositorio documental.
    driveRootFolder: ((env.VITE_ONEDRIVE_ROOT_FOLDER as string | undefined) ?? '').trim() || 'ArcaDeCristo',
    // Correos con rol administrador garantizado (arranque inicial del sistema).
    adminEmails: csv(env.VITE_ADMIN_EMAILS as string | undefined),
  },
  automation: {
    // URL del desencadenador HTTP del flujo de Power Automate "Enviar correo institucional".
    mailFlowUrl: ((env.VITE_POWER_AUTOMATE_MAIL_URL as string | undefined) ?? '').trim(),
  },
  copilot: {
    // URL de inserción de un agente de Copilot Studio (opcional). Si está vacía, se enlaza a Microsoft 365 Copilot.
    embedUrl: ((env.VITE_COPILOT_EMBED_URL as string | undefined) ?? '').trim(),
    m365ChatUrl: 'https://m365.cloud.microsoft/chat',
  },
} as const

export type AppConfig = typeof appConfig

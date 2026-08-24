# Configuración de Microsoft 365 (Entra ID, SharePoint, OneDrive, Teams)

La intranet es una **SPA** que se autentica con **Microsoft Entra ID** mediante MSAL (flujo de código de autorización con PKCE) y accede a Microsoft 365 con **permisos delegados** del usuario conectado (Microsoft Graph). No existe backend propio ni datos de demostración: todo vive en el tenant del colegio.

| Servicio | Uso en la intranet |
| --- | --- |
| **Microsoft Entra ID** | Inicio de sesión único y directorio de usuarios |
| **SharePoint Online** | Base de datos (listas `ARC_*` del sitio `IntranetArca`) |
| **OneDrive** | Repositorio documental (material de aulas virtuales) |
| **Microsoft Teams / Outlook** | Encuentros virtuales (reuniones de Teams con invitación de calendario) |
| **Power Automate** | Envío de correos institucionales (circulares, admisiones, alertas) |
| **Microsoft 365 Copilot** | Asistente de IA integrado en cada portal |

## Registro de aplicación (ya creado)

| Dato | Valor |
| --- | --- |
| Id. de aplicación (cliente) | `c69b1c39-4357-4b88-8634-01cde6235549` |
| Id. de directorio (inquilino) | `b5fed600-8da6-43f1-8018-e741824c0e28` |
| Authority | `https://login.microsoftonline.com/b5fed600-8da6-43f1-8018-e741824c0e28` |

> **Sobre el secreto de cliente:** una SPA **no usa** client secret (el flujo PKCE es público y el código se ejecuta en el navegador). Si se generó un secreto para este registro, **no lo coloque en el proyecto** y, si se compartió por un canal inseguro, **elimínelo/rotélo** en *Certificados y secretos*. El secreto solo tendría sentido en un backend o en una conexión de Power Automate con permisos de aplicación.

## Lista de verificación en el portal de Entra

Acceda a [entra.microsoft.com](https://entra.microsoft.com) → **Aplicaciones** → **Registros de aplicaciones** → *Intranet Arca de Cristo* (`c69b1c39-…`).

### 1. Autenticación

- Plataforma **Aplicación de página única (SPA)** con estas **URI de redirección**:
  - `http://localhost:5173` (desarrollo)
  - `https://<nombre>.azurestaticapps.net` (producción, la URL que asigne Static Web Apps)
  - El dominio personalizado cuando se configure (p. ej. `https://intranet.arcadecristo.edu.do`)
- **Tipos de cuenta admitidos:** *Solo las cuentas de este directorio organizativo* (inquilino único).
- No active la concesión implícita (no es necesaria con MSAL v3+/PKCE).

### 2. Permisos de API → Microsoft Graph → Permisos **delegados**

| Permiso | Para qué |
| --- | --- |
| `User.Read` | Perfil y foto del usuario conectado |
| `User.ReadBasic.All` | Leer el directorio en "Usuarios y roles" |
| `Directory.Read.All` | (Opcional) detalles ampliados del directorio |
| `Sites.ReadWrite.All` | Leer/escribir los elementos de las listas de SharePoint |
| `Sites.Manage.All` | Crear las listas y columnas `ARC_*` automáticamente (aprovisionamiento) |
| `Files.ReadWrite.All` | Subir material a OneDrive y crear enlaces compartidos |
| `Calendars.ReadWrite` | Crear reuniones de Teams para los encuentros virtuales y eventos del plan TIC |
| `Team.Create` | Crear equipos de clase de Teams por curso (Gestión académica) |
| `Team.ReadBasic.All` | Listar sus equipos de Teams para importarlos como cursos |
| `Mail.Send` | Envío de correo de respaldo cuando no hay flujo de Power Automate |

Pulse **Conceder consentimiento de administrador para <tenant>** y compruebe que todos aparecen en verde.

### 3. Asignación de usuarios (recomendado)

**Aplicaciones empresariales** → *Intranet Arca de Cristo* → **Propiedades** → *¿Asignación requerida?* = **Sí**, y en **Usuarios y grupos** agregue los grupos de docentes, estudiantes, familias y dirección. Así solo las cuentas autorizadas pueden iniciar sesión.

## Sitio de SharePoint

1. Centro de administración de SharePoint → **Sitios activos** → **Crear** → *Sitio de grupo* → nombre **IntranetArca** (URL `/sites/IntranetArca`).
2. Agregue como **miembros** (permiso de edición) a los grupos de docentes, familias, estudiantes y dirección: la app escribe en las listas con la identidad del usuario.
3. **No hace falta crear las listas manualmente**: la primera persona que inicie sesión con permiso de edición las crea automáticamente (ver [SPO_PROVISIONING.md](SPO_PROVISIONING.md)).

Si el sitio tiene otro nombre o ruta, ajuste `VITE_SPO_SITE_PATH`. El hostname (`<tenant>.sharepoint.com`) se detecta solo; puede fijarlo con `VITE_SPO_HOSTNAME`.

## Roles de acceso

Al iniciar sesión, la intranet determina los roles del usuario en este orden:

1. Roles guardados en la lista **`ARC_Users`** (módulo *Usuarios y roles* del portal administrativo).
2. Correos listados en `VITE_ADMIN_EMAILS` → **superadministrador**: los cuatro roles/portales (arranque inicial y cuenta de TIC/Dirección).
3. Inferencia automática: correo presente en *Personas → Docentes* → **Docente**; en *Personas → Padres* → **Padre / Tutor**.
4. Si la lista `ARC_Users` está vacía (primer uso), la primera cuenta que entra recibe el rol **Administrativo**.

Un usuario sin rol ve la pantalla *"Acceso pendiente de asignación"* hasta que Dirección le asigne uno.

## Variables de entorno

`.env.production` (valores públicos, se incluye en el repositorio):

```env
VITE_MSAL_CLIENT_ID=c69b1c39-4357-4b88-8634-01cde6235549
VITE_MSAL_TENANT_ID=b5fed600-8da6-43f1-8018-e741824c0e28
VITE_SPO_HOSTNAME=
VITE_SPO_SITE_PATH=/sites/IntranetArca
VITE_ONEDRIVE_ROOT_FOLDER=ArcaDeCristo
VITE_ADMIN_EMAILS=leoncio.vasquez@arcadecristo.edu.do,direccion@arcadecristo.edu.do
VITE_POWER_AUTOMATE_MAIL_URL=
VITE_COPILOT_EMBED_URL=
```

Para desarrollo local copie `.env.example` a `.env`.

## Prueba

1. `npm run dev` → `http://localhost:5173` → **Iniciar sesión con Microsoft**.
2. Tras autenticarse verá *"Conectando con Microsoft 365"*: se crea lo que falte en SharePoint y se cargan los catálogos.
3. Elija el portal. Con el rol Administrativo, vaya a **Catálogos** para crear grados, asignaturas y períodos, y a **Personas** / **Usuarios y roles** para dar acceso a los demás.

## Solución de problemas

| Error | Causa | Solución |
| --- | --- | --- |
| `AADSTS50011` | URI de redirección no registrada | Agregue exactamente la URL (sin barra final) en la plataforma **SPA** |
| `AADSTS65001` / `AADSTS650**` | Falta consentimiento | Conceda el consentimiento de administrador a los permisos |
| `AADSTS50105` | Usuario no asignado a la aplicación | Agréguelo en *Aplicaciones empresariales → Usuarios y grupos* |
| "SharePoint no está listo" | No existe el sitio `/sites/IntranetArca` o el usuario no tiene acceso | Cree el sitio o ajuste `VITE_SPO_SITE_PATH`; dé permisos de edición |
| 403 al guardar | El usuario solo tiene lectura en el sitio | Conviértalo en miembro (edición) del sitio |
| 403 al crear la lista `ARC_Users` | Falta `Sites.Manage.All` | Agregue el permiso delegado, conceda consentimiento de administrador, cierre sesión y vuelva a entrar |
| Reunión de Teams no se crea | Falta `Calendars.ReadWrite` o el usuario no tiene licencia de Teams/Exchange | Revise permisos y licencias |

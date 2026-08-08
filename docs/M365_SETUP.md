# Configuración de Microsoft Entra ID (Login con Microsoft)

La intranet usa **MSAL (Microsoft Authentication Library)** con el flujo de autorización de código PKCE para usuarios (permisos delegados). Siga estos pasos en el **Azure Portal**.

## 1. Registrar la aplicación

1. Vaya a **Azure Portal → Microsoft Entra ID → Registros de aplicaciones → Nuevo registro**.
2. **Nombre:** `Intranet Arca de Cristo`.
3. **Tipos de cuenta admitidos:** *Solo las cuentas en este directorio organizativo* (single-tenant) recomendado.
4. **URI de redirección (SPA):** `http://localhost:5173` (desarrollo) y la URL pública de producción cuando se despliegue.
5. Clic en **Registrar** y anote el **Id. de aplicación (cliente)**.

## 2. Plataforma SPA y autenticación implícita

En **Autenticación**:

- Agregue la plataforma **SPA (aplicación de página única)**.
- Active el flujo con códigos de autorización (PKCE). MSAL v5 lo utiliza por defecto; **no es necesario** activar la concesión implícita.

## 3. Permisos de API (Microsoft Graph)

En **Permisos de API → Agregar un permiso → Microsoft Graph → Permisos delegados**, agregue:

| Permiso | Propósito |
| --- | --- |
| `User.Read` | Datos básicos del usuario conectado |
| `Mail.Send` | Envío de correos institucionales (notificaciones) |
| `Calendars.ReadWrite` | Creación de reuniones / encuentros virtuales |
| `Sites.ReadWrite.All` | Lectura/escritura de listas de SharePoint Online (base de datos) |
| `Files.ReadWrite.All` | Repositorio de documentos en OneDrive |
| `Directory.Read.All` | (Opcional) resolución de grupos/docentes |

En **Conceder consentimiento de administrador** presione el botón para aceptar los permisos en nombre de la organización.

> **Importante:** para SPA con MSAL v5 no se generan secretos; el flujo es público (PKCE). No almacene secretos en el frontend.

## 4. Usuarios permitidos

En **Exposición de API / Azure AD B2C** no aplica. Para restringir acceso, asigne usuarios en **Aplicaciones empresariales → Intranet Arca de Cristo → Usuarios y grupos** o configure **Acceso condicional**.

## 5. Variables de entorno del frontend

Copie `.env.example` a `.env`:

```env
VITE_M365_ENABLED=true
VITE_MSAL_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/SU-TENANT.onmicrosoft.com
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_SPO_HOSTNAME=SU-TENANT.sharepoint.com
VITE_SPO_SITE_PATH=/sites/IntranetArca
```

## 6. Prueba

1. `npm run dev`
2. Abra `http://localhost:5173` → se mostrará el botón **"Iniciar sesión con Microsoft"**.
3. Inicie sesión con una cuenta institucional. Tras autenticarse podrá elegir el portal.

## Solución de problemas

| Error | Causa | Solución |
| --- | --- | --- |
| `AADSTS50011` | URI de redirección no registrada | Agregue exactamente la URI en la plataforma SPA |
| `AADSTS65001` | No se concedió consentimiento | Acepte el consentimiento de administrador de los permisos |
| Token 401 en Graph | Faltan permisos delegados | Verifique `Mail.Send`, `Sites.ReadWrite.All`, etc. |
| `Sites.ReadWrite.All` requiere consentimiento admin | Permiso de alto privilegio | Conceder consentimiento de administrador |

# Despliegue en Azure Static Web Apps

La intranet es un sitio estático (Vite) y se publica en **Azure Static Web Apps (SWA)** mediante **GitHub Actions** (`.github/workflows/azure-static-web-apps.yml`). También existe `azure-pipelines.yml` para Azure DevOps.

## 1. Token de implementación (secreto)

El token de implementación de SWA **es un secreto**: quien lo tenga puede publicar en su sitio. Nunca se escribe en el repositorio ni en archivos `.env`.

1. Portal de Azure → su recurso **Static Web App** → **Información general** → **Administrar token de implementación** → copie el token.
   - Si el token se compartió por chat, correo u otro canal inseguro, pulse **Restablecer token** y use el nuevo.
2. GitHub → repositorio `IngEdwinVasquez/ColegioarcadeCristo` → **Settings → Secrets and variables → Actions → New repository secret**:
   - **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - **Secret:** el token.

## 2. Variables de compilación (opcional)

Los valores públicos (client id, tenant id, ruta del sitio) ya están en `.env.production`. Si desea sobreescribirlos sin tocar el código, cree **Variables** (no secrets) en GitHub → *Settings → Secrets and variables → Actions → Variables*:

| Variable | Ejemplo |
| --- | --- |
| `VITE_SPO_HOSTNAME` | `arcadecristo.sharepoint.com` |
| `VITE_SPO_SITE_PATH` | `/sites/IntranetArca` |
| `VITE_ADMIN_EMAILS` | `direccion@arcadecristo.edu.do,tic@arcadecristo.edu.do` |
| `VITE_POWER_AUTOMATE_MAIL_URL` | URL del desencadenador HTTP del flujo |
| `VITE_COPILOT_EMBED_URL` | URL de inserción del agente de Copilot Studio |

## 3. Flujo de ramas y publicación

El flujo es estricto: **dev → qa → produccion** (nunca se salta un paso).

1. Los cambios se suben a `dev`.
2. `dev` se fusiona en `qa` (PR o merge): se despliega al **entorno qa** de SWA (URL propia con sufijo `-qa`).
3. Tras validar en qa, `qa` se fusiona en `produccion`: se despliega al entorno principal.

El workflow instala dependencias, ejecuta `npm run lint` y `npm run build`, y sube `dist/` a SWA. Los *pull requests* generan además un entorno de vista previa. También puede lanzarse a mano desde **Actions → Run workflow**.

> Agregue la URL del entorno qa como URI de redirección SPA en Entra ID para poder iniciar sesión allí.

## 4. Después del primer despliegue

1. Copie la URL pública (`https://<nombre>.azurestaticapps.net`).
2. Entra ID → registro de aplicación → **Autenticación** → plataforma **SPA** → agregue esa URL como URI de redirección (sin barra final).
3. Abra la URL, inicie sesión con la cuenta de Dirección y verifique que se crean las listas en SharePoint.

## 5. Dominio personalizado (opcional)

SWA → **Dominios personalizados** → agregue `intranet.arcadecristo.edu.do` y cree el CNAME indicado en el DNS del dominio. Luego agregue también ese dominio como URI de redirección en Entra ID.

## Despliegue manual desde su equipo (alternativa)

```bash
npm run build
npx @azure/static-web-apps-cli deploy ./dist --env production
```

El CLI pedirá iniciar sesión en Azure o el token (`--deployment-token`), que debe introducir usted en su terminal; no lo guarde en scripts ni archivos del proyecto.

## Configuración del sitio

`public/staticwebapp.config.json` define el *fallback* de navegación para la SPA, cabeceras de seguridad y `Cache-Control: no-cache` para `index.html` y el service worker (PWA), de modo que las nuevas versiones se distribuyan al instante.

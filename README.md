# INTRANET COLEGIO EVANGÉLICO ARCA DE CRISTO

Intranet institucional construida con **React + Microsoft Graph API + Fluent UI v9**, integrada al ecosistema **Microsoft 365**: inicio de sesión único con **Microsoft Entra ID**, listas de **SharePoint Online** como base de datos, **OneDrive** como repositorio de documentos, y **Outlook / Graph** para correo y notificaciones.

La institución usa los **colores de la bandera dominicana** (azul `#002D62`, rojo `#CE1126`, blanco).

---

## Portales

| Portal | Acceso | Funcionalidades |
| --- | --- | --- |
| **Portal de Docentes** | Cuerpo docente | Planificación anual, repositorio de clases (antes/durante/después), control de asistencia con informes, aulas virtuales con calificaciones, encuentros virtuales con actas. |
| **Campus Virtual de Estudiantes** | Alumnado | Mis clases, aula virtual (actividades y calificaciones), mi asistencia, comunicados. |
| **Portal de Padres y Tutores** | Familias | Progreso académico, reporte de asistencia y comunicaciones por hijo(a). |
| **Portal Administrativo** | Dirección y coordinación | **Dirección y Coordinación Pedagógica** (KPIs, cumplimiento docente, indicadores), **Psicología y Orientación** (ventanilla, casos de seguimiento, talleres), **Administración** (admisiones, solicitudes de documentos, FAQ). |

## Módulos núcleo

1. **Planificación Anual** — cronograma de todas las clases por asignatura, grado y docente. Cada clase impartida se vincula directamente a una clase del plan, permitiendo reportes de *planificado vs. impartido*.
2. **Repositorio de Clases** — registro integral de cada clase con tres fases:
   - **ANTES** (planificación, plan de trabajo y cronograma de la sesión).
   - **DURANTE** (desarrollo de la actividad, participación y observaciones).
   - **DESPUÉS** (reflexión docente, logros, mejoras e informe de la actividad realizada).
   - Generación de **informe imprimible** de cada clase.
3. **Control de Asistencia** — el docente pasa asistencia por cada asignatura impartida (Presente / Ausente / Tarde / Justificado), con informe gráfico: distribución, asistencia por día, tendencia y detalle por estudiante.
4. **Aulas Virtuales** — publicación de actividades (tareas, quizzes, proyectos, evaluaciones), registro de entregas y **calificaciones** por actividad.
5. **Encuentros Virtuales** — programación de reuniones, **acta de lo tratado**, asistentes, y **acuerdos** con responsables y fechas que derivan en actividades futuras.

## Requisitos

- Node.js 20+ y npm.
- Un tenant de Microsoft 365 con licencias para SharePoint Online, OneDrive, Exchange Online y Teams (según el uso).

## Puesta en marcha (modo demo)

Sin ninguna configuración de Microsoft 365, la app funciona en **modo demostración** con datos de ejemplo persistidos en `localStorage`:

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`, seleccione un usuario de demostración (docente, estudiante, padre o dirección) y explore los portales.

> Para probar el login real con Microsoft Entra ID siga la guía de [docs/M365_SETUP.md](docs/M365_SETUP.md) y defina las variables en `.env` (ver ejemplo en `.env.example`).

## Configuración con Microsoft 365

1. **Registre la aplicación en Entra ID** ([guía](docs/M365_SETUP.md)) y anote el `Client ID`.
2. **Cree las listas en SharePoint Online** ([esquema](docs/SPO_PROVISIONING.md)) en el sitio `IntranetArca`.
3. **Configure el archivo `.env`**:

```env
VITE_M365_ENABLED=true
VITE_MSAL_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/yourtenant.onmicrosoft.com
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_SPO_HOSTNAME=yourtenant.sharepoint.com
VITE_SPO_SITE_PATH=/sites/IntranetArca
# Opcional: VITE_SPO_SITE_ID=<id-del-sitio>
```

4. **Automatizaciones** con Power Automate, envío de correos y notificaciones: [docs/POWERAUTOMATE.md](docs/POWERAUTOMATE.md).

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Compilación de producción (TypeScript + Vite + PWA) |
| `npm run lint` | Análisis estático (oxlint) |
| `npm run preview` | Previsualiza la compilación (útil para probar la PWA) |

## Progressive Web App (PWA)

La aplicación es **instalable y funciona offline** (modo demo):

- **Manifest** con nombre, colores institucionales e iconos de la bandera dominicana (`pwa-192x192`, `pwa-512x512`, `pwa-maskable`, `apple-touch-icon`).
- **Service Worker** generado con Workbox (`vite-plugin-pwa`) que precachea el *app shell* y los recursos (JS/CSS/fuentes), con *fallback* de navegación offline.
- **Botón "Instalar aplicación"** en el panel lateral (aparece automáticamente cuando el navegador lo permite).
- En **desarrollo** el Service Worker está desactivado; se activa con `npm run build` y `npm run preview` (o al desplegar).

> Nota: las llamadas a Microsoft Graph requieren conexión. La interfaz y los datos del modo demo (localStorage) funcionan completamente sin conexión.

## Arquitectura

```
src/
  auth/          → Login Entra ID (MSAL), selector de portal
  components/    → Layout (shell) y componentes compartidos
  config/        → Configuración de la app y de M365 (variables de entorno)
  context/       → Estado global (usuario, rol, catálogos)
  hooks/         → useCollection, useLocalList
  modules/       → anualPlan, clases, asistencia, aulas, encuentros, administrativo, dashboard
  portals/       → Rutas de cada portal
  services/      → Graph API, SharePoint, OneDrive, Mail, dataService (demo ↔ M365)
  theme/         → Tema Fluent con colores institucionales
  types/         → Modelo de datos
```

La capa `src/services/dataService.ts` abstrae el origen de datos: en **modo demo** usa `localStorage` con datos de ejemplo; en **modo M365** usa las listas de SharePoint a través de Microsoft Graph.

## Elaborado por

**Ing. Leoncio Alberto Vásquez Tavarez** — Coordinador de Tecnologías e Innovación Educativa
Centro Educativo Evangélico Arca de Cristo — La Romana, República Dominicana

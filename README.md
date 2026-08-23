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
- Un tenant de Microsoft 365 con licencias para SharePoint Online, OneDrive, Exchange Online y Teams.
- El registro de aplicación en Microsoft Entra ID con los permisos concedidos (ver [docs/M365_SETUP.md](docs/M365_SETUP.md)).

> La aplicación **no tiene modo de demostración**: todos los datos viven en el tenant del colegio y el acceso requiere una cuenta institucional.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # ya contiene el Client ID y Tenant ID del colegio
npm run dev
```

Abra `http://localhost:5173` → **Iniciar sesión con Microsoft**. La primera cuenta con permiso de edición en el sitio de SharePoint crea automáticamente las listas `ARC_*`.

## Integración con Microsoft 365

| Servicio | Uso | Documento |
| --- | --- | --- |
| **Entra ID** | Inicio de sesión único (MSAL + PKCE) y directorio de usuarios | [M365_SETUP.md](docs/M365_SETUP.md) |
| **SharePoint Online** | Base de datos: listas `ARC_*` del sitio `IntranetArca` (aprovisionamiento automático) | [SPO_PROVISIONING.md](docs/SPO_PROVISIONING.md) |
| **OneDrive** | Material de aulas virtuales con enlace compartido en la organización | [POWERAUTOMATE.md](docs/POWERAUTOMATE.md#6-onedrive) |
| **Teams / Outlook** | Encuentros virtuales: reunión de Teams + invitaciones de calendario | [POWERAUTOMATE.md](docs/POWERAUTOMATE.md#5-microsoft-teams) |
| **Power Automate** | Envío de circulares y notificaciones desde el buzón institucional | [POWERAUTOMATE.md](docs/POWERAUTOMATE.md) |
| **Microsoft 365 Copilot** | Sección *Copilot* en cada portal (opcional: agente de Copilot Studio embebido) | [POWERAUTOMATE.md](docs/POWERAUTOMATE.md#7-copilot) |

## Despliegue

Azure Static Web Apps con GitHub Actions: [docs/DEPLOY.md](docs/DEPLOY.md). El token de implementación se guarda como secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` del repositorio.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Compilación de producción (TypeScript + Vite + PWA) |
| `npm run lint` | Análisis estático (oxlint) |
| `npm run preview` | Previsualiza la compilación (útil para probar la PWA) |

## Progressive Web App (PWA)

La aplicación es **instalable** (PWA):

- **Manifest** con nombre, colores institucionales e iconos de la bandera dominicana (`pwa-192x192`, `pwa-512x512`, `pwa-maskable`, `apple-touch-icon`).
- **Service Worker** generado con Workbox (`vite-plugin-pwa`) que precachea el *app shell* y los recursos (JS/CSS/fuentes), con *fallback* de navegación offline.
- **Botón "Instalar aplicación"** en el panel lateral (aparece automáticamente cuando el navegador lo permite).
- En **desarrollo** el Service Worker está desactivado; se activa con `npm run build` y `npm run preview` (o al desplegar).

> Nota: las llamadas a Microsoft Graph requieren conexión; el *app shell* se sirve desde caché para arrancar rápido.

## Arquitectura

```
src/
  auth/          → Login Entra ID (MSAL), selector de portal
  components/    → Layout (shell) y componentes compartidos
  config/        → Configuración de la app y de M365 (variables de entorno)
  context/       → Estado global (usuario, rol, catálogos)
  hooks/         → useCollection
  modules/       → anualPlan, clases, asistencia, aulas, encuentros, administrativo, dashboard
  portals/       → Rutas de cada portal
  services/      → Graph, MSAL, SharePoint, OneDrive, Teams, Power Automate (notifications), dataService
  theme/         → Tema Fluent con colores institucionales
  types/         → Modelo de datos
```

La capa `src/services/dataService.ts` expone colecciones tipadas sobre las listas de SharePoint (`src/services/sharepoint.ts`), que mantienen ids lógicos estables (`app_id`) y el registro completo en `json_payload`.

## Elaborado por

**Ing. Leoncio Alberto Vásquez Tavarez** — Coordinador de Tecnologías e Innovación Educativa
Centro Educativo Evangélico Arca de Cristo — La Romana, República Dominicana

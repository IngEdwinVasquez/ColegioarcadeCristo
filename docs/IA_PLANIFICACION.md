# Asistente de IA para planificaciones (MINERD)

El módulo de planificación del **Portal de Docentes** incluye un asistente de IA que genera
planificaciones académicas (diarias y de unidad) alineadas al diseño curricular del
**MINERD** (República Dominicana).

## Política de uso de la IA

- **Usuarios finales (docentes, estudiantes, familias):** usan **Microsoft 365 Copilot** del
  centro educativo (sección *Copilot* de cada portal).
- **El asistente "Generar con IA" (DeepSeek) está restringido a los superadministradores**
  (`VITE_ADMIN_EMAILS`): se reserva para el **desarrollo y mejora de la plataforma**, y solo
  cuando no sea factible hacerlo con Copilot.

> Microsoft 365 Copilot Chat no expone una API programática, por lo que el generador
> estructurado de planificaciones (que devuelve un JSON para prellenar el formulario) se
> apoya en DeepSeek a través del proxy. Esta es la herramienta de desarrollo/mejora, no el
> asistente de los usuarios.

## Cómo funciona

1. Un superadministrador abre **Planificaciones → Generar con IA**.
2. Selecciona **grado, asignatura, tema/unidad, tipo y duración**.
3. La intranet envía los datos a un modelo de lenguaje con un *prompt de sistema*
   parametrizado con la estructura curricular dominicana.
4. El modelo devuelve un **JSON** que se carga en el formulario de planificación para
   que el docente lo revise, edite, guarde (SharePoint) o exporte a **Word / PDF**.

## Proveedores soportados

El cliente (`src/services/ai.ts`) soporta `openai`, `deepseek`, `anthropic`, `azure` y un
modo `proxy` genérico. Se configura con variables de entorno:

| Variable | Descripción |
| --- | --- |
| `VITE_AI_PROVIDER` | `openai` · `deepseek` · `anthropic` · `azure` · `proxy` |
| `VITE_AI_API_URL` | URL del proxy o de la API del proveedor |
| `VITE_AI_API_KEY` | Clave de API (solo modo directo / desarrollo) |
| `VITE_AI_MODEL` | Modelo (opcional; usa el predeterminado del proveedor) |

Modelos predeterminados: `gpt-4o-mini` (OpenAI), `deepseek-chat` (DeepSeek),
`claude-3-5-sonnet-latest` (Anthropic). En `azure` debe indicar `VITE_AI_API_URL` (endpoint)
y `VITE_AI_MODEL` (nombre del despliegue).

## Seguridad (importante)

Esta aplicación es una **SPA**: todo lo que empiece por `VITE_` se incluye en el bundle del
navegador. **No coloque claves de API directamente en `VITE_AI_API_KEY` en producción.**

El modo **`proxy`** (recomendado) es coherente con la arquitectura del proyecto: igual que el
envío de correos usa un flujo de Power Automate, aquí se apunta a un **desencadenador HTTP**
que guarda la clave del lado del servidor y reenvía la petición al modelo.

El proxy exige **autenticación de Entra ID**: valida el token del usuario contra Microsoft
Graph (`/me`) y solo permite los correos listados en `AI_ADMIN_EMAILS` (configuración del
Function App). Además aplica límite de peticiones por IP y validación de entrada.

> Guía completa paso a paso (Azure Function lista para desplegar + Power Automate):
> **ver [IA_PROXY.md](IA_PROXY.md)**.

### Acceso directo (solo desarrollo local)

```env
VITE_AI_PROVIDER=deepseek
VITE_AI_API_URL=https://api.deepseek.com
VITE_AI_API_KEY=sk-....
VITE_AI_MODEL=deepseek-chat
```

> Nunca use el acceso directo en producción ni suba claves al repositorio.

## Prompt de sistema

El prompt de sistema vive en `src/services/planningPrompts.ts` (`MINERD_SYSTEM_PROMPT`). Está
parametrizado con los elementos del diseño curricular dominicano:

- **7 competencias fundamentales**: Ética y Ciudadana; Comunicativa; Pensamiento Lógico,
  Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica; Ambiental y de la
  Salud; Desarrollo Personal y Espiritual.
- **Competencias específicas** del área/asignatura.
- **Ejes transversales** (salud, ambiente, valores, convivencia, género, TIC, cultura).
- **Contenidos** conceptuales, procedimentales y actitudinales.
- **Actividades** de inicio, desarrollo y cierre.
- **Indicadores de logro** y **evaluación** (tipo, instrumento, criterios).

El modelo debe responder **solo JSON** con la estructura de `DailyPlan` (ver
`src/types/index.ts`). Puede editarse este prompt desde un único lugar sin tocar el resto del
código.

## Estructura de datos

La planificación se persiste en la lista de SharePoint **`ARC_DailyPlans`** (se aprovisiona
automáticamente como el resto de listas `ARC_*`). La asignación de grados/secciones del docente
se guarda en **`ARC_TeacherConfig`** (`src/modules/planificacion/GradosSeccionesPage.tsx`).

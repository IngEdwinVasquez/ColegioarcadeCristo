# SharePoint Online como base de datos

La aplicación lee y escribe en **listas de SharePoint** del sitio `IntranetArca` usando Microsoft Graph con la identidad del usuario conectado (permiso delegado `Sites.ReadWrite.All`).

## Aprovisionamiento automático

No es necesario crear las listas a mano. Al iniciar sesión, la app:

1. Resuelve el sitio (`VITE_SPO_SITE_PATH`, por defecto `/sites/IntranetArca`; el hostname se detecta desde `/sites/root`).
2. Lee las listas existentes y **crea las `ARC_*` que falten** con sus columnas.
3. Si una lista ya existía (p. ej. creada con PnP), **agrega las columnas que falten**.

El resultado se recuerda durante la sesión del navegador. Si un usuario no tiene permiso para crear listas, el paso se omite y la app sigue (las listas deben existir ya). Es recomendable que la **primera persona en iniciar sesión sea un administrador con permiso de edición** en el sitio.

## Esquema de cada lista

| Columna | Tipo | Uso |
| --- | --- | --- |
| `Title` | Texto | Título legible (tema, nombre, asunto…) |
| `app_id` | Texto, **indexada** | Identificador lógico del registro (el que usa la app; p. ej. `act-…`, `s-…`) |
| `json_payload` | Varias líneas de texto (sin formato) | Registro completo en JSON según `src/types/index.ts` |

> El `id` numérico de SharePoint **no** se usa como identificador de negocio: la app mantiene sus propios ids (`app_id`) para que las referencias entre listas (`subjectId`, `teacherId`, `studentId`…) sean estables. Internamente resuelve `app_id → id de SharePoint` con una caché y, si falta, con `$filter=fields/app_id eq '…'`.

## Listas

| Lista | Contenido |
| --- | --- |
| `ARC_Users` | Usuarios que han iniciado sesión y sus roles (oid de Entra ID como `id`) |
| `ARC_Students` | Matrícula de estudiantes |
| `ARC_Teachers` | Cuerpo docente (el correo vincula con la cuenta de Entra) |
| `ARC_Guardians` | Padres y tutores (el correo vincula con la cuenta de Entra) |
| `ARC_Subjects` | Asignaturas |
| `ARC_Grades` | Grados y secciones |
| `ARC_Periods` | Períodos escolares |
| `ARC_ClassPlans` | Planificación anual |
| `ARC_Classes` | Clases impartidas (antes / durante / después) |
| `ARC_Attendance` | Registros de asistencia |
| `ARC_Activities` | Actividades de aulas virtuales (con enlaces a OneDrive) |
| `ARC_Scores` | Calificaciones |
| `ARC_Meetings` | Encuentros virtuales (con `eventId` de Teams/Outlook) |
| `ARC_Enrollments` | Matrícula por curso y período |
| `ARC_TeacherAssignments` | Asignación de docentes |
| `ARC_DocumentTypes` | Documentos requeridos en admisión |
| `ARC_AdmissionDocs` | Documentos entregados por aspirantes |
| `ARC_AdmissionEvals` | Evaluaciones de admisión |
| `ARC_Admissions` | Solicitudes de admisión |
| `ARC_DocumentRequests` | Solicitudes de certificaciones y cartas |
| `ARC_PsychRequests` | Solicitudes a la Unidad Psicopedagógica |
| `ARC_Announcements` | Circulares y comunicados |
| `ARC_Messages` | Mensajería interna |
| `ARC_RoleMeta` | Nombres y descripciones personalizados de los roles |

## Aprovisionamiento manual (alternativa con PnP PowerShell)

Solo si prefiere crear las listas antes del primer inicio de sesión:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
Connect-PnPOnline -Url https://SU-TENANT.sharepoint.com/sites/IntranetArca -Interactive

$listas = @(
  "ARC_Users","ARC_Students","ARC_Teachers","ARC_Guardians","ARC_Subjects","ARC_Grades","ARC_Periods",
  "ARC_ClassPlans","ARC_Classes","ARC_Attendance","ARC_Activities","ARC_Scores","ARC_Meetings",
  "ARC_Enrollments","ARC_TeacherAssignments","ARC_DocumentTypes","ARC_AdmissionDocs","ARC_AdmissionEvals",
  "ARC_Admissions","ARC_DocumentRequests","ARC_PsychRequests","ARC_Announcements","ARC_Messages","ARC_RoleMeta"
)

foreach ($nombre in $listas) {
  if (-not (Get-PnPList -Identity $nombre -ErrorAction SilentlyContinue)) {
    New-PnPList -Title $nombre -Template GenericList -Url "Lists/$nombre" | Out-Null
  }
  if (-not (Get-PnPField -List $nombre -Identity "app_id" -ErrorAction SilentlyContinue)) {
    Add-PnPField -List $nombre -DisplayName "app_id" -InternalName "app_id" -Type Text -AddToDefaultView | Out-Null
    Set-PnPField -List $nombre -Identity "app_id" -Values @{ Indexed = $true }
  }
  if (-not (Get-PnPField -List $nombre -Identity "json_payload" -ErrorAction SilentlyContinue)) {
    Add-PnPField -List $nombre -DisplayName "json_payload" -InternalName "json_payload" -Type Note | Out-Null
  }
}
```

## Permisos

- Usuarios que deben **escribir** (docentes, dirección, familias que envían solicitudes): **Miembros** del sitio (Editar).
- Usuarios que solo **consultan**: **Visitantes** (Leer) es suficiente para ver, pero la mensajería y las solicitudes requieren edición.

## Power Automate

Los flujos pueden desencadenarse con *"Cuando se crea un elemento"* sobre cualquier lista `ARC_*` y leer el JSON de `json_payload` con la acción **Analizar JSON** (ver [POWERAUTOMATE.md](POWERAUTOMATE.md)).

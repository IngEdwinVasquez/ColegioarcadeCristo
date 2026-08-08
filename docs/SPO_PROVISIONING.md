# SharePoint Online como base de datos

La aplicación lee y escribe en **listas de SharePoint** del sitio `IntranetArca` usando Microsoft Graph. Cada lista guarda cada registro serializado en una columna de texto grande `json_payload` (además de `Title` para facilitar la administración en SharePoint). Esto permite un modelo de datos flexible sin columnas adicionales por campo.

## Listas requeridas

| Lista | Descripción |
| --- | --- |
| `ARC_Users` | Usuarios de demostración / mapeo de roles |
| `ARC_Students` | Matrícula de estudiantes |
| `ARC_Teachers` | Cuerpo docente |
| `ARC_Subjects` | Asignaturas |
| `ARC_Grades` | Grados y secciones (cursos) |
| `ARC_Periods` | Períodos escolares (años lectivos, trimestres) |
| `ARC_ClassPlans` | Planificación anual (cronograma de clases) |
| `ARC_Classes` | Clases impartidas (antes / durante / después) |
| `ARC_Attendance` | Registros de asistencia por clase |
| `ARC_Activities` | Actividades de las aulas virtuales |
| `ARC_Scores` | Calificaciones por actividad y estudiante |
| `ARC_Meetings` | Encuentros virtuales, actas y acuerdos |
| `ARC_Enrollments` | Matrícula de estudiantes a cursos y períodos |
| `ARC_TeacherAssignments` | Asignación de docentes a asignaturas, cursos y períodos |

> Los nombres internos de lista no deben contener espacios ni caracteres especiales.

## Columnas de cada lista

Todas las listas requieren al menos:

| Columna | Tipo | Notas |
| --- | --- | --- |
| `Title` | Línea de texto | Título del elemento (tema, actividad, reunión…) |
| `json_payload` | Varias líneas de texto | Registro completo del elemento en JSON (lo usa la app) |

## Aprovisionamiento con PowerShell (PnP PowerShell)

Instale los módulos y ejecute:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser

Connect-PnPOnline -Url https://SU-TENANT.sharepoint.com/sites/IntranetArca -Interactive
```

```powershell
$listas = @("ARC_Users","ARC_Students","ARC_Teachers","ARC_Subjects","ARC_Grades","ARC_Periods",
            "ARC_ClassPlans","ARC_Classes","ARC_Attendance",
            "ARC_Activities","ARC_Scores","ARC_Meetings",
            "ARC_Enrollments","ARC_TeacherAssignments")

foreach ($nombre in $listas) {
    New-PnPList -Title $nombre -Template GenericList -Url $nombre

    # Columna de carga útil JSON
    Add-PnPField -List $nombre -DisplayName "json_payload" -InternalName "json_payload" `
        -Type Note -AddToDefaultView

    $lista = Get-PnPList -Identity $nombre
    $lista.Hidden = $false
    $lista.Update()
    Invoke-PnPQuery
}
```

> **Alternativa con el explorador de SharePoint:** cree cada lista manualmente desde *Configuración → Agregar una lista* y agregue la columna `json_payload` (Varias líneas de texto) a cada una.

## Permisos de la aplicación

Para que la app (SPA) acceda a las listas con el usuario autenticado, basta con el permiso delegado `Sites.ReadWrite.All` (ver [M365_SETUP.md](M365_SETUP.md)). El usuario conectado debe tener acceso al sitio `IntranetArca` (por ejemplo, mediante el grupo *Miembros del sitio*).

## Resolución del sitio

La app resuelve el sitio de dos maneras:

1. Si define `VITE_SPO_SITE_ID`, lo usa directamente.
2. En caso contrario, resuelve `https://graph.microsoft.com/v1.0/sites/{hostname}:/{ruta}` con `VITE_SPO_HOSTNAME` y `VITE_SPO_SITE_PATH`.

## Estructura del `json_payload`

Cada registro sigue el modelo de `src/types/index.ts`. Ejemplo de un elemento de `ARC_Classes`:

```json
{
  "planId": "plan-g-6toA-subj-inf-2026-08-07",
  "subjectId": "subj-inf",
  "teacherId": "t1",
  "gradeId": "g-6toA",
  "date": "2026-08-07",
  "period": "9:15 - 10:00",
  "title": "Informática · Seguridad en internet",
  "status": "completada",
  "before": { "objectives": "...", "content": "...", "activities": "...", "resources": "...", "cronograma": "..." },
  "during": { "development": "...", "participation": "...", "observations": "..." },
  "after": { "reflection": "...", "achieved": "...", "toImprove": "...", "report": "..." }
}
```

El campo `id` de la lista se usa como identificador del registro.

# Power Automate — correo institucional y automatizaciones

La intranet delega el **envío de correos** a un flujo de Power Automate para que salgan desde el buzón institucional (y no desde el buzón personal de quien publica). Si el flujo no está configurado, la app envía con Microsoft Graph (`Mail.Send`) desde la cuenta del usuario conectado.

## 1. Flujo principal: "Intranet — Enviar correo" (desencadenador HTTP)

1. [make.powerautomate.com](https://make.powerautomate.com) → **Crear** → **Flujo de nube instantáneo** → desencadenador **Cuando se recibe una solicitud HTTP**.
2. En *Esquema JSON del cuerpo de la solicitud* pegue:

```json
{
  "type": "object",
  "properties": {
    "app": { "type": "string" },
    "category": { "type": "string" },
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "important": { "type": "boolean" },
    "to": { "type": "array", "items": { "type": "string" } },
    "cc": { "type": "array", "items": { "type": "string" } },
    "metadata": { "type": "object" },
    "sentAt": { "type": "string" }
  },
  "required": ["subject", "body", "to"]
}
```

3. Acción **Unir** (Data Operations): *Desde* = `to`, *Unir con* = `;` → produce la lista de destinatarios.
4. Acción **Enviar un correo electrónico (V2)** (Office 365 Outlook):
   - **Para:** salida de *Unir*.
   - **CC:** (opcional) otra acción *Unir* sobre `cc`.
   - **Asunto:** `subject`.
   - **Cuerpo:** `body` (ya viene en HTML; en opciones avanzadas deje *Es HTML = Sí*).
   - **Importancia:** expresión `if(triggerBody()?['important'], 'High', 'Normal')`.
   - **Enviar desde:** la cuenta institucional (p. ej. `comunicaciones@arcadecristo.edu.do`); la cuenta del flujo debe tener permiso *Enviar como* sobre ese buzón.
5. (Opcional) Acción **Crear elemento** en una lista `ARC_MailLog` para auditoría.
6. Acción **Respuesta** con código `202`.
7. Guarde. Copie la **URL HTTP POST** que genera el desencadenador y colóquela en:
   - `.env.production` → `VITE_POWER_AUTOMATE_MAIL_URL=https://prod-xx.westus.logic.azure.com:443/workflows/...`
   - o en GitHub → *Settings → Secrets and variables → Actions → Variables* → `VITE_POWER_AUTOMATE_MAIL_URL`.

> La URL del desencadenador incluye una firma (`sig=`). Cualquiera que la conozca puede invocar el flujo; es aceptable para una intranet interna, pero si se filtra regenérela (*Desencadenador → … → Regenerar*).

### Eventos que envía la app

| `category` | Cuándo | Destinatarios |
| --- | --- | --- |
| `comunicado` | Al publicar una circular con "Enviar por correo" marcado | Tutores, correos de contacto de estudiantes y docentes |
| `admision` | Al aprobar o rechazar una solicitud de admisión | Contacto de la solicitud (si es un correo) |

`metadata` incluye ids útiles (`announcementId`, `admissionId`, `resultado`) por si desea enrutar o registrar.

## 2. Flujo: "Alerta de asistencia" (SharePoint)

**Desencadenador:** *SharePoint — Cuando se crea un elemento* → sitio `IntranetArca`, lista `ARC_Attendance`.

1. **Analizar JSON** sobre `json_payload` con el esquema:
   ```json
   { "type": "object", "properties": {
       "date": { "type": "string" }, "subjectId": { "type": "string" }, "gradeId": { "type": "string" },
       "entries": { "type": "array", "items": { "type": "object", "properties": {
           "studentId": { "type": "string" }, "status": { "type": "string" }, "note": { "type": "string" } } } } } }
   ```
2. **Filtrar matriz** `entries` donde `status` = `ausente`.
3. **Obtener elementos** de `ARC_Students` con filtro OData `app_id eq '<studentId>'` → *Analizar JSON* de su `json_payload` para obtener `fullName` y `parentEmail`.
4. **Enviar un correo (V2)** al tutor con la inasistencia del día.

## 3. Flujo: "Recordatorio de clases del día"

**Desencadenador:** *Periodicidad* (diario 6:00, zona horaria *SA Western Standard Time*).

1. **Obtener elementos** de `ARC_ClassPlans` (todos) → *Analizar JSON* de cada `json_payload`.
2. Filtrar `date` = `formatDateTime(utcNow(), 'yyyy-MM-dd')` y `status` = `planificada`.
3. Agrupar por `teacherId`, resolver correo en `ARC_Teachers` y enviar el cronograma del día.

## 4. Flujo: "Resumen semanal para Dirección"

**Desencadenador:** *Periodicidad* (lunes 8:00). Lee `ARC_Classes`, `ARC_Attendance` y `ARC_Scores` de la semana anterior y envía un resumen a `direccion@arcadecristo.edu.do`. Combine con un informe de **Power BI** conectado a las listas para el panel directivo.

## 5. Microsoft Teams

- Los **Encuentros Virtuales** crean la reunión de Teams directamente desde la app (Graph `/me/events` con `isOnlineMeeting`), envían las invitaciones de calendario a los participantes y guardan el enlace *Unirse*.
- Opcionalmente cree un flujo *"Cuando se crea un elemento"* sobre `ARC_Announcements` que publique la circular en un canal de Teams (*Publicar mensaje en un chat o canal*).

## 6. OneDrive

El material de las aulas virtuales se sube a OneDrive del docente (`/ArcaDeCristo/AulasVirtuales/<grado>/<asignatura>/`) y se comparte con un **enlace de solo lectura para la organización**, que queda guardado en la actividad.

## 7. Copilot

- **Microsoft 365 Copilot Chat** está enlazado en la sección *Copilot* de cada portal.
- Para un agente propio del colegio: cree el agente en **Copilot Studio**, publíquelo en el canal *Sitio web personalizado* y pegue la URL de inserción en `VITE_COPILOT_EMBED_URL`. El agente puede conectarse a las listas `ARC_*` como origen de conocimiento (conector SharePoint).

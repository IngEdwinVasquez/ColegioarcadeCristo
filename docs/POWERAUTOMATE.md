# Automatización con Microsoft 365 (Power Automate, Correo, Notificaciones)

Además de la aplicación, el ecosistema Microsoft 365 permite automatizar tareas. Estas son las integraciones recomendadas.

## 1. Notificaciones por correo (Outlook / Graph)

La app puede enviar correos institucionales con el permiso `Mail.Send` (servicio `src/services/mail.ts`).

**Ejemplo de uso en el código:**

```ts
import { sendMail } from './services/mail'

await sendMail({
  to: [{ email: 'familia@correo.com', name: 'Familia' }],
  subject: 'Circular #12 — Evaluaciones del período',
  body: '<p>Estimada familia, les informamos…</p>',
  important: true,
})
```

Casos sugeridos:
- Aviso a las familias cuando el estudiante registra ausencias.
- Notificación al docente cuando se publica una actividad.
- Recordatorio de reuniones y encuentros virtuales.

## 2. Power Automate — flujo recomendado: "Alerta de asistencia"

**Desencadenador:** *Cuando se crea un elemento* (lista `ARC_Attendance`).

**Acciones:**

1. **Obtener elemento** de `ARC_Attendance`.
2. **Analizar JSON** con el esquema de `entries`.
3. **Filtrar** entradas con `status = ausente`.
4. Para cada ausente:
   - **Buscar estudiante** en `ARC_Students`.
   - **Enviar un correo** al padre/tutor (`parentEmail`) desde la cuenta del centro.

Resultado: los padres reciben notificación automática de inasistencias.

## 3. Power Automate — "Recordatorio de clases del día"

**Desencadenador:** *Recurrence* (diario a las 6:00).

**Acciones:**

1. **Obtener elementos** de `ARC_ClassPlans` filtrados por `date = utcNow('yyyy-MM-dd')` y `status = planificada`.
2. **Enviar correo** a cada docente con el cronograma del día (asignatura, grado, tema, periodo).

## 4. Power Automate — "Resumen semanal para Dirección"

**Desencadenador:** *Recurrence* (lunes 8:00).

**Acciones:**

1. Obtener las listas `ARC_Classes`, `ARC_Attendance`, `ARC_Scores` de la semana anterior.
2. Construir y enviar un **correo con resumen** (clases impartidas vs. planificadas, % de asistencia, promedio académico) a `direccion@arcadecristo.edu.do`.

> Consejo: combine estos datos con un **informe de Power BI** conectado a las listas para el panel directivo.

## 5. Teams / Aulas virtuales

- **Teams por grado y asignatura:** cree equipos con canales por asignatura; la sección *Aulas Virtuales* de la app puede guardar el `channelId` de la actividad para publicar enlaces.
- **Programación de reuniones:** la app puede crear eventos de calendario con Graph (`Calendars.ReadWrite`) para los **Encuentros Virtuales** y enviar invitaciones a los participantes.

## 6. OneDrive como repositorio de documentos

- Adjuntos de actividades, guías y actas se suben a carpetas de OneDrive del docente (`src/services/onedrive.ts`).
- Los enlaces (`webUrl`) se guardan como `DriveFileRef` en las listas.

**Ejemplo:**

```ts
import { uploadFile } from './services/onedrive'
const ref = await uploadFile('AulasVirtuales/6toA/Matematicas', 'actividad-01.pdf', archivo)
```

## 7. SharePoint conector para Power Automate

Utilice los conectores **"SharePoint - Cuando se crea/modifica un elemento"** apuntando a las listas `ARC_*`. Asegúrese de que la cuenta del flujo tenga acceso de escritura al sitio `IntranetArca`.

---

**Nota:** los flujos de Power Automate deben crearse desde el centro de administración de Power Platform (make.powerautomate.com). El correo de envío debe ser una cuenta del dominio institucional (o una cuenta de servicio con buzón).

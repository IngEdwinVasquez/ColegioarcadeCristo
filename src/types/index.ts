import type { Role } from './roles'

/**
 * Usuario del sistema. El `id` es el identificador de objeto (oid) de Microsoft Entra ID.
 * Los roles se administran en la lista ARC_Users (módulo "Usuarios y roles").
 */
export interface User {
  id: string
  displayName: string
  email: string
  roles: Role[]
  photoUrl?: string
  teacherId?: string
  studentId?: string
  jobTitle?: string
  updatedAt?: string
}

export interface GradeSection {
  id: string
  name: string
  level: string
  /** Nivel: Inicial | Primaria | Secundaria */
  nivel?: string
  /** Ciclo (solo Primaria/Secundaria): Primer ciclo | Segundo ciclo */
  ciclo?: string
  /** Seccion (A, B, ...) si se administra por separado */
  section?: string
  /** Nombre de la asignatura (sin el grado) del curso */
  asignatura?: string
  /** Equipo de Microsoft Teams vinculado al curso */
  teamId?: string
  teamUrl?: string
  /** Docente encargado (titular) del curso */
  leadTeacherId?: string
}

export interface Subject {
  id: string
  name: string
  shortName: string
  color?: string
  icon?: string
}

export interface Teacher {
  id: string
  fullName: string
  email: string
  /** Id. de objeto (oid) de la cuenta de Entra ID vinculada (obligatorio) */
  userId?: string
  subjects: string[]
  grades: string[]
}

export interface Student {
  id: string
  fullName: string
  /** Correo institucional del estudiante (de su cuenta de Entra ID) */
  email?: string
  /** Id. de objeto (oid) de la cuenta de Entra ID vinculada (obligatorio) */
  userId?: string
  gradeId: string
  section?: string
  parentId?: string
  parentName?: string
  parentEmail?: string
  birthDate?: string
}

export type ClassPlanStatus = 'planificada' | 'pendiente' | 'impartida' | 'cancelada'

export interface ClassPlan {
  id: string
  subjectId: string
  teacherId: string
  gradeId: string
  date: string
  period: string
  topic: string
  objective: string
  content: string
  strategy: string
  resources: string
  evaluation: string
  status: ClassPlanStatus
  classId?: string
}

export type ClassPhaseStatus = 'programada' | 'en_progreso' | 'completada' | 'cancelada'

// ------------------------------ Planificación (MINERD) ------------------------------

export type PlanTipo = 'diaria' | 'unidad'

export interface PlanContenidos {
  conceptuales: string
  procedimentales: string
  actitudinales: string
}

export interface PlanActividades {
  inicio: string
  desarrollo: string
  cierre: string
}

export interface PlanEvaluacion {
  tipo: string
  instrumento: string
  criterios: string
}

// ------------------------------ Estructura Unidad de Aprendizaje (Eduplan / MINERD) ------------------------------

export interface SecuenciaCurricular {
  /** Área/asignatura (ej. Ciencias de la Naturaleza) */
  area: string
  /** Código de la secuencia curricular (ej. SC 12) */
  codigo: string
  /** Título de la secuencia */
  titulo: string
}

export interface ActividadDidactica {
  titulo: string
  fase: 'inicio' | 'desarrollo' | 'cierre'
  descripcion: string
  /** Orientaciones para el docente */
  orientaciones: string
  /** Duración (ej. 00:45) */
  duracion: string
  /** Estrategias/técnicas aplicadas */
  estrategias: string[]
}

export interface ApoyoDiferencial {
  /** "Si observas…" */
  observacion: string
  /** "Trata de…" */
  tratamiento: string
}

export interface Anexo {
  titulo: string
  contenido: string
}

/**
 * Planificación académica (diaria o de unidad) con la estructura del diseño
 * curricular del MINERD (República Dominicana): competencias, ejes
 * transversales, contenidos, actividades e indicadores de logro.
 */
export interface DailyPlan {
  id: string
  teacherId: string
  subjectId: string
  gradeId: string
  section: string
  tipo: PlanTipo
  nivel: string
  unidad: string
  tema: string
  fecha: string
  duracion: string
  competenciasFundamentales: string[]
  competenciasEspecificas: string[]
  ejesTransversales: string[]
  contenidos: PlanContenidos
  actividades: PlanActividades
  estrategias: string[]
  recursos: string[]
  indicadoresLogro: string[]
  evaluacion: PlanEvaluacion
  generadoPorIA: boolean
  createdAt: string
  updatedAt?: string
  // --- Estructura "Unidad de Aprendizaje" (Eduplan / MINERD) ---
  /** Secuencias curriculares con las que se conecta la unidad */
  secuenciasCurriculares?: SecuenciaCurricular[]
  /** Apartado "Recuerda" (saberes previos) */
  recuerda?: string
  /** Situación de aprendizaje (contexto que motiva la unidad) */
  situacionAprendizaje?: string
  /** Materiales necesarios para las actividades */
  materiales?: string[]
  /** Recursos didácticos digitales (enlaces) */
  recursosDigitales?: string[]
  /** Secuencia didáctica desglosada por actividad */
  actividadesDetalle?: ActividadDidactica[]
  /** Apoyo diferenciado: "Si observas…, trata de…" */
  apoyos?: ApoyoDiferencial[]
  /** Anexos */
  anexos?: Anexo[]
}

/**
 * Configuración de grados y secciones del docente: la matriz grados × secciones
 * que imparte y el modo máster (sin restricción de grados, para coordinadores).
 */
export interface TeacherGradeConfig {
  id: string
  teacherId: string
  /** Matriz grados × secciones: combinaciones (curso + sección) que imparte el docente. */
  selection: Array<{ gradeId: string; section: string }>
  /** Modo máster: ignora las restricciones de grados/secciones */
  masterMode: boolean
  updatedAt?: string
}

export interface ClassPlanSection {
  objectives: string
  content: string
  activities: string
  resources: string
  cronograma: string
}

export interface ClassDuringSection {
  development: string
  participation: string
  observations: string
}

export interface ClassAfterSection {
  reflection: string
  achieved: string
  toImprove: string
  report: string
}

export interface SchoolClassRecord {
  id: string
  planId: string
  subjectId: string
  teacherId: string
  gradeId: string
  date: string
  period: string
  title: string
  status: ClassPhaseStatus
  before: ClassPlanSection
  during: ClassDuringSection
  after: ClassAfterSection
  attendanceId?: string
  /** Unidad de Aprendizaje (DailyPlan) de referencia */
  unidadId?: string
  /** Lista de estudiantes inscritos en esta clase */
  roster?: string[]
  createdAt: string
}

export type AttendanceStatus = 'presente' | 'ausente' | 'tarde' | 'justificado'

export interface AttendanceEntry {
  studentId: string
  status: AttendanceStatus
  note?: string
}

export interface AttendanceRecord {
  id: string
  classId: string
  subjectId: string
  gradeId: string
  date: string
  period: string
  entries: AttendanceEntry[]
  takenBy: string
  takenAt: string
}

export type ActivityType = 'tarea' | 'quiz' | 'proyecto' | 'evaluacion' | 'lectura' | 'foro'

export type ActivityStatus = 'borrador' | 'publicada' | 'cerrada'

export interface AttachmentRef {
  id: string
  name: string
  webUrl: string
  size?: number
}

export interface Activity {
  id: string
  subjectId: string
  teacherId: string
  gradeId: string
  title: string
  description: string
  type: ActivityType
  points: number
  publishDate: string
  dueDate: string
  status: ActivityStatus
  /** Enlaces a documentos en OneDrive (URL compartida) */
  attachments: string[]
  attachmentRefs?: AttachmentRef[]
  channelId?: string
}

export interface Grade {
  id: string
  activityId: string
  studentId: string
  score: number
  comment?: string
  gradedBy: string
  gradedAt: string
}

export type MeetingType = 'consejo' | 'junta' | 'reunion_padres' | 'capacitacion' | 'coordinacion' | 'otros'

export type MeetingStatus = 'programado' | 'realizado' | 'cancelado'

export interface MeetingAgreement {
  id: string
  description: string
  ownerId?: string
  dueDate?: string
  status: 'pendiente' | 'en_progreso' | 'completado'
}

export interface MeetingRecord {
  agenda: string
  minutes: string
  agreements: MeetingAgreement[]
  attendees: string[]
}

export interface VirtualMeeting {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  organizerId: string
  attendees: string[]
  type: MeetingType
  platform: string
  link?: string
  /** Id. del evento de Outlook/Teams creado con Microsoft Graph */
  eventId?: string
  status: MeetingStatus
  record?: MeetingRecord
  createdAt: string
}

export interface PortalDefinition {
  id: string
  title: string
  description: string
  icon: string
  path: string
}

export interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

export interface Enrollment {
  id: string
  studentId: string
  gradeId: string
  subjectId?: string
  periodId: string
}

export interface TeacherAssignment {
  id: string
  teacherId: string
  gradeId: string
  subjectId: string
  periodId: string
}

export interface AdmissionRequest {
  id: string
  estudiante: string
  grado: string
  contacto: string
  fecha: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  observacion?: string
}

export interface RoleDefinition {
  code: string
  label: string
  description: string
  portal: string
}

export type Parentesco = 'padre' | 'madre' | 'tutor' | 'otro'

export interface StudentGuardian {
  id: string
  studentId: string
  fullName: string
  email: string
  /** Id. de objeto (oid) de la cuenta de Entra ID vinculada (obligatorio) */
  userId?: string
  phone?: string
  parentesco: Parentesco
}

export interface DocumentType {
  id: string
  name: string
  description: string
  required: boolean
  order: number
}

export interface AdmissionDocument {
  id: string
  admissionId: string
  documentTypeId: string
  fileName: string
  fileUrl?: string
  uploadedAt: string
  status: 'pendiente' | 'entregado' | 'aprobado' | 'rechazado'
  comentario?: string
}

export interface AdmissionEvaluation {
  id: string
  admissionId: string
  evaluador: string
  fecha: string
  puntuacion: number
  observaciones: string
  resultado: 'aprobado' | 'pendiente' | 'rechazado'
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  senderRole: string
  receiverId: string
  receiverName: string
  content: string
  timestamp: string
  read: boolean
}

export interface Announcement {
  id: string
  titulo: string
  contenido: string
  fecha: string
  autorId?: string
  autorNombre?: string
  /** Si se envió notificación por correo a las familias */
  notificado?: boolean
}

export interface DocumentRequest {
  id: string
  tipo: string
  estudiante: string
  detalle: string
  fecha: string
  solicitante?: string
  estado: 'pendiente' | 'en_proceso' | 'entregado'
}

export interface PsychRequest {
  id: string
  tipo: string
  studentId: string
  detalle: string
  fecha: string
  solicitante?: string
  estado: 'pendiente' | 'en_atencion' | 'cerrado'
}

/**
 * Metadatos de un rol. Los seis roles del sistema (docente, estudiante, padre,
 * admin, psicologia, tecnologia) son fijos; ademas pueden crearse roles
 * personalizados (custom) que dan acceso al portal indicado en `portal`.
 */
export interface RoleMeta {
  id: string
  label?: string
  description?: string
  /** Portal al que da acceso un rol personalizado */
  portal?: string
  custom?: boolean
}

// ------------------------------ Gestion TIC (RM-009) ------------------------------

export type TicScope = 'anual' | 'mensual' | 'semanal'
export type TicStage = 'inicio' | 'desarrollo' | 'finalizacion'
export type TicStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
export type TicCategory = 'infraestructura' | 'soporte' | 'capacitacion' | 'innovacion' | 'plataforma' | 'otros'

export interface TicLogEntry {
  id: string
  date: string
  note: string
  author?: string
}

export interface TicEvidence {
  id: string
  name: string
  webUrl: string
  type: 'foto' | 'documento' | 'otro'
  uploadedAt: string
}

/** Actividad del plan de trabajo del Coordinador TIC */
export interface TicActivity {
  id: string
  title: string
  description: string
  scope: TicScope
  /** Categoría (nombre de la categoría TIC, ahora dinámica) */
  category: string
  startDate: string
  endDate: string
  stage: TicStage
  status: TicStatus
  /** % de avance 0-100 */
  progress: number
  responsible?: string
  /** Temas de planificación por mes (planificación anual): Agosto..Junio. */
  monthlyTopics?: Record<string, string>
  evidences: TicEvidence[]
  log: TicLogEntry[]
  createdAt: string
  updatedAt?: string
}

/** Categoría TIC dinámica (catálogo). */
export interface TicCategoryItem {
  id: string
  name: string
}

// ------------------------------ Planificador Dinámico (IA) ------------------------------

export type PlanAlcance = 'anual' | 'mensual' | 'semanal' | 'actividad'
export type PlanEstado = 'borrador' | 'activa' | 'archivada'
export type PlanMomentoNombre = 'inicio' | 'desarrollo' | 'cierre'

/** Momento pedagógico de una planificación (Inicio / Desarrollo / Cierre). */
export interface PlanMomento {
  momento: PlanMomentoNombre
  /** Duración del momento, ej. "15 min". */
  duracion: string
  descripcion: string
  actividades: string[]
}

/**
 * Planificación generada/asistida por IA. Soporta alcance anual, mensual,
 * semanal o por actividad, con los campos pedagógicos MINERD.
 */
export interface PlanificacionDinamica {
  id: string
  teacherId: string
  alcance: PlanAlcance
  estado: PlanEstado
  nivel?: string
  gradeId: string
  subjectId: string
  tema: string
  objetivo?: string
  duracion?: string
  competencias: string[]
  indicadores: string[]
  momentos: PlanMomento[]
  recursos: string[]
  herramientasTec: string[]
  evaluacion?: string
  generadoPorIA: boolean
  createdAt: string
  updatedAt?: string
}

/** Tema/actividad de un mes dentro de la planificación anual consolidada. */
export interface AnnualPlanMonthItem {
  mes: string
  tema: string
  actividades?: string
}

/** Documento "Planificación Anual" generado con IA a partir de las planificaciones anuales. */
export interface AnnualPlanDocument {
  titulo: string
  presentacion: string
  objetivoGeneral: string
  meses: AnnualPlanMonthItem[]
  evaluacion: string
  conclusion: string
  generadoPor?: string
  createdAt: string
}

/** Horario de trabajo semanal (filas de hora × Lunes-Viernes), generado desde un PDF. */
export interface WeeklySchedule {
  id: string
  title: string
  /** Filas: cada una con rango de hora y 5 celdas (Lunes, Martes, Miércoles, Jueves, Viernes) */
  rows: Array<{ time: string; cells: string[] }>
  createdAt: string
}

// ------------------------------ Coordinación Pedagógica ------------------------------

export type CoordinationLevel = 'Inicial' | 'Primaria' | 'Secundaria'

/** Horario de clase de un docente dentro de su nivel (curso, sección y asignatura). */
export interface ClassSchedule {
  id: string
  teacherId: string
  gradeId: string
  section: string
  subjectId: string
  /** Día de la semana (Lunes, martes…) */
  day: string
  /** Hora de inicio (HH:mm) */
  startTime: string
  /** Hora de fin (HH:mm) */
  endTime: string
  createdAt: string
}

export type AccompanimentPhase = 'planificacion' | 'ejecucion' | 'evaluacion'
export type AccompanimentStatus = 'planificado' | 'realizado' | 'seguimiento'

/**
 * Acompañamiento del coordinador a un docente, tomando como base la planificación
 * y/o la clase que el docente crea e imparte. Registra observaciones, fortalezas,
 * mejoras y compromisos de seguimiento.
 */
export interface Accompaniment {
  id: string
  coordinatorId: string
  teacherId: string
  level: CoordinationLevel
  /** Planificación de referencia (ClassPlan o DailyPlan) */
  relatedPlanId?: string
  /** Clase impartida de referencia (SchoolClassRecord) */
  relatedClassId?: string
  date: string
  topic: string
  phase: AccompanimentPhase
  observations: string
  strengths: string
  improvements: string
  recommendations: string
  /** Compromiso acordado con el docente */
  agreedFollowUp?: string
  followUpDate?: string
  status: AccompanimentStatus
  createdAt: string
}

// ------------------------------ Cronograma de trabajo (Gestión TIC) ------------------------------

/** Momento del plan de una actividad (con duración y detalle). */
export interface PlanPhase {
  /** Duración del momento, ej. "10 min". */
  duracion: string
  detalle: string
}

/** Evidencia (imagen/documento) anexa al informe de una actividad. */
export interface PlanEvidence {
  id: string
  name: string
  webUrl: string
  type: 'foto' | 'documento' | 'otro'
  uploadedAt: string
}

/**
 * Informe de ejecución de una actividad: cómo se desarrolló el plan una vez
 * impartida, más los anexos con imágenes/evidencias.
 */
export interface ActivityReport {
  fecha: string
  desarrollo: string
  logros?: string
  dificultades?: string
  recomendaciones?: string
  evidencias: PlanEvidence[]
  responsable?: string
  createdAt: string
  updatedAt?: string
}

/**
 * Plan de una actividad del cronograma generado con IA. Se compone de tres
 * momentos (inicio, desarrollo, cierre) con su duración y detalle.
 */
export interface ActivityPlan {
  id: string
  /** Persona que solicitó / llenó el formulario */
  solicitante: string
  rolSolicitante?: string
  objetivo: string
  contenidos: string
  audiencia: string
  estrategia: string
  recursos: string
  evaluacion: string
  inicio: PlanPhase
  desarrollo: PlanPhase
  cierre: PlanPhase
  /** Nombres de quienes firman el plan */
  firmantes?: {
    acompanado?: string
    ofrece?: string
    directivo?: string
  }
  /** Informe de ejecución (una vez impartida la actividad) */
  informe?: ActivityReport
  generadoPor?: string
  createdAt: string
}

/**
 * Fila del cronograma mensual: una actividad (acompañamiento / capacitación)
 * del horario semanal, conservando el día y la hora planificada.
 */
export interface WorkPlanEntry {
  id: string
  /** Día de la semana (Lunes, Martes…) */
  day: string
  /** Hora planificada en el horario (columna HOR) */
  time: string
  /** Texto de la actividad (inicia con «Acompañamiento» o «Capacitación») */
  activity: string
  responsable?: string
  /** Plan de la actividad generado con IA */
  plan?: ActivityPlan
}

/**
 * Cronograma de trabajo mensual del Coordinador TIC. Se construye a partir de
 * las actividades del horario semanal que inician con «acompañamiento» o
 * «capacitación» y se agrupa por mes dentro de un período educativo.
 */
export interface WorkCronograma {
  id: string
  /** Período educativo al que pertenece (ARC_Periods) */
  periodId: string
  periodName: string
  /** Mes en formato YYYY-MM */
  month: string
  /** Etiqueta legible del mes, ej. «Septiembre 2026» */
  monthLabel: string
  title: string
  responsable?: string
  observations?: string
  entries: WorkPlanEntry[]
  createdAt: string
  updatedAt?: string
}

// ------------------------------ Personas (Coordinación / TIC / Staff) ------------------------------

export type PersonaTipo = 'coordinador' | 'tic' | 'director' | 'administrador' | 'siger' | 'apoyo' | 'psicologia'

/**
 * Registro de una persona de staff de coordinación (pedagógica), tecnología (TIC),
 * dirección, administración, SIGER o personal de apoyo. El tipo determina el rol
 * de Entra ID vinculado.
 */
export interface Persona {
  id: string
  fullName: string
  email: string
  userId?: string
  tipo: PersonaTipo
  createdAt: string
}

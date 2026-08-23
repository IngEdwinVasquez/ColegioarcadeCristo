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

export interface RoleMeta {
  id: string
  label?: string
  description?: string
}

import type {
  Accompaniment,
  Activity,
  AdmissionDocument,
  AdmissionEvaluation,
  AdmissionRequest,
  Announcement,
  AttendanceRecord,
  ChatMessage,
  ClassPlan,
  ClassSchedule,
  DailyPlan,
  DocumentRequest,
  DocumentType,
  Enrollment,
  Grade,
  GradeSection,
  Period,
  Persona,
  PsychRequest,
  RoleMeta,
  TicActivity,
  TicCategoryItem,
  WeeklySchedule,
  WorkCronograma,
  PlanificacionDinamica,
  SchoolClassRecord,
  Student,
  StudentGuardian,
  Subject,
  Teacher,
  TeacherAssignment,
  TeacherGradeConfig,
  User,
  VirtualMeeting,
} from '../types'
import { SPO_LISTS, deleteItem, getItems, upsertItem, type StoredRecord } from './sharepoint'

/**
 * Acceso a datos de la intranet. Toda la persistencia vive en listas de
 * SharePoint Online (Microsoft Graph) — ver docs/SPO_PROVISIONING.md.
 */
export interface Collection<T extends { id: string }> {
  list: string
  getAll(): Promise<T[]>
  save(item: T): Promise<void>
  remove(id: string): Promise<void>
}

function collection<T extends { id: string }>(list: string): Collection<T> {
  return {
    list,
    getAll: () => getItems<T & StoredRecord>(list) as Promise<T[]>,
    save: async (item) => {
      await upsertItem(list, item as T & StoredRecord)
    },
    remove: (id) => deleteItem(list, id),
  }
}

export const collections = {
  users: collection<User>(SPO_LISTS.users),
  students: collection<Student>(SPO_LISTS.students),
  teachers: collection<Teacher>(SPO_LISTS.teachers),
  subjects: collection<Subject>(SPO_LISTS.subjects),
  grades: collection<GradeSection>(SPO_LISTS.grades),
  periods: collection<Period>(SPO_LISTS.periods),
  classPlans: collection<ClassPlan>(SPO_LISTS.classPlans),
  dailyPlans: collection<DailyPlan>(SPO_LISTS.dailyPlans),
  teacherConfig: collection<TeacherGradeConfig>(SPO_LISTS.teacherConfig),
  schedules: collection<ClassSchedule>(SPO_LISTS.schedules),
  accompaniments: collection<Accompaniment>(SPO_LISTS.accompaniments),
  personas: collection<Persona>(SPO_LISTS.personas),
  classes: collection<SchoolClassRecord>(SPO_LISTS.classes),
  attendance: collection<AttendanceRecord>(SPO_LISTS.attendance),
  activities: collection<Activity>(SPO_LISTS.activities),
  scores: collection<Grade>(SPO_LISTS.scores),
  meetings: collection<VirtualMeeting>(SPO_LISTS.meetings),
  enrollments: collection<Enrollment>(SPO_LISTS.enrollments),
  teacherAssignments: collection<TeacherAssignment>(SPO_LISTS.teacherAssignments),
  guardians: collection<StudentGuardian>(SPO_LISTS.guardians),
  documentTypes: collection<DocumentType>(SPO_LISTS.documentTypes),
  admissionDocs: collection<AdmissionDocument>(SPO_LISTS.admissionDocs),
  admissionEvals: collection<AdmissionEvaluation>(SPO_LISTS.admissionEvals),
  messages: collection<ChatMessage>(SPO_LISTS.messages),
  announcements: collection<Announcement>(SPO_LISTS.announcements),
  admissions: collection<AdmissionRequest>(SPO_LISTS.admissions),
  documentRequests: collection<DocumentRequest>(SPO_LISTS.documentRequests),
  psychRequests: collection<PsychRequest>(SPO_LISTS.psychRequests),
  roleMeta: collection<RoleMeta>(SPO_LISTS.roleMeta),
  ticPlan: collection<TicActivity>(SPO_LISTS.ticPlan),
  ticCategories: collection<TicCategoryItem>(SPO_LISTS.ticCategories),
    weeklySchedules: collection<WeeklySchedule>(SPO_LISTS.weeklySchedules),
    workCronogramas: collection<WorkCronograma>(SPO_LISTS.workCronogramas),
    planificador: collection<PlanificacionDinamica>(SPO_LISTS.planificador),
}

export const dataService = {
  // Usuarios y catálogos
  getUsers: collections.users.getAll,
  saveUser: collections.users.save,
  deleteUser: collections.users.remove,
  getStudents: collections.students.getAll,
  saveStudent: collections.students.save,
  deleteStudent: collections.students.remove,
  getTeachers: collections.teachers.getAll,
  saveTeacher: collections.teachers.save,
  deleteTeacher: collections.teachers.remove,
  getSubjects: collections.subjects.getAll,
  saveSubject: collections.subjects.save,
  deleteSubject: collections.subjects.remove,
  getGrades: collections.grades.getAll,
  saveGrade: collections.grades.save,
  deleteGrade: collections.grades.remove,
  getPeriods: collections.periods.getAll,
  savePeriod: collections.periods.save,
  deletePeriod: collections.periods.remove,
  // Planificación anual
  getClassPlans: collections.classPlans.getAll,
  saveClassPlan: collections.classPlans.save,
  deleteClassPlan: collections.classPlans.remove,
  // Planificación académica (diaria / unidad, estructura MINERD)
  getDailyPlans: collections.dailyPlans.getAll,
  saveDailyPlan: collections.dailyPlans.save,
  deleteDailyPlan: collections.dailyPlans.remove,
  // Configuración de grados y secciones del docente
  getTeacherConfigs: collections.teacherConfig.getAll,
  saveTeacherConfig: collections.teacherConfig.save,
  deleteTeacherConfig: collections.teacherConfig.remove,
  // Horarios de clase (coordinación pedagógica)
  getSchedules: collections.schedules.getAll,
  saveSchedule: collections.schedules.save,
  deleteSchedule: collections.schedules.remove,
  // Acompañamientos a docentes (coordinación pedagógica)
  getAccompaniments: collections.accompaniments.getAll,
  saveAccompaniment: collections.accompaniments.save,
  deleteAccompaniment: collections.accompaniments.remove,
  // Personas de coordinación / TIC
  getPersonas: collections.personas.getAll,
  savePersona: collections.personas.save,
  deletePersona: collections.personas.remove,
  // Repositorio de clases
  getClasses: collections.classes.getAll,
  saveClassRecord: collections.classes.save,
  deleteClassRecord: collections.classes.remove,
  // Asistencia
  getAttendance: collections.attendance.getAll,
  saveAttendance: collections.attendance.save,
  // Aulas virtuales
  getActivities: collections.activities.getAll,
  saveActivity: collections.activities.save,
  deleteActivity: collections.activities.remove,
  getScores: collections.scores.getAll,
  saveScore: collections.scores.save,
  // Encuentros virtuales
  getMeetings: collections.meetings.getAll,
  saveMeeting: collections.meetings.save,
  deleteMeeting: collections.meetings.remove,
  // Asignaciones
  getEnrollments: collections.enrollments.getAll,
  saveEnrollment: collections.enrollments.save,
  deleteEnrollment: collections.enrollments.remove,
  getTeacherAssignments: collections.teacherAssignments.getAll,
  saveTeacherAssignment: collections.teacherAssignments.save,
  deleteTeacherAssignment: collections.teacherAssignments.remove,
  // Tutores
  getGuardians: collections.guardians.getAll,
  saveGuardian: collections.guardians.save,
  deleteGuardian: collections.guardians.remove,
  // Documentos requeridos
  getDocumentTypes: collections.documentTypes.getAll,
  saveDocumentType: collections.documentTypes.save,
  deleteDocumentType: collections.documentTypes.remove,
  // Documentos de admisión
  getAdmissionDocs: collections.admissionDocs.getAll,
  saveAdmissionDoc: collections.admissionDocs.save,
  // Evaluaciones de admisión
  getAdmissionEvals: collections.admissionEvals.getAll,
  saveAdmissionEval: collections.admissionEvals.save,
  deleteAdmissionEval: collections.admissionEvals.remove,
  // Mensajería
  getMessages: collections.messages.getAll,
  saveMessage: collections.messages.save,
  // Comunicados
  getAnnouncements: collections.announcements.getAll,
  saveAnnouncement: collections.announcements.save,
  deleteAnnouncement: collections.announcements.remove,
  // Solicitudes de admisión
  getAdmissions: collections.admissions.getAll,
  saveAdmission: collections.admissions.save,
  deleteAdmission: collections.admissions.remove,
  // Solicitudes de documentos
  getDocumentRequests: collections.documentRequests.getAll,
  saveDocumentRequest: collections.documentRequests.save,
  deleteDocumentRequest: collections.documentRequests.remove,
  // Solicitudes de atención psicopedagógica
  getPsychRequests: collections.psychRequests.getAll,
  savePsychRequest: collections.psychRequests.save,
  deletePsychRequest: collections.psychRequests.remove,
  // Metadatos de roles
  getRoleMeta: collections.roleMeta.getAll,
  saveRoleMeta: collections.roleMeta.save,
  deleteRoleMeta: collections.roleMeta.remove,
  // Plan de trabajo TIC
  getTicActivities: collections.ticPlan.getAll,
  saveTicActivity: collections.ticPlan.save,
  deleteTicActivity: collections.ticPlan.remove,
  // Categorías TIC
  getTicCategories: collections.ticCategories.getAll,
  saveTicCategory: collections.ticCategories.save,
  deleteTicCategory: collections.ticCategories.remove,
  // Horarios semanales
  getWeeklySchedules: collections.weeklySchedules.getAll,
  saveWeeklySchedule: collections.weeklySchedules.save,
  deleteWeeklySchedule: collections.weeklySchedules.remove,
  // Cronogramas de trabajo
  getWorkCronogramas: collections.workCronogramas.getAll,
  saveWorkCronograma: collections.workCronogramas.save,
  deleteWorkCronograma: collections.workCronogramas.remove,
  // Planificador Dinámico (IA)
  getPlanificaciones: collections.planificador.getAll,
  savePlanificacion: collections.planificador.save,
  deletePlanificacion: collections.planificador.remove,
}

export type DataService = typeof dataService

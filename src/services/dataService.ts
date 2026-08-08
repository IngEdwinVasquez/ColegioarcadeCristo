import type {
  Activity,
  AdmissionDocument,
  AdmissionEvaluation,
  AttendanceRecord,
  ChatMessage,
  ClassPlan,
  DocumentType,
  Enrollment,
  Grade,
  GradeSection,
  Period,
  SchoolClassRecord,
  Student,
  StudentGuardian,
  Subject,
  Teacher,
  TeacherAssignment,
  User,
  VirtualMeeting,
} from '../types'
import { appConfig } from '../config/appConfig'
import { SPO_LISTS, addItem, deleteItem, getItems, updateItem } from './sharepoint'
import { demoAdd, demoDelete, demoGet, demoUpdate } from './demo/demoStore'

export interface DataService {
  mode: 'demo' | 'm365'
  // Usuarios y catálogos
  getUsers(): Promise<User[]>
  getStudents(): Promise<Student[]>
  saveStudent(student: Student): Promise<void>
  deleteStudent(id: string): Promise<void>
  getTeachers(): Promise<Teacher[]>
  saveTeacher(teacher: Teacher): Promise<void>
  deleteTeacher(id: string): Promise<void>
  getSubjects(): Promise<Subject[]>
  saveSubject(subject: Subject): Promise<void>
  deleteSubject(id: string): Promise<void>
  getGrades(): Promise<GradeSection[]>
  saveGrade(grade: GradeSection): Promise<void>
  deleteGrade(id: string): Promise<void>
  getPeriods(): Promise<Period[]>
  savePeriod(period: Period): Promise<void>
  deletePeriod(id: string): Promise<void>
  // Planificación anual
  getClassPlans(): Promise<ClassPlan[]>
  saveClassPlan(plan: ClassPlan): Promise<void>
  deleteClassPlan(id: string): Promise<void>
  // Repositorio de clases
  getClasses(): Promise<SchoolClassRecord[]>
  saveClassRecord(record: SchoolClassRecord): Promise<void>
  deleteClassRecord(id: string): Promise<void>
  // Asistencia
  getAttendance(): Promise<AttendanceRecord[]>
  saveAttendance(record: AttendanceRecord): Promise<void>
  // Aulas virtuales
  getActivities(): Promise<Activity[]>
  saveActivity(activity: Activity): Promise<void>
  deleteActivity(id: string): Promise<void>
  getScores(): Promise<Grade[]>
  saveScore(score: Grade): Promise<void>
  // Encuentros virtuales
  getMeetings(): Promise<VirtualMeeting[]>
  saveMeeting(meeting: VirtualMeeting): Promise<void>
  deleteMeeting(id: string): Promise<void>
  // Asignaciones
  getEnrollments(): Promise<Enrollment[]>
  saveEnrollment(enrollment: Enrollment): Promise<void>
  deleteEnrollment(id: string): Promise<void>
  getTeacherAssignments(): Promise<TeacherAssignment[]>
  saveTeacherAssignment(assignment: TeacherAssignment): Promise<void>
  deleteTeacherAssignment(id: string): Promise<void>
  // Tutores
  getGuardians(): Promise<StudentGuardian[]>
  saveGuardian(guardian: StudentGuardian): Promise<void>
  deleteGuardian(id: string): Promise<void>
  // Documentos requeridos
  getDocumentTypes(): Promise<DocumentType[]>
  saveDocumentType(dt: DocumentType): Promise<void>
  deleteDocumentType(id: string): Promise<void>
  // Documentos de admisión
  getAdmissionDocs(): Promise<AdmissionDocument[]>
  saveAdmissionDoc(doc: AdmissionDocument): Promise<void>
  // Evaluaciones de admisión
  getAdmissionEvals(): Promise<AdmissionEvaluation[]>
  saveAdmissionEval(ev: AdmissionEvaluation): Promise<void>
  deleteAdmissionEval(id: string): Promise<void>
  // Mensajería
  getMessages(): Promise<ChatMessage[]>
  saveMessage(msg: ChatMessage): Promise<void>
}

// --------------------------- Implementación demo ---------------------------

function upsertDemo<T extends { id?: string }>(listName: string, item: T): void {
  const existing = item.id && demoGet<{ id: string }>(listName).some((x) => x.id === item.id)
  if (existing) {
    demoUpdate(listName, item.id as string, item)
  } else {
    demoAdd(listName, item)
  }
}

const demoService: DataService = {
  mode: 'demo',
  getUsers: () => Promise.resolve(demoGet<User>('ARC_Users')),
  getStudents: () => Promise.resolve(demoGet<Student>('ARC_Students')),
  saveStudent: (s) => Promise.resolve(upsertDemo('ARC_Students', s)),
  deleteStudent: (id) => Promise.resolve(demoDelete('ARC_Students', id)),
  getTeachers: () => Promise.resolve(demoGet<Teacher>('ARC_Teachers')),
  saveTeacher: (t) => Promise.resolve(upsertDemo('ARC_Teachers', t)),
  deleteTeacher: (id) => Promise.resolve(demoDelete('ARC_Teachers', id)),
  getSubjects: () => Promise.resolve(demoGet<Subject>('ARC_Subjects')),
  saveSubject: (s) => Promise.resolve(upsertDemo('ARC_Subjects', s)),
  deleteSubject: (id) => Promise.resolve(demoDelete('ARC_Subjects', id)),
  getGrades: () => Promise.resolve(demoGet<GradeSection>('ARC_Grades')),
  saveGrade: (g) => Promise.resolve(upsertDemo('ARC_Grades', g)),
  deleteGrade: (id) => Promise.resolve(demoDelete('ARC_Grades', id)),
  getPeriods: () => Promise.resolve(demoGet<Period>('ARC_Periods')),
  savePeriod: (p) => Promise.resolve(upsertDemo('ARC_Periods', p)),
  deletePeriod: (id) => Promise.resolve(demoDelete('ARC_Periods', id)),
  getClassPlans: () => Promise.resolve(demoGet<ClassPlan>('ARC_ClassPlans')),
  saveClassPlan: (plan) => Promise.resolve(upsertDemo('ARC_ClassPlans', plan)),
  deleteClassPlan: (id) => Promise.resolve(demoDelete('ARC_ClassPlans', id)),
  getClasses: () => Promise.resolve(demoGet<SchoolClassRecord>('ARC_Classes')),
  saveClassRecord: (record) => Promise.resolve(upsertDemo('ARC_Classes', record)),
  deleteClassRecord: (id) => Promise.resolve(demoDelete('ARC_Classes', id)),
  getAttendance: () => Promise.resolve(demoGet<AttendanceRecord>('ARC_Attendance')),
  saveAttendance: (record) => Promise.resolve(upsertDemo('ARC_Attendance', record)),
  getActivities: () => Promise.resolve(demoGet<Activity>('ARC_Activities')),
  saveActivity: (activity) => Promise.resolve(upsertDemo('ARC_Activities', activity)),
  deleteActivity: (id) => Promise.resolve(demoDelete('ARC_Activities', id)),
  getScores: () => Promise.resolve(demoGet<Grade>('ARC_Scores')),
  saveScore: (score) => Promise.resolve(upsertDemo('ARC_Scores', score)),
  getMeetings: () => Promise.resolve(demoGet<VirtualMeeting>('ARC_Meetings')),
  saveMeeting: (meeting) => Promise.resolve(upsertDemo('ARC_Meetings', meeting)),
  deleteMeeting: (id) => Promise.resolve(demoDelete('ARC_Meetings', id)),
  getEnrollments: () => Promise.resolve(demoGet<Enrollment>('ARC_Enrollments')),
  saveEnrollment: (e) => Promise.resolve(upsertDemo('ARC_Enrollments', e)),
  deleteEnrollment: (id) => Promise.resolve(demoDelete('ARC_Enrollments', id)),
  getTeacherAssignments: () => Promise.resolve(demoGet<TeacherAssignment>('ARC_TeacherAssignments')),
  saveTeacherAssignment: (a) => Promise.resolve(upsertDemo('ARC_TeacherAssignments', a)),
  deleteTeacherAssignment: (id) => Promise.resolve(demoDelete('ARC_TeacherAssignments', id)),
  getGuardians: () => Promise.resolve(demoGet<StudentGuardian>('ARC_Guardians')),
  saveGuardian: (g) => Promise.resolve(upsertDemo('ARC_Guardians', g)),
  deleteGuardian: (id) => Promise.resolve(demoDelete('ARC_Guardians', id)),
  getDocumentTypes: () => Promise.resolve(demoGet<DocumentType>('ARC_DocumentTypes')),
  saveDocumentType: (dt) => Promise.resolve(upsertDemo('ARC_DocumentTypes', dt)),
  deleteDocumentType: (id) => Promise.resolve(demoDelete('ARC_DocumentTypes', id)),
  getAdmissionDocs: () => Promise.resolve(demoGet<AdmissionDocument>('ARC_AdmissionDocs')),
  saveAdmissionDoc: (doc) => Promise.resolve(upsertDemo('ARC_AdmissionDocs', doc)),
  getAdmissionEvals: () => Promise.resolve(demoGet<AdmissionEvaluation>('ARC_AdmissionEvals')),
  saveAdmissionEval: (ev) => Promise.resolve(upsertDemo('ARC_AdmissionEvals', ev)),
  deleteAdmissionEval: (id) => Promise.resolve(demoDelete('ARC_AdmissionEvals', id)),
  getMessages: () => Promise.resolve(demoGet<ChatMessage>('ARC_Messages')),
  saveMessage: (msg) => Promise.resolve(upsertDemo('ARC_Messages', msg)),
}

// --------------------------- Implementación SharePoint (Graph) ---------------------------

interface SPOItem {
  Title?: string
  json_payload?: string
}

function parsePayload<T>(items: Array<SPOItem & { id: string }>): T[] {
  return items.map((item) => {
    const parsed = item.json_payload ? (JSON.parse(item.json_payload) as T) : ({} as T)
    return { ...parsed, id: item.id }
  })
}

const titleOf = (item: unknown): string => {
  const anyItem = item as { title?: string; topic?: string; name?: string; fullName?: string; displayName?: string }
  return anyItem.title ?? anyItem.topic ?? anyItem.name ?? anyItem.fullName ?? anyItem.displayName ?? 'Elemento'
}

async function m365Save<T>(listName: string, item: T & { id?: string }): Promise<void> {
  const { id, ...rest } = item
  const payload = JSON.stringify(rest)
  const title = titleOf(rest)
  if (id) {
    await updateItem(listName, id, { Title: title, json_payload: payload })
  } else {
    await addItem(listName, { Title: title, json_payload: payload })
  }
}

const m365Service: DataService = {
  mode: 'm365',
  getUsers: async () => parsePayload<User>(await getItems<SPOItem>(SPO_LISTS.users)),
  getStudents: async () => parsePayload<Student>(await getItems<SPOItem>(SPO_LISTS.students)),
  saveStudent: (student) => m365Save(SPO_LISTS.students, student),
  deleteStudent: (id) => deleteItem(SPO_LISTS.students, id),
  getTeachers: async () => parsePayload<Teacher>(await getItems<SPOItem>(SPO_LISTS.teachers)),
  saveTeacher: (teacher) => m365Save(SPO_LISTS.teachers, teacher),
  deleteTeacher: (id) => deleteItem(SPO_LISTS.teachers, id),
  getSubjects: async () => parsePayload<Subject>(await getItems<SPOItem>(SPO_LISTS.subjects)),
  saveSubject: (subject) => m365Save(SPO_LISTS.subjects, subject),
  deleteSubject: (id) => deleteItem(SPO_LISTS.subjects, id),
  getGrades: async () => parsePayload<GradeSection>(await getItems<SPOItem>(SPO_LISTS.grades)),
  saveGrade: (grade) => m365Save(SPO_LISTS.grades, grade),
  deleteGrade: (id) => deleteItem(SPO_LISTS.grades, id),
  getPeriods: async () => parsePayload<Period>(await getItems<SPOItem>(SPO_LISTS.periods)),
  savePeriod: (period) => m365Save(SPO_LISTS.periods, period),
  deletePeriod: (id) => deleteItem(SPO_LISTS.periods, id),
  getClassPlans: async () => parsePayload<ClassPlan>(await getItems<SPOItem>(SPO_LISTS.classPlans)),
  saveClassPlan: (plan) => m365Save(SPO_LISTS.classPlans, plan),
  deleteClassPlan: (id) => deleteItem(SPO_LISTS.classPlans, id),
  getClasses: async () => parsePayload<SchoolClassRecord>(await getItems<SPOItem>(SPO_LISTS.classes)),
  saveClassRecord: (record) => m365Save(SPO_LISTS.classes, record),
  deleteClassRecord: (id) => deleteItem(SPO_LISTS.classes, id),
  getAttendance: async () => parsePayload<AttendanceRecord>(await getItems<SPOItem>(SPO_LISTS.attendance)),
  saveAttendance: (record) => m365Save(SPO_LISTS.attendance, record),
  getActivities: async () => parsePayload<Activity>(await getItems<SPOItem>(SPO_LISTS.activities)),
  saveActivity: (activity) => m365Save(SPO_LISTS.activities, activity),
  deleteActivity: (id) => deleteItem(SPO_LISTS.activities, id),
  getScores: async () => parsePayload<Grade>(await getItems<SPOItem>(SPO_LISTS.scores)),
  saveScore: (score) => m365Save(SPO_LISTS.scores, score),
  getMeetings: async () => parsePayload<VirtualMeeting>(await getItems<SPOItem>(SPO_LISTS.meetings)),
  saveMeeting: (meeting) => m365Save(SPO_LISTS.meetings, meeting),
  deleteMeeting: (id) => deleteItem(SPO_LISTS.meetings, id),
  getEnrollments: async () => parsePayload<Enrollment>(await getItems<SPOItem>(SPO_LISTS.enrollments)),
  saveEnrollment: (enrollment) => m365Save(SPO_LISTS.enrollments, enrollment),
  deleteEnrollment: (id) => deleteItem(SPO_LISTS.enrollments, id),
  getTeacherAssignments: async () => parsePayload<TeacherAssignment>(await getItems<SPOItem>(SPO_LISTS.teacherAssignments)),
  saveTeacherAssignment: (assignment) => m365Save(SPO_LISTS.teacherAssignments, assignment),
  deleteTeacherAssignment: (id) => deleteItem(SPO_LISTS.teacherAssignments, id),
  getGuardians: async () => parsePayload<StudentGuardian>(await getItems<SPOItem>(SPO_LISTS.guardians)),
  saveGuardian: (guardian) => m365Save(SPO_LISTS.guardians, guardian),
  deleteGuardian: (id) => deleteItem(SPO_LISTS.guardians, id),
  getDocumentTypes: async () => parsePayload<DocumentType>(await getItems<SPOItem>(SPO_LISTS.documentTypes)),
  saveDocumentType: (dt) => m365Save(SPO_LISTS.documentTypes, dt),
  deleteDocumentType: (id) => deleteItem(SPO_LISTS.documentTypes, id),
  getAdmissionDocs: async () => parsePayload<AdmissionDocument>(await getItems<SPOItem>(SPO_LISTS.admissionDocs)),
  saveAdmissionDoc: (doc) => m365Save(SPO_LISTS.admissionDocs, doc),
  getAdmissionEvals: async () => parsePayload<AdmissionEvaluation>(await getItems<SPOItem>(SPO_LISTS.admissionEvals)),
  saveAdmissionEval: (ev) => m365Save(SPO_LISTS.admissionEvals, ev),
  deleteAdmissionEval: (id) => deleteItem(SPO_LISTS.admissionEvals, id),
  getMessages: async () => parsePayload<ChatMessage>(await getItems<SPOItem>(SPO_LISTS.messages)),
  saveMessage: (msg) => m365Save(SPO_LISTS.messages, msg),
}

export const dataService: DataService = appConfig.m365.enabled ? m365Service : demoService

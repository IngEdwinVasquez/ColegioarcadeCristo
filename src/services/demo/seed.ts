import type {
  AttendanceStatus,
  ClassPlan,
  GradeSection,
  SchoolClassRecord,
  Subject,
  Teacher,
  User,
} from '../../types'
import type { DemoDb } from './demoStore'

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260807)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function weekdayDates(start: Date, end: Date): Date[] {
  const out: Date[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) out.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}

// ---------------------------- Maestros de datos ----------------------------

export const DEMO_SUBJECTS: Subject[] = [
  { id: 'subj-mat', name: 'Matemáticas', shortName: 'MAT', color: '#C62828' },
  { id: 'subj-len', name: 'Lengua Española', shortName: 'LEN', color: '#2E7D32' },
  { id: 'subj-cs', name: 'Ciencias Sociales', shortName: 'SOC', color: '#1565C0' },
  { id: 'subj-cn', name: 'Ciencias Naturales', shortName: 'NAT', color: '#00695C' },
  { id: 'subj-inf', name: 'Informática', shortName: 'INF', color: '#4527A0' },
  { id: 'subj-ing', name: 'Inglés', shortName: 'ING', color: '#EF6C00' },
  { id: 'subj-art', name: 'Educación Artística', shortName: 'ART', color: '#AD1457' },
  { id: 'subj-fi', name: 'Formación Integral', shortName: 'FI', color: '#4E342E' },
]

export const DEMO_TEACHERS: Teacher[] = [
  { id: 't1', fullName: 'Leoncio A. Vásquez Tavarez', email: 'leoncio.vasquez@arcadecristo.edu.do', subjects: ['subj-inf'], grades: ['g-6toA', 'g-6toB', 'g-5toA'] },
  { id: 't2', fullName: 'María Fernández Núñez', email: 'maria.fernandez@arcadecristo.edu.do', subjects: ['subj-mat'], grades: ['g-6toA', 'g-5toA', 'g-6toB'] },
  { id: 't3', fullName: 'José Martínez Reyes', email: 'jose.martinez@arcadecristo.edu.do', subjects: ['subj-len'], grades: ['g-6toA', 'g-5toA'] },
  { id: 't4', fullName: 'Ana Rodríguez Cruz', email: 'ana.rodriguez@arcadecristo.edu.do', subjects: ['subj-cs'], grades: ['g-6toA', 'g-5toA'] },
  { id: 't5', fullName: 'Carmen Gómez Peña', email: 'carmen.gomez@arcadecristo.edu.do', subjects: ['subj-cn'], grades: ['g-6toA', 'g-5toA'] },
  { id: 't6', fullName: 'Pedro Santana Ortiz', email: 'pedro.santana@arcadecristo.edu.do', subjects: ['subj-ing'], grades: ['g-6toA', 'g-5toA'] },
  { id: 't7', fullName: 'Rosa Pérez Jiménez', email: 'rosa.perez@arcadecristo.edu.do', subjects: ['subj-art'], grades: ['g-6toA', 'g-5toA'] },
  { id: 't8', fullName: 'Juan Castillo García', email: 'juan.castillo@arcadecristo.edu.do', subjects: ['subj-fi'], grades: ['g-6toA', 'g-5toA'] },
]

export const DEMO_GRADES: GradeSection[] = [
  { id: 'g-1roA', name: '1ro A', level: 'Nivel Primario' },
  { id: 'g-1roB', name: '1ro B', level: 'Nivel Primario' },
  { id: 'g-2doA', name: '2do A', level: 'Nivel Primario' },
  { id: 'g-3roA', name: '3ro A', level: 'Nivel Primario' },
  { id: 'g-4toA', name: '4to A', level: 'Nivel Primario' },
  { id: 'g-5toA', name: '5to A', level: 'Nivel Primario' },
  { id: 'g-5toB', name: '5to B', level: 'Nivel Primario' },
  { id: 'g-6toA', name: '6to A', level: 'Nivel Primario' },
  { id: 'g-6toB', name: '6to B', level: 'Nivel Primario' },
]

const FIRST_NAMES = ['María', 'Laura', 'Carlos', 'José', 'Ana', 'Luis', 'Pedro', 'Carmen', 'Rosa', 'Miguel', 'Juana', 'Francisco', 'Elena', 'David', 'Paola', 'Ángel', 'Sofía', 'Gabriel', 'Marta', 'Diego', 'Camila', 'Andrés', 'Valeria', 'Samuel', 'Isabel', 'Natalia']
const LAST_NAMES = ['Vásquez', 'Tavarez', 'Fernández', 'Martínez', 'Rodríguez', 'Gómez', 'Santana', 'Pérez', 'Castillo', 'García', 'Reyes', 'Cruz', 'Peña', 'Núñez', 'Jiménez', 'Rosario', 'Ortiz', 'Cabrera', 'Rojas', 'Salazar']

const GRADE_SIZE: Record<string, number> = {
  'g-1roA': 6, 'g-1roB': 5, 'g-2doA': 5, 'g-3roA': 5, 'g-4toA': 5,
  'g-5toA': 6, 'g-5toB': 4, 'g-6toA': 6, 'g-6toB': 4,
}

const TOPICS: Record<string, string[]> = {
  'subj-mat': ['Operaciones con fracciones', 'Ecuaciones de primer grado', 'Área y perímetro de figuras', 'Números decimales y porcentaje', 'Razones y proporciones', 'Potenciación y radicación', 'Estadística y gráficas', 'Geometría plana'],
  'subj-len': ['El texto narrativo', 'La oración y sus partes', 'Análisis de lectura', 'El párrafo y sus ideas', 'Los conectores lógicos', 'Comprensión lectora', 'La noticia y el reportaje', 'Literatura dominicana'],
  'subj-cn': ['El sistema circulatorio', 'Ecosistemas y biodiversidad', 'La célula y sus partes', 'Cambios de estado de la materia', 'El sistema solar', 'La energía y sus formas', 'Los seres vivos y su clasificación'],
  'subj-cs': ['Historia de la República Dominicana', 'División territorial', 'Los símbolos patrios', 'Geografía de la isla', 'Derechos y deberes ciudadanos', 'La independencia nacional', 'Los recursos naturales del país'],
  'subj-inf': ['Introducción a la programación', 'Ofimática: Word', 'Ofimática: Excel', 'Seguridad en internet', 'Presentaciones efectivas', 'Correo electrónico', 'Herramientas colaborativas de Microsoft 365'],
  'subj-ing': ['Simple present', 'Vocabulary: the school', 'Past tense', 'Reading comprehension', 'Present continuous', 'Everyday dialogues'],
  'subj-art': ['El color y sus combinaciones', 'Dibujo de observación', 'Música folclórica', 'Artesanía dominicana', 'El retrato y la expresión'],
  'subj-fi': ['Valores y convivencia escolar', 'Inteligencia emocional', 'Respeto y empatía', 'Mi proyecto de vida'],
}

const STRATEGIES = ['Clase magistral', 'Trabajo colaborativo', 'Aprendizaje basado en proyectos', 'Aula invertida', 'Juego didáctico', 'Estudio de caso', 'Taller práctico', 'Debate guiado']

const PERIODS = ['7:45 - 8:30', '8:30 - 9:15', '9:15 - 10:00', '10:15 - 11:00', '11:00 - 11:45', '13:00 - 13:45']

// ---------------------------- Generación ----------------------------

export function buildSeedDb(): DemoDb {
  const db: DemoDb = {}

  db.ARC_Subjects = DEMO_SUBJECTS.map((s) => ({ ...s }))
  db.ARC_Teachers = DEMO_TEACHERS.map((t) => ({ ...t }))
  db.ARC_Grades = DEMO_GRADES.map((g) => ({ ...g }))

  const students: Array<Record<string, unknown> & { id: string }> = []
  let studentCounter = 0
  for (const grade of DEMO_GRADES) {
    const count = GRADE_SIZE[grade.id]
    for (let i = 0; i < count; i++) {
      studentCounter++
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
      students.push({
        id: `s-${String(studentCounter).padStart(2, '0')}`,
        fullName: name,
        gradeId: grade.id,
        parentName: `Familia ${name.split(' ')[1]}`,
        parentEmail: `familia.${studentCounter}@correo.com`,
      })
    }
  }
  // Estudiante de demostración (hija del usuario padre demo)
  const demoStudent = students.find((s) => s.id === 's-01')!
  demoStudent.fullName = 'Laura Fernández Castillo'
  demoStudent.gradeId = 'g-6toA'
  demoStudent.parentName = 'Luis Rodríguez García'
  demoStudent.parentEmail = 'luis.rodriguez@correo.com'
  db.ARC_Students = students

  const demoUsers: User[] = [
    { id: 'u-docente', displayName: 'Leoncio A. Vásquez Tavarez', email: 'leoncio.vasquez@arcadecristo.edu.do', roles: ['docente'], teacherId: 't1' },
    { id: 'u-estudiante', displayName: 'Laura Fernández Castillo', email: 'laura.fernandez@arcadecristo.edu.do', roles: ['estudiante'], studentId: 's-01' },
    { id: 'u-padre', displayName: 'Luis Rodríguez García', email: 'luis.rodriguez@correo.com', roles: ['padre'] },
    { id: 'u-admin', displayName: 'Dirección General Arca de Cristo', email: 'direccion@arcadecristo.edu.do', roles: ['admin'] },
    { id: 'u-superadmin', displayName: 'Super Administrador', email: 'superadmin@arcadecristo.edu.do', roles: ['docente', 'estudiante', 'padre', 'admin'] },
  ]
  db.ARC_Users = demoUsers

  // ---------------------------- Planificación anual y clases ----------------------------
  const today = new Date()
  const plans: Array<Record<string, unknown> & { id: string }> = []
  const classes: Array<Record<string, unknown> & { id: string }> = []
  const attendance: Array<Record<string, unknown> & { id: string }> = []
  let planCounter = 0

  const specs: Array<{ gradeId: string; subjects: string[]; pastDays: number; futureDays: number }> = [
    { gradeId: 'g-6toA', subjects: ['subj-mat', 'subj-len', 'subj-inf', 'subj-cn', 'subj-cs'], pastDays: 14, futureDays: 25 },
    { gradeId: 'g-5toA', subjects: ['subj-mat', 'subj-len'], pastDays: 10, futureDays: 25 },
    { gradeId: 'g-6toB', subjects: ['subj-mat'], pastDays: 10, futureDays: 25 },
  ]

  for (const spec of specs) {
    const start = addDays(today, -spec.pastDays)
    const end = addDays(today, spec.futureDays)
    const days = weekdayDates(start, end)
    const gradeStudents = students.filter((s) => s.gradeId === spec.gradeId)
    const isPastDate = (d: Date) => d < new Date(`${toIso(today)}T00:00:00`)

    for (const day of days) {
      for (let si = 0; si < spec.subjects.length; si++) {
        const subjectId = spec.subjects[si]
        const subject = DEMO_SUBJECTS.find((s) => s.id === subjectId)!
        const teacher = DEMO_TEACHERS.find((t) => t.subjects.includes(subjectId))!
        const topicPool = TOPICS[subjectId] ?? [subject.name]
        const topic = topicPool[planCounter % topicPool.length]
        planCounter++
        const past = isPastDate(day)
        const planId = `plan-${spec.gradeId}-${subjectId}-${toIso(day)}`

        const plan: ClassPlan = {
          id: planId,
          subjectId,
          teacherId: teacher.id,
          gradeId: spec.gradeId,
          date: toIso(day),
          period: PERIODS[planCounter % PERIODS.length],
          topic,
          objective: `Comprender y aplicar los contenidos de ${topic}.`,
          content: `Desarrollo del tema: ${topic}. Actividades de refuerzo y práctica guiada.`,
          strategy: pick(STRATEGIES),
          resources: 'Guías didácticas, pizarra, recursos digitales de Microsoft 365.',
          evaluation: 'Participación, práctica dirigida y tarea de aplicación.',
          status: past ? 'impartida' : 'planificada',
        }

        if (past) {
          const classId = `class-${planId}`
          plan.classId = classId
          const title = `${subject.name} · ${topic}`
          const classRecord: SchoolClassRecord = {
            id: classId,
            planId,
            subjectId,
            teacherId: teacher.id,
            gradeId: spec.gradeId,
            date: toIso(day),
            period: plan.period,
            title,
            status: 'completada',
            before: {
              objectives: plan.objective,
              content: plan.content,
              activities: `1. Motivación e introducción. 2. Desarrollo del tema. 3. Práctica guiada. 4. Cierre y asignación de tarea.`,
              resources: plan.resources,
              cronograma: `${plan.period}: ${topic}`,
            },
            during: {
              development: `Se desarrolló el tema "${topic}" mediante ${plan.strategy}. Los estudiantes participaron activamente y resolvieron ejercicios de práctica en el aula.`,
              participation: 'Participación activa de la mayoría de los estudiantes; se atendieron dudas de forma individualizada.',
              observations: 'El grupo respondió bien a la dinámica; algunos estudiantes requieren reforzamiento adicional en los próximos días.',
            },
            after: {
              reflection: 'La estrategia aplicada resultó efectiva. Se recomienda continuar con ejercicios de reforzamiento.',
              achieved: 'Se logró el objetivo general de la sesión y se evidenció comprensión en la práctica dirigida.',
              toImprove: 'Dar seguimiento individualizado a los estudiantes con dificultades y variar las estrategias de motivación.',
              report: `Informe de la clase del ${toIso(day)}: se impartió "${topic}" en ${subject.name}. Asistencia registrada. Se asignaron tareas complementarias.`,
            },
            createdAt: `${toIso(day)}T${String(8 + (si % 8)).padStart(2, '0')}:15:00.000Z`,
          }
          const classObj = { ...classRecord, id: classId }
          classes.push(classObj)

          const attendanceEntries = gradeStudents.map((s) => {
            const r = rand()
            let status: AttendanceStatus = 'presente'
            if (r > 0.93) status = 'ausente'
            else if (r > 0.86) status = 'tarde'
            else if (r > 0.80) status = 'justificado'
            return { studentId: s.id, status, note: status === 'justificado' ? 'Justificación por la familia' : '' }
          })
          const attendanceId = `att-${classId}`
          attendance.push({
            id: attendanceId,
            classId,
            subjectId,
            gradeId: spec.gradeId,
            date: toIso(day),
            period: plan.period,
            entries: attendanceEntries,
            takenBy: teacher.id,
            takenAt: `${toIso(day)}T${String(8 + (si % 8)).padStart(2, '0')}:30:00.000Z`,
          })
          classObj.attendanceId = attendanceId
        }
        plans.push({ ...plan, id: planId })
      }
    }
  }

  db.ARC_ClassPlans = plans
  db.ARC_Classes = classes
  db.ARC_Attendance = attendance

  // ---------------------------- Actividades y calificaciones ----------------------------
  const activities: Array<Record<string, unknown> & { id: string }> = []
  const scores: Array<Record<string, unknown> & { id: string }> = []
  const activityTypes = ['tarea', 'quiz', 'proyecto', 'evaluacion'] as const
  let activityCounter = 0

  const activitySpecs: Array<{ gradeId: string; subjects: string[] }> = [
    { gradeId: 'g-6toA', subjects: ['subj-mat', 'subj-len', 'subj-inf', 'subj-cn'] },
    { gradeId: 'g-5toA', subjects: ['subj-mat', 'subj-len'] },
  ]

  for (const spec of activitySpecs) {
    const gradeStudents = students.filter((s) => s.gradeId === spec.gradeId)
    for (const subjectId of spec.subjects) {
      const teacher = DEMO_TEACHERS.find((t) => t.subjects.includes(subjectId))!
      for (let i = 0; i < 4; i++) {
        activityCounter++
        const activityId = `act-${activityCounter}`
        const base = addDays(today, -8 + i * 4)
        const points = [20, 30, 50, 100][i]
        activities.push({
          id: activityId,
          subjectId,
          teacherId: teacher.id,
          gradeId: spec.gradeId,
          title: `Actividad ${i + 1}: ${pick(TOPICS[subjectId] ?? ['Práctica'])}`,
          description: 'Actividad práctica para reforzar los contenidos trabajados en clase. Debe entregarse a través del aula virtual.',
          type: activityTypes[i % activityTypes.length],
          points,
          publishDate: toIso(base),
          dueDate: toIso(addDays(base, 4)),
          status: 'publicada',
          attachments: [],
        })
        for (const s of gradeStudents) {
          const score = Math.round(55 + rand() * 45)
          scores.push({
            id: `${activityId}-${s.id}`,
            activityId,
            studentId: s.id,
            score: Math.min(100, score),
            comment: score >= 85 ? 'Excelente desempeño' : score >= 70 ? 'Buen desempeño' : 'Requiere refuerzo',
            gradedBy: teacher.id,
            gradedAt: `${toIso(addDays(base, 5))}T10:00:00.000Z`,
          })
        }
      }
    }
  }

  db.ARC_Activities = activities
  db.ARC_Scores = scores

  // ---------------------------- Encuentros virtuales ----------------------------
  const meetings: Array<Record<string, unknown> & { id: string }> = []
  const meetingDefs: Array<{ daysAgo: number; title: string; type: string; platform: string; status: string }> = [
    { daysAgo: 25, title: 'Reunión de coordinación pedagógica', type: 'coordinacion', platform: 'Microsoft Teams', status: 'realizado' },
    { daysAgo: 18, title: 'Consejo de docentes — seguimiento de planificación', type: 'consejo', platform: 'Microsoft Teams', status: 'realizado' },
    { daysAgo: 12, title: 'Reunión con padres y tutores de 6to A', type: 'reunion_padres', platform: 'Microsoft Teams', status: 'realizado' },
    { daysAgo: 5, title: 'Capacitación: herramientas digitales para el aula', type: 'capacitacion', platform: 'Microsoft Teams', status: 'realizado' },
    { daysAgo: -3, title: 'Junta pedagógica — análisis de indicadores', type: 'junta', platform: 'Microsoft Teams', status: 'programado' },
    { daysAgo: -9, title: 'Seguimiento de proyectos de aula virtual', type: 'coordinacion', platform: 'Microsoft Teams', status: 'programado' },
  ]
  meetingDefs.forEach((def, idx) => {
    const date = addDays(today, def.daysAgo)
    const attendees = DEMO_TEACHERS.slice(0, idx === 2 ? 8 : 5).map((t) => t.id)
    const isDone = def.status === 'realizado'
    meetings.push({
      id: `mtg-${idx + 1}`,
      title: def.title,
      date: toIso(date),
      startTime: '15:00',
      endTime: '16:30',
      organizerId: 't1',
      attendees,
      type: def.type,
      platform: def.platform,
      link: 'https://teams.microsoft.com/l/meetup-join/19:ejemplo',
      status: def.status,
      record: isDone
        ? {
            agenda: '1. Revisión de compromisos anteriores. 2. Análisis del tema del encuentro. 3. Acuerdos y próximos pasos.',
            minutes: `Se trató: ${def.title}. Se revisaron los avances de la planificación anual, el control de asistencia y las actividades del aula virtual. Se establecieron compromisos para las próximas semanas.`,
            attendees: attendees.map((a) => a),
            agreements: [
              { id: `${idx}-a1`, description: 'Completar el registro de clases impartidas en el repositorio.', ownerId: 't1', dueDate: toIso(addDays(today, 7)), status: 'en_progreso' },
              { id: `${idx}-a2`, description: 'Publicar las próximas actividades del aula virtual.', ownerId: 't3', dueDate: toIso(addDays(today, 14)), status: 'pendiente' },
              { id: `${idx}-a3`, description: 'Enviar circular a las familias con las nuevas disposiciones.', ownerId: 't1', dueDate: toIso(addDays(today, 3)), status: 'completado' },
            ],
          }
        : undefined,
      createdAt: `${toIso(date)}T14:30:00.000Z`,
    })
  })

  db.ARC_Meetings = meetings

  // ---------------------------- Períodos escolares ----------------------------
  db.ARC_Periods = [
    { id: 'p-2025', name: 'Año escolar 2025-2026', startDate: '2025-09-01', endDate: '2026-06-30', isActive: false },
    { id: 'p-2026', name: 'Año escolar 2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', isActive: true },
  ]

  // ---------------------------- Matrículas (estudiante -> curso -> periodo) ----------------------------
  const enrollments: Array<Record<string, unknown> & { id: string }> = []
  for (const grade of DEMO_GRADES) {
    for (const s of students.filter((st) => st.gradeId === grade.id)) {
      enrollments.push({
        id: `enr-${s.id}-2026`,
        studentId: s.id,
        gradeId: grade.id,
        subjectId: '',
        periodId: 'p-2026',
      })
    }
  }
  db.ARC_Enrollments = enrollments

  // ---------------------------- Asignaciones docentes (docente -> asignatura -> curso -> periodo) ----------------------------
  const teacherAssignments: Array<Record<string, unknown> & { id: string }> = []
  for (const t of DEMO_TEACHERS) {
    for (const subjectId of t.subjects) {
      for (const gradeId of t.grades) {
        teacherAssignments.push({
          id: `ta-${t.id}-${subjectId}-${gradeId}-2026`,
          teacherId: t.id,
          subjectId,
          gradeId,
          periodId: 'p-2026',
        })
      }
    }
  }
  db.ARC_TeacherAssignments = teacherAssignments

  // ---------------------------- Tutores (vinculados a estudiantes) ----------------------------
  const guardians: Array<Record<string, unknown> & { id: string }> = []
  const parentescoValues = ['padre', 'madre', 'tutor', 'otro']
  let gidx = 0
  for (const s of students) {
    if (s.parentName) {
      gidx++
      guardians.push({
        id: `gr-${s.id}`,
        studentId: s.id,
        fullName: s.parentName,
        email: s.parentEmail || '',
        phone: '',
        parentesco: parentescoValues[gidx % parentescoValues.length],
      })
    }
  }
  db.ARC_Guardians = guardians

  // ---------------------------- Tipos de documento para admisión ----------------------------
  db.ARC_DocumentTypes = [
    { id: 'dt-1', name: 'Acta de nacimiento', description: 'Copia del acta de nacimiento legalizada.', required: true, order: 1 },
    { id: 'dt-2', name: 'Récord de notas previo', description: 'Historial académico del año anterior o constancia de estudios.', required: true, order: 2 },
    { id: 'dt-3', name: 'Certificado médico', description: 'Certificado de salud general del aspirante.', required: true, order: 3 },
    { id: 'dt-4', name: 'Carta de buena conducta', description: 'Carta de la institución de procedencia.', required: false, order: 4 },
    { id: 'dt-5', name: 'Fotografía 2x2', description: 'Dos fotos tamaño 2x2 recientes.', required: true, order: 5 },
    { id: 'dt-6', name: 'Formulario de entrevista', description: 'Formulario completado por el equipo psicopedagógico.', required: false, order: 6 },
  ]

  // ---------------------------- Mensajes de chat demo ----------------------------
  const now = new Date()
  const ago = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString()
  db.ARC_Messages = [
    { id: 'msg-1', senderId: 'u-docente', senderName: 'Leoncio A. Vásquez Tavarez', senderRole: 'docente', receiverId: 'u-estudiante', receiverName: 'Laura Fernández Castillo', content: 'Buenos días, Laura. Recuerda que la tarea de informática se entrega el viernes. ¿Tienes alguna duda?', timestamp: ago(45), read: false },
    { id: 'msg-2', senderId: 'u-estudiante', senderName: 'Laura Fernández Castillo', senderRole: 'estudiante', receiverId: 'u-docente', receiverName: 'Leoncio A. Vásquez Tavarez', content: 'Buenos días profe. Sí, tengo una duda con el ejercicio 3 de Excel. ¿Lo revisamos mañana?', timestamp: ago(40), read: true },
    { id: 'msg-3', senderId: 'u-docente', senderName: 'Leoncio A. Vásquez Tavarez', senderRole: 'docente', receiverId: 'u-estudiante', receiverName: 'Laura Fernández Castillo', content: 'Claro, lo revisamos mañana en clase. Lleva tu laptop.', timestamp: ago(35), read: false },
    { id: 'msg-4', senderId: 'u-admin', senderName: 'Dirección General Arca de Cristo', senderRole: 'admin', receiverId: 'u-docente', receiverName: 'Leoncio A. Vásquez Tavarez', content: 'Leoncio, favor enviar el informe de cumplimiento de la planificación de este mes antes del viernes.', timestamp: ago(120), read: true },
    { id: 'msg-5', senderId: 'u-docente', senderName: 'Leoncio A. Vásquez Tavarez', senderRole: 'docente', receiverId: 'u-admin', receiverName: 'Dirección General Arca de Cristo', content: 'Recibido, Dirección. Lo envío mañana sin falta.', timestamp: ago(110), read: true },
    { id: 'msg-6', senderId: 'u-padre', senderName: 'Luis Rodríguez García', senderRole: 'padre', receiverId: 'u-docente', receiverName: 'Leoncio A. Vásquez Tavarez', content: 'Buenas tardes, profesor. ¿Cómo va Laura en informática? Quisiera saber si necesita algún refuerzo.', timestamp: ago(180), read: true },
    { id: 'msg-7', senderId: 'u-docente', senderName: 'Leoncio A. Vásquez Tavarez', senderRole: 'docente', receiverId: 'u-padre', receiverName: 'Luis Rodríguez García', content: 'Buenas tardes, Sr. Vásquez. Laura va muy bien, tiene promedio de 92. Solo recomiendo reforzar el tema de Excel con práctica en casa.', timestamp: ago(170), read: true },
    { id: 'msg-8', senderId: 'u-admin', senderName: 'Dirección General Arca de Cristo', senderRole: 'admin', receiverId: 'u-docente', receiverName: 'Leoncio A. Vásquez Tavarez', content: 'Recuerden que el viernes tenemos consejo de docentes a las 3pm en Teams. Revisar la agenda que envié.', timestamp: ago(60), read: false },
  ]

  return db
}

export function seedUsers(): User[] {
  return [
    { id: 'u-docente', displayName: 'Leoncio A. Vásquez Tavarez', email: 'leoncio.vasquez@arcadecristo.edu.do', roles: ['docente'], teacherId: 't1' },
    { id: 'u-estudiante', displayName: 'Laura Fernández Castillo', email: 'laura.fernandez@arcadecristo.edu.do', roles: ['estudiante'], studentId: 's-01' },
    { id: 'u-padre', displayName: 'Luis Rodríguez García', email: 'luis.rodriguez@correo.com', roles: ['padre'] },
    { id: 'u-admin', displayName: 'Dirección General Arca de Cristo', email: 'direccion@arcadecristo.edu.do', roles: ['admin'] },
    { id: 'u-superadmin', displayName: 'Super Administrador', email: 'superadmin@arcadecristo.edu.do', roles: ['docente', 'estudiante', 'padre', 'admin'] },
  ]
}

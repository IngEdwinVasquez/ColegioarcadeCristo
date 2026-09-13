/**
 * Configuración del Asistente IA por sección (sitio) de la plataforma.
 * Cada sitio define el enfoque, los ejemplos sugeridos y el contexto que se
 * envía a la IA, para que el usuario pueda hacer el trabajo específico de esa
 * pantalla de forma más fácil y efectiva.
 */

export interface AiSectionConfig {
  /** Nombre legible de la sección. */
  label: string
  /** Marcador de ejemplo del campo de texto. */
  placeholder: string
  /** Tareas sugeridas (chips) que el usuario puede usar con un clic. */
  suggestions: string[]
  /** Contexto/enfoque que se añade al prompt del sistema. */
  guidance: string
}

const DEFAULT: AiSectionConfig = {
  label: 'la plataforma',
  placeholder: 'Ej. Ayúdame a redactar, analizar o preparar lo que necesito…',
  suggestions: [
    'Redacta un comunicado para las familias',
    'Resume esta información en puntos clave',
    'Propón un plan de acción con pasos',
  ],
  guidance: 'Ayuda al usuario con las tareas propias de la sección en la que se encuentra, de forma concreta y accionable.',
}

export const AI_SECTIONS: Record<string, AiSectionConfig> = {
  'gestion-academica': {
    label: 'Gestión académica',
    placeholder: 'Ej. Cómo organizo los cursos de 1ro de Primaria y sus asignaturas…',
    suggestions: [
      'Organiza los cursos y secciones con sus asignaturas',
      'Redacta un mensaje para los docentes sobre los cursos',
      'Propón una estructura de cursos y secciones por nivel',
      'Analiza qué asignaturas faltan por curso',
    ],
    guidance:
      'Sección de gestión académica: cursos/grados, niveles, ciclos, secciones, asignaturas y equipos de Microsoft Teams. Ayuda a organizar y nombrar cursos, asignar asignaturas, planificar la estructura académica del centro y redactar comunicaciones a docentes sobre ella.',
  },
  asignaciones: {
    label: 'Asignaciones',
    placeholder: 'Ej. Qué docentes conviene asignar a Matemáticas de 2do A…',
    suggestions: [
      'Propón la asignación de docentes por curso y asignatura',
      'Redacta el comunicado de asignación a los docentes',
      'Ayúdame a organizar las matrículas por curso',
      'Define criterios para elegir el docente encargado de un curso',
    ],
    guidance:
      'Sección de asignaciones: matrícula de estudiantes en cursos, asignación de docentes a asignaturas y designación del docente encargado por curso. Ayuda a tomar decisiones de asignación, organizar matrículas y redactar las comunicaciones correspondientes.',
  },
  'planificador-ia': {
    label: 'Planificador IA',
    placeholder: 'Ej. Planificación semanal de Lengua Española de 3ro sobre la fábula…',
    suggestions: [
      'Crea una planificación semanal completa',
      'Adapta esta planificación a estudiantes con dificultades',
      'Propón una secuencia de actividades por días',
      'Genera los indicadores de logro de esta unidad',
    ],
    guidance:
      'Sección Planificador: crear y editar planificaciones (anual, mensual, semanal y por actividad) con estructura MINERD. Ayuda a redactar objetivos, competencias, indicadores, momentos y actividades.',
  },
  planificaciones: {
    label: 'Planificaciones',
    placeholder: 'Ej. Planificación de clase de Ciencias de la Naturaleza sobre el ecosistema…',
    suggestions: [
      'Crea una planificación de clase de 45 minutos',
      'Mejora las actividades de esta planificación',
      'Añade adaptaciones para la diversidad del aula',
      'Redacta la evaluación de esta unidad',
    ],
    guidance:
      'Sección de planificaciones docentes. Ayuda a diseñar y mejorar planificaciones de clase y unidades, con momentos, recursos y evaluación.',
  },
  cronograma: {
    label: 'Cronograma de trabajo',
    placeholder: 'Ej. Plan del acompañamiento y capacitación de septiembre…',
    suggestions: [
      'Redacta el plan de un acompañamiento docente',
      'Diseña una capacitación con inicio, desarrollo y cierre',
      'Detalla el cronograma de actividades del mes',
      'Sugiere evidencias para el informe del cronograma',
    ],
    guidance:
      'Sección Cronograma de trabajo: actividades de acompañamiento y capacitación del horario, con informes de ejecución y anexos. Ayuda a preparar planes, cronogramas y informes de acompañamiento/capacitación.',
  },
  'gestion-tic': {
    label: 'Gestión TIC',
    placeholder: 'Ej. Plan TIC anual de mantenimiento e innovación…',
    suggestions: [
      'Redacta el plan de trabajo TIC del mes',
      'Diseña un plan de mantenimiento de equipos',
      'Propón actividades de innovación con M365',
      'Analiza los riesgos de infraestructura tecnológica',
    ],
    guidance:
      'Sección Gestión TIC: plan de trabajo, infraestructura, soporte, capacitación e innovación. Ayuda a planificar y documentar la coordinación de tecnología.',
  },
  clases: {
    label: 'Clases impartidas',
    placeholder: 'Ej. Quiero registrar y analizar las clases impartidas de la semana…',
    suggestions: [
      'Resume las clases impartidas de la semana',
      'Analiza el avance de los temas por curso',
      'Propón ajustes según las clases registradas',
      'Redacta una retroalimentación general del grupo',
    ],
    guidance:
      'Sección de clases impartidas. Ayuda a analizar el avance, redactar resúmenes y proponer ajustes pedagógicos.',
  },
  asistencia: {
    label: 'Asistencia',
    placeholder: 'Ej. Analiza la asistencia del grupo y propón acciones…',
    suggestions: [
      'Analiza los patrones de ausencias del grupo',
      'Redacta un comunicado por inasistencia recurrente',
      'Propón acciones para mejorar la puntualidad',
      'Resume el reporte de asistencia del mes',
    ],
    guidance:
      'Sección de asistencia. Ayuda a interpretar los datos, detectar patrones y redactar comunicaciones y acciones de mejora.',
  },
  aulas: {
    label: 'Aulas virtuales',
    placeholder: 'Ej. Prepara el contenido del aula virtual de Matemáticas…',
    suggestions: [
      'Diseña el contenido y las tareas del aula virtual',
      'Redacta una guía de estudio para el aula',
      'Propón un cronograma de publicaciones',
      'Crea rúbricas para las tareas del aula',
    ],
    guidance:
      'Sección de aulas virtuales. Ayuda a preparar contenidos, tareas, guías y rúbricas para el aula virtual.',
  },
  encuentros: {
    label: 'Encuentros virtuales',
    placeholder: 'Ej. Planifica un encuentro virtual con las familias…',
    suggestions: [
      'Prepara la agenda de un encuentro virtual',
      'Redacta la invitación al encuentro',
      'Propón dinámicas para el encuentro con familias',
      'Resume los acuerdos de un encuentro',
    ],
    guidance:
      'Sección de encuentros virtuales. Ayuda a planificar, invitar y documentar encuentros con estudiantes y familias.',
  },
  comunicados: {
    label: 'Comunicados',
    placeholder: 'Ej. Circular para las familias sobre la reunión de boletines…',
    suggestions: [
      'Redacta una circular formal para las familias',
      'Convierte esto en un comunicado breve y claro',
      'Redacta la versión para estudiantes del comunicado',
      'Resume en 5 puntos el comunicado',
    ],
    guidance:
      'Sección de comunicados. Ayuda a redactar circulares y avisos claros, con tono institucional y adaptados a la audiencia (familias, docentes, estudiantes).',
  },
  informes: {
    label: 'Informes',
    placeholder: 'Ej. Informe de gestión del mes para la dirección…',
    suggestions: [
      'Redacta un informe de gestión del período',
      'Sintetiza estos datos en un informe ejecutivo',
      'Propón conclusiones y recomendaciones',
      'Convierte esta información en una tabla de resumen',
    ],
    guidance:
      'Sección de informes/reportes. Ayuda a redactar informes profesionales, sintetizar datos y proponer conclusiones y recomendaciones.',
  },
  admisiones: {
    label: 'Admisiones',
    placeholder: 'Ej. Criterios y respuesta para las solicitudes de admisión…',
    suggestions: [
      'Redacta la respuesta a una solicitud de admisión',
      'Define criterios de evaluación de aspirantes',
      'Prepara la entrevista de admisión',
      'Resume el estado de las admisiones del período',
    ],
    guidance:
      'Sección de admisiones. Ayuda a evaluar solicitudes, redactar respuestas y organizar el proceso de admisión.',
  },
  promocion: {
    label: 'Promoción',
    placeholder: 'Ej. Analiza quiénes pasan de grado y quiénes requieren apoyo…',
    suggestions: [
      'Analiza los resultados de promoción del grupo',
      'Redacta observaciones por estudiante',
      'Propón planes de apoyo para quienes repiten',
      'Resume los indicadores de promoción',
    ],
    guidance:
      'Sección de promoción. Ayuda a analizar resultados, redactar observaciones y proponer planes de apoyo.',
  },
  personas: {
    label: 'Personas',
    placeholder: 'Ej. Redacta la descripción del puesto de coordinador…',
    suggestions: [
      'Redacta la descripción de un puesto',
      'Resume la información de una persona del staff',
      'Redacta un mensaje de bienvenida al equipo',
      'Organiza las responsabilidades por área',
    ],
    guidance:
      'Sección de personas/staff. Ayuda con descripciones de puestos, comunicaciones internas y organización del equipo.',
  },
  portafolio: {
    label: 'Portafolio docente',
    placeholder: 'Ej. Redacta la reflexión de mi portafolio docente…',
    suggestions: [
      'Redacta la reflexión de mi práctica docente',
      'Organiza las evidencias de mi portafolio',
      'Propón mejoras para el próximo período',
      'Resume mis logros del período',
    ],
    guidance:
      'Sección de portafolio docente. Ayuda a reflexionar sobre la práctica, organizar evidencias y redactar conclusiones.',
  },
  recursos: {
    label: 'Recursos',
    placeholder: 'Ej. Crea un recurso didáctico sobre fracciones…',
    suggestions: [
      'Crea un recurso didáctico para el tema',
      'Adapta este material a otro grado',
      'Propón una lista de recursos digitales del tema',
      'Convierte este contenido en una guía de estudio',
    ],
    guidance:
      'Sección de recursos. Ayuda a crear y adaptar materiales didácticos y recursos digitales.',
  },
  copilot: {
    label: 'Copilot',
    placeholder: 'Ej. Ayúdame a planificar, redactar o analizar…',
    suggestions: [
      'Ayúdame con una tarea docente',
      'Explícame un tema paso a paso',
      'Redacta un documento a partir de estas ideas',
    ],
    guidance: 'Asistente general de Microsoft 365 para el trabajo educativo.',
  },
}

export function getAiSection(pathname: string): AiSectionConfig {
  const segment = pathname.split('/').filter(Boolean).slice(-1)[0] ?? ''
  const key = segment.toLowerCase()
  return AI_SECTIONS[key] ?? { ...DEFAULT, label: segment ? segment.replace(/-/g, ' ') : DEFAULT.label }
}

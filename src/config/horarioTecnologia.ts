import type { WeeklySchedule } from '../types'

export const HORARIO_TECNOLOGIA_TITLE = 'Horario de trabajo semanal · Departamento de Tecnología'

const repetir = (v: string) => [v, v, v, v, v]

/** Filas del horario semanal del Departamento de Tecnología (Lunes a Viernes). */
export const HORARIO_TECNOLOGIA_ROWS: WeeklySchedule['rows'] = [
  { time: '7:45-8:00', cells: repetir('Acto Cívico y Entrada') },
  { time: '8:00-8:15', cells: repetir('Desayuno') },
  { time: '8:15-9:00', cells: ['Mantenimiento Equipos', 'Revisión de equipos en el laboratorio', 'Investigación Herramientas Digitales', 'Revisión Repositorio Digital', 'Comité Tecnología y Revisión FODA'] },
  { time: '9:00-9:45', cells: ['Actualizar informe Tic mensual', 'Acompañamiento Docente', 'Revisión a la plataforma Virtual M365', 'Acompañamiento Docente', 'Acompañamiento Docente'] },
  { time: '9:45-10:30', cells: ['Actualizar informe Tic mensual', 'Mantenimiento Equipos', 'Actualización plataforma M365', 'Soporte a estudiantes', 'Acompañamiento Docente'] },
  { time: '10:30-11:00', cells: repetir('Receso') },
  { time: '11:00-11:45', cells: ['Reunión Liderazgo (primer lunes de mes) y/o Revisión semanal Proyectos Club de Robótica', 'Acompañamiento Docente', 'Actualización plataforma M365', 'Capacitación M365 Personal Docente', 'Acompañamiento Docente'] },
  { time: '11:45-12:30', cells: ['Revisión semanal Proyectos Club de Robótica', 'Evaluación Herramientas · Soporte a estudiantes', 'Evaluación semanal Proyectos Club de Robótica · Planificación semanal Proyectos Club de Robótica', 'Reporte Semanal · Revisión Seguridad Equipos', 'Soporte en aulas virtuales'] },
  { time: '12:30-1:30', cells: repetir('Almuerzo') },
  { time: '1:30-2:15', cells: ['Club de Robótica', 'Club Pequeños Exploradores Grandes Inventores', 'Club de Robótica', 'Club Pequeños Exploradores Grandes Inventores', 'Planificación semanal'] },
  { time: '2:15-3:00', cells: ['Club de Robótica', 'Club Pequeños Exploradores Grandes Inventores', 'Club de Robótica', 'Club Pequeños Exploradores Grandes Inventores', 'Planificación semanal'] },
  { time: '3:00-3:45', cells: repetir('Soporte técnico equipos y redes') },
  { time: '3:45-4:00', cells: repetir('Despacho') },
]

/** Devuelve un registro `WeeklySchedule` del horario del Departamento de Tecnología. */
export function horarioTecnologia(id = 'horario-tecnologia', createdAt = new Date().toISOString()): WeeklySchedule {
  return {
    id,
    title: HORARIO_TECNOLOGIA_TITLE,
    rows: HORARIO_TECNOLOGIA_ROWS.map((r) => ({ time: r.time, cells: [...r.cells] })),
    createdAt,
  }
}

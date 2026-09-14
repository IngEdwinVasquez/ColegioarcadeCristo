/**
 * Fuente ÚNICA de las listas académicas de la plataforma (Nivel, Grado,
 * Sección, Ciclo). Todas las pantallas y portales deben usar estas constantes
 * para que los desplegables sean idénticos a los de Gestión académica.
 *
 * Las asignaturas y cursos concretos provienen de la lista ARC_Grades
 * (Gestión académica), por lo que cualquier creación/edición/duplicado/borrado
 * se refleja automáticamente en todos los sitios.
 */

/** Niveles educativos (etiqueta corta, alineada con Gestión académica). */
export const NIVELES = ['Inicial', 'Primaria', 'Secundaria']

/** Grados (1ro…6to). */
export const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to']

/** Secciones (A…G), igual que Gestión académica. */
export const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Ciclos (solo Primaria/Secundaria). */
export const CICLOS = ['Primer ciclo', 'Segundo ciclo']

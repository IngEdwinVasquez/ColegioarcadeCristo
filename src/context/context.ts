import { createContext } from 'react'
import type { GradeSection, Period, RoleMeta, Student, StudentGuardian, Subject, Teacher, User } from '../types'
import type { Role } from '../types/roles'

export type AuthState = 'anonymous' | 'loading' | 'ready' | 'no-access' | 'error'

export interface SetupIssue {
  title: string
  message: string
  hint?: string
}

export interface AppContextValue {
  authState: AuthState
  setupIssue: SetupIssue | null
  user: User | null
  role: Role | null
  setRole: (role: Role) => void
  signIn: () => Promise<void>
  logout: () => Promise<void>
  retry: () => void
  subjects: Subject[]
  grades: GradeSection[]
  periods: Period[]
  teachers: Teacher[]
  students: Student[]
  guardians: StudentGuardian[]
  users: User[]
  roleMeta: RoleMeta[]
  /** Roles de portal efectivos del usuario (roles personalizados ya expandidos) */
  effectiveRoles: Role[]
  /** Etiqueta visible de un rol (fijo o personalizado), según ARC_RoleMeta */
  roleLabel: (roleId: string) => string
  refreshCatalogs: () => Promise<void>
  subjectById: (id?: string) => Subject | undefined
  gradeById: (id?: string) => GradeSection | undefined
  periodById: (id?: string) => Period | undefined
  teacherById: (id?: string) => Teacher | undefined
  studentById: (id?: string) => Student | undefined
  userById: (id?: string) => User | undefined
}

export const AppContext = createContext<AppContextValue | null>(null)

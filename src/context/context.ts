import { createContext } from 'react'
import type { GradeSection, Period, Student, Subject, Teacher, User } from '../types'
import type { Role } from '../types/roles'

export interface AppContextValue {
  mode: 'demo' | 'm365'
  ready: boolean
  user: User | null
  role: Role | null
  setRole: (role: Role) => void
  loginAsDemo: (user: User) => void
  setCurrentUser: (user: User) => void
  logout: () => void
  subjects: Subject[]
  grades: GradeSection[]
  periods: Period[]
  teachers: Teacher[]
  students: Student[]
  users: User[]
  refreshCatalogs: () => Promise<void>
  subjectById: (id?: string) => Subject | undefined
  gradeById: (id?: string) => GradeSection | undefined
  periodById: (id?: string) => Period | undefined
  teacherById: (id?: string) => Teacher | undefined
  studentById: (id?: string) => Student | undefined
  userById: (id?: string) => User | undefined
}

export const AppContext = createContext<AppContextValue | null>(null)

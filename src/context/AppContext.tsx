import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GradeSection, Period, Student, Subject, Teacher, User } from '../types'
import type { Role } from '../types/roles'
import { dataService } from '../services/dataService'
import { appConfig } from '../config/appConfig'
import { AppContext, type AppContextValue } from './context'

const DEMO_USER_KEY = 'arca_demo_user'
const ROLE_KEY = 'arca_role'

export function AppProvider({ children }: { children: ReactNode }) {
  const mode = appConfig.m365.enabled ? 'm365' : 'demo'

  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRoleState] = useState<Role | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [grades, setGrades] = useState<GradeSection[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    const storedUser = sessionStorage.getItem(DEMO_USER_KEY)
    const storedRole = sessionStorage.getItem(ROLE_KEY) as Role | null
    if (storedUser && mode === 'demo') {
      try {
        setUser(JSON.parse(storedUser) as User)
      } catch {
        sessionStorage.removeItem(DEMO_USER_KEY)
      }
    }
    if (storedRole) setRoleState(storedRole)
    setReady(true)
    void refreshCatalogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const refreshCatalogs = useCallback(async () => {
    try {
      const [subj, gr, per, teac, stud, usr] = await Promise.all([
        dataService.getSubjects(),
        dataService.getGrades(),
        dataService.getPeriods(),
        dataService.getTeachers(),
        dataService.getStudents(),
        dataService.getUsers(),
      ])
      setSubjects(subj)
      setGrades(gr)
      setPeriods(per)
      setTeachers(teac)
      setStudents(stud)
      setUsers(usr)
    } catch (error) {
      console.error('No se pudieron cargar los catálogos', error)
    }
  }, [])

  const loginAsDemo = useCallback((demoUser: User) => {
    setUser(demoUser)
    sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser))
  }, [])

  const setCurrentUser = useCallback((nextUser: User) => {
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setRoleState(null)
    sessionStorage.removeItem(DEMO_USER_KEY)
    sessionStorage.removeItem(ROLE_KEY)
  }, [])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
    sessionStorage.setItem(ROLE_KEY, nextRole)
  }, [])

  const lookup = useMemo(
    () => ({
      subjectById: (id?: string) => subjects.find((s) => s.id === id),
      gradeById: (id?: string) => grades.find((g) => g.id === id),
      periodById: (id?: string) => periods.find((p) => p.id === id),
      teacherById: (id?: string) => teachers.find((t) => t.id === id),
      studentById: (id?: string) => students.find((s) => s.id === id),
      userById: (id?: string) => users.find((u) => u.id === id),
    }),
    [subjects, grades, periods, teachers, students, users],
  )

  const value: AppContextValue = {
    mode,
    ready,
    user,
    role,
    setRole,
    loginAsDemo,
    setCurrentUser,
    logout,
    subjects,
    grades,
    periods,
    teachers,
    students,
    users,
    refreshCatalogs,
    ...lookup,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

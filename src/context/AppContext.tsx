import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsAuthenticated } from '@azure/msal-react'
import type { GradeSection, Period, Student, StudentGuardian, Subject, Teacher, User } from '../types'
import type { Role } from '../types/roles'
import { dataService } from '../services/dataService'
import { signIn as msalSignIn, signOut as msalSignOut } from '../services/msal'
import { getMyProfile, getMyPhoto } from '../services/entraUsers'
import { SharePointSetupError, ensureProvisioned } from '../services/sharepoint'
import { graphErrorMessage } from '../services/graph'
import { appConfig } from '../config/appConfig'
import { AppContext, type AppContextValue, type AuthState, type SetupIssue } from './context'

const ROLE_KEY = 'arca_role'

interface Catalogs {
  subjects: Subject[]
  grades: GradeSection[]
  periods: Period[]
  teachers: Teacher[]
  students: Student[]
  guardians: StudentGuardian[]
  users: User[]
}

const EMPTY: Catalogs = { subjects: [], grades: [], periods: [], teachers: [], students: [], guardians: [], users: [] }

async function loadCatalogs(): Promise<Catalogs> {
  const [subjects, grades, periods, teachers, students, guardians, users] = await Promise.all([
    dataService.getSubjects(),
    dataService.getGrades(),
    dataService.getPeriods(),
    dataService.getTeachers(),
    dataService.getStudents(),
    dataService.getGuardians(),
    dataService.getUsers(),
  ])
  return { subjects, grades, periods, teachers, students, guardians, users }
}

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Determina el usuario del sistema a partir de la identidad de Entra ID:
 *  1. Roles asignados en la lista ARC_Users (módulo "Usuarios y roles").
 *  2. Correos administradores de arranque (VITE_ADMIN_EMAILS).
 *  3. Inferencia: correo presente en ARC_Teachers → docente; en ARC_Guardians → padre.
 *  4. Primer inicio de sesión del sistema sin ningún usuario registrado → administrador.
 */
function resolveUser(profile: { id: string; displayName: string; email: string; jobTitle?: string }, catalogs: Catalogs): { user: User; isNew: boolean; changed: boolean } {
  const existing = catalogs.users.find((u) => u.id === profile.id) ?? catalogs.users.find((u) => sameEmail(u.email, profile.email))
  const roles = new Set<Role>(existing?.roles ?? [])
  let teacherId = existing?.teacherId
  let studentId = existing?.studentId

  if (appConfig.m365.adminEmails.includes(profile.email)) roles.add('admin')

  const teacher = catalogs.teachers.find((t) => sameEmail(t.email, profile.email))
  if (teacher) {
    roles.add('docente')
    teacherId = teacherId ?? teacher.id
  }
  if (catalogs.guardians.some((g) => sameEmail(g.email, profile.email))) roles.add('padre')
  if (studentId) roles.add('estudiante')

  const bootstrap = catalogs.users.length === 0 && roles.size === 0
  if (bootstrap) roles.add('admin')

  const nextRoles = [...roles]
  const user: User = {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.email,
    jobTitle: profile.jobTitle,
    roles: nextRoles,
    teacherId,
    studentId,
    updatedAt: new Date().toISOString(),
  }
  const changed =
    !existing ||
    existing.id !== user.id ||
    existing.displayName !== user.displayName ||
    !sameEmail(existing.email, user.email) ||
    existing.teacherId !== user.teacherId ||
    existing.roles.length !== nextRoles.length ||
    existing.roles.some((r) => !nextRoles.includes(r))
  return { user, isNew: !existing, changed }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useIsAuthenticated()

  const [authState, setAuthState] = useState<AuthState>('anonymous')
  const [setupIssue, setSetupIssue] = useState<SetupIssue | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRoleState] = useState<Role | null>(() => (sessionStorage.getItem(ROLE_KEY) as Role | null) ?? null)
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const photoUrlRef = useRef<string | null>(null)

  const refreshCatalogs = useCallback(async () => {
    try {
      setCatalogs(await loadCatalogs())
    } catch (error) {
      console.error('No se pudieron cargar los catálogos', error)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthState('anonymous')
      setUser(null)
      setCatalogs(EMPTY)
      return
    }
    let cancelled = false
    setAuthState('loading')
    setSetupIssue(null)

    const bootstrap = async () => {
      const profile = await getMyProfile()

      try {
        await ensureProvisioned()
      } catch (error) {
        if (error instanceof SharePointSetupError) throw error
        // Usuarios sin permiso de creación de listas: se continúa; si faltan listas, fallará la carga.
        console.warn('Aprovisionamiento de listas omitido:', graphErrorMessage(error))
      }

      const loaded = await loadCatalogs()
      const resolved = resolveUser(profile, loaded)
      if (resolved.changed) {
        try {
          await dataService.saveUser(resolved.user)
          loaded.users = [...loaded.users.filter((u) => u.id !== resolved.user.id && !sameEmail(u.email, resolved.user.email)), resolved.user]
        } catch (error) {
          console.warn('No se pudo registrar el usuario en ARC_Users:', graphErrorMessage(error))
        }
      }

      const photo = await getMyPhoto()
      if (cancelled) return
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = photo
      setCatalogs(loaded)
      setUser({ ...resolved.user, photoUrl: photo ?? undefined })
      const storedRole = sessionStorage.getItem(ROLE_KEY) as Role | null
      if (storedRole && !resolved.user.roles.includes(storedRole)) {
        sessionStorage.removeItem(ROLE_KEY)
        setRoleState(null)
      }
      setAuthState(resolved.user.roles.length > 0 ? 'ready' : 'no-access')
    }

    bootstrap().catch((error: unknown) => {
      if (cancelled) return
      console.error('Error al iniciar la sesión', error)
      if (error instanceof SharePointSetupError) {
        setSetupIssue({ title: 'SharePoint no está listo', message: error.message, hint: error.hint })
      } else {
        setSetupIssue({
          title: 'No se pudo conectar con Microsoft 365',
          message: graphErrorMessage(error),
          hint: 'Verifique que el administrador haya concedido consentimiento a los permisos de la aplicación (docs/M365_SETUP.md).',
        })
      }
      setAuthState('error')
    })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, attempt])

  const signIn = useCallback(() => msalSignIn(), [])

  const logout = useCallback(async () => {
    sessionStorage.removeItem(ROLE_KEY)
    setRoleState(null)
    setUser(null)
    await msalSignOut()
  }, [])

  const retry = useCallback(() => {
    sessionStorage.removeItem('arca_spo_provisioned_v1')
    setAttempt((n) => n + 1)
  }, [])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
    sessionStorage.setItem(ROLE_KEY, nextRole)
  }, [])

  const lookup = useMemo(
    () => ({
      subjectById: (id?: string) => catalogs.subjects.find((s) => s.id === id),
      gradeById: (id?: string) => catalogs.grades.find((g) => g.id === id),
      periodById: (id?: string) => catalogs.periods.find((p) => p.id === id),
      teacherById: (id?: string) => catalogs.teachers.find((t) => t.id === id),
      studentById: (id?: string) => catalogs.students.find((s) => s.id === id),
      userById: (id?: string) => catalogs.users.find((u) => u.id === id),
    }),
    [catalogs],
  )

  const value: AppContextValue = {
    authState,
    setupIssue,
    user,
    role,
    setRole,
    signIn,
    logout,
    retry,
    ...catalogs,
    refreshCatalogs,
    ...lookup,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

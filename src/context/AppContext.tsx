import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsAuthenticated } from '@azure/msal-react'
import type { GradeSection, Period, RoleMeta, Student, StudentGuardian, Subject, Teacher, User } from '../types'
import { ROLE_LABELS, expandPortalRoles, type Role } from '../types/roles'
import { dataService } from '../services/dataService'
import { signIn as msalSignIn, signOut as msalSignOut } from '../services/msal'
import { getMyProfile, getMyPhoto } from '../services/entraUsers'
import { ListProvisioningError, SharePointSetupError, ensureProvisioned } from '../services/sharepoint'
import { graphErrorMessage } from '../services/graph'
import { appConfig } from '../config/appConfig'
import { AppContext, type AppContextValue, type AuthState, type SetupIssue } from './context'
import { DATA_CHANGED_EVENT } from '../hooks/useCollection'

const ROLE_KEY = 'arca_role'

interface Catalogs {
  subjects: Subject[]
  grades: GradeSection[]
  periods: Period[]
  teachers: Teacher[]
  students: Student[]
  guardians: StudentGuardian[]
  users: User[]
  roleMeta: RoleMeta[]
}

const EMPTY: Catalogs = { subjects: [], grades: [], periods: [], teachers: [], students: [], guardians: [], users: [], roleMeta: [] }

async function loadCatalogs(): Promise<Catalogs> {
  const [subjects, grades, periods, teachers, students, guardians, users, roleMeta] = await Promise.all([
    dataService.getSubjects(),
    dataService.getGrades(),
    dataService.getPeriods(),
    dataService.getTeachers(),
    dataService.getStudents(),
    dataService.getGuardians(),
    dataService.getUsers(),
    dataService.getRoleMeta(),
  ])
  return { subjects, grades, periods, teachers, students, guardians, users, roleMeta }
}

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Determina el usuario del sistema a partir de la identidad de Entra ID:
 *  1. Roles asignados en la lista ARC_Users (módulo "Usuarios y roles").
 *  2. Correos superadministradores (VITE_ADMIN_EMAILS): todos los portales.
 *  3. Inferencia: correo presente en ARC_Teachers → docente; en ARC_Guardians → padre.
 *  4. Primer inicio de sesión del sistema sin ningún usuario registrado → administrador.
 */
function resolveUser(profile: { id: string; displayName: string; email: string; jobTitle?: string }, catalogs: Catalogs): { user: User; isNew: boolean; changed: boolean } {
  const existing = catalogs.users.find((u) => u.id === profile.id) ?? catalogs.users.find((u) => sameEmail(u.email, profile.email))
  // Los roles guardados en ARC_Users son la fuente de verdad: si Tecnología
  // desmarca un rol, no se vuelve a inferir en el siguiente inicio de sesión.
  const roles = new Set<string>(existing?.roles ?? [])
  const teacher = catalogs.teachers.find((t) => t.userId === profile.id) ?? catalogs.teachers.find((t) => sameEmail(t.email, profile.email))
  const student = catalogs.students.find((st) => st.userId === profile.id) ?? catalogs.students.find((st) => sameEmail(st.email, profile.email))
  const teacherId = teacher?.id ?? existing?.teacherId
  const studentId = student?.id ?? existing?.studentId

  if (!existing) {
    // Primer inicio de sesión: se infiere el rol desde las fichas registradas.
    if (teacher) roles.add('docente')
    if (studentId) roles.add('estudiante')
    if (catalogs.guardians.some((g) => g.userId === profile.id || sameEmail(g.email, profile.email))) roles.add('padre')
  }

  // Superadministradores (VITE_ADMIN_EMAILS): acceso a todos los portales.
  if (appConfig.m365.adminEmails.includes(profile.email)) {
    for (const r of Object.keys(ROLE_LABELS) as Role[]) roles.add(r)
  }

  const bootstrap = catalogs.users.length === 0 && roles.size === 0
  if (bootstrap) roles.add('admin')

  const nextRoles = [...roles] as Role[]
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
    existing.studentId !== user.studentId ||
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

  // Refresca los catálogos globales cuando cualquier módulo guarda o elimina datos.
  useEffect(() => {
    if (authState !== 'ready') return
    let timer: number | undefined
    const onChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void refreshCatalogs(), 300)
    }
    window.addEventListener(DATA_CHANGED_EVENT, onChange)
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, onChange)
      window.clearTimeout(timer)
    }
  }, [authState, refreshCatalogs])

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

      let provisioningError: unknown = null
      try {
        const result = await ensureProvisioned()
        if (result.created.length > 0) console.info('Listas creadas en SharePoint:', result.created.join(', '))
      } catch (error) {
        if (error instanceof SharePointSetupError) throw error
        // Puede fallar por falta de permisos del usuario; si además faltan listas, se informa abajo.
        provisioningError = error
        console.warn('Aprovisionamiento de listas incompleto:', graphErrorMessage(error))
      }

      let loaded: Catalogs
      try {
        loaded = await loadCatalogs()
      } catch (error) {
        const message = graphErrorMessage(error)
        if (/list.*not found|not found.*list/i.test(message)) {
          const cause = provisioningError ? graphErrorMessage(provisioningError) : message
          throw new SharePointSetupError(
            `Faltan listas de datos en el sitio de SharePoint: ${cause}`,
            provisioningError instanceof ListProvisioningError
              ? provisioningError.hint
              : 'Inicie sesión con una cuenta que sea miembro (edición) o propietaria del sitio para que la intranet cree las listas automáticamente.',
          )
        }
        throw error
      }
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
      setAuthState(expandPortalRoles(resolved.user.roles, loaded.roleMeta).length > 0 ? 'ready' : 'no-access')
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
    sessionStorage.removeItem('arca_spo_provisioned_v2')
    setAttempt((n) => n + 1)
  }, [])

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole)
    sessionStorage.setItem(ROLE_KEY, nextRole)
  }, [])

  const effectiveRoles = useMemo(() => expandPortalRoles(user?.roles ?? [], catalogs.roleMeta), [user, catalogs.roleMeta])

  const roleLabel = useCallback(
    (roleId: string) => {
      const meta = catalogs.roleMeta.find((m) => m.id === roleId)
      if (meta?.label) return meta.label
      return (ROLE_LABELS as Record<string, string>)[roleId] ?? roleId
    },
    [catalogs.roleMeta],
  )

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
    effectiveRoles,
    roleLabel,
    refreshCatalogs,
    ...lookup,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

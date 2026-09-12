import { useMemo, useState } from 'react'
import { useToastController } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { useApp } from '../../context/useApp'
import { useCollection } from '../../hooks/useCollection'
import { appConfig, isAdminEmail } from '../../config/appConfig'
import { dataService } from '../../services/dataService'
import { DashboardPlanificacion } from './DashboardPlanificacion'
import { ModalCrearIA } from './ModalCrearIA'
import { EditorPlan } from './EditorPlan'
import { planificadorService, type PlanLabels } from './planificadorService'
import type { PlanificacionDinamica, TeacherAssignment } from '../../types'

export function PlanificadorPage() {
  const toaster = useToastController()
  const { user, grades, subjects, gradeById, subjectById, role } = useApp()
  const plansCol = useCollection<PlanificacionDinamica>(planificadorService.getAll, planificadorService.save, planificadorService.remove)
  const assignCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)

  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PlanificacionDinamica | null>(null)
  const [busyId, setBusyId] = useState<string>()

  const isStaff = role === 'admin' || role === 'tecnologia' || role === 'psicologia'

  const mine = useMemo(() => {
    const items = plansCol.items
    if (isStaff && !user?.teacherId) return items
    return items.filter((p) => p.teacherId === user?.teacherId)
  }, [plansCol.items, user?.teacherId, isStaff])

  // Pares grado–asignatura permitidos: los asignados al docente (staff sin ficha ve todos).
  const assignedPairs = useMemo(() => {
    const staffAll = (isStaff && !user?.teacherId) || isAdminEmail(user?.email)
    if (staffAll) return grades.flatMap((g) => subjects.map((s) => ({ gradeId: g.id, subjectId: s.id })))
    const seen = new Set<string>()
    const pairs: Array<{ gradeId: string; subjectId: string }> = []
    for (const a of assignCol.items) {
      if (a.teacherId !== user?.teacherId) continue
      const key = `${a.gradeId}::${a.subjectId}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({ gradeId: a.gradeId, subjectId: a.subjectId })
    }
    return pairs
  }, [assignCol.items, isStaff, user?.teacherId, grades, subjects])

  const counts = useMemo(() => ({
    todas: mine.length,
    activa: mine.filter((p) => p.estado === 'activa').length,
    borrador: mine.filter((p) => p.estado === 'borrador').length,
    archivada: mine.filter((p) => p.estado === 'archivada').length,
  }), [mine])

  const filtered = useMemo(() => {
    return mine
      .filter((p) => !filter || p.estado === filter)
      .filter((p) => !search || p.tema.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => ((a.updatedAt ?? a.createdAt) < (b.updatedAt ?? b.createdAt) ? 1 : -1))
  }, [mine, filter, search])

  const labels = (plan: PlanificacionDinamica): PlanLabels => ({
    grado: gradeById(plan.gradeId)?.name ?? '',
    asignatura: subjectById(plan.subjectId)?.name ?? '',
    teacher: user?.displayName,
    institution: appConfig.institution,
  })

  const gradeName = (id: string) => gradeById(id)?.name ?? '—'
  const subjectName = (id: string) => subjectById(id)?.name ?? '—'

  const handleGenerated = async (plan: PlanificacionDinamica) => {
    try {
      await plansCol.save(plan)
      toaster.dispatchToast('Planificación generada y guardada. Ajústala si lo deseas.', { intent: 'success' })
      setEditing(plan)
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo guardar.', { intent: 'error' })
    }
  }

  const handleSave = async (plan: PlanificacionDinamica) => {
    await plansCol.save(plan)
  }

  const handleShare = async (plan: PlanificacionDinamica) => {
    setBusyId(plan.id)
    try {
      const url = await planificadorService.compartir(plan, labels(plan))
      try { await navigator.clipboard?.writeText(url) } catch { /* sin permiso de portapapeles */ }
      toaster.dispatchToast('Planificación compartida. Enlace copiado al portapapeles.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo compartir.', { intent: 'error' })
    } finally {
      setBusyId(undefined)
    }
  }

  const handleDownload = (plan: PlanificacionDinamica) => planificadorService.descargar(plan, labels(plan))

  const handleDelete = async (plan: PlanificacionDinamica) => {
    if (!window.confirm(`¿Eliminar la planificación «${plan.tema}»? Esta acción no se puede deshacer.`)) return
    try {
      await plansCol.remove(plan.id)
      toaster.dispatchToast('Planificación eliminada.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo eliminar.', { intent: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Planificador IA"
        subtitle="Crea planificaciones anuales, mensuales, semanales y por actividad en 3 clics con el asistente de IA. Autoguardado, compartir y descargar."
      />

      <DashboardPlanificacion
        plans={filtered}
        loading={plansCol.loading}
        filter={filter}
        onFilter={setFilter}
        search={search}
        onSearch={setSearch}
        onNew={() => setCreateOpen(true)}
        onEdit={setEditing}
        onShare={(p) => void handleShare(p)}
        onDownload={handleDownload}
        onDelete={(p) => void handleDelete(p)}
        busyId={busyId}
        gradeName={gradeName}
        subjectName={subjectName}
        counts={counts}
      />

      <ModalCrearIA
        open={createOpen}
        onOpenChange={setCreateOpen}
        grades={grades.map((g) => ({ id: g.id, name: g.name }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        assignments={assignedPairs}
        teacherId={user?.teacherId ?? user?.id ?? ''}
        onGenerated={handleGenerated}
        onError={(m) => toaster.dispatchToast(m, { intent: 'error' })}
      />

      <EditorPlan
        plan={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onShare={(p) => void handleShare(p)}
        onDownload={handleDownload}
      />
    </div>
  )
}

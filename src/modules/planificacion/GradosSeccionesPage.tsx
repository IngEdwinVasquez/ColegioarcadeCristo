import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Checkbox, Switch, Text, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens } from '@fluentui/react-components'
import { SaveRegular, InfoRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { TeacherGradeConfig } from '../../types'
import { NIVELES, SECCIONES } from './curriculo'

const useStyles = makeStyles({
  masterCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: '14px',
    background: 'linear-gradient(120deg, #0A1F2B 0%, #0B2E3F 100%)',
    color: '#fff',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  matrix: { overflowX: 'auto', marginTop: '12px' },
  levelHead: {
    background: tokens.colorNeutralBackground2,
  },
  cellCheck: { display: 'flex', justifyContent: 'center' },
  hint: { color: tokens.colorNeutralForeground2, fontSize: '13px', marginBottom: '16px' },
  saved: { color: tokens.colorPaletteGreenForeground1, fontWeight: 600 },
})

const key = (gradeId: string, section: string) => `${gradeId}::${section}`

export function GradosSeccionesPage() {
  const styles = useStyles()
  const { user, grades } = useApp()

  const configsCol = useCollection<TeacherGradeConfig>(dataService.getTeacherConfigs, dataService.saveTeacherConfig)

  const teacherId = user?.teacherId ?? ''
  const existing = configsCol.items.find((c) => c.teacherId === teacherId)

  const [masterMode, setMasterMode] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (existing) {
      setMasterMode(existing.masterMode)
      setSelection(new Set(existing.selection.map((s) => key(s.gradeId, s.section))))
    } else {
      setMasterMode(false)
      setSelection(new Set())
    }
  }, [existing])

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof grades>()
    for (const g of grades) {
      const level = g.level || 'Primaria'
      if (!groups.has(level)) groups.set(level, [])
      groups.get(level)?.push(g)
    }
    return NIVELES.filter((n) => groups.has(n)).map((n) => ({ level: n, items: groups.get(n) ?? [] }))
  }, [grades])

  const toggleCell = (gradeId: string, section: string, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev)
      const k = key(gradeId, section)
      if (checked) next.add(k)
      else next.delete(k)
      return next
    })
    setSaved(false)
  }

  const toggleGradeRow = (gradeId: string, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev)
      for (const s of SECCIONES) {
        const k = key(gradeId, s)
        if (checked) next.add(k)
        else next.delete(k)
      }
      return next
    })
    setSaved(false)
  }

  const save = async () => {
    const selectionArr = grades
      .flatMap((g) => SECCIONES.map((s) => ({ gradeId: g.id, section: s })))
      .filter((x) => selection.has(key(x.gradeId, x.section)))
    const config: TeacherGradeConfig = {
      id: existing?.id ?? `tgc-${teacherId}`,
      teacherId,
      selection: selectionArr,
      masterMode,
      updatedAt: new Date().toISOString(),
    }
    await configsCol.save(config)
    setSaved(true)
  }

  const selectedCount = selection.size

  return (
    <div>
      <PageHeader
        title="Grados y Secciones"
        subtitle="Seleccione los cursos (grados) y secciones que imparte. Esta asignación alimenta sus planificaciones, horario y listados de estudiantes."
        actions={
          <Button appearance="primary" icon={<SaveRegular />} onClick={() => void save()} disabled={configsCol.saving}>
            {configsCol.saving ? 'Guardando…' : 'Guardar asignación'}
          </Button>
        }
      />

      <div className={styles.masterCard}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <InfoRegular fontSize={20} />
          <div>
            <Text weight="semibold" block style={{ color: '#fff' }}>Modo Máster</Text>
            <Text size={200} block style={{ color: 'rgba(255,255,255,0.7)' }}>
              Permite ver y trabajar con todos los grados y secciones (útil para coordinadores y pruebas).
            </Text>
          </div>
        </div>
        <Switch
          checked={masterMode}
          onChange={(_, d) => {
            setMasterMode(d.checked)
            setSaved(false)
          }}
          label={masterMode ? 'Activo' : 'Inactivo'}
        />
      </div>

      {!teacherId && (
        <div className={styles.hint}>
          Su cuenta aún no está vinculada a una ficha de docente. Contacte a Tecnología para vincularla antes de asignar grados.
        </div>
      )}

      {saved && <Text className={styles.saved} block style={{ marginBottom: '12px' }}>✓ Asignación guardada correctamente.</Text>}

      <Text size={300} block className={styles.hint}>
        {selectedCount} combinación(es) de curso y sección seleccionada(s). Marque la casilla del encabezado de un grado para seleccionar todas sus secciones.
      </Text>

      <div className={styles.matrix}>
        <Table aria-label="Matriz de grados y secciones" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Grado</TableHeaderCell>
              {SECCIONES.map((s) => (
                <TableHeaderCell key={s}><div className={styles.cellCheck}>{s}</div></TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((group) => (
              <TableRowGroup key={group.level} level={group.level}>
                {group.items.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <Checkbox
                        checked={SECCIONES.every((s) => selection.has(key(g.id, s)))}
                        onChange={(_, d) => toggleGradeRow(g.id, d.checked === true)}
                        label={g.name}
                      />
                    </TableCell>
                    {SECCIONES.map((s) => (
                      <TableCell key={s}>
                        <div className={styles.cellCheck}>
                          <Checkbox
                            checked={selection.has(key(g.id, s))}
                            onChange={(_, d) => toggleCell(g.id, s, d.checked === true)}
                            aria-label={`${g.name} sección ${s}`}
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableRowGroup>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function TableRowGroup({ level, children }: { level: string; children: ReactNode }) {
  return (
    <>
      <TableRow>
        <TableCell style={{ background: 'var(--superficie)', fontWeight: 700 }} colSpan={SECCIONES.length + 1}>
          {level}
        </TableCell>
      </TableRow>
      {children}
    </>
  )
}

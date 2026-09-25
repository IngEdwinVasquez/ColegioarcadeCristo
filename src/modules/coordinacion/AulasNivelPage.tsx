import { AulasViewManagement } from '../aulas/aulas'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'

/** Aulas del nivel de coordinación (Inicial / Primaria / Secundaria). */
export function AulasNivelPage() {
  const { level, setLevel, levels } = useCoordinationLevel()
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
      </div>
      <AulasViewManagement
        base="/coordinacion/aulas"
        scope={{ kind: 'todos', level }}
        pageTitle={`Aulas de ${level}`}
        subtitle="Aulas del nivel de coordinación seleccionado, con sus asignaturas y aulas de Teams."
      />
    </div>
  )
}

import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { BriefcaseRegular } from '@fluentui/react-icons'

export function PortafolioPage() {
  return (
    <div>
      <PageHeader
        title="Portafolio Docente y Agenda"
        subtitle="Evidencias de su práctica docente, agenda personal y seguimiento de su desarrollo profesional."
      />
      <EmptyStateView
        title="Sección en construcción"
        message="Aquí podrá registrar evidencias, documentos de su práctica y organizar su agenda docente."
        icon={<BriefcaseRegular />}
      />
    </div>
  )
}

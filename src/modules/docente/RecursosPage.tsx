import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { FolderRegular } from '@fluentui/react-icons'

export function RecursosPage() {
  return (
    <div>
      <PageHeader
        title="Recursos e Interactivos"
        subtitle="Banco de materiales didácticos, presentaciones, guías y recursos interactivos para sus clases."
      />
      <EmptyStateView
        title="Sección en construcción"
        message="Aquí podrá organizar y compartir recursos didácticos e interactivos por asignatura y grado."
        icon={<FolderRegular />}
      />
    </div>
  )
}

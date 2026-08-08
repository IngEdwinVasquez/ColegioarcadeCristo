import type { ReactNode } from 'react'
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, makeStyles, tokens } from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  content: { paddingTop: tokens.spacingVerticalM },
})

interface ModalFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  width?: number
}

export function ModalForm({ open, onOpenChange, title, subtitle, children, actions, width = 680 }: ModalFormProps) {
  const styles = useStyles()
  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface style={{ maxWidth: width, width: '100%' }}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="subtle" aria-label="Cerrar" icon={<DismissRegular />} />
              </DialogTrigger>
            }
          >
            {title}
            {subtitle && <div style={{ fontSize: '13px', fontWeight: 400, color: tokens.colorNeutralForeground2 }}>{subtitle}</div>}
          </DialogTitle>
          <DialogContent className={styles.content}>{children}</DialogContent>
          {actions && <DialogActions>{actions}</DialogActions>}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

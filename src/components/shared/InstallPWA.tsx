import { useEffect, useState } from 'react'
import { Button } from '@fluentui/react-components'
import { ArrowDownloadRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !deferred) return null

  return (
    <Button
      appearance="subtle"
      icon={installed ? <CheckmarkCircleRegular /> : <ArrowDownloadRegular />}
      style={{ color: 'rgba(255,255,255,0.92)', justifyContent: 'flex-start', width: '100%' }}
      onClick={async () => {
        await deferred.prompt()
        setDeferred(null)
      }}
    >
      Instalar aplicación
    </Button>
  )
}

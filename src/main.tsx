import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMsal } from './services/msal'
import { dataService } from './services/dataService'
import { graphGetAll, graphRequest } from './services/graph'
import { getTeamRoster, classifyDirectory } from './services/importM365'
import { listTenantTeams, resolveTeamUrl } from './services/teamsEdu'

if (import.meta.env.DEV) {
  // Gancho de desarrollo para pruebas desde la consola del navegador (no se incluye en producción).
  ;(window as unknown as { __arca?: unknown }).__arca = { dataService, graphGetAll, graphRequest, getTeamRoster, classifyDirectory, listTenantTeams, resolveTeamUrl }
}

const root = createRoot(document.getElementById('root')!)

// MSAL debe inicializarse y procesar el redirect de Entra ID antes de montar la app.
initMsal()
  .catch((error: unknown) => {
    console.error('Error al procesar la autenticación', error)
  })
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })

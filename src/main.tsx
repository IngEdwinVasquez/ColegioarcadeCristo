import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMsal } from './services/msal'

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

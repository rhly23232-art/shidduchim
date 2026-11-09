import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initBackend } from './lib/api'
import './index.css'

// Choose the storage (Supabase / claude.ai database / local demo) before the first render.
void initBackend().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

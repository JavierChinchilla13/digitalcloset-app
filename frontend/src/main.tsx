import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/Toast.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import ErrorState from './components/ErrorState.tsx'
import { initTheme } from './store/useThemeStore.ts'

// Task 67: apply the saved/device theme and keep following the device.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Task 22: last resort. Pages, the persona preview and the upload flow have
        their own, more local boundaries; this catches anything that escapes
        them (or crashes the layout itself) so the user never gets a blank
        page - just a way to reload. */}
    <ErrorBoundary
      fallback={() => (
        <div className="min-h-screen bg-background-main flex items-center justify-center">
          <ErrorState
            title="Something went wrong"
            message="VYSVI hit an unexpected problem. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
            retryLabel="Reload"
          />
        </div>
      )}
    >
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)

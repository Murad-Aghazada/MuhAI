import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { configureClient } from './lib/client.js'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

// The one place in the web app that reads Vite's environment. client.js is
// also bundled by Metro for the Expo app, where `import.meta` does not parse,
// so the platform tells the client where the API is rather than the other way
// round. Empty is correct in production: nginx proxies /api on this origin.
configureClient({
  baseUrl: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : ''),
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

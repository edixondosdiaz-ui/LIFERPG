import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'
import './tailwind.css'
import { palette } from './design/tokens'

document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.background.violet)

const root = ReactDOM.createRoot(document.getElementById('root'))
if (import.meta.env.DEV && window.location.pathname === '/__visual') {
  import('./design/Preview.jsx').then(({ default: Preview }) => root.render(<Preview />))
} else root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)

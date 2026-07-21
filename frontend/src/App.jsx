import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

const SESSION_KEY = 'ponderada_session'
const ADMIN_TOKEN_KEY = 'ponderada_admin_token'

// sessionStorage: sobrevive a F5, some ao fechar a aba/navegador.
function readStored(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function App() {
  const [session, setSession] = useState(() => readStored(SESSION_KEY))
  const [adminToken, setAdminToken] = useState(() => readStored(ADMIN_TOKEN_KEY))

  const isAdmin = window.location.pathname === '/admin'

  const handleLogin = (data) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
    setSession(data)
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  const handleAdminLogin = (token) => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, JSON.stringify(token))
    setAdminToken(token)
  }

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken(null)
  }

  if (isAdmin) {
    if (!adminToken) return <AdminLogin onLogin={handleAdminLogin} />
    return <AdminDashboard token={adminToken} onLogout={handleAdminLogout} />
  }

  if (!session) return <Login onLogin={handleLogin} />
  return <Dashboard session={session} onLogout={handleLogout} />
}

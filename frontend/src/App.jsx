import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [adminToken, setAdminToken] = useState(null)

  const isAdmin = window.location.pathname === '/admin'

  if (isAdmin) {
    if (!adminToken) return <AdminLogin onLogin={setAdminToken} />
    return <AdminDashboard token={adminToken} onLogout={() => setAdminToken(null)} />
  }

  if (!session) return <Login onLogin={setSession} />
  return <Dashboard session={session} onLogout={() => setSession(null)} />
}

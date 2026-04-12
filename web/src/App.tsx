import type { ReactElement } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Buckets from './pages/Buckets'
import Objects from './pages/Objects'
import Settings from './pages/Settings'
import About from './pages/About'
import Login from './pages/Login'
import AuditLogs from './pages/AuditLogs'
import Migration from './pages/Migration'
import { useAuth } from './hooks/useAuth'

function AdminRoute({ children }: { children: ReactElement }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/buckets" element={<Buckets />} />
        <Route path="/buckets/:bucket/*" element={<Objects />} />
        <Route path="/migration" element={<AdminRoute><Migration /></AdminRoute>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App

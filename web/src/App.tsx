import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Buckets from './pages/Buckets'
import Objects from './pages/Objects'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Login from './pages/Login'
import { useAuth } from './hooks/useAuth'

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
        <Route path="/buckets/:bucket" element={<Objects />} />
        <Route path="/buckets/:bucket/*" element={<Objects />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App

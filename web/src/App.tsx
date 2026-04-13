import { Suspense, lazy, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import Layout from './components/Layout'
import { useAuth } from './hooks/useAuth'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Buckets = lazy(() => import('./pages/Buckets'))
const Objects = lazy(() => import('./pages/Objects'))
const Settings = lazy(() => import('./pages/Settings'))
const About = lazy(() => import('./pages/About'))
const Login = lazy(() => import('./pages/Login'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Migration = lazy(() => import('./pages/Migration'))
const AccessControl = lazy(() => import('./pages/AccessControl'))
const Tickets = lazy(() => import('./pages/Tickets'))
const Tester = lazy(() => import('./pages/Tester'))

function AdminRoute({ children }: { children: ReactElement }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(PermUserManage, PermCredentialManage, PermRoleManage, PermBucketManage, PermBucketAssign, PermBucketQuota, PermBucketTraffic, PermBucketPolicy)) {
    return <Navigate to="/" replace />
  }
  return children
}

function SuperAdminRoute({ children }: { children: ReactElement }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return children
}

function PermissionRoute({ children, permissions }: { children: ReactElement; permissions: string[] }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(...permissions)) {
    return <Navigate to="/" replace />
  }
  return children
}

const PermUserManage = 'user:manage'
const PermCredentialManage = 'credential:manage'
const PermRoleManage = 'role:manage'
const PermBucketManage = 'bucket:manage'
const PermBucketAssign = 'bucket:assign'
const PermBucketQuota = 'bucket:quota'
const PermBucketTraffic = 'bucket:traffic'
const PermBucketPolicy = 'bucket:policy'
const PermTicketCreate = 'ticket:create'
const PermTicketRead = 'ticket:read'
const PermTicketManage = 'ticket:manage'

export default function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>}>
        <Login />
      </Suspense>
    )
  }

  return (
    <Layout>
      <Suspense fallback={<div style={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/buckets" element={<Buckets />} />
          <Route path="/buckets/:bucket/*" element={<Objects />} />
          <Route path="/migration" element={<PermissionRoute permissions={[PermBucketManage]}><Migration /></PermissionRoute>} />
          <Route path="/iam" element={<AdminRoute><AccessControl /></AdminRoute>} />
          <Route path="/tickets" element={<PermissionRoute permissions={[PermTicketCreate, PermTicketRead, PermTicketManage]}><Tickets /></PermissionRoute>} />
          <Route path="/tester" element={<Tester />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-logs" element={<SuperAdminRoute><AuditLogs /></SuperAdminRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

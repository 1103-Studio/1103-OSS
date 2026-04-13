import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getApiEndpoint, logoutUser } from '../lib/api'

interface Credentials {
  accessKey: string
  sessionToken: string
  endpoint: string
  publicEndpoint?: string
  username?: string
  displayName?: string
  isAdmin?: boolean
  subscription?: {
    activePlans?: Array<{ id: number }>
    totalStorageBytes?: number
    totalTrafficBytes?: number
    totalObjectQuota?: number
    expiresAt?: string | null
  }
  roles?: Array<{ id: number; name: string; description?: string; permissions?: string[] }>
  permissions?: string[]
}

interface AuthContextType {
  credentials: Credentials | null
  isAuthenticated: boolean
  isAdmin: boolean
  permissions: string[]
  hasPermission: (...required: string[]) => boolean
  login: (creds: Credentials) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const CREDENTIALS_KEY = 'oss_credentials'

function readStoredCredentials() {
  const sessionValue = sessionStorage.getItem(CREDENTIALS_KEY)
  if (sessionValue) {
    return sessionValue
  }

  const legacyLocalValue = localStorage.getItem(CREDENTIALS_KEY)
  if (!legacyLocalValue) {
    return null
  }

  sessionStorage.setItem(CREDENTIALS_KEY, legacyLocalValue)
  localStorage.removeItem(CREDENTIALS_KEY)
  return legacyLocalValue
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const normalizeCredentials = (value: Credentials): Credentials => ({
    ...value,
    endpoint: value.endpoint || getApiEndpoint(),
    publicEndpoint: value.publicEndpoint || value.endpoint || getApiEndpoint(),
    isAdmin: !!value.isAdmin,
    roles: value.roles || [],
    permissions: value.permissions || [],
    sessionToken: value.sessionToken || '',
  })

  useEffect(() => {
    const stored = readStoredCredentials()
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Credentials
        setCredentials(normalizeCredentials(parsed))
      } catch {
        sessionStorage.removeItem(CREDENTIALS_KEY)
        localStorage.removeItem(CREDENTIALS_KEY)
      }
    }
  }, [])

  const login = (creds: Credentials) => {
    const normalized = normalizeCredentials(creds)
    sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(normalized))
    localStorage.removeItem(CREDENTIALS_KEY)
    setCredentials(normalized)
  }

  const logout = async () => {
    try {
      if (credentials?.sessionToken) {
        await logoutUser()
      }
    } catch {
      // 忽略登出接口失败，仍然清理本地状态
    }
    sessionStorage.removeItem(CREDENTIALS_KEY)
    localStorage.removeItem(CREDENTIALS_KEY)
    setCredentials(null)
  }

  const permissions = credentials?.isAdmin ? ['*'] : (credentials?.permissions || [])
  const hasPermission = (...required: string[]) => {
    if (credentials?.isAdmin) {
      return true
    }
    if (!required.length) {
      return false
    }
    return required.some((permission) => permissions.includes(permission) || permissions.includes('*'))
  }

  return (
    <AuthContext.Provider value={{ credentials, isAuthenticated: !!credentials, isAdmin: !!credentials?.isAdmin, permissions, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

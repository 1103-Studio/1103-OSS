import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getApiEndpoint } from '../lib/api'

interface Credentials {
  accessKey: string
  secretKey: string
  endpoint: string
  publicEndpoint?: string
  username?: string
  displayName?: string
  isAdmin?: boolean
  roles?: Array<{ id: number; name: string; description?: string; permissions?: string[] }>
  permissions?: string[]
}

interface AuthContextType {
  credentials: Credentials | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (creds: Credentials) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('oss_credentials')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Credentials
        setCredentials({
          ...parsed,
          endpoint: parsed.endpoint || getApiEndpoint(),
          publicEndpoint: parsed.publicEndpoint || parsed.endpoint || getApiEndpoint(),
          isAdmin: !!parsed.isAdmin,
        })
      } catch {
        localStorage.removeItem('oss_credentials')
      }
    }
  }, [])

  const login = (creds: Credentials) => {
    const normalized = {
      ...creds,
      endpoint: creds.endpoint || getApiEndpoint(),
      publicEndpoint: creds.publicEndpoint || creds.endpoint || getApiEndpoint(),
      isAdmin: !!creds.isAdmin,
    }
    localStorage.setItem('oss_credentials', JSON.stringify(normalized))
    setCredentials(normalized)
  }

  const logout = () => {
    localStorage.removeItem('oss_credentials')
    setCredentials(null)
  }

  return (
    <AuthContext.Provider value={{ credentials, isAuthenticated: !!credentials, isAdmin: !!credentials?.isAdmin, login, logout }}>
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

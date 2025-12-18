import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Credentials {
  accessKey: string
  secretKey: string
  endpoint: string
}

interface AuthContextType {
  credentials: Credentials | null
  isAuthenticated: boolean
  login: (creds: Credentials) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('oss_credentials')
    if (stored) {
      try {
        setCredentials(JSON.parse(stored))
      } catch {
        localStorage.removeItem('oss_credentials')
      }
    }
    setIsLoading(false)
  }, [])

  const login = (creds: Credentials) => {
    localStorage.setItem('oss_credentials', JSON.stringify(creds))
    setCredentials(creds)
  }

  const logout = () => {
    localStorage.removeItem('oss_credentials')
    setCredentials(null)
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-gray-600 dark:text-gray-300">Loading...</div>
    </div>
  }

  return (
    <AuthContext.Provider value={{ credentials, isAuthenticated: !!credentials, login, logout }}>
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
